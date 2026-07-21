import { useEffect, useRef, useState } from "react";
import {
  GraduationCap,
  Workflow,
  Terminal,
  Blocks,
  Keyboard,
  MessageSquare,
  Store,
  ArrowRight,
  ChevronDown,
  Gift,
  Coins,
} from "lucide-react";
import AuthDropdown from "@/components/auth/AuthDropdown";

const PRIMARY = "hsl(var(--primary))";
const PRIMARY_FG = "hsl(var(--primary-foreground))";
const BORDER = "hsl(var(--border))";
const FOREGROUND = "hsl(var(--foreground))";
const MUTED_FG = "hsl(var(--muted-foreground))";
const BACKGROUND = "hsl(var(--background))";

const QUICK_LINKS: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: "flowchart", label: "순서도", icon: <Workflow className="size-3.5" /> },
  { id: "ide", label: "온라인 IDE", icon: <Terminal className="size-3.5" /> },
  { id: "block", label: "블록 코딩", icon: <Blocks className="size-3.5" /> },
  { id: "typing", label: "타자 연습", icon: <Keyboard className="size-3.5" /> },
  { id: "portfolio", label: "포트폴리오 첨삭", icon: <MessageSquare className="size-3.5" /> },
  { id: "shop", label: "포인트 상점", icon: <Store className="size-3.5" /> },
];

function scrollToSection(id: string) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

export default function Landing() {
  const [authState, setAuthState] = useState<null | "login" | "signup">(null);

  return (
    <div
      className="flex min-h-screen flex-col bg-background text-foreground"
      style={{ backgroundImage: `radial-gradient(${BORDER} 1px, transparent 1px)`, backgroundSize: "24px 24px" }}
    >
      <style>{`
        .fp-line { stroke-dasharray: 1; stroke-dashoffset: 1; animation: fp-draw 1s ease forwards; }
        .fp-pop { opacity: 0; transform: scale(0.92); animation: fp-pop 0.5s ease forwards; }
        @keyframes fp-draw { to { stroke-dashoffset: 0; } }
        @keyframes fp-pop { to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          .fp-line, .fp-pop { animation: none; stroke-dashoffset: 0; opacity: 1; transform: none; }
        }
      `}</style>

      <header className="flex items-center gap-2 border-b bg-background px-6 py-3">
        <GraduationCap className="text-primary" />
        <span className="text-lg font-black tracking-tight">디랩과천</span>
        <div className="ml-auto">
          <AuthDropdown openState={authState} onOpenStateChange={setAuthState} />
        </div>
      </header>

      <main className="flex-1">
        {/* 1. 서비스 개요 */}
        <section className="mx-auto max-w-3xl px-6 py-20 text-center sm:py-28">
          <p className="font-mono text-xs tracking-widest text-muted-foreground">디랩과천 · 올인원 파이썬 학습</p>
          <h1 className="mx-auto mt-3 max-w-2xl text-balance text-4xl font-black leading-[1.15] tracking-tight [word-break:keep-all] sm:text-5xl">
            코드부터 상점까지, 배움의 모든 순간을 한 곳에서
          </h1>
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setAuthState("signup")}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              학습 시작하기 <ArrowRight className="size-4" />
            </button>
          </div>

          <div className="mt-14 flex flex-wrap justify-center gap-2">
            {QUICK_LINKS.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          <div className="mt-10 flex justify-center text-muted-foreground motion-safe:animate-bounce motion-reduce:animate-none">
            <ChevronDown className="size-5" />
          </div>
        </section>

        {/* 2. 순서도 */}
        <FeatureSection
          id="flowchart"
          icon={<Workflow />}
          eyebrow="TEACHER · 문제 설계"
          title="순서도로 문제를 설계합니다"
          desc="노드를 끌어 놓고 연결해 흐름을 만듭니다. 기존 DSL 코드를 그대로 가져와 순서도로 되살릴 수도 있습니다."
          visual={<FlowDiagram />}
        />

        {/* 3. 파이썬 온라인 IDE */}
        <FeatureSection
          id="ide"
          band
          reverse
          icon={<Terminal />}
          eyebrow="STUDENT · 코드 실행"
          title="브라우저에서 바로 코드를 실행합니다"
          desc="Monaco 에디터로 작성하고 Pyodide로 즉시 실행합니다. 제출하면 테스트 케이스로 자동 채점되어 선생님이 결과를 바로 확인합니다."
          visual={<IdeDemo />}
        />

        {/* 4. 블록 코딩 */}
        <FeatureSection
          id="block"
          icon={<Blocks />}
          eyebrow="또 다른 문제 유형"
          title="블록을 끼워 맞춰도 코드가 됩니다"
          desc="텍스트 코딩이 아직 낯선 학생은 스크래치처럼 블록을 조립합니다. 조립한 블록은 그대로 파이썬 코드로 변환됩니다."
          visual={<BlockDemo />}
        />

        {/* 5. 타자 연습 */}
        <FeatureSection
          id="typing"
          band
          reverse
          icon={<Keyboard />}
          title="타자 연습으로 손에 코드를 익힙니다"
          desc="봇·실시간 상대와 게임처럼 대결하며 재미있게 타자를 연습합니다. 속도 랭킹에도 오릅니다."
          visual={<TypingDemo />}
        />

        {/* 6. 포트폴리오 첨삭 */}
        <FeatureSection
          id="portfolio"
          icon={<MessageSquare />}
          eyebrow="피드백"
          title="포트폴리오에 범위 지정 첨삭을 남깁니다"
          desc="학생이 쓴 노트와 첨부한 이미지에 선생님이 원하는 부분을 짚어 코멘트를 남기면, 학생에게 바로 알림이 갑니다."
          visual={<NoteDemo />}
        />

        {/* 7. 포인트 상점 */}
        <FeatureSection
          id="shop"
          band
          reverse
          icon={<Store />}
          eyebrow="동기부여"
          title="모은 포인트로 상점에서 교환합니다"
          desc="문제를 풀며 얻은 포인트로 상점에서 아이템을 구매합니다."
          visual={<ShopDemo />}
        />

        {/* 마무리 CTA */}
        <Reveal>
          <section className="border-t px-6 py-20 text-center">
            <h2 className="text-balance text-2xl font-black tracking-tight [word-break:keep-all] sm:text-3xl">지금 바로 시작해보세요</h2>
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setAuthState("signup")}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                학습 시작하기 <ArrowRight className="size-4" />
              </button>
            </div>
          </section>
        </Reveal>
      </main>

      <footer className="border-t bg-background py-4 text-center text-xs text-muted-foreground">
        디랩과천 · 올인원 파이썬 학습
      </footer>
    </div>
  );
}

function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      {children}
    </div>
  );
}

function FeatureSection({
  id,
  icon,
  eyebrow,
  title,
  desc,
  visual,
  reverse,
  band,
}: {
  id: string;
  icon: React.ReactNode;
  eyebrow?: string;
  title: string;
  desc: string;
  visual: React.ReactNode;
  reverse?: boolean;
  band?: boolean;
}) {
  return (
    <Reveal>
      <section id={id} className={`border-t ${band ? "bg-muted/60" : ""}`}>
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center">
          <div className={reverse ? "lg:order-2" : ""}>
            <div className="mb-4 flex size-10 items-center justify-center rounded-full border bg-background text-primary">
              {icon}
            </div>
            {eyebrow && <p className="font-mono text-xs tracking-widest text-muted-foreground">{eyebrow}</p>}
            <h2 className="mt-2 text-balance text-2xl font-black tracking-tight [word-break:keep-all] sm:text-3xl">{title}</h2>
            <p className="mt-3 max-w-[46ch] text-muted-foreground">{desc}</p>
          </div>
          <div className={reverse ? "lg:order-1" : ""}>{visual}</div>
        </div>
      </section>
    </Reveal>
  );
}

function IdeDemo() {
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-2xl border bg-foreground font-mono text-sm text-background shadow-sm">
      <div className="flex items-center gap-2 border-b border-background/10 px-4 py-2 text-xs text-background/50">
        <span className="size-2 rounded-full bg-background/40" />
        solution.py
      </div>
      <pre className="overflow-x-auto px-4 py-4 leading-relaxed">
<span className="font-semibold">def</span> check_even(n: int) -&gt; <span className="font-semibold">bool</span>:{"\n"}    <span className="text-background/50"># 짝수인지 확인</span>{"\n"}    <span className="font-semibold">return</span> n % 2 == 0{"\n\n"}print(check_even(7))
      </pre>
      <div className="flex flex-wrap items-center gap-3 border-t border-background/10 px-4 py-3 text-xs">
        <span className="text-background/50">▶ 실행 결과: False</span>
        <span className="rounded-full bg-background/15 px-2 py-1 text-background">테스트 1 통과 (n=4)</span>
        <span className="rounded-full bg-destructive/20 px-2 py-1 text-destructive">테스트 2 실패 (n=7)</span>
      </div>
    </div>
  );
}

function BlockDemo() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-card p-5">
      <div className="rounded-xl border bg-muted/40 p-3">
        <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 font-mono text-sm">
          <span className="font-semibold">반복하기</span>
          <span className="text-muted-foreground">5 번</span>
        </div>
        <div className="ml-4 mt-2 space-y-2 border-l-2 pl-3">
          <div className="rounded-lg border bg-background px-3 py-2 font-mono text-sm">
            화면에 출력하기 <span className="text-muted-foreground">"전진!"</span>
          </div>
          <div className="rounded-lg border bg-background px-3 py-2 font-mono text-sm">
            앞으로 <span className="text-muted-foreground">10</span> 만큼 움직이기
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowRight className="size-3" /> 자동 변환
      </div>
      <pre className="mt-2 overflow-x-auto rounded-xl bg-foreground px-4 py-3 font-mono text-xs text-background">
for _ in range(5):{"\n"}    print("전진!"){"\n"}    move(10)
      </pre>
    </div>
  );
}

function TypingDemo() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-card p-5">
      <p className="rounded-lg border bg-background px-3 py-2 font-mono text-sm">
        <span>print(</span>
        <span>"hello"</span>
        <span className="border-r-2 border-primary">)</span>
        <span className="text-muted-foreground">.upper()</span>
      </p>
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-8 text-muted-foreground">나</span>
          <div className="h-2 flex-1 rounded-full bg-muted">
            <div className="h-2 w-4/5 rounded-full bg-primary" />
          </div>
          <span className="w-16 text-right font-mono tabular-nums">62 WPM</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-8 text-muted-foreground">봇</span>
          <div className="h-2 flex-1 rounded-full bg-muted">
            <div className="h-2 w-3/5 rounded-full bg-muted-foreground/50" />
          </div>
          <span className="w-16 text-right font-mono tabular-nums">48 WPM</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span>실시간 랭킹</span>
        <span className="font-mono tabular-nums">1위 · 71 WPM</span>
      </div>
    </div>
  );
}

function NoteDemo() {
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border bg-card p-5">
        <p className="text-xs text-muted-foreground">이번 주 프로젝트 노트</p>
        <p className="mt-2 text-sm leading-relaxed">
          반복문을 활용해 별 찍기 패턴을 만들어봤다.{" "}
          <span className="rounded bg-primary/10 px-0.5 underline decoration-primary decoration-2 underline-offset-2">
            처음엔 무한 루프에 빠져서 한참 애먹었지만
          </span>{" "}
          범위를 다시 확인하고 나서 정상 동작했다.
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs text-muted-foreground">
          📎 별찍기.png
        </span>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-xl border bg-card p-3 text-sm">
        <MessageSquare className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <p>
            <span className="font-semibold">3–4번째 줄</span> · 어디서 왜 막혔는지 조금 더 적어볼까요?
          </p>
          <p className="mt-1 text-xs text-muted-foreground">김선생 · 방금 · 알림 전송됨</p>
        </div>
      </div>
    </div>
  );
}

function ShopDemo() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">상점</span>
        <span className="font-mono tabular-nums text-muted-foreground">내 포인트 · 340P</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border p-3 text-center">
          <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full border bg-background text-primary">
            <Gift className="size-4" />
          </div>
          <p className="text-sm font-medium">교실 청소 면제권</p>
          <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">120P</p>
          <button className="mt-2 w-full rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted">구매 요청</button>
        </div>
        <div className="rounded-xl border p-3 text-center">
          <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full border bg-background text-primary">
            <Coins className="size-4" />
          </div>
          <p className="text-sm font-medium">간식 쿠폰</p>
          <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">80P</p>
          <button className="mt-2 w-full rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted">구매 요청</button>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">구매 요청은 선생님 승인 후 지급됩니다.</p>
    </div>
  );
}

function FlowDiagram() {
  return (
    <svg
      viewBox="-40 0 440 420"
      className="mx-auto w-full max-w-sm"
      role="img"
      aria-label="문제 출제부터 제출 완료까지, 실패 시 재작성으로 돌아가는 순서도"
    >
      <defs>
        <marker id="fp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={BORDER} />
        </marker>
      </defs>

      {/* connectors */}
      <path pathLength="1" className="fp-line" d="M150,56 L150,84" stroke={BORDER} strokeWidth="2" markerEnd="url(#fp-arrow)" style={{ animationDelay: "0.1s" }} />
      <path pathLength="1" className="fp-line" d="M150,138 L150,166" stroke={BORDER} strokeWidth="2" markerEnd="url(#fp-arrow)" style={{ animationDelay: "0.3s" }} />
      <path pathLength="1" className="fp-line" d="M150,220 L150,258" stroke={BORDER} strokeWidth="2" markerEnd="url(#fp-arrow)" style={{ animationDelay: "0.5s" }} />
      <path pathLength="1" className="fp-line" d="M245,318 L316,318" stroke={BORDER} strokeWidth="2" markerEnd="url(#fp-arrow)" style={{ animationDelay: "0.7s" }} />
      <path pathLength="1" className="fp-line" d="M55,318 C -20,318 -20,111 58,111" stroke={BORDER} strokeWidth="2" fill="none" markerEnd="url(#fp-arrow)" style={{ animationDelay: "0.9s" }} />

      {/* nodes */}
      <ellipse cx="150" cy="30" rx="90" ry="26" className="fp-pop" fill={PRIMARY} style={{ animationDelay: "0s" }} />
      <text x="150" y="35" textAnchor="middle" className="fp-pop font-mono" style={{ animationDelay: "0s" }} fontSize="13" fill={PRIMARY_FG}>문제 출제</text>

      <rect x="60" y="84" width="180" height="54" rx="14" className="fp-pop" fill={BACKGROUND} stroke={BORDER} style={{ animationDelay: "0.2s" }} />
      <text x="150" y="116" textAnchor="middle" className="fp-pop font-mono" style={{ animationDelay: "0.2s" }} fontSize="13" fill={FOREGROUND}>순서도 보고 코드 작성</text>

      <rect x="60" y="166" width="180" height="54" rx="14" className="fp-pop" fill={BACKGROUND} stroke={BORDER} style={{ animationDelay: "0.4s" }} />
      <text x="150" y="198" textAnchor="middle" className="fp-pop font-mono" style={{ animationDelay: "0.4s" }} fontSize="13" fill={FOREGROUND}>웹에서 실행</text>

      <polygon points="150,258 245,318 150,378 55,318" className="fp-pop" fill={BACKGROUND} stroke={FOREGROUND} strokeWidth="1.5" style={{ animationDelay: "0.6s" }} />
      <text x="150" y="323" textAnchor="middle" className="fp-pop font-mono" style={{ animationDelay: "0.6s" }} fontSize="12" fill={FOREGROUND}>테스트 통과?</text>

      <ellipse cx="356" cy="318" rx="42" ry="24" className="fp-pop" fill={PRIMARY} style={{ animationDelay: "0.8s" }} />
      <text x="356" y="323" textAnchor="middle" className="fp-pop font-mono" style={{ animationDelay: "0.8s" }} fontSize="12" fill={PRIMARY_FG}>제출 완료</text>

      <text x="280" y="308" textAnchor="middle" className="fp-pop font-mono" style={{ animationDelay: "0.8s" }} fontSize="10" fill={MUTED_FG}>예</text>
      <text x="-20" y="205" textAnchor="middle" className="fp-pop font-mono" style={{ animationDelay: "1s" }} fontSize="10" fill={MUTED_FG}>아니오, 재작성</text>
    </svg>
  );
}
