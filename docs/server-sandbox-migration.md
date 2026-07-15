# 서버 샌드박스 실행 마이그레이션 설계

## 왜

현재 채점은 학생 브라우저의 Pyodide 에서 실행되고, 클라이언트가 stdout 을 서버로 보낸다. 즉 **학생이 점수를 위조**할 수 있고(개발자 도구로 요청 조작), 리소스 제한·악성 코드 격리도 브라우저에 의존한다. 성적이 의미를 갖는 평가에서는 **신뢰 가능한 서버 실행**이 필요하다.

Pyodide 는 "빠른 실습/즉시 피드백" 용도로 유지하고, **제출 채점만 서버로** 옮기는 하이브리드를 목표로 한다.

## 목표 아키텍처

```
학생 제출 ─▶ Edge Function `grade` ─▶ 샌드박스 실행기 ─▶ 각 테스트 stdout ─▶ 채점 ─▶ submissions
             (인증·문제·테스트 로드)    (격리·타임아웃·메모리 제한)      (buildGradingSummary 재사용)
```

핵심: **grading_tests 와 기대 출력은 서버에서만 읽고, 실행도 서버에서** 한다. 클라이언트는 코드만 보낸다.

## 실행기 선택지

| 방식 | 격리 | 지연 | 운영 부담 | 비고 |
|------|------|------|-----------|------|
| **Judge0**(self-host/클라우드) | 강(cgroup) | 중 | 낮음 | 다국어 온라인 저지. 가장 빠른 도입 |
| **Piston** | 중~강 | 낮 | 낮음 | 경량, 언어 런타임 내장 |
| **gVisor + 컨테이너** | 강 | 중 | 높음 | 직접 구축, 세밀한 제어 |
| **Cloudflare Workers + Pyodide(WASM)** | 프로세스=요청 | 낮 | 중 | 서버측 Pyodide, 네이티브 격리 아님 |
| **Firecracker microVM** | 최강 | 중 | 높음 | 대규모/멀티테넌트 |

**권장 도입 순서**: Judge0(또는 Piston) 자체호스팅으로 시작 → 규모/보안 요구가 커지면 Firecracker.

## 실행 제약(필수)

- CPU 시간 제한(예: 2~5초), 벽시계 타임아웃, 메모리 상한(예: 128MB), 출력 크기 상한.
- 네트워크 차단, 파일시스템 읽기전용/임시.
- 프로세스 수·fork 제한.

## API 설계 (Edge Function)

```
POST /functions/v1/grade
  headers: Authorization: Bearer <supabase session jwt>
  body: { problemId, code }

동작:
  1. JWT 로 user 확인.
  2. problems 에서 grading_tests(서버 전용) 로드. 문제 발행 여부 확인.
  3. 각 테스트: 실행기에 { code, stdin: test.input, limits } 제출 → stdout 수집.
  4. buildGradingSummary(tests, outputs)  ← 기존 lib/grading.ts 로직 그대로 이식.
  5. submissions insert (service role).
  응답: { score, maxScore, passed, total, details(공개 가능한 부분만) }
```

RLS 변경: 클라이언트의 직접 `submissions` insert 정책을 제거하고, insert 는 오직 Edge Function(service role)만. `problems.grading_tests` 는 학생 SELECT 에서 제외(뷰/컬럼 분리 또는 별도 테이블 `problem_secrets`).

## 코드 재사용

- `src/lib/grading.ts` 의 `normalizeOutput`, `buildGradingSummary`, `toPositivePoints` 는 Deno(Edge Function)에서 그대로 임포트 가능하도록 순수 함수로 유지 중. 이식 시 로직 중복 없음.
- 클라이언트 Pyodide 경로(`usePyodide`, worker)는 "실행/미리보기" 용으로 남기고, 제출 버튼만 `grade` 호출로 교체.

## 단계별 이행

1. `problem_secrets`(또는 컬럼 분리)로 기대 출력·테스트 입력을 학생 SELECT 에서 격리.
2. `grade` Edge Function + 실행기(Judge0) 배포. `buildGradingSummary` 이식.
3. Solve 제출 핸들러를 `grade` 호출로 교체. 결과 표시는 동일.
4. `submissions` insert RLS 를 service-role 전용으로 축소.
5. (선택) Pyodide 는 "실행" 버튼 전용으로만 유지.
