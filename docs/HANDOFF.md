# Flow-Py v2 — 세션 인수인계 지시서

## ⛔ 최우선 규칙 (반드시 준수)

- **지금까지 구현된 기능은 사용자가 직접 지시하지 않는 한 절대 수정하지 말 것.**
- 리팩터링·정리·개선도 요청 없이는 하지 말 것. "더 나아 보여서" 손대는 것 금지.
- **부득이하게 기존 기능 수정이 필요하면, 손대기 전에 무조건 사용자 허락을 구할 것.**
- 새 요청은 기존 동작을 깨지 않는 선에서 최소 변경으로 추가.
- 작업 흐름: 기능 1개 = 로컬 git 커밋 1개. 커밋 후 빌드·배포까지.

## 프로젝트

- 순서도 기반 파이썬 학습 툴. 선생=순서도(캔버스) 작성+문제 출제, 학생=순서도 보고 코드 작성·실행·제출.
- 위치: `/Users/monicx/projects/claude-projects/flow-py-v2` (git repo).
- **참고 전용(수정 금지)**: `/Users/monicx/projects/personalpj/flowcode-pathways` (구버전 v1).
- 스택: Vite + React18 + TS + Tailwind + shadcn식 UI · `@xyflow/react` + `@dagrejs/dagre` · `@monaco-editor/react` · Pyodide(Web Worker) · Supabase(Auth+Postgres+RLS+Realtime) · react-query · react-router.

## 실행 / 빌드 / 테스트

```sh
bun install
bun run dev      # http://localhost:8080
bun run test     # vitest (dsl-parser, grading)
bun run build
bun run lint     # 0 errors 유지(경고 3개는 shadcn 표준, 무시)
bunx tsc -p tsconfig.app.json --noEmit   # 타입체크
```

## 배포 (Vercel, 정적)

- 프로젝트명 `dist`(정적 폴더 배포라 이름이 dist). SSO 보호 해제됨(공개).
- **고정 프로덕션 별칭(항상 최신, 사용자에게 이 URL 안내)**: https://dist-omega-six-s1yiiea3ve.vercel.app
- 배포 절차:
  ```sh
  bun run build
  cp vercel.json dist/vercel.json          # SPA fallback
  npx vercel deploy dist --prod --yes --archive=tgz
  rm -f dist/vercel.json
  ```
- 매 배포는 새 불변 URL(`dist-<rnd>...`)을 찍음 — 그건 옛 빌드에 고정. 사용자에게는 **별칭**만 안내.
- 배포 후 확인: `curl -s <별칭>/ | grep -o '/assets/index-[^"]*\.js'` 가 `dist/assets/index-*.js` 와 일치하는지.

## Supabase

- **클라우드**: project ref `bhvtfbtlsuvaeojexbjk` (Monixc's Org, Seoul). URL `https://bhvtfbtlsuvaeojexbjk.supabase.co`.
  - 스키마: `supabase/migrations/0001_init.sql` (`db push` 로 적용됨).
  - 선생 가입 코드: **`dlabgc`** (`app_config.teacher_code`).
  - 이메일 확인 off(아이디만으로 로그인).
- **로컬 스택**: `supabase start` (Docker 필요). `.env` = 로컬 값. 로컬 코드도 `dlabgc`.
- 프론트 env: `.env`(로컬), `.env.production.local`(클라우드) — **둘 다 gitignore**. anon key만 프론트 번들에 인라인(공개 안전).
- **민감정보**: service_role 키·DB 비번은 깃·번들·문서 어디에도 없음. 세션 로그(로컬)에만 존재. DB 비번은 앱 미사용(CLI link용) — 필요시 대시보드에서 rotate.

## 아키텍처 핵심 (건드리기 전 반드시 이해)

### 순서도 = 캔버스 원본
- 저장 포맷: `problems.flowchart` = `{ nodes: FlowNode[], edges: FlowEdge[] }` (JSONB). **캔버스가 source of truth**, DSL은 임포트 경로.
- 타입: `src/types/flowchart.ts` (FlowNode: id/type/label/position/style/width/height/parentId, FlowEdge: +sourceHandle/targetHandle/pathType).
- 변환 유틸: `src/lib/flow-graph.ts` — `normalizeStored`(DB→그래프, 구 `{dsl,positions}` 도 수용), `toRFNodes/toRFEdges/fromRF`(RF↔저장), `autoLayout`(dagre, "정렬" 버튼용, 간선 없으면 세로 스택), `dslToGraph`(DSL→컨테이너 중첩 그래프), `orderParentsFirst`(부모 먼저 위상정렬).
- 렌더: `src/components/flow/FlowNode.tsx`(SVG 도형, for는 컨테이너), `FlowchartCanvas.tsx`(편집/보기 겸용).

### 핸들 규칙 (중요 — 함부로 바꾸지 말 것)
- 노드마다 핸들 4개: id `top/left/bottom/right`, **전부 `type="source"`**. ConnectionMode.Loose 라 타깃으로도 동작.
  - 이유: target 타입 핸들에서 출발하는 간선은 렌더가 안 됨 → for 컨테이너 상단 진입선이 안 그려졌던 버그. 전부 source 로 해결.
- 일반 핸들: hover 시만 표시, 회색. for 컨테이너 핸들: 항상 표시.

### for 컨테이너
- for = 리사이즈 가능한 실선 컨테이너. 자식은 `parentId`로 소속. **중첩 for 지원**(getIntersectingNodes 로 겹침 감지, 가장 안쪽 선택, 순환 방지, 위상정렬).
- 중첩 시 안쪽 for 자동 축소(부모 안에 맞게)·헤더 아래 배치, 부모 필요시 확대. `extent:'parent'` 미사용(밖으로 드래그해 분리 가능).
- for 관련 간선은 **직선(straight) + 상단/하단만**: 컨테이너top→첫블록top, 마지막블록bottom→컨테이너bottom, 컨테이너bottom→다음.
- DSL 임포트: 파서가 for 본문에 `scope=for id` 표시(`src/lib/dsl-parser.ts`) → `dslToGraph` 가 컨테이너로 중첩 + 위 간선 규칙 적용. for 라벨은 `for <header>`.

### 편집 상호작용 (FlowchartCanvas)
- 팔레트로 노드 추가, 핸들 드래그로 연결, 더블클릭으로 노드/간선 라벨 편집, Delete 삭제, "정렬"(dagre), "DSL" 가져오기.
- 노드 선택 시 우상단 색상 패널(배경/테두리/글자). 기본 흰배경·검정테두리·검정글자.
- **간선 재연결**: 끝점 떼서 다른 핸들에 붙임, 빈 곳에 놓으면 삭제(onReconnectStart/End).
- `panActivationKeyCode={null}` — Space 팬 끔(Monaco 띄어쓰기 삼킴 방지). **지우지 말 것.**

### 실행/채점 (Pyodide)
- `src/workers/pyodide-runner.worker.ts` (CDN ESM 로드, stdout/stderr 스트리밍, stdin은 미리 준 문자열 큐 — 블로킹 input 없음).
- `src/hooks/usePyodide.ts` — 타임아웃 시 worker.terminate 후 재시작(무한루프 차단).
- `src/components/editor/EditorPanel.tsx` — Monaco + stdin 박스 + 콘솔 + 실행/중단. **선생·학생 공용**. input() 있는데 stdin 비면 실행 전 경고("입력값을 먼저 넣고 실행해주세요").
- 채점: `src/lib/grading.ts` (`buildGradingSummary`, `normalizeOutput`). 각 테스트 stdin 으로 실행 → stdout 정규화 비교.

### 인증/권한
- Supabase Auth, 아이디→`username@flowpy.local` 합성 이메일(`src/lib/auth.ts`). 선생 승격 `claim_teacher(code)` RPC.
- `useAuth`(`src/hooks/useAuth.tsx`): 로그인 후 role 확정 전엔 loading 유지(선생이 /student 로 튕기던 버그 수정됨). `refreshProfile` 은 live 세션 사용.
- RLS: 학생=발행문제만/본인 제출만, 선생=본인 문제 CRUD+제출 조회. 가드 `src/components/RouteGuards.tsx`.

### 라우팅/화면
- `/`=랜딩(로그아웃) or role 리다이렉트. 로그인/회원가입=헤더 드롭다운 팝업(`AuthDropdown`/`AuthForm`).
- `/teacher`=워크스페이스(좌측 문제 패널 인라인 생성/선택/삭제/발행 `ProblemPanel` + 우측 `ProblemEditor`, 라우트 이동 없음).
- `/student`=발행 문제 목록, `/solve/:id`=풀이(순서도 읽기전용 + EditorPanel + 제출).
- Realtime: `useProblemsRealtime` 로 problems 변경 즉시 반영. 학생 코드 로컬 드래프트(`src/lib/draft.ts`).

## 알려진 한계 / 미결 (수정은 지시 있을 때만)

- **클라이언트 채점**: 학생 브라우저 Pyodide → 점수 위조 가능. 서버 이행 설계: `docs/server-sandbox-migration.md`.
- `autoLayout`("정렬" 버튼)은 flat dagre — for 컨테이너 중첩을 평탄화할 수 있음(정렬 시 그룹 깨질 위험). 미해결.
- DSL 임포트는 현재 그래프를 **대체**(병합 아님).
- ProblemEditor 저장은 수동(자동저장 아님). 발행해야 학생에게 보임.
- 번들 500KB 경고(무시 가능).

## 진행 중이던 흐름

최근 세션은 순서도 편집기(캔버스 원본 전환, for 컨테이너, 중첩 for, 간선 직선화/재연결, 핸들 규칙, 색상, Space 버그, input 경고 등)를 사용자 피드백에 따라 반복 개선. 전부 커밋+배포 완료. `git log --oneline` 참고.
