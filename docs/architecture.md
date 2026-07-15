# Flow-Py v2 아키텍처

순서도 기반 파이썬 학습 툴. 선생은 순서도(DSL)를 그리고 채점 테스트를 정의하고, 학생은 순서도를 보며 Monaco IDE로 코드를 작성·실행·제출한다.

## 스택

- **프론트**: Vite + React 18 + TypeScript + Tailwind + shadcn 스타일 UI
- **순서도**: `@xyflow/react`(React Flow) + `@dagrejs/dagre`(자동 레이아웃)
- **코드 편집**: `@monaco-editor/react`
- **파이썬 실행**: Pyodide(브라우저 Web Worker)
- **백엔드**: Supabase (Auth + Postgres + RLS + Realtime)
- **데이터 패칭**: `@tanstack/react-query`

## 데이터 흐름

```
DSL 텍스트 ──parseDsl──▶ FlowchartData(nodes,edges) ──layoutFlowchart(dagre)──▶ React Flow
   (problems.flowchart.dsl)                                    좌표 override: flowchart.positions
```

- **DSL이 순서도의 source of truth**. 선생이 노드를 드래그하면 `positions` 만 override 로 저장.
- 파서는 Python 유사 들여쓰기 블록(`if/elif/else`, `for`, `while`, `def`)을 노드/간선으로 변환. 제어 흐름(분기 병합, 루프 되돌아가기, 함수 서브그래프)까지 간선으로 표현. `src/lib/dsl-parser.ts`.

## 인증·권한

- Supabase Auth. 아이디는 `username@flowpy.local` 합성 이메일로 매핑(`src/lib/auth.ts`).
- `profiles` 테이블에 role(student/teacher). 신규 가입 시 트리거로 `student` 기본.
- 선생 승격: `claim_teacher(code)` RPC(SECURITY DEFINER)가 `app_config.teacher_code` 와 대조 — 코드는 서버에만 존재.
- 권한은 전부 **RLS**로 강제(별도 미들웨어/edge function 없음):
  - `problems`: 학생은 발행분만 SELECT, 선생은 본인 것 전체 CRUD.
  - `submissions`: 학생은 본인 제출, 선생은 본인 문제의 제출만.

## 실행·채점

- Web Worker(`src/workers/pyodide-runner.worker.ts`)가 CDN에서 Pyodide(ESM) 로드, stdout/stderr 스트리밍.
- **표준입력은 미리 주어진 문자열 큐**로 소비(`input()` 블로킹 없음 → SharedArrayBuffer/교차출처격리 불필요).
- 무한 루프 방어: `usePyodide` 가 타임아웃 시 `worker.terminate()` 후 새 워커 생성(스트리밍된 부분 출력은 보존).
- 채점: 각 테스트의 `input` 을 stdin 으로 실행 → stdout 정규화 비교 → 점수(`src/lib/grading.ts`). 결과를 `submissions` 에 저장.

## 라우팅

| 경로 | 대상 | 설명 |
|------|------|------|
| `/login`, `/signup` | 공통 | Supabase Auth |
| `/teacher` | 선생 | 문제 목록/생성/발행/삭제 |
| `/teacher/:id` | 선생 | DSL 편집 + 순서도 미리보기 + 채점 편집 + 제출 현황 |
| `/student` | 학생 | 발행 문제 목록 |
| `/solve/:id` | 학생 | 순서도(읽기전용) + 코드 작성/실행/제출 |

가드: `src/components/RouteGuards.tsx` (`RequireAuth`, `RequireRole`, `RoleLanding`).

## 알려진 한계

- **클라이언트 채점**: 학생 브라우저에서 Pyodide 로 채점하므로 결과 위조가 가능. 신뢰가 필요한 평가에는 서버 실행이 필요 → [server-sandbox-migration.md](./server-sandbox-migration.md).
- 순서도 간선은 dagre 자동 라우팅 + 되돌아가기 간선의 우측 핸들 고정. 복잡한 그래프에서 겹칠 수 있음(수동 라우팅은 의도적으로 배제 — 과거 버전의 유지보수 부담 원인).
