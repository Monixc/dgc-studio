import { useState } from "react";
import { LogOut, GraduationCap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import ProblemPanel from "@/components/teacher/ProblemPanel";
import ProblemEditor from "@/components/teacher/ProblemEditor";
import { Button } from "@/components/ui/button";

export default function TeacherProblems() {
  const { user, profile } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <GraduationCap className="text-primary" />
        <span className="font-bold">Flow-Py</span>
        <span className="text-sm text-muted-foreground">{profile?.display_name} 선생님</span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => signOut()}>
          <LogOut /> 로그아웃
        </Button>
      </header>
      <div className="flex flex-1 overflow-hidden">
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
    </div>
  );
}
