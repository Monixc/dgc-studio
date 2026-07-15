import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import ProblemPanel from "@/components/teacher/ProblemPanel";
import ProblemEditor from "@/components/teacher/ProblemEditor";
import AppShell from "@/components/layout/AppShell";

export default function TeacherProblems() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <AppShell>
      <div className="flex h-full overflow-hidden">
        <ProblemPanel userId={user!.id} selectedId={selectedId} onSelect={setSelectedId} />
        <div className="flex-1 overflow-hidden">
          {selectedId ? (
            <ProblemEditor key={selectedId} problemId={selectedId} />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              왼쪽에서 문제를 선택하거나 “새 문제”를 만드세요.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
