# Flow-Py v2 — 세션 인수인계 지시서

## ⛔ 최우선 규칙 (반드시 준수)

- **지금까지 구현된 기능은 사용자가 직접 지시하지 않는 한 절대 수정하지 말 것.**
- 리팩터링·정리·개선도 요청 없이는 하지 말 것. "더 나아 보여서" 손대는 것 금지.
- **부득이하게 기존 기능 수정이 필요하면, 손대기 전에 무조건 사용자 허락을 구할 것.**
- 새 요청은 기존 동작을 깨지 않는 선에서 최소 변경으로 추가.
- 작업 흐름: 기능 1개(또는 한 라운드 요청) = 로컬 git 커밋 1개. 커밋 후 빌드·배포까지.
- **DB 마이그레이션 새로 만들면 로컬+클라우드 둘 다 적용할 것** (아래 Supabase 절 참고, 반복 발생하던 사고 지점).

## 프로젝트

- 순서도 기반 파이썬 학습 툴 + 학원 관리(반/문제/포인트/쪽지/공지/일정). 선생=반·문제·포인트·공지 관리, 학생=배정된 문제/연습 문제 풀이+포인트 랭킹+쪽지.
- 위치: `/Users/monicx/projects/claude-projects/flow-py-v2` (git repo).
- **참고 전용(수정 금지)**: `/Users/monicx/projects/personalpj/flowcode-pathways` (구버전 v1).
- 스택: Vite + React18 + TS + Tailwind + shadcn식 UI · `@xyflow/react` + `@dagrejs/dagre` · `@monaco-editor/react` · Pyodide(Web Worker) · Supabase(Auth+Postgres+RLS+Realtime) · react-query · react-router.

## 실행 / 빌드 / 테스트

```sh
bun install
bun run dev      # http://localhost:8080
bun run test     # vitest (dsl-parser, grading)
bun run build
bun run lint     # 0 errors 유지(경고 4개는 shadcn/기존 패턴 fast-refresh 경고, 무시)
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
  - 스키마: `supabase/migrations/0001_init.sql` ~ `0007_student_dashboard.sql` 순서대로 적용됨.
  - 선생 가입 코드: **`dlabgc`** (`app_config.teacher_code`).
  - 이메일 확인 off(아이디만으로 로그인).
- **로컬 스택**: `supabase start` (Docker 필요). `.env` = 로컬 값. 로컬 코드도 `dlabgc`.
- **⚠️ 마이그레이션 적용은 로컬/클라우드가 완전히 별개 명령**:
  - 로컬 Docker DB: `npx supabase migration up`
  - 클라우드: `npx supabase db push --linked`
  - 둘 중 하나만 돌리면 그 환경만 반영됨(과거에 이걸 몰라서 로컬 400/404, 클라우드 스키마캐시 미스 두 번 남).
- 새 테이블/컬럼 추가 마이그레이션 끝에는 `notify pgrst, 'reload schema';` 넣을 것(PostgREST 캐시 즉시 반영, 안 넣으면 클라우드에서 새 테이블 404 날 수 있음).
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
- **클라이언트 채점**이라 학생 브라우저 Pyodide 결과를 그대로 믿음 — 점수 위조 가능(서버 이행 설계: `docs/server-sandbox-migration.md`). 포인트 자동지급은 이 클라이언트 채점 결과(`submissions.score`)를 트리거로 하므로 같은 위험을 그대로 물려받음(아래 포인트 절 참고).

### 문제(problems) 확장: 카테고리 · 폴더 · 포인트
- `problems.category`: `flowchart`(순서도, 기본값) / `general`(파이썬 일반) / `block`(블럭코딩). 기존 문제는 전부 `flowchart`로 마이그레이션됨.
- `ProblemEditor.tsx`: 제목 옆에 카테고리 select + 포인트 숫자 입력. **카테고리에 따라 레이아웃 분기**: `flowchart`면 기존 그대로(좌 캔버스 + 우 코드/설명/채점 탭), 그 외는 좌측이 설명+채점 에디터, 우측은 코드 실행 패널 그대로. **이 분기 조건 지우지 말 것** — 지우면 파이썬/블럭 문제 편집 시 빈 캔버스가 다시 뜸.
- `Solve.tsx`(학생 풀이 화면)도 동일하게 `category === "flowchart"`일 때만 캔버스 렌더. 원래 이 분기가 없어서 파이썬/블럭 문제 풀 때 빈 캔버스가 뜨던 버그를 학생 대시보드 작업 때 수정함.
- `problems.folder_id`: `problem_folders`(자기참조, `parent_id`)로 계층 분류. **대분류 3개는 자동 생성**되고 고정(순서도/파이썬/블럭코딩, `ensureDefaultFolders` — `useFolders` 쿼리 안에서 lazy 시드, `problem_folders.category` 컬럼이 이 3개에만 값 있음). 하위 폴더는 자유 생성, `resolveFolderCategory()`가 부모 체인을 타고 올라가 대분류를 상속받음. "미분류" 개념은 없음 — 폴더 미지정 새 문제는 항상 순서도 대분류로 들어감(`ProblemManager.tsx` `handleCreateProblem`).
- 문제 관리 화면(`/problems`, `ProblemManager.tsx`): 좌측 폴더 트리(펼침/접힘, 하위폴더 추가) + 가운데 문제 목록(드래그해서 폴더로 이동 가능, HTML5 native DnD) + 우측 `ProblemEditor`.
- `problems.points`: 문제 만점 시 지급할 포인트(선생 지정, 기본 0). 아래 포인트 절 참고.

### 반(class) 관리
- `classes`(선생 소유) / `class_students`(등록 명단, 다대다) / `class_problems`(배정 문제, 다대다 — 같은 문제를 여러 반에 재사용 배정 가능).
- `/classes`(`ClassManager.tsx`): 반 CRUD + 학생 등록(`EnrollStudentsDialog`) + 문제 할당(`AssignProblemsDialog`, 폴더 단위 일괄 체크 가능) + **학생별 포인트 수동 부여**(`AwardPointsDialog`, 아래 참고). **문제 관리 기능은 여기 없음** — `/problems`로 분리됨(사용자 지시).
- 학생 쪽 "내 수업"(`/myclass`)은 `listAssignedProblems(studentId)`로 본인이 속한 반들의 배정 문제를 합쳐서 보여줌(class 이름 자체는 안 씀, 문제 목록만).

### 포인트 시스템
- `points_ledger(student_id, amount, reason, problem_id?, awarded_by?)` — 지급 이력 테이블. 랭킹은 이 테이블을 학생별로 합산해서 계산(`listPointsRanking`, 클라이언트에서 reduce — DB뷰 없음, 학생 수 많아지면 나중에 뷰/집계 쿼리로 바꿀 것).
- **자동 지급**: `submissions` insert 시 DB 트리거(`award_points_on_submission`, `0007_student_dashboard.sql`)가 `score === max_score`(만점)면 `problems.points`만큼 자동 적립. 학생·문제 조합당 1회만(`awarded_by is null`인 기존 지급 있으면 스킵). **클라이언트가 아니라 DB 트리거라서 API 우회로는 중복 지급 못 함** — 다만 클라이언트 채점 자체가 위조 가능하다는 한계는 그대로 있음(위 실행/채점 절 참고).
- **수동 지급**: 반 관리에서 학생 칩 옆 코인 아이콘 → `AwardPointsDialog`(금액+사유) → `awardPoints()`.
- `points_ledger` select RLS는 `authenticated using(true)`(랭킹 집계에 전체 학생 데이터 필요) — 즉 로그인한 아무나 다른 학생의 지급 사유(`reason`)까지 조회는 가능함. 지금은 랭킹 총합만 UI에 노출하지만, 개인 지급 내역을 비공개로 바꾸고 싶으면 RLS 정책 다시 설계 필요(지시 있을 때만).
- 학생 대시보드에 포인트 랭킹 위젯 있음. **선생 쪽엔 랭킹 위젯 없음**(요청 범위 밖, 필요하면 얘기).

### 쪽지(messages)
- `messages(sender_id, recipient_id, body, read_at)` — 양방향. RLS: 보낸사람/받는사람 본인만 select, insert는 sender=본인.
- `MessageCenter.tsx`(공용 컴포넌트, `recipients` prop만 다르게 줌): 선생 대시보드는 `recipients=학생 전체`, 학생 대시보드는 `recipients=선생 전체`(`listAllTeachers`).
- **읽음 처리 UI는 없음** — `read_at` 컬럼과 update RLS 정책은 만들어놨지만 아무 코드도 안 씀(미구현, 필요하면 추가). 실시간 갱신도 없음 — react-query 기본 staleTime 재조회에 의존(수동 새로고침/재방문 시 반영), Realtime 구독 안 붙임.

### 공지사항 / 학사 일정 — "수업 시간표"와 다른 별개 기능
- `announcements`(제목/본문, 선생 작성, 전체 열람) — `AnnouncementsPanel.tsx`(`readOnly` prop으로 선생/학생 겸용). 예전엔 대시보드에 정적 placeholder였는데 이번에 실제 기능으로 연결됨.
- `academic_events`(날짜/제목/설명, 선생 작성, 전체 열람) — `AcademicEventsPanel.tsx`(동일하게 `readOnly` prop). **DB 기반, 전체 학생에게 노출**.
- **`ScheduleCalendar.tsx`("수업 시간표")는 완전히 별개** — 선생 개인 localStorage(`flowpy:calendar:<uid>`) 저장, 학생은 못 봄, 이번 작업에서 손 안 댐. 학사 일정(academic_events)과 헷갈리지 말 것 — 사용자가 명시적으로 "수업 시간표는 선생님꺼, 학사 일정은 따로"라고 구분 지음.

### 인증/권한
- Supabase Auth, 아이디→`username@flowpy.local` 합성 이메일(`src/lib/auth.ts`). 선생 승격 `claim_teacher(code)` RPC.
- `useAuth`(`src/hooks/useAuth.tsx`): 로그인 후 role 확정 전엔 loading 유지(선생이 /student 로 튕기던 버그 수정됨). `refreshProfile` 은 live 세션 사용.
- 프로필 표시 이름 수정(`Header.tsx` 아바타 드롭다운)은 **localStorage만** 바꿈(`profile-prefs.ts`) — 로그인 아이디(`profiles.username`/synthetic email)는 애초에 건드리는 코드 자체가 없어서 안전.
- RLS: 학생=발행문제만/본인 제출만/본인이 속한 class_students·class_problems만/points_ledger·announcements·academic_events는 전체 열람. 선생=본인 문제·반·폴더 CRUD+제출 조회. 가드 `src/components/RouteGuards.tsx`(role 불일치 시 선생→`/dashboard`, 학생→`/student`로 리다이렉트).

### 라우팅/화면
- `/`=랜딩(로그아웃) or role 리다이렉트.
- **선생**: `/dashboard`(메인 허브, `Dashboard.tsx`) · `/classes`(반 관리) · `/problems`(문제 관리, 폴더트리+에디터) · `/teacher`(구 워크스페이스, **사이드 메뉴에서는 빠졌지만 라우트/파일은 안 지움** — 직접 URL 접근은 됨).
- **학생**: `/student`(`StudentDashboard.tsx`, 학습현황/공지/학사일정/포인트랭킹/쪽지) · `/myclass`(배정 문제만) · `/practice/flowchart`·`/practice/general`·`/practice/block`(카테고리별 발행 문제 전체, 공용 `PracticeList.tsx`) · `/solve/:id`(풀이).
  - 구 `StudentProblems.tsx`(발행 문제 전체 나열, 카테고리 구분 없음)는 어느 라우트에도 안 붙어있음 — 파일은 안 지움(`/teacher`와 같은 원칙), 3개 연습 페이지가 기능적으로 흡수.
- `AppShell.tsx`가 `menu`/`homePath` prop을 받도록 일반화됨 — 안 주면 기존 선생님 메뉴/`/dashboard` 그대로, 학생 페이지들은 `STUDENT_MENU`(`AppShell.tsx`에서 export) + `homePath="/student"`를 넘김. **새 role별 화면 추가할 때 AppShell 통째로 새로 만들지 말고 이 prop 재사용할 것.**
- Realtime: `useProblemsRealtime` 로 problems 변경 즉시 반영. 학생 코드 로컬 드래프트(`src/lib/draft.ts`).

### 대시보드/셸 공통 (`/dashboard`, `/student`)
- `src/components/layout/AppShell.tsx`: 좌측 접이식 사이드바(`collapsed` w-56/w-16) + 우측 상단 헤더 + 콘텐츠.
- `src/components/layout/Header.tsx`: 우측 이름 + 색상 아바타(이니셜). 클릭→드롭다운(이름 편집, 색상 8종, 로그아웃). 프로필 설정 = **localStorage**(`src/lib/profile-prefs.ts`) — profiles RLS 가 자기수정 막아 DB 미저장.
- 선생 벤토(`Dashboard.tsx`): 수업 시간표 캘린더 / 접속 중인 학생 / 내 문제·등록 학생 통계 / 최근 제출 현황 / 빠른 실행 / 공지사항(`AnnouncementsPanel`) / 학사 일정(`AcademicEventsPanel`) / 쪽지함(`MessageCenter`).
- 학생 벤토(`StudentDashboard.tsx`): 학습 현황(이어서 풀기, 본인 제출 이력 기반) / 포인트 랭킹 / 공지보기(readOnly) / 학사 일정(readOnly) / 쪽지 보내기.
- **접속 중인 학생 = Supabase Realtime presence**(`src/hooks/usePresence.ts`). 단일 채널 싱글턴 + 모듈 스토어(`useSyncExternalStore`). `usePresenceTracker` 는 `App` 의 `PresenceGate` 로 전역 1회 마운트(학생 포함 모든 로그인 유저 등록), `useOnlineUsers` 로 조회. **같은 topic 두 번 subscribe 금지**(StrictMode 이중 마운트 시 throw→빈 화면). topic `online-users`.
- 최근 제출: `listRecentSubmissions`(`src/lib/submissions.ts`), RLS 로 본인 문제 제출만.

## 알려진 한계 / 미결 (수정은 지시 있을 때만)

- **클라이언트 채점**: 학생 브라우저 Pyodide → 점수 위조 가능, 포인트 자동지급도 이 결과에 의존. 서버 이행 설계: `docs/server-sandbox-migration.md`.
- `autoLayout`("정렬" 버튼)은 flat dagre — for 컨테이너 중첩을 평탄화할 수 있음(정렬 시 그룹 깨질 위험). 미해결.
- DSL 임포트는 현재 그래프를 **대체**(병합 아님).
- ProblemEditor 저장은 수동(자동저장 아님). 발행해야 학생에게 보임.
- 번들 870KB 경고(무시 가능, code-split 안 함).
- **프로필 설정·수업 시간표(선생 개인용) = localStorage(기기별, 동기화 안 됨)**. 학사 일정(academic_events)·공지(announcements)는 이번에 DB로 옮겨졌지만 수업 시간표(ScheduleCalendar)는 그대로 localStorage.
- **포인트 랭킹은 클라이언트 합산**(DB 뷰/집계쿼리 없음) — 학생·지급건수 많아지면 느려질 수 있음.
- **쪽지 읽음 처리 미구현**(`read_at` 컬럼/RLS만 존재), **실시간 갱신 없음**(react-query 재조회 의존, Realtime 미구독).
- **points_ledger는 로그인 유저 전체가 읽을 수 있음**(랭킹 집계 위해 select RLS `true`) — 개인 지급 사유까지 남에게 보이는 구조. 프라이버시 강화 필요하면 지시 있을 때 RLS 재설계.
- 사이드바 "타자 연습"·"포인트 상점"은 선생/학생 공통 미구현 stub(토스트).
- 학생 대시보드 UI는 tsc/lint만 통과 확인했고 **브라우저 실클릭 테스트는 아직 안 함** — 로그인해서 골든패스(문제 생성→포인트 지정→학생 만점 제출→랭킹 반영, 쪽지 왕복, 공지/일정 등록→학생 화면 노출) 확인 필요.

## 진행 중이던 흐름

이전 세션은 순서도 편집기(캔버스 원본 전환, for 컨테이너, 중첩 for, 간선 직선화/재연결, 핸들 규칙, 색상, Space 버그, input 경고 등)와 선생 전용 대시보드/셸(접이식 메뉴+벤토그리드+presence+헤더 아바타+편집형 캘린더)까지 완료.

이번 세션(최근 커밋 블록)은 학원 관리 기능 전체를 붙임, 순서대로:
1. `/teacher` AppShell 통일, 사이드바 높이 정렬.
2. 반/문제 폴더/반-문제 배정 스키마 + `/classes` 관리 패널 + 테스트 학생 20계정 스크립트.
3. 문제 카테고리(순서도/파이썬/블럭) 도입, `ProblemEditor` 레이아웃 분기.
4. 로컬 Docker DB에 마이그레이션 누락되어 있던 버그 수정(로컬/클라우드 별개 적용 필요하다는 교훈, 위 Supabase 절에 명문화).
5. 반 학생 등록 + 폴더 대분류/하위폴더 계층 + 드래그로 문제 이동 + 폴더 단위 배정.
6. "미분류" 폴더 제거, 문제 관리를 `/classes`에서 `/problems`로 독립, 선생 사이드바에서 순서도/파이썬/블럭 메뉴 제거(구 `/teacher`는 안 지우고 언링크만).
7. **문제별 포인트 + 자동/수동 지급 + 공지사항 + 학사 일정 + 쪽지(양방향)** 스키마·선생 UI 추가.
8. **학생 대시보드 신설** + 학생 사이드 메뉴(내 수업/순서도·파이썬·블럭 연습) + `Solve.tsx` 카테고리 분기 수정(빈 캔버스 버그) + `AppShell` role-agnostic화.

전부 커밋+배포 완료(`git log --oneline` 참고, 최신 두 커밋이 7·8단계). DB 마이그레이션은 `0001`~`0007`, 로컬+클라우드 둘 다 적용됨.
