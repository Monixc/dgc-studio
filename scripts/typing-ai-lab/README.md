# Typing AI Lab Lexicon ETL

오프라인으로 영어 학습 사전을 생성합니다. 브라우저 런타임에서는 외부 사전 API를
호출하지 않고 `public/typing-ai-lab/`의 정적 JSON만 사용합니다.

## 2026-07 동사 확장

난이도별 동사 수가 89~214개에 머물던 문제를 해결했습니다.

| 항목 | 변경 전 | 변경 후 |
| --- | ---: | ---: |
| 전체 단어 | 6,557 | 7,659 |
| 동사 | 690 | 1,791 |
| 난이도별 동사 | 89~214 | 358~359 |
| 도감 페이지(60개/페이지) | 약 1.5~3.6 | 약 6 |

주요 변경:

- `common_verbs.json`: 자주 쓰는 영어 동사와 검수된 대표 한국어 뜻을 보강합니다.
- `build_lexicon.py`: 기존 자동 번역보다 검수 뜻을 우선하고 WordNet 동사 여부를 검증합니다.
- 동사를 빈도순 5분위로 재배치해 모든 난이도에서 비슷한 양을 제공합니다.
- 명사와 같은 표면형을 가진 동사도 별도 ID(`seal_v` 등)로 보존합니다.
- `expand_common_verbs.py`: 검수 목록을 `common_verbs.json`에 병합하는 유지보수 도구입니다.

난이도 재배치는 사전 규모의 균형을 위한 상대 등급입니다. 같은 빈도 안에서는
알파벳순으로 안정적으로 정렬되어 빌드 결과가 재현됩니다.

## Setup

```bash
python3 -m venv .venv-lexicon
.venv-lexicon/bin/pip install -r scripts/typing-ai-lab/requirements.txt
.venv-lexicon/bin/python scripts/typing-ai-lab/build_lexicon.py
# or: npm run build:lexicon
```

첫 실행 시 NLTK WordNet과 Wiktionary en→ko 텍스트를 다운로드합니다.
산출물은 `public/typing-ai-lab/` 에 기록됩니다.

## Inputs

- `curated_seed.json` — 문장 생성용 핵심 단어·동사 frame·관계
- `common_verbs.json` — 추가 동사와 대표 한국어 뜻
- wordfreq — 영어 사용 빈도
- Princeton WordNet — 품사 확인과 단어 관계
- Wiktionary en→ko — 자동 한국어 뜻

처리 순서:

1. curated seed를 우선 등록합니다.
2. wordfreq 후보를 WordNet 품사와 Wiktionary 뜻으로 필터링합니다.
3. common verb seed를 병합하고 검수된 뜻을 우선 적용합니다.
4. 중복 표면형을 정리하고 동사 난이도를 균등 분배합니다.
5. WordNet 관계를 생성한 뒤 품질 조건을 검사합니다.
6. 난이도별 JSON과 manifest를 출력합니다.

## Outputs

- `manifest.json` — 버전·개수·출처
- `words-d1.json` … `words-d5.json` — 난이도별 단어
- `relations-d1.json` … `relations-d5.json` — 난이도별 관계

## Quality gates

- 고유 단어 5,000개 이상
- 검증된 동사 1,400개 이상, 난이도별 200개 이상
- 모든 단어에 한국어 뜻
- 동사 뜻은 사전형 `-다`로 종료
- dangling relation 0
- curated frame 보존

## Verification

```bash
npm run build:lexicon
npm test -- --run src/test/typing-ai-lab.test.ts
```

현재 생성 결과는 `manifest.json` 기준 단어 7,659개, 관계 22,791개입니다.
