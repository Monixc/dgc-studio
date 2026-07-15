# Flow-Py v2

순서도 기반 파이썬 학습 툴. **선생**은 순서도(DSL)와 채점 테스트를 만들고, **학생**은 순서도를 보며 Monaco IDE로 코드를 작성·실행·제출한다. 파이썬은 브라우저 Pyodide로 실행된다.

설계 상세: [docs/architecture.md](docs/architecture.md) · 서버 채점 이행: [docs/server-sandbox-migration.md](docs/server-sandbox-migration.md)

## 요구사항

- [Bun](https://bun.sh) (또는 Node 18+/npm)
- Supabase 프로젝트 (신규 권장) 또는 로컬 `supabase` CLI

## 셋업

```sh
bun install
cp .env.example .env      # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 채우기
```

### Supabase 연결

**A. 클라우드 프로젝트**

1. supabase.com 에서 프로젝트 생성 → Project URL, anon key 를 `.env` 에 입력.
2. `supabase/migrations/0001_init.sql` 을 SQL Editor 에 붙여 실행(스키마·RLS·트리거·RPC).
3. `supabase/seed.sql` 의 `teacher_code` 값을 원하는 코드로 바꿔 실행(선생 가입 코드).
4. Auth → Email 확인(Confirm email)을 끄면 아이디만으로 즉시 로그인 가능(학교 환경 권장).

**B. 로컬 CLI**

```sh
supabase start
supabase db reset        # 마이그레이션 + seed 적용
```
출력된 API URL / anon key 를 `.env` 에 입력.

## 실행

```sh
bun run dev              # http://localhost:8080
bun run test             # DSL 파서 + 채점 단위 테스트
bun run build            # 프로덕션 빌드
bun run lint
```

## 순서도 DSL

Python 유사 들여쓰기 블록. 들여쓰기로 블록을 열고 dedent 로 닫는다.

```
start
input n
if n > 0
    output "양수"
elif n == 0
    output "영"
else
    output "음수"
for i in range(1, n + 1)
    process total += i
while x > 0
    process x -= 1
def greet(name)
    output "hi " + name
end
```

- 키워드: `start end input output process call if elif else for while def`
- 인식 안 되는 줄은 `process` 로 관대하게 처리(예: `total = 0`).

## 사용 흐름

1. **선생 가입**: 회원가입에서 "선생님으로 가입" + 가입 코드 입력.
2. 문제 생성 → DSL 작성(우측 순서도 실시간 미리보기) → 채점 탭에서 테스트 추가 → 저장 → 발행.
3. **학생 가입**: 일반 가입. 발행된 문제 목록에서 문제 선택 → 코드 작성 → 실행/제출.
4. 선생은 문제 편집 화면의 "제출 현황"에서 학생별 점수·코드 확인.
