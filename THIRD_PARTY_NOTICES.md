# Typing AI Lab Lexicon — Third-Party Notices

이 저장소의 `public/typing-ai-lab/*.json` 학습 사전은 아래 오픈 데이터를
오프라인 ETL로 병합한 파생물입니다. 런타임에는 외부 API를 호출하지 않습니다.

## wordfreq (빈도)

- 프로젝트: https://github.com/rspeer/wordfreq
- 버전: 3.1.1
- 코드 라이선스: Apache-2.0
- 빈도 데이터: **CC BY-SA 4.0**
- 필수 표기: **Robyn Speer**
- 비고: 파생 빈도 데이터를 재배포할 때 출처 표시와 동일조건변경허락을 유지합니다.

## Princeton WordNet / NLTK wordnet

- WordNet: https://wordnet.princeton.edu/
- NLTK corpora `wordnet`, `omw-1.4`
- 라이선스: WordNet 3.0 license (연구·상업 사용 가능, 저작권·면책 고지 필요)
- 사용 필드: 표제어, 품사, synset, synonym / hypernym / similar 관계

## Wiktionary English→Korean

- 원천: English Wiktionary translations
- 스냅샷 배포: https://github.com/open-dsl-dict/wiktionary-dict
  (`src/en-ko-enwiktionary.txt`, Matthias Buchmeier / open-dsl-dict)
- 라이선스: **CC BY-SA 3.0** 및 GFDL
- 사용 필드: 한국어 뜻(gloss)

## Curated seed

- `scripts/typing-ai-lab/curated_seed.json`
- flow-py typing-ai-lab 수동 검수 단어·동사 frame·교육용 관계
- 문장 생성용 semantic frame은 curated 동사만 사용합니다.
- `scripts/typing-ai-lab/common_verbs.json`
- 자주 쓰는 영어 동사와 수동 검수한 대표 한국어 뜻
- WordNet에서 동사 품사가 확인된 항목만 최종 산출물에 포함됩니다.

## 파생 산출물

- `public/typing-ai-lab/manifest.json`
- `public/typing-ai-lab/words-d1.json` … `words-d5.json`
- `public/typing-ai-lab/relations-d1.json` … `relations-d5.json`

파생 사전 JSON은 포함된 Wiktionary·wordfreq 데이터의 ShareAlike 조건을 따릅니다.
재배포 시 본 NOTICE와 출처를 함께 제공하세요.

생성 명령:

```bash
pip install -r scripts/typing-ai-lab/requirements.txt
python3 scripts/typing-ai-lab/build_lexicon.py
```
