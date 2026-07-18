#!/usr/bin/env python3
"""Build and validate the static typing-practice corpus using only stdlib."""

from __future__ import annotations

import argparse
import collections
import difflib
import fnmatch
import hashlib
import io
import json
import re
import shutil
import sys
import tarfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Iterable


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[1]
OUTPUT_DIR = ROOT / "public" / "typing-practice"
CACHE_DIR = SCRIPT_DIR / ".cache"
PROSE_MANIFEST = SCRIPT_DIR / "sources.prose.json"
CODE_MANIFEST = SCRIPT_DIR / "sources.code.json"
CHUNK_SIZE = 200
RIGHTS_CUTOFF_YEAR = 1955  # Life + 70 completed before the 2026 corpus release.
CODE_LICENSES = {
    "CC0-1.0",
    "0BSD",
    "Unlicense",
    "MIT",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "Apache-2.0",
}
REQUIRED_CATEGORIES = {
    "prose",
    "python",
    "lua",
    "javascript",
    "html",
    "typescript",
    "sql",
    "react-tsx",
    "css",
    "shell",
}
SECRET_RE = re.compile(
    r"""(?ix)
    -----BEGIN[ ](?:RSA[ ]|EC[ ]|OPENSSH[ ])?PRIVATE[ ]KEY-----
    | \b(?:AKIA|ASIA)[A-Z0-9]{16}\b
    | \bgithub_pat_[A-Za-z0-9_]{20,}\b
    | \bgh[pousr]_[A-Za-z0-9]{20,}\b
    | \b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|
          password|passwd|secret)\b\s*[:=]\s*["'][^"'\r\n]{8,}["']
    """
)
TOKEN_RE = re.compile(r"[A-Za-z0-9_]+|[^\w\s]", re.UNICODE)
GUTENBERG_START_RE = re.compile(
    r"\*{3}\s*START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK.*?\*{3}",
    re.IGNORECASE,
)
GUTENBERG_END_RE = re.compile(
    r"\*{3}\s*END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK.*?\*{3}",
    re.IGNORECASE,
)


class CorpusError(RuntimeError):
    """Raised for invalid source data or generated output."""


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise CorpusError(f"{path} must contain a JSON object")
    return value


def write_json(path: Path, value: Any, *, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    options = {"ensure_ascii": False, "sort_keys": True}
    if pretty:
        text = json.dumps(value, indent=2, **options)
    else:
        text = json.dumps(value, separators=(",", ":"), **options)
    path.write_text(text + "\n", encoding="utf-8")


def fetch(url: str, cache_name: str) -> bytes:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    destination = CACHE_DIR / cache_name
    if destination.exists():
        return destination.read_bytes()

    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "flow-py-v2-typing-corpus/1.0 (static corpus builder)",
            "Accept": "*/*",
        },
    )
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                data = response.read()
            if not data:
                raise CorpusError(f"empty response from {url}")
            temporary = destination.with_suffix(destination.suffix + ".tmp")
            temporary.write_bytes(data)
            temporary.replace(destination)
            return data
        except (OSError, urllib.error.URLError) as error:
            last_error = error
            if attempt < 3:
                time.sleep(2**attempt)
    raise CorpusError(f"failed to fetch {url}: {last_error}")


def stable_digest(*parts: str, size: int = 16) -> str:
    payload = "\0".join(parts).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:size]


def normalized_text(text: str) -> str:
    return " ".join(text.casefold().split())


def simhash(text: str) -> int:
    tokens = TOKEN_RE.findall(normalized_text(text))
    features = set(tokens)
    features.update(" ".join(tokens[index : index + 3]) for index in range(len(tokens) - 2))
    weights = [0] * 64
    for feature in features:
        value = int.from_bytes(
            hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest(), "big"
        )
        for bit in range(64):
            weights[bit] += 1 if value & (1 << bit) else -1
    result = 0
    for bit, weight in enumerate(weights):
        if weight >= 0:
            result |= 1 << bit
    return result


class Deduplicator:
    """Exact and banded-SimHash near-duplicate detector."""

    def __init__(self) -> None:
        self.exact: set[str] = set()
        self.values: list[tuple[str, int]] = []
        self.bands: dict[tuple[int, int, int], list[int]] = collections.defaultdict(list)

    @staticmethod
    def _length_bucket(text: str) -> int:
        return len(text) // 50

    def add(self, text: str) -> bool:
        normal = normalized_text(text)
        if normal in self.exact:
            return False
        fingerprint = simhash(normal)
        length_bucket = self._length_bucket(normal)
        candidates: set[int] = set()
        for band in range(4):
            value = (fingerprint >> (band * 16)) & 0xFFFF
            for nearby_bucket in range(max(0, length_bucket - 1), length_bucket + 2):
                candidates.update(self.bands[(band, value, nearby_bucket)])

        for candidate_index in candidates:
            candidate, candidate_hash = self.values[candidate_index]
            if min(len(normal), len(candidate)) / max(len(normal), len(candidate)) < 0.82:
                continue
            if (fingerprint ^ candidate_hash).bit_count() > 12:
                continue
            if difflib.SequenceMatcher(None, normal, candidate, autojunk=False).ratio() >= 0.94:
                return False

        index = len(self.values)
        self.values.append((normal, fingerprint))
        self.exact.add(normal)
        for band in range(4):
            value = (fingerprint >> (band * 16)) & 0xFFFF
            self.bands[(band, value, length_bucket)].append(index)
        return True


def strip_gutenberg(text: str, source_id: str) -> str:
    start = GUTENBERG_START_RE.search(text)
    if not start:
        raise CorpusError(f"{source_id}: Project Gutenberg start marker not found")
    end = GUTENBERG_END_RE.search(text, start.end())
    if not end:
        raise CorpusError(f"{source_id}: Project Gutenberg end marker not found")
    body = text[start.end() : end.start()]
    body = re.sub(r"\r\n?", "\n", body)
    body = re.sub(r"(?m)^\s*\[Illustration(?::[^\]]*)?\]\s*$", "", body)
    body = re.sub(r"(?m)^\s*\[(?:Footnote|Transcriber[’']s Note).*?\]\s*$", "", body)
    return body.strip()


def prose_paragraphs(body: str) -> Iterable[str]:
    for raw in re.split(r"\n\s*\n", body):
        paragraph = " ".join(line.strip() for line in raw.splitlines() if line.strip())
        paragraph = re.sub(r"\s+", " ", paragraph).strip()
        if not 80 <= len(paragraph) <= 1400:
            continue
        letters = sum(character.isalpha() for character in paragraph)
        if letters / len(paragraph) < 0.62:
            continue
        if paragraph.isupper() or re.match(r"^(?:CHAPTER|BOOK|PART)\b", paragraph, re.I):
            continue
        if "www.gutenberg.org" in paragraph.casefold():
            continue
        yield paragraph


def prose_candidates(body: str) -> dict[str, list[str]]:
    candidates: dict[str, list[str]] = {"sentence": [], "paragraph": []}
    sentence_split = re.compile(r'(?<=[.!?])(?:["”’])?\s+(?=[A-Z“‘"])')
    for paragraph in prose_paragraphs(body):
        sentences = sentence_split.split(paragraph)
        for sentence in sentences:
            sentence = sentence.strip()
            if 60 <= len(sentence) <= 460 and sentence[-1:] in ".!?\"”":
                candidates["sentence"].append(sentence)
        if 180 <= len(paragraph) <= 900 and 2 <= len(sentences) <= 8:
            candidates["paragraph"].append(paragraph)
    return candidates


def prose_difficulty(text: str, unit: str) -> str:
    words = re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ']+", text)
    average_word = sum(map(len, words)) / max(1, len(words))
    score = len(text) / 180 + average_word / 3 + len(re.findall(r"[;:—()]", text)) / 3
    if unit == "paragraph":
        score += 1
    return "easy" if score < 3.3 else "hard" if score >= 5.2 else "medium"


def build_prose(manifest: dict[str, Any], deduper: Deduplicator) -> list[dict[str, Any]]:
    target = int(manifest["target_items_per_source"])
    items: list[dict[str, Any]] = []
    for source in manifest["sources"]:
        death_year = int(source["author_death_year"])
        if death_year > RIGHTS_CUTOFF_YEAR:
            raise CorpusError(
                f"{source['id']}: author death year {death_year} is not life+70-safe for 2026"
            )
        raw = fetch(source["url"], f"gutenberg-{source['gutenberg_id']}.txt")
        text = raw.decode("utf-8-sig", errors="replace")
        candidates = prose_candidates(strip_gutenberg(text, source["id"]))
        quotas = {"sentence": target * 3 // 4, "paragraph": target - target * 3 // 4}
        selected = 0
        for unit in ("sentence", "paragraph"):
            ranked = sorted(
                candidates[unit],
                key=lambda value: stable_digest(source["id"], unit, value, size=64),
            )
            for value in ranked:
                if selected >= target or quotas[unit] <= 0:
                    break
                if not deduper.add(value):
                    continue
                identifier = "prose-" + stable_digest(source["id"], unit, value)
                items.append(
                    {
                        "id": identifier,
                        "category": "prose",
                        "title": source["title"],
                        "text": value,
                        "difficulty": prose_difficulty(value, unit),
                        "source": {
                            "name": "Project Gutenberg",
                            "ebook_id": source["gutenberg_id"],
                            "url": source["url"],
                        },
                        "license": source["license"],
                        "author": source["author"],
                        "unit": unit,
                    }
                )
                quotas[unit] -= 1
                selected += 1
        if selected < target:
            print(
                f"warning: {source['title']} yielded {selected}/{target} quality units",
                file=sys.stderr,
            )
    return items


def archive_url(source: dict[str, Any]) -> str:
    return (
        f"https://codeload.github.com/{source['repository']}/tar.gz/"
        f"{source['commit']}"
    )


def archive_cache_name(source: dict[str, Any]) -> str:
    repository = source["repository"].replace("/", "-")
    return f"github-{repository}-{source['commit']}.tar.gz"


def matches_source(path: str, source: dict[str, Any]) -> bool:
    if any(excluded.casefold() in path.casefold() for excluded in source["exclude"]):
        return False
    return any(fnmatch.fnmatchcase(path, pattern) for pattern in source["include"])


def source_files(source: dict[str, Any]) -> Iterable[tuple[str, str]]:
    data = fetch(archive_url(source), archive_cache_name(source))
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        members: list[tuple[str, tarfile.TarInfo]] = []
        for member in archive.getmembers():
            if not member.isfile() or "/" not in member.name:
                continue
            relative = member.name.split("/", 1)[1]
            if member.size > 500_000 or not matches_source(relative, source):
                continue
            members.append((relative, member))
        for relative, member in sorted(members):
            extracted = archive.extractfile(member)
            if extracted is None:
                continue
            raw = extracted.read()
            if b"\0" in raw:
                continue
            yield relative, raw.decode("utf-8-sig", errors="replace")


def meaningful_code(lines: list[str]) -> bool:
    content = [
        line.strip()
        for line in lines
        if line.strip()
        and not re.match(r"^(?://|#|--|/\*|\*|<!--|-->)", line.strip())
    ]
    if len(content) < 2:
        return False
    text = "\n".join(lines)
    if len(text) < 80 or len(text) > 5000 or SECRET_RE.search(text):
        return False
    if re.search(r"(?i)\b(?:copyright|all rights reserved|licensed under)\b", text):
        return False
    return sum(character.isalnum() for character in text) / len(text) >= 0.18


def clean_code_unit(
    lines: list[str], start: int, end: int
) -> tuple[int, str] | None:
    while start < end and not lines[start].strip():
        start += 1
    while end > start and not lines[end - 1].strip():
        end -= 1
    unit = lines[start:end]
    if not 3 <= len(unit) <= 40 or not meaningful_code(unit):
        return None
    return start + 1, "\n".join(unit)


def brace_end(lines: list[str], start: int) -> int | None:
    depth = 0
    opened = False
    for index in range(start, min(len(lines), start + 80)):
        line = re.sub(r"""(["'`])(?:\\.|(?!\1).)*\1""", "", lines[index])
        line = re.sub(r"//.*|/\*.*?\*/", "", line)
        depth += line.count("{") - line.count("}")
        opened = opened or "{" in line
        if opened and depth == 0:
            return index + 1
    return None


def python_units(lines: list[str]) -> Iterable[tuple[int, str]]:
    declaration = re.compile(r"^(\s*)(?:async\s+def|def|class)\s+\w+")
    starts = [
        (index, len(match.group(1)))
        for index, line in enumerate(lines)
        if (match := declaration.match(line))
    ]
    for position, (start, indent) in enumerate(starts):
        end = len(lines)
        for next_start, next_indent in starts[position + 1 :]:
            if next_indent <= indent:
                end = next_start
                break
        unit = clean_code_unit(lines, start, end)
        if unit:
            yield unit


def brace_units(lines: list[str], category: str) -> Iterable[tuple[int, str]]:
    starts = {
        "javascript": re.compile(
            r"^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?"
            r"(?:function|class)\b|^\s*(?:export\s+)?(?:const|let|var)\s+\w+.*(?:=>|function\b)"
        ),
        "typescript": re.compile(
            r"^\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:async\s+)?"
            r"(?:function|class|interface|type|enum|namespace)\b|"
            r"^\s*(?:export\s+)?(?:const|let)\s+\w+.*(?:=>|function\b)"
        ),
        "react-tsx": re.compile(
            r"^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class)\b|"
            r"^\s*(?:export\s+)?(?:const|let)\s+[A-Z]\w*.*(?:=>|function\b)"
        ),
        "shell": re.compile(
            r"^\s*(?:function\s+[\w:-]+|[\w:-]+\s*\(\s*\))\s*\{"
        ),
        "css": re.compile(r"^\s*(?:@[\w-]+[^{]*|[^@/][^{]*)\{\s*$"),
    }[category]
    for start, line in enumerate(lines):
        if not starts.search(line):
            continue
        end = brace_end(lines, start)
        if end is None:
            continue
        unit = clean_code_unit(lines, start, end)
        if unit:
            yield unit


def lua_units(lines: list[str]) -> Iterable[tuple[int, str]]:
    function_start = re.compile(
        r"^\s*(?:(?:local\s+)?function\s+[\w.:]+|(?:local\s+)?\w+\s*=\s*function)\b"
    )
    opener = re.compile(
        r"\bfunction\b|^\s*(?:if\b.*\bthen|for\b.*\bdo|while\b.*\bdo|repeat\b|do)\s*$"
    )
    closer = re.compile(r"^\s*(?:end\b|until\b)")
    for start, line in enumerate(lines):
        if not function_start.search(line):
            continue
        depth = 0
        end = None
        for index in range(start, min(len(lines), start + 80)):
            stripped = re.sub(r"--.*", "", lines[index])
            depth += len(opener.findall(stripped))
            if closer.search(stripped):
                depth -= 1
            if depth == 0:
                end = index + 1
                break
        if end is not None:
            unit = clean_code_unit(lines, start, end)
            if unit:
                yield unit


def sql_units(lines: list[str]) -> Iterable[tuple[int, str]]:
    start_re = re.compile(
        r"^\s*(?:with|select|insert|update|delete|create|alter|drop|merge)\b",
        re.IGNORECASE,
    )
    start = None
    for index, line in enumerate(lines):
        if start is None and start_re.search(line):
            start = index
        if start is not None and line.rstrip().endswith(";"):
            unit = clean_code_unit(lines, start, index + 1)
            if unit:
                yield unit
            start = None


HTML_VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}


def html_units(lines: list[str]) -> Iterable[tuple[int, str]]:
    tag_re = re.compile(r"<\s*(/?)\s*([a-z][\w-]*)\b[^>]*?(/?)>", re.IGNORECASE)
    for start, line in enumerate(lines):
        first = tag_re.search(line)
        if not first or first.group(1) or first.group(2).lower() in HTML_VOID_TAGS:
            continue
        root = first.group(2).lower()
        depth = 0
        for index in range(start, min(len(lines), start + 40)):
            for closing, tag, self_closing in tag_re.findall(lines[index]):
                tag = tag.lower()
                if tag != root or tag in HTML_VOID_TAGS or self_closing:
                    continue
                depth += -1 if closing else 1
            if depth == 0:
                unit = clean_code_unit(lines, start, index + 1)
                if unit:
                    yield unit
                break


def code_blocks(text: str, category: str) -> Iterable[tuple[int, str]]:
    text = re.sub(r"\r\n?", "\n", text).replace("\t", "    ")
    lines = [line.rstrip() for line in text.splitlines()]
    extractors = {
        "python": lambda: python_units(lines),
        "lua": lambda: lua_units(lines),
        "javascript": lambda: brace_units(lines, category),
        "typescript": lambda: brace_units(lines, category),
        "react-tsx": lambda: brace_units(lines, category),
        "css": lambda: brace_units(lines, category),
        "shell": lambda: brace_units(lines, category),
        "sql": lambda: sql_units(lines),
        "html": lambda: html_units(lines),
    }
    yield from extractors[category]()


def code_difficulty(text: str) -> str:
    lines = text.splitlines()
    nesting = max((len(line) - len(line.lstrip())) // 4 for line in lines)
    symbols = len(re.findall(r"[{}()[\]<>|&?:]", text))
    score = len(lines) / 8 + nesting / 2 + symbols / 20
    return "easy" if score < 2.5 else "hard" if score >= 5 else "medium"


def build_code(manifest: dict[str, Any], deduper: Deduplicator) -> list[dict[str, Any]]:
    target = int(manifest["target_per_category"])
    items: list[dict[str, Any]] = []
    category_counts: collections.Counter[str] = collections.Counter()
    for source in manifest["sources"]:
        if source["license"] not in CODE_LICENSES:
            raise CorpusError(
                f"{source['repository']}: disallowed license {source['license']}"
            )
        category = source["category"]
        if category_counts[category] >= target:
            continue
        candidates: list[tuple[str, int, str]] = []
        for path, text in source_files(source):
            candidates.extend(
                (path, line, snippet)
                for line, snippet in code_blocks(text, source["category"])
            )
        candidates.sort(
            key=lambda value: stable_digest(
                source["category"], value[0], str(value[1]), value[2], size=64
            )
        )
        for path, line, snippet in candidates:
            if category_counts[category] >= target:
                break
            if not deduper.add(snippet):
                continue
            source_url = (
                f"https://github.com/{source['repository']}/blob/{source['commit']}/"
                f"{urllib.parse.quote(path, safe='/')}#L{line}"
            )
            identifier = "code-" + stable_digest(
                source["category"], source["repository"], source["commit"], path, snippet
            )
            items.append(
                {
                    "id": identifier,
                    "category": source["category"],
                    "title": f"{source['repository']}: {path}",
                    "text": snippet,
                    "difficulty": code_difficulty(snippet),
                    "source": {
                        "repository": source["repository"],
                        "commit": source["commit"],
                        "path": path,
                        "url": source_url,
                    },
                    "license": source["license"],
                }
            )
            category_counts[category] += 1
    for category in sorted({source["category"] for source in manifest["sources"]}):
        if category_counts[category] < target:
            print(
                f"warning: {category} yielded {category_counts[category]}/{target} "
                "quality snippets",
                file=sys.stderr,
            )
    return items


def notices_text(
    prose_manifest: dict[str, Any], code_manifest: dict[str, Any]
) -> str:
    lines = [
        "# Third-Party Notices",
        "",
        "This corpus contains excerpts only; complete upstream works and repositories",
        "are not redistributed. Each generated item retains its source URL and license.",
        "",
        "## Public-domain prose",
        "",
        "Project Gutenberg boilerplate, trademark text, and donation notices are removed",
        "from generated excerpts. “Project Gutenberg” is a trademark; no endorsement is",
        "implied. Public-domain status can vary by jurisdiction.",
        "",
    ]
    for source in prose_manifest["sources"]:
        lines.extend(
            [
                f"- **{source['title']}**, {source['author']} "
                f"(d. {source['author_death_year']})",
                f"  - Text: {source['url']}",
                f"  - Status: {source['license']}",
                f"  - Gutenberg terms: {source['rights_url']}",
            ]
        )
    lines.extend(["", "## Code", ""])
    for source in code_manifest["sources"]:
        lines.extend(
            [
                f"- **{source['repository']}** ({source['category']})",
                f"  - Commit: `{source['commit']}`",
                f"  - Repository: https://github.com/{source['repository']}",
                f"  - License: {source['license']} ({source['license_url']})",
            ]
        )
    lines.extend(
        [
            "",
            "See each corpus item's `source.path`, `source.commit`, and `source.url` for",
            "file-level provenance. License texts remain available at the pinned URLs above.",
            "",
        ]
    )
    return "\n".join(lines)


def emit(
    items: list[dict[str, Any]],
    prose_manifest: dict[str, Any],
    code_manifest: dict[str, Any],
) -> None:
    chunks_dir = OUTPUT_DIR / "chunks"
    if chunks_dir.exists():
        shutil.rmtree(chunks_dir)
    chunks_dir.mkdir(parents=True, exist_ok=True)

    categories: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
    for item in items:
        categories[item["category"]].append(item)

    index_categories: dict[str, Any] = {}
    for category in sorted(categories):
        category_items = sorted(categories[category], key=lambda item: item["id"])
        chunk_paths: list[str] = []
        for number, offset in enumerate(range(0, len(category_items), CHUNK_SIZE), 1):
            relative = f"chunks/{category}-{number:03d}.json"
            write_json(
                OUTPUT_DIR / relative,
                {"category": category, "items": category_items[offset : offset + CHUNK_SIZE]},
            )
            chunk_paths.append(relative)
        index_categories[category] = {
            "count": len(category_items),
            "chunks": chunk_paths,
        }

    index = {
        "schema_version": 1,
        "chunk_size": CHUNK_SIZE,
        "total": len(items),
        "categories": index_categories,
    }
    write_json(OUTPUT_DIR / "index.json", index, pretty=True)
    (OUTPUT_DIR / "THIRD_PARTY_NOTICES.md").write_text(
        notices_text(prose_manifest, code_manifest), encoding="utf-8"
    )


def validate_item(item: dict[str, Any], expected_category: str) -> None:
    required = {"id", "category", "title", "text", "difficulty", "source", "license"}
    missing = required - item.keys()
    if missing:
        raise CorpusError(f"{item.get('id', '<unknown>')}: missing {sorted(missing)}")
    if item["category"] != expected_category:
        raise CorpusError(f"{item['id']}: category/chunk mismatch")
    if item["difficulty"] not in {"easy", "medium", "hard"}:
        raise CorpusError(f"{item['id']}: invalid difficulty")
    if not isinstance(item["source"], dict) or not isinstance(item["text"], str):
        raise CorpusError(f"{item['id']}: invalid source or text type")
    if SECRET_RE.search(item["text"]):
        raise CorpusError(f"{item['id']}: possible secret")

    if expected_category == "prose":
        if item["license"] != "Public Domain":
            raise CorpusError(f"{item['id']}: prose is not public domain")
        if item.get("unit") not in {"sentence", "paragraph"} or not item.get("author"):
            raise CorpusError(f"{item['id']}: invalid prose metadata")
        if not 60 <= len(item["text"]) <= 900:
            raise CorpusError(f"{item['id']}: prose length out of range")
    else:
        if item["license"] not in CODE_LICENSES:
            raise CorpusError(f"{item['id']}: disallowed code license")
        line_count = len(item["text"].splitlines())
        if not 3 <= line_count <= 40:
            raise CorpusError(f"{item['id']}: code line count {line_count}")
        complete_units = {
            normalized_text(snippet)
            for _, snippet in code_blocks(item["text"], expected_category)
        }
        if normalized_text(item["text"]) not in complete_units:
            raise CorpusError(f"{item['id']}: incomplete structural code unit")
        source_keys = {"repository", "commit", "path", "url"}
        if source_keys - item["source"].keys():
            raise CorpusError(f"{item['id']}: incomplete code provenance")
        if not re.fullmatch(r"[0-9a-f]{40}", item["source"]["commit"]):
            raise CorpusError(f"{item['id']}: source commit is not pinned")


def validate(output_dir: Path = OUTPUT_DIR) -> dict[str, Any]:
    prose_manifest = load_json(PROSE_MANIFEST)
    code_manifest = load_json(CODE_MANIFEST)
    index = load_json(output_dir / "index.json")
    if index.get("schema_version") != 1 or index.get("chunk_size") != CHUNK_SIZE:
        raise CorpusError("invalid index schema or chunk size")
    categories = set(index.get("categories", {}))
    if categories != REQUIRED_CATEGORIES:
        raise CorpusError(
            f"category mismatch: expected {sorted(REQUIRED_CATEGORIES)}, got {sorted(categories)}"
        )

    ids: set[str] = set()
    deduper = Deduplicator()
    counts: collections.Counter[str] = collections.Counter()
    total_size = 0
    for category in sorted(categories):
        category_info = index["categories"][category]
        category_count = 0
        for relative in category_info["chunks"]:
            path = output_dir / relative
            if path.parent != output_dir / "chunks" or not path.exists():
                raise CorpusError(f"invalid or missing chunk path: {relative}")
            total_size += path.stat().st_size
            chunk = load_json(path)
            if chunk.get("category") != category or not isinstance(chunk.get("items"), list):
                raise CorpusError(f"{relative}: invalid chunk schema")
            if not 1 <= len(chunk["items"]) <= CHUNK_SIZE:
                raise CorpusError(f"{relative}: invalid chunk item count")
            for item in chunk["items"]:
                validate_item(item, category)
                if item["id"] in ids:
                    raise CorpusError(f"duplicate id: {item['id']}")
                ids.add(item["id"])
                if not deduper.add(item["text"]):
                    raise CorpusError(f"exact or near duplicate text: {item['id']}")
                category_count += 1
        if category_count != category_info["count"]:
            raise CorpusError(f"{category}: index count mismatch")
        counts[category] = category_count

    if sum(counts.values()) != index["total"]:
        raise CorpusError("index total mismatch")
    if counts["prose"] < int(prose_manifest["minimum_items"]):
        raise CorpusError(f"prose minimum not met: {counts['prose']}")
    code_counts = [counts[category] for category in REQUIRED_CATEGORIES - {"prose"}]
    minimum_per_category = int(code_manifest["minimum_per_category"])
    if any(count < minimum_per_category for count in code_counts):
        raise CorpusError(f"code category minimum not met: {dict(counts)}")
    if sum(code_counts) < int(code_manifest["minimum_total"]):
        raise CorpusError(f"code total minimum not met: {sum(code_counts)}")
    notices = output_dir / "THIRD_PARTY_NOTICES.md"
    if not notices.exists():
        raise CorpusError("THIRD_PARTY_NOTICES.md is missing")
    total_size += (output_dir / "index.json").stat().st_size + notices.stat().st_size
    return {
        "status": "ok",
        "total": sum(counts.values()),
        "counts": dict(sorted(counts.items())),
        "bytes": total_size,
    }


def build() -> dict[str, Any]:
    prose_manifest = load_json(PROSE_MANIFEST)
    code_manifest = load_json(CODE_MANIFEST)
    deduper = Deduplicator()
    prose_items = build_prose(prose_manifest, deduper)
    code_items = build_code(code_manifest, deduper)
    emit(prose_items + code_items, prose_manifest, code_manifest)
    return validate()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command",
        choices=("build", "validate"),
        nargs="?",
        default="build",
        help="fetch/build the corpus or validate existing output",
    )
    return parser.parse_args()


def main() -> int:
    arguments = parse_args()
    try:
        result = build() if arguments.command == "build" else validate()
    except (CorpusError, OSError, json.JSONDecodeError, tarfile.TarError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
