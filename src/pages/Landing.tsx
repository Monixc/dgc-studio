import { GraduationCap, Workflow, Code2, CheckCircle2 } from "lucide-react";
import AuthDropdown from "@/components/auth/AuthDropdown";

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-2 border-b px-6 py-3">
        <GraduationCap className="text-primary" />
        <span className="text-lg font-bold">Flow-Py</span>
        <div className="ml-auto">
          <AuthDropdown />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          순서도로 배우는 파이썬
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          선생님은 순서도를 그리고 문제를 내고, 학생은 순서도를 보며 코드를 작성·실행·제출합니다.
          브라우저에서 바로 파이썬이 돌아갑니다.
        </p>

        <div className="mt-8">
          <AuthDropdown
            trigger={
              <button className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">
                학습 시작하기 →
              </button>
            }
          />
        </div>

        <div className="mt-12 grid max-w-3xl gap-6 sm:grid-cols-3">
          <Feature icon={<Workflow />} title="드래그드롭 순서도" desc="draw.io처럼 노드를 끌어 놓고 연결. DSL 가져오기도 지원." />
          <Feature icon={<Code2 />} title="웹 IDE + 실행" desc="Monaco 에디터에서 파이썬 작성, Pyodide로 즉시 실행." />
          <Feature icon={<CheckCircle2 />} title="자동 채점" desc="테스트 케이스로 제출 자동 채점, 선생님이 결과 확인." />
        </div>
      </main>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground">Flow-Py · 순서도 기반 파이썬 학습</footer>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border p-5 text-left">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full border bg-background text-foreground">
        {icon}
      </div>
      <div className="font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
