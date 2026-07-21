#!/usr/bin/env python3
"""Offline ETL: wordfreq + WordNet + Wiktionary en→ko → public/typing-ai-lab/*.json

Usage:
  pip install -r scripts/typing-ai-lab/requirements.txt
  python scripts/typing-ai-lab/build_lexicon.py
"""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "typing-ai-lab" / "raw"
OUT_DIR = ROOT / "public" / "typing-ai-lab"
CURATED_PATH = Path(__file__).resolve().parent / "curated_seed.json"
COMMON_VERBS_PATH = Path(__file__).resolve().parent / "common_verbs.json"
ENKO_URL = (
    "https://raw.githubusercontent.com/open-dsl-dict/wiktionary-dict/"
    "master/src/en-ko-enwiktionary.txt"
)
ENKO_PATH = RAW_DIR / "en-ko-enwiktionary.txt"

MIN_WORDS = 5000
TARGET_WORDS = 7500
MIN_VERBS = 1400
MIN_VERBS_PER_BAND = 200
MIN_CURATED_FRAMES = 40
WORD_RE = re.compile(r"^[a-z]+(?:-[a-z]+)?$")
MASS_HINTS = {
    "water", "milk", "rice", "bread", "soup", "cheese", "meat", "coffee", "tea",
    "juice", "butter", "honey", "yogurt", "air", "sand", "soil", "rain", "snow",
    "wind", "grass", "knowledge", "research", "homework", "data", "code",
    "software", "hardware", "science", "math", "history", "information", "music",
    "money", "furniture", "equipment", "advice", "news", "luggage", "traffic",
}
PROFANITY = {
    "ass", "shit", "fuck", "damn", "hell", "crap", "piss", "dick", "cock", "pussy",
    "bitch", "bastard", "slut", "whore", "nigger", "faggot", "cunt", "porn", "sex",
    "nude", "naked", "kill", "murder", "rape", "drug", "cocaine", "heroin", "weed", "fart",
}
SKIP_SURFACES = {"so", "out", "please", "well"}
SUPPLEMENTAL_VERB_SKIP = {
    # WordNet has obscure verb senses, but the Korean gloss is adjectival or misleading.
    "benefit", "bitter", "black", "blue", "bored", "boring", "celebrated",
    "charming", "complicated", "cool", "dirty", "excited", "free", "full",
    "green", "interesting", "low", "narrow", "near", "pale", "parallel",
    "short", "steep", "thin", "true", "uniform", "warm", "white",
    # Known bad/obsolete Wiktionary translations.
    "file", "ground", "lost", "right", "weather",
}
POS_MAP = {"n": "noun", "v": "verb", "a": "adj", "adj": "adj", "s": "adj"}
CATEGORY_BY_POS = {
    "noun": ["object"],
    "verb": ["action"],
    "adj": ["object"],
}
SEMANTIC_BY_POS = {
    "noun": ["artifact"],
    "verb": ["action"],
    "adj": ["artifact"],
}


def die(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def ensure_deps():
    try:
        import nltk  # noqa: F401
        import wordfreq  # noqa: F401
    except ImportError as e:
        die(f"missing dependency: {e}. Run: pip install -r scripts/typing-ai-lab/requirements.txt")


def download_enko() -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if ENKO_PATH.exists() and ENKO_PATH.stat().st_size > 100_000:
        return ENKO_PATH
    print(f"Downloading EN→KO dictionary → {ENKO_PATH}")
    urllib.request.urlretrieve(ENKO_URL, ENKO_PATH)
    return ENKO_PATH


ENKO_STOP = {
    "a", "an", "the", "of", "to", "or", "and", "for", "in", "on", "by", "with", "as",
    "be", "is", "are", "was", "were", "being", "been", "that", "this", "those", "these",
    "which", "who", "whom", "whose", "about", "from", "into", "over", "after", "before",
    "between", "through", "during", "without", "within", "something", "someone", "one",
}
BAD_GLOSS_RE = re.compile(
    r"(\.\.\.|…|친한 사이다|코카인|헤로인|대마|개같은|씨발|병신|좆|자살|살인|포르노)"
)
HONORIFIC_GLOSS = {"드시다", "잡수시다", "주시다", "계시다", "말씀하다"}
NOUN_VERB_GLOSS = {
    "해야 하다", "인정하다", "섞다", "주목하다", "우러르다", "축하합니다",
    "겹치다", "멀티플렉싱하다", "한가로이 걷다", "바뀌다",
}
# Prefer these when tied (learner-friendly primary senses)
GLOSS_PREF = {
    ("know", "verb"): "알다",
    ("time", "noun"): "시간",
    ("day", "noun"): "하루",
    ("want", "verb"): "원하다",
    ("name", "noun"): "이름",
    ("show", "verb"): "보이다",
    ("person", "noun"): "사람",
    ("change", "noun"): "변화",
    ("watch", "verb"): "보다",
    ("class", "noun"): "수업",
    ("right", "noun"): "오른쪽",
    ("orange", "noun"): "오렌지",
    ("green", "adj"): "초록색",
    ("cold", "adj"): "춥다",
    ("fire", "noun"): "불",
    ("family", "noun"): "가족",
    ("go", "verb"): "가다",
    ("good", "adj"): "좋은",
    ("free", "adj"): "무료",
    ("full", "adj"): "가득 찬",
    ("long", "adj"): "긴",
    ("real", "adj"): "진짜",
    ("white", "adj"): "흰색",
    ("young", "adj"): "젊은",
    ("final", "adj"): "마지막",
    ("general", "adj"): "일반적인",
    ("able", "adj"): "할 수 있는",
    ("accept", "verb"): "받아들이다",
    ("american", "adj"): "미국의",
    ("apply", "verb"): "신청하다",
    ("ask", "verb"): "묻다",
    ("available", "adj"): "이용 가능한",
    ("care", "verb"): "돌보다",
    ("case", "noun"): "경우",
    ("common", "adj"): "흔한",
    ("control", "noun"): "통제",
    ("early", "adj"): "이른",
    ("example", "noun"): "예시",
    ("fine", "adj"): "괜찮은",
    ("first", "adj"): "첫 번째",
    ("force", "noun"): "힘",
    ("form", "noun"): "형태",
    ("former", "adj"): "이전의",
    ("game", "noun"): "게임",
    ("great", "adj"): "훌륭한",
    ("heart", "noun"): "심장",
    ("hope", "verb"): "희망하다",
    ("human", "noun"): "인간",
    ("important", "adj"): "중요한",
    ("left", "adj"): "왼쪽",
    ("list", "noun"): "목록",
    ("local", "adj"): "지역의",
    ("look", "verb"): "보다",
    ("lost", "adj"): "잃어버린",
    ("low", "adj"): "낮은",
    ("may", "verb"): "할 수 있다",
    ("men", "noun"): "남자들",
    ("military", "adj"): "군사의",
    ("one", "adj"): "하나",
    ("party", "noun"): "파티",
    ("president", "noun"): "대통령",
    ("price", "noun"): "가격",
    ("project", "noun"): "프로젝트",
    ("public", "adj"): "공공의",
    ("same", "adj"): "같은",
    ("second", "adj"): "두 번째",
    ("support", "noun"): "지원",
    ("take", "verb"): "가져가다",
    ("age", "verb"): "나이를 먹다",
    ("concern", "verb"): "관련되다",
    ("light", "verb"): "불을 켜다",
    ("marry", "verb"): "결혼하다",
    ("motivate", "verb"): "동기를 부여하다",
}
POS_PREF = {
    "change": "noun",
    "final": "adj",
    "fine": "adj",
    "may": "verb",
}

# WordNet/Wiktionary가 생물명을 잘못 줄 때 강제 교정
BIO_GLOSS = {
    "amberjack": "잿방어",
    "tuna": "참치",
    "seal": "물범",
    "coral": "산호",
    "cedar": "삼나무",
    "pine": "소나무",
    "oak": "참나무",
    "lily": "백합",
    "violet": "제비꽃",
    "bass": "농어",
    "cod": "대구",
    "salmon": "연어",
    "mackerel": "고등어",
    "trout": "송어",
    "eel": "장어",
    "shark": "상어",
    "whale": "고래",
    "dolphin": "돌고래",
    "otter": "수달",
    "lobster": "바닷가재",
    "shrimp": "새우",
    "crab": "게",
    "octopus": "문어",
    "squid": "오징어",
    "jellyfish": "해파리",
    "oyster": "굴",
    "clam": "조개",
    "snail": "달팽이",
    "butterfly": "나비",
    "mosquito": "모기",
    "sparrow": "참새",
    "eagle": "독수리",
    "hawk": "매",
    "owl": "올빼미",
    "crow": "까마귀",
    "frog": "개구리",
    "toad": "두꺼비",
    "snake": "뱀",
    "lizard": "도마뱀",
    "turtle": "거북",
    "scorpion": "전갈",
    "spider": "거미",
    "wasp": "말벌",
    "moth": "나방",
    "worm": "벌레",
    "algae": "조류",
    "moss": "이끼",
    "fern": "양치식물",
    "bamboo": "대나무",
    "willow": "버드나무",
    "birch": "자작나무",
    "maple": "단풍나무",
    "beech": "너도밤나무",
    "elm": "느릅나무",
    "fir": "전나무",
    "spruce": "가문비나무",
    "cactus": "선인장",
    "orchid": "난초",
    "tulip": "튤립",
    "rose": "장미",
    "daisy": "데이지",
    "almond": "아몬드",
    "chestnut": "밤",
    "walnut": "호두",
}

BIO_HYPERNYMS = {
    "animal", "plant", "fish", "bird", "mammal",
    "insect", "tree", "flower", "alga", "fungus", "reptile", "amphibian",
    "crustacean", "mollusk", "chordate", "vertebrate", "invertebrate",
    "aquatic_vertebrate", "food_fish", "game_fish", "woody_plant", "vascular_plant",
}
PERSON_HYPERNYMS = {
    "person", "human", "adult", "worker", "serviceman", "contestant", "leader",
}
NON_BIO_GLOSS = {
    "도장", "산호색", "보라색", "밤색", "부리", "부채선인장", "시다", "솔",
    "참나무속", "운모", "레알", "아웃", "빠구리",
}
BIO_DEF_HINTS = {
    "fish", "bird", "mammal", "insect", "animal", "plant", "tree", "flower",
    "alga", "fungus", "reptile", "amphibian", "crustacean", "mollusk", "shark",
    "whale", "snake", "frog", "crab", "shrimp", "butterfly", "mosquito", "spider",
    "species", "genus", "pinniped", "cetacean", "carangid", "scombrid",
}


def is_blocked_surface(surface: str) -> bool:
    return (
        surface in PROFANITY
        or surface in SKIP_SURFACES
        or any(term in surface for term in ("fuck", "shit", "cunt", "porn"))
    )


def _en_tokens(text: str | None) -> set[str]:
    if not text:
        return set()
    return {
        t
        for t in re.findall(r"[a-z]+", text.lower())
        if t not in ENKO_STOP and len(t) > 2
    }


def _clean_ko_glosses(right: str) -> list[str]:
    meaning = right.strip()
    if not meaning or meaning.startswith("SEE:"):
        return []
    meaning = re.sub(r"/[^/]*/", "", meaning)
    meaning = re.sub(r"\([^)]*\)", "", meaning)
    meaning = re.sub(r"\[[^\]]*\]", "", meaning)
    out: list[str] = []
    for part in re.split(r"[,;|]", meaning):
        g = re.sub(r"\s+", " ", part).strip(" ,.-")
        g = re.sub(r"[A-Za-z0-9_^~./]+", "", g).strip()
        g = re.sub(r"[^가-힣\s]", "", g)
        g = re.sub(r"\s+", " ", g).strip()
        if g and re.search(r"[가-힣]", g):
            out.append(g[:20])
            # 형용사 관형형 "초록의" → 대표형 "초록"도 후보에 추가
            if g.endswith("의") and len(g) > 2:
                stem = g[:-1]
                if stem and re.fullmatch(r"[가-힣]+", stem):
                    out.append(stem)
    return out


def is_bad_gloss(g: str) -> bool:
    if BAD_GLOSS_RE.search(g):
        return True
    if g in HONORIFIC_GLOSS:
        return True
    if re.search(r"[A-Za-z]", g):
        return True
    if len(g) < 1 or len(g) > 16:
        return True
    if g.count(" ") >= 3:
        return True
    if "놈" in g or "년" in g:
        return True
    if g.startswith(("^", "~", "-", "…")):
        return True
    return False


def gloss_quality(g: str, pos: str) -> float:
    score = 0.0
    if re.fullmatch(r"[가-힣]+", g):
        score += 3.0
    if " " not in g:
        score += 2.0
    if 1 <= len(g) <= 6:
        score += 2.0
    elif len(g) <= 8:
        score += 1.0
    else:
        score -= 1.0
    if pos == "verb":
        if g.endswith("다"):
            score += 1.5
        if g in {"빌다"}:  # often "pray", weak for primary desire sense
            score -= 2.0
    if pos == "noun":
        if g.endswith(("다", "한", "의", "에")):
            score -= 2.0
        else:
            score += 1.0
        if g in {"인칭", "거스름돈", "잔돈", "주간"}:
            score -= 2.5
    if pos == "adj":
        if g.endswith(("다", "한", "운", "은", "인")):
            score += 1.5
        if g.endswith("의"):
            score -= 0.5
        # prefer 초록 over 녹색의
        if g in {"초록", "녹색", "추운", "차가운", "찬"}:
            score += 1.0
    return score


def acceptable_gloss_for_pos(g: str, pos: str) -> bool:
    if pos == "verb":
        return g.endswith("다")
    if pos == "noun":
        if g in NOUN_VERB_GLOSS:
            return False
        if g.endswith(("하다", "되다", "시키다", "합니다", "입니다")):
            return False
    return True


def _synset_hypernym_names(synset) -> set[str]:
    names: set[str] = set()
    for path in synset.hypernym_paths():
        for node in path:
            names.update(node.lemma_names())
    return names


def is_organism_synset(synset) -> bool:
    names = _synset_hypernym_names(synset)
    if names & PERSON_HYPERNYMS and not (names & {"animal", "fish", "bird", "mammal", "insect", "plant", "tree", "flower"}):
        return False
    return bool(names & BIO_HYPERNYMS)


def primary_organism_synset(surface: str, wn):
    """Prefer organism sense by usage; animal/fish beat plant when both exist."""
    ranked = []
    for idx, synset in enumerate(wn.synsets(surface, pos="n")):
        if not is_organism_synset(synset):
            continue
        usage = 0
        for lemma in synset.lemmas():
            if lemma.name().lower().replace("_", "-") == surface:
                usage += lemma.count()
        hyper = _synset_hypernym_names(synset)
        # Prefer animals/fish over plants for ambiguous food names like tuna
        kingdom = 2 if hyper & {"animal", "fish", "bird", "mammal", "insect", "reptile", "amphibian", "crustacean", "mollusk"} else 1
        ranked.append((kingdom, usage, -idx, synset))
    if not ranked:
        return None
    ranked.sort(reverse=True)
    return ranked[0][3]


def looks_like_organism_gloss(g: str) -> bool:
    if g in NON_BIO_GLOSS:
        return False
    if g.endswith(("색", "색의")):
        return False
    if g in {"도장", "인장", "서명", "우표"}:
        return False
    return True


def load_enko(path: Path) -> dict[str, list[tuple[str, str | None, list[str]]]]:
    """word -> [(pos, english_sense_def, good_ko_glosses), ...] in file order."""
    out: dict[str, list[tuple[str, str | None, list[str]]]] = defaultdict(list)
    pos_re = re.compile(r"\{([^}]+)\}")
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "::" not in line:
            continue
        left, right = line.split("::", 1)
        glosses = [g for g in _clean_ko_glosses(right) if not is_bad_gloss(g)]
        if not glosses:
            continue
        m = pos_re.search(left)
        pos = POS_MAP.get(m.group(1).lower()) if m else None
        if pos is None:
            continue
        en_m = re.search(r"\(([^)]*)\)", left)
        en_def = en_m.group(1).strip() if en_m else None
        word = pos_re.sub("", left).split("(", 1)[0].strip().lower()
        word = word.split(",")[0].strip()
        word = word.split("/")[0].strip()
        if not WORD_RE.match(word) or is_blocked_surface(word):
            continue
        out[word].append((pos, en_def, glosses))
    return out


def pick_meaning_ko(
    surface: str,
    pos: str,
    enko: dict[str, list[tuple[str, str | None, list[str]]]],
    wn,
) -> str | None:
    """Pick the most representative Korean gloss for the primary sense."""
    pref = GLOSS_PREF.get((surface, pos))
    if pref:
        return pref
    if pos == "noun" and surface in BIO_GLOSS:
        return BIO_GLOSS[surface]

    senses = [s for s in enko.get(surface, []) if s[0] == pos]
    if not senses:
        senses = list(enko.get(surface, []))
    if not senses:
        return None

    organism = primary_organism_synset(surface, wn) if pos == "noun" else None
    all_glosses = [
        g
        for _, _, gs in senses
        for g in gs
        if acceptable_gloss_for_pos(g, pos)
        and (organism is None or looks_like_organism_gloss(g))
    ]
    if not all_glosses:
        return None

    wn_pos = {"noun": "n", "verb": "v", "adj": "a"}.get(pos)
    syns = wn.synsets(surface, pos=wn_pos) if wn_pos else wn.synsets(surface)
    if organism is not None:
        wn_toks = _en_tokens(organism.definition()) | {
            t for t in BIO_DEF_HINTS if t in organism.definition().lower()
        }
        # Prefer Wiktionary senses that mention organism/fish/animal/plant.
        bio_senses = []
        for sense in senses:
            en_def = (sense[1] or "").lower()
            if any(h in en_def for h in BIO_DEF_HINTS) or (
                organism and len(_en_tokens(sense[1]) & _en_tokens(organism.definition())) > 0
            ):
                bio_senses.append(sense)
        if bio_senses:
            senses = bio_senses
    else:
        wn_toks = _en_tokens(syns[0].definition()) if syns else set()

    freq = Counter(all_glosses)
    scored: list[tuple[float, str]] = []
    for si, (_p, en_def, glosses) in enumerate(senses):
        en_toks = _en_tokens(en_def)
        overlap = len(wn_toks & en_toks)
        denom = max(1, len(wn_toks | en_toks))
        jacc = overlap / denom
        en_l = (en_def or "").lower()
        bio_boost = 0.0
        if organism is not None and any(h in en_l for h in BIO_DEF_HINTS):
            bio_boost = 8.0
        for gi, g in enumerate(glosses):
            if not acceptable_gloss_for_pos(g, pos):
                continue
            if organism is not None and not looks_like_organism_gloss(g):
                continue
            sc = (
                overlap * 6.0
                + jacc * 4.0
                + gloss_quality(g, pos)
                + min(2.0, freq[g] * 0.8)
                + bio_boost
                - si * 0.35
                - gi * 0.2
            )
            scored.append((sc, g))

    if not scored:
        return None
    scored.sort(key=lambda x: (-x[0], len(x[1])))
    meaning = scored[0][1]

    # Strict organism gate: never keep a known-wrong bio gloss.
    if organism is not None and not looks_like_organism_gloss(meaning):
        return None
    if organism is not None and meaning in NON_BIO_GLOSS:
        return None
    return meaning


def zipf_to_frequency(zipf: float) -> int:
    # Zipf ~1..7 → frequency 1..10
    return max(1, min(10, int(round(zipf))))


def assign_difficulty(zipf: float, length: int, sense_count: int, pos: str) -> int:
    score = 0.0
    # rarer = harder
    if zipf >= 5.2:
        score += 0
    elif zipf >= 4.4:
        score += 1
    elif zipf >= 3.6:
        score += 2
    elif zipf >= 2.8:
        score += 3
    else:
        score += 4
    if length >= 10:
        score += 1
    elif length >= 8:
        score += 0.5
    if sense_count >= 8:
        score += 0.5
    # Verbs used to get +1 when zipf < 4, which piled them into hard bands.
    # Keep noun/adj curve; verbs follow zipf/length only so bands fill evenly.
    band = int(score) + 1
    return max(1, min(5, band))


def load_common_verbs() -> list[dict]:
    if not COMMON_VERBS_PATH.exists():
        return []
    data = json.loads(COMMON_VERBS_PATH.read_text(encoding="utf-8"))
    out: list[dict] = []
    seen: set[str] = set()
    for row in data.get("verbs", []):
        surface = str(row.get("word", "")).lower().strip()
        meaning = str(row.get("meaningKo", "")).strip()
        if not surface or surface in seen:
            continue
        if not WORD_RE.match(surface) or is_blocked_surface(surface):
            continue
        if not meaning or not acceptable_gloss_for_pos(meaning, "verb"):
            continue
        if meaning.startswith(("을 ", "를 ", "에 ", "의 ", "와 ")):
            continue
        seen.add(surface)
        out.append({"word": surface, "meaningKo": meaning})
    return out


def pluralize(word: str) -> str:
    if word.endswith(("s", "x", "z", "ch", "sh")):
        return word + "es"
    if word.endswith("y") and len(word) > 1 and word[-2] not in "aeiou":
        return word[:-1] + "ies"
    if word.endswith("f"):
        return word[:-1] + "ves"
    if word.endswith("fe"):
        return word[:-2] + "ves"
    return word + "s"


def third_person(word: str) -> str:
    if word.endswith(("s", "x", "z", "ch", "sh")):
        return word + "es"
    if word.endswith("y") and len(word) > 1 and word[-2] not in "aeiou":
        return word[:-1] + "ies"
    return word + "s"


def word_id_for(word: str, pos: str, used: set[str]) -> str:
    base = word.replace("-", "_")
    if pos == "verb" and base in used:
        cand = f"{base}_v"
        if cand not in used:
            return cand
    if base not in used:
        return base
    i = 2
    while f"{base}_{i}" in used:
        i += 1
    return f"{base}_{i}"


def build() -> None:
    ensure_deps()
    import nltk
    from nltk.corpus import wordnet as wn
    from wordfreq import top_n_list, zipf_frequency

    for pkg in ("wordnet", "omw-1.4"):
        try:
            nltk.data.find(f"corpora/{pkg}")
        except LookupError:
            print(f"Downloading NLTK corpus: {pkg}")
            nltk.download(pkg, quiet=True)

    curated = json.loads(CURATED_PATH.read_text(encoding="utf-8"))
    curated_words = {w["id"]: w for w in curated["words"]}
    curated_by_surface: dict[tuple[str, str], dict] = {}
    for w in curated["words"]:
        curated_by_surface[(w["word"].lower(), w["pos"])] = w

    enko = load_enko(download_enko())
    print(f"EN→KO entries: {len(enko)}")

    # Candidate pool from wordfreq, filtered by WordNet + KO gloss
    candidates = []
    seen_surface_pos: set[tuple[str, str]] = set()

    # Always include curated first
    for w in curated["words"]:
        key = (w["word"].lower(), w["pos"])
        seen_surface_pos.add(key)
        candidates.append(("curated", w))

    # Prefer frequent words, then fill with remaining EN→KO lemmas that have WordNet.
    freq_list = top_n_list("en", 100_000)
    print(f"wordfreq candidates: {len(freq_list)}")
    # Stable order: wordfreq rank first, then remaining enko keys by zipf desc
    surface_order: list[str] = []
    seen_order: set[str] = set()
    for surface in freq_list:
        surface = surface.lower()
        if surface in seen_order:
            continue
        seen_order.add(surface)
        surface_order.append(surface)
    enko_extra = sorted(
        (s for s in enko if s not in seen_order),
        key=lambda s: (-zipf_frequency(s, "en"), s),
    )
    surface_order.extend(enko_extra)
    print(f"total surface candidates: {len(surface_order)}")

    for surface in surface_order:
        surface = surface.lower()
        if not WORD_RE.match(surface):
            continue
        if is_blocked_surface(surface):
            continue
        if len(surface) < 2 or len(surface) > 16:
            continue
        if surface not in enko:
            continue
        synsets = wn.synsets(surface)
        if not synsets:
            continue
        # Pick representative POS using WordNet tagged-corpus usage counts.
        pos_counts: Counter[str] = Counter()
        pos_usage: Counter[str] = Counter()
        for s in synsets:
            mapped = POS_MAP.get(s.pos())
            if mapped:
                pos_counts[mapped] += 1
                for lemma in s.lemmas():
                    lemma_surface = lemma.name().lower().replace("_", "-")
                    if lemma_surface == surface:
                        pos_usage[mapped] += lemma.count()
        if not pos_counts:
            continue
        # Require a Korean gloss for that POS; usage wins, sense count breaks ties.
        enko_pos = {p for p, _, _ in enko[surface]}
        enko_pos.update(p for (word, p), _ in GLOSS_PREF.items() if word == surface)
        ranked = sorted(
            pos_counts.items(),
            key=lambda x: (
                0 if x[0] in enko_pos else 1,
                -pos_usage[x[0]],
                -x[1],
                {"noun": 0, "verb": 1, "adj": 2}.get(x[0], 9),
                x[0],
            ),
        )
        preferred_pos = POS_PREF.get(surface)
        pos = (
            preferred_pos
            if preferred_pos in enko_pos
            else ranked[0][0]
        )
        key = (surface, pos)
        if key in seen_surface_pos:
            continue
        # one surface form per word (prefer noun > verb > adj if already have surface)
        if any(s == surface for s, _ in seen_surface_pos):
            # allow verb duplicate only if curated pattern; skip auto duplicates
            continue
        seen_surface_pos.add(key)

        meaning = pick_meaning_ko(surface, pos, enko, wn)
        if not meaning:
            continue
        organism = primary_organism_synset(surface, wn) if pos == "noun" else None
        if organism is not None and not looks_like_organism_gloss(meaning):
            # Strict: never keep organism lemmas with non-organism glosses
            continue

        zipf = zipf_frequency(surface, "en")
        # Skip near-zero frequency obscure lemmas unless we still need volume
        if zipf < 1.5 and len([c for c in candidates if c[0] == "auto"]) >= MIN_WORDS:
            continue
        sense_count = len(synsets)
        difficulty = assign_difficulty(zipf, len(surface), sense_count, pos)
        freq = zipf_to_frequency(zipf)
        countability = "mass" if surface in MASS_HINTS else "count"
        singular = wn.morphy(surface, wn.NOUN) if pos == "noun" else None
        is_plural = bool(singular and singular != surface)
        number = "invariant" if pos != "noun" else ("plural" if is_plural else "singular")
        forms = {}
        if pos == "noun" and countability == "count" and not is_plural:
            forms["plural"] = pluralize(surface)
        if pos == "verb":
            forms["thirdPersonSingular"] = third_person(surface)

        categories = list(CATEGORY_BY_POS[pos])
        semantic_types = list(SEMANTIC_BY_POS[pos])
        if organism is not None:
            hyper = _synset_hypernym_names(organism)
            if hyper & {"animal", "fish", "bird", "mammal", "insect", "reptile", "amphibian"}:
                categories = ["animal"]
                semantic_types = ["animal", "animate"] if "animal" in hyper or "mammal" in hyper else ["animal"]
            elif hyper & {"plant", "tree", "flower", "alga", "fungus", "woody_plant"}:
                categories = ["nature"]
                semantic_types = ["nature_thing"]

        auto = {
            "id": surface,  # temporary; reassigned later
            "word": surface,
            "pos": pos,
            "categories": categories,
            "meaningKo": meaning,
            "semanticTypes": semantic_types,
            "difficulty": difficulty,
            "frequency": freq,
            "countability": countability,
            "number": number,
        }
        if forms:
            auto["forms"] = forms
        # curated overlay if same surface+pos
        if key in curated_by_surface:
            continue
        candidates.append(("auto", auto))
        if len([c for c in candidates if c[0] == "auto"]) >= TARGET_WORDS:
            break

    # Force-include curated common verbs (large quality set beyond Wiktionary coverage).
    represented_verb_surfaces = {
        w["word"] for kind, w in candidates if w["pos"] == "verb"
    }
    common_verbs = load_common_verbs()
    common_by_surface = {row["word"]: row["meaningKo"] for row in common_verbs}
    print(f"Common verb seed: {len(common_verbs)}")
    # Upgrade existing auto/supplemental verb glosses when curated seed is better.
    for kind, w in candidates:
        if w["pos"] != "verb":
            continue
        curated_meaning = common_by_surface.get(w["word"])
        if curated_meaning and kind != "curated":
            w["meaningKo"] = curated_meaning
    for row in common_verbs:
        surface = row["word"]
        if surface in represented_verb_surfaces or surface in SUPPLEMENTAL_VERB_SKIP:
            continue
        verb_synsets = wn.synsets(surface, pos="v")
        if not verb_synsets:
            continue
        zipf = zipf_frequency(surface, "en")
        meaning = row["meaningKo"]
        # Spread common verbs across bands more evenly than the general curve.
        if zipf >= 5.0:
            difficulty = 1
        elif zipf >= 4.2:
            difficulty = 2
        elif zipf >= 3.5:
            difficulty = 3
        elif zipf >= 2.9:
            difficulty = 4
        else:
            difficulty = 5
        auto = {
            "id": surface,
            "word": surface,
            "pos": "verb",
            "categories": ["action"],
            "meaningKo": meaning,
            "semanticTypes": ["action"],
            "difficulty": difficulty,
            "frequency": zipf_to_frequency(zipf),
            "countability": "count",
            "number": "invariant",
            "forms": {"thirdPersonSingular": third_person(surface)},
            "_commonVerb": True,
        }
        candidates.append(("common_verb", auto))
        represented_verb_surfaces.add(surface)

    # Add common alternate verb senses hidden by a primary noun/adjective entry.
    for surface in surface_order:
        if surface in represented_verb_surfaces or surface in SUPPLEMENTAL_VERB_SKIP:
            continue
        if not WORD_RE.match(surface) or is_blocked_surface(surface):
            continue
        verb_synsets = wn.synsets(surface, pos="v")
        if not verb_synsets:
            continue
        usage = sum(
            lemma.count()
            for synset in verb_synsets
            for lemma in synset.lemmas()
            if lemma.name().lower().replace("_", "-") == surface
        )
        if usage <= 0:
            continue
        zipf = zipf_frequency(surface, "en")
        meaning = pick_meaning_ko(surface, "verb", enko, wn)
        if not meaning or not acceptable_gloss_for_pos(meaning, "verb"):
            continue
        if meaning.startswith(("을 ", "를 ", "에 ", "의 ", "와 ")):
            continue
        difficulty = assign_difficulty(
            zipf, len(surface), len(verb_synsets), "verb",
        )
        auto = {
            "id": surface,
            "word": surface,
            "pos": "verb",
            "categories": ["action"],
            "meaningKo": meaning,
            "semanticTypes": ["action"],
            "difficulty": difficulty,
            "frequency": zipf_to_frequency(zipf),
            "countability": "count",
            "number": "invariant",
            "forms": {"thirdPersonSingular": third_person(surface)},
            "_supplementalVerb": True,
        }
        candidates.append(("supplemental", auto))
        represented_verb_surfaces.add(surface)

    # Force-include verified biological lemmas even when Wiktionary coverage is missing/wrong
    for surface, meaning in BIO_GLOSS.items():
        if any(s == surface for s, _ in seen_surface_pos):
            continue
        synsets = wn.synsets(surface, pos="n")
        if not synsets:
            continue
        organism = primary_organism_synset(surface, wn)
        if organism is None:
            continue
        zipf = zipf_frequency(surface, "en")
        difficulty = assign_difficulty(zipf, len(surface), len(synsets), "noun")
        freq = zipf_to_frequency(zipf)
        hyper = _synset_hypernym_names(organism)
        if hyper & {"animal", "fish", "bird", "mammal", "insect", "reptile", "amphibian"}:
            categories = ["animal"]
            semantic_types = ["animal", "animate"]
        else:
            categories = ["nature"]
            semantic_types = ["nature_thing"]
        auto = {
            "id": surface,
            "word": surface,
            "pos": "noun",
            "categories": categories,
            "meaningKo": meaning,
            "semanticTypes": semantic_types,
            "difficulty": difficulty,
            "frequency": freq,
            "countability": "count",
            "number": "singular",
            "forms": {"plural": pluralize(surface)},
        }
        seen_surface_pos.add((surface, "noun"))
        candidates.append(("auto", auto))

    # Assign stable unique ids
    used_ids: set[str] = set()
    words: list[dict] = []
    for kind, w in candidates:
        ww = dict(w)
        if kind == "curated":
            wid = ww["id"]
            used_ids.add(wid)
        else:
            wid = word_id_for(ww["word"], ww["pos"], used_ids)
            used_ids.add(wid)
            ww["id"] = wid
        words.append(ww)

    # Quality gate / trim to unique surfaces (except curated/common/supplemental verbs)
    by_surface: dict[str, list[dict]] = defaultdict(list)
    for w in words:
        by_surface[w["word"]].append(w)
    final_words: list[dict] = []
    for surface, group in by_surface.items():
        curated_group = [w for w in group if w["id"] in curated_words]
        # Keep curated nouns/adjs plus any protected verb entries for the same surface.
        if curated_group:
            final_words.extend(curated_group)
            final_words.extend(
                w for w in group
                if w.get("_supplementalVerb") or w.get("_commonVerb")
            )
            continue
        supplemental = [
            w for w in group
            if w.get("_supplementalVerb") or w.get("_commonVerb")
        ]
        primary_group = [
            w for w in group
            if not w.get("_supplementalVerb") and not w.get("_commonVerb")
        ]
        if primary_group:
            final_words.append(
                sorted(primary_group, key=lambda x: (-x["frequency"], x["pos"]))[0],
            )
        final_words.extend(supplemental)

    # Prefer keeping high-frequency words to hit MIN_WORDS with good quality
    final_words.sort(key=lambda w: (
        0 if w["id"] in curated_words else 1,
        -w["frequency"],
        w["difficulty"],
        w["word"],
    ))

    # Cap extremely rare tails if we somehow overshoot a lot
    if len(final_words) > 12000:
        curated_keep = [w for w in final_words if w["id"] in curated_words]
        rest = [w for w in final_words if w["id"] not in curated_words][:12000 - len(curated_keep)]
        final_words = curated_keep + rest

    # Strict bio cleanup before graph build
    cleaned: list[dict] = []
    for w in final_words:
        ww = dict(w)
        ww.pop("_supplementalVerb", None)
        ww.pop("_commonVerb", None)
        if ww["word"] in BIO_GLOSS and ww["pos"] == "noun":
            ww["meaningKo"] = BIO_GLOSS[ww["word"]]
            organism = primary_organism_synset(ww["word"], wn)
            if organism is not None:
                hyper = _synset_hypernym_names(organism)
                if hyper & {"animal", "fish", "bird", "mammal", "insect", "reptile", "amphibian"}:
                    ww["categories"] = ["animal"]
                    ww["semanticTypes"] = ["animal", "animate"]
                elif hyper & {"plant", "tree", "flower", "alga", "fungus", "woody_plant"}:
                    ww["categories"] = ["nature"]
                    ww["semanticTypes"] = ["nature_thing"]
        if ww["meaningKo"] in NON_BIO_GLOSS and ww["pos"] == "noun":
            continue
        cleaned.append(ww)
    final_words = cleaned

    id_set = {w["id"] for w in final_words}
    word_by_id = {w["id"]: w for w in final_words}
    surface_to_ids: dict[str, list[str]] = defaultdict(list)
    for w in final_words:
        surface_to_ids[w["word"]].append(w["id"])

    # Relations: curated first, then WordNet among final set
    relations: list[dict] = []
    rel_keys: set[tuple[str, str, str]] = set()

    def add_rel(frm: str, to: str, typ: str, weight: float) -> None:
        if frm not in id_set or to not in id_set or frm == to:
            return
        key = (frm, to, typ)
        if key in rel_keys:
            return
        rel_keys.add(key)
        relations.append({"from": frm, "to": to, "type": typ, "weight": round(weight, 3)})

    for r in curated["relations"]:
        add_rel(r["from"], r["to"], r["type"], float(r["weight"]))

    # WordNet synonym / hypernym edges (RelatedTo / IsA)
    for w in final_words:
        if w["id"] in curated_words:
            continue
        synsets = wn.synsets(w["word"], pos={"noun": "n", "verb": "v", "adj": "a"}.get(w["pos"]))
        if not synsets:
            synsets = wn.synsets(w["word"])
        for s in synsets[:3]:
            for lemma in s.lemmas()[:8]:
                name = lemma.name().lower().replace("_", "-")
                if name == w["word"]:
                    continue
                for oid in surface_to_ids.get(name, []):
                    add_rel(w["id"], oid, "RelatedTo", 0.55)
            for h in s.hypernyms()[:4]:
                for lemma in h.lemmas()[:4]:
                    name = lemma.name().lower().replace("_", "-")
                    for oid in surface_to_ids.get(name, []):
                        add_rel(w["id"], oid, "IsA", 0.65)
            if w["pos"] == "adj":
                for sim in s.similar_tos()[:4]:
                    for lemma in sim.lemmas()[:4]:
                        name = lemma.name().lower().replace("_", "-")
                        for oid in surface_to_ids.get(name, []):
                            add_rel(w["id"], oid, "Describes", 0.5)

    if len(final_words) < MIN_WORDS:
        die(f"only {len(final_words)} words (< {MIN_WORDS}). Check EN→KO coverage / network.")

    verb_count = sum(1 for w in final_words if w["pos"] == "verb")
    if verb_count < MIN_VERBS:
        die(f"only {verb_count} verbs (< {MIN_VERBS})")

    # Rebalance verb difficulties into frequency quintiles so each band has
    # comparable catalog depth (Wiktionary alone piled verbs into mid bands).
    verb_words = [w for w in final_words if w["pos"] == "verb"]
    verb_words.sort(key=lambda w: (-w["frequency"], w["word"]))
    n_verbs = len(verb_words)
    for i, w in enumerate(verb_words):
        w["difficulty"] = min(5, (i * 5) // max(1, n_verbs) + 1)

    verbs_by_band = Counter(
        w["difficulty"] for w in final_words if w["pos"] == "verb"
    )
    sparse_bands = {
        d: verbs_by_band[d]
        for d in range(1, 6)
        if verbs_by_band[d] < MIN_VERBS_PER_BAND
    }
    if sparse_bands:
        die(f"too few verbs by difficulty after rebalance: {sparse_bands}")

    # Validate
    for w in final_words:
        assert w["word"] and w["meaningKo"] and w["pos"] in ("noun", "verb", "adj")
        assert 1 <= w["difficulty"] <= 5
        assert 1 <= w["frequency"] <= 10
        assert "..." not in w["meaningKo"] and "…" not in w["meaningKo"]
        assert re.search(r"[가-힣]", w["meaningKo"])
        assert w["meaningKo"] not in NON_BIO_GLOSS or w["pos"] != "noun", (w["word"], w["meaningKo"])
        if w["word"] in BIO_GLOSS and w["pos"] == "noun":
            assert w["meaningKo"] == BIO_GLOSS[w["word"]], (w["word"], w["meaningKo"])
    dangling = [r for r in relations if r["from"] not in id_set or r["to"] not in id_set]
    if dangling:
        die(f"dangling relations: {len(dangling)}")

    # Preserve curated frames
    for wid, cw in curated_words.items():
        if wid in word_by_id and cw.get("frame"):
            word_by_id[wid]["frame"] = cw["frame"]
            # also restore curated semantic metadata
            for k in ("categories", "semanticTypes", "meaningKo", "countability", "number", "forms"):
                if k in cw:
                    word_by_id[wid][k] = cw[k]

    framed = [w for w in final_words if w.get("frame")]
    if len(framed) < MIN_CURATED_FRAMES:
        die(f"too few sentence frames: {len(framed)} < {MIN_CURATED_FRAMES}")
    for verb in framed:
        if not any(
            r["to"] == verb["id"] and r["type"] == "CapableOf"
            for r in relations
        ):
            die(f"frame has no capable subject: {verb['id']}")
        if verb["frame"].get("objects") and not any(
            r["from"] == verb["id"] and r["type"] == "ActsOn"
            for r in relations
        ):
            die(f"frame has no valid object: {verb['id']}")

    # Write by difficulty
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    by_diff: dict[int, list[dict]] = defaultdict(list)
    for w in final_words:
        by_diff[w["difficulty"]].append(w)

    for d in range(1, 6):
        words_d = sorted(by_diff.get(d, []), key=lambda x: (-x["frequency"], x["word"]))
        ids_d = {w["id"] for w in words_d}
        # relations where both ends are in this difficulty OR touch this band from lower bands:
        # include edges with at least one endpoint in band (for local graph density)
        rels_d = [
            r for r in relations
            if r["from"] in ids_d or r["to"] in ids_d
        ]
        # but drop dangling within file by keeping only edges where both known globally
        # (loader merges all loaded bands)
        (OUT_DIR / f"words-d{d}.json").write_text(
            json.dumps(words_d, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        (OUT_DIR / f"relations-d{d}.json").write_text(
            json.dumps(rels_d, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        print(f"d{d}: {len(words_d)} words, {len(rels_d)} relations")

    # Also write full relations for convenience? Plan says relations-d1..d5 only.
    # Loader will merge loaded difficulty files.

    pos_counts = Counter(w["pos"] for w in final_words)
    diff_counts = Counter(w["difficulty"] for w in final_words)
    manifest = {
        "version": "1.0.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "minWords": MIN_WORDS,
        "wordCount": len(final_words),
        "relationCount": len(relations),
        "uniqueSurfaces": len({w["word"] for w in final_words}),
        "posCounts": dict(pos_counts),
        "difficultyCounts": {str(k): v for k, v in sorted(diff_counts.items())},
        "chunks": {
            "words": [f"words-d{d}.json" for d in range(1, 6)],
            "relations": [f"relations-d{d}.json" for d in range(1, 6)],
        },
        "sources": [
            "wordfreq 3.1.1 (CC BY-SA 4.0, Robyn Speer)",
            "Princeton WordNet / NLTK wordnet",
            "Wiktionary en→ko (CC BY-SA 3.0 / GFDL) via open-dsl-dict",
            "curated seed from flow-py typing-ai-lab",
        ],
        "curatedWordCount": len(curated_words),
        "curatedFrameCount": sum(1 for w in curated["words"] if w.get("frame")),
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    print("OK")


if __name__ == "__main__":
    build()
