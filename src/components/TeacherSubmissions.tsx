import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { listProblemSubmissions } from "@/lib/submissions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function TeacherSubmissions({ problemId }: { problemId: string }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["submissions", problemId],
    queryFn: () => listProblemSubmissions(problemId),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ClipboardList /> 제출 현황
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>제출 현황</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중…</p>
        ) : subs.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 제출이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {subs.map((s) => (
              <div key={s.id} className="rounded-lg border">
                <button
                  className="flex w-full items-center justify-between p-3 text-left"
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                >
                  <div>
                    <div className="font-medium">{s.student_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.submitted_at).toLocaleString("ko-KR")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {s.passed_tests}/{s.total_tests} · {s.score}/{s.max_score}점
                    </span>
                    <ChevronDown className={cn("size-4 transition", expanded === s.id && "rotate-180")} />
                  </div>
                </button>
                {expanded === s.id && (
                  <div className="border-t p-3">
                    <div className="mb-2 space-y-1">
                      {s.grading_details.map((d) => (
                        <div key={d.caseId} className="flex items-center gap-2 text-xs">
                          {d.passed ? (
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          ) : (
                            <XCircle className="size-4 text-destructive" />
                          )}
                          <span>{d.title}</span>
                        </div>
                      ))}
                    </div>
                    <div className={cn("grid gap-3", s.block_image && "md:grid-cols-2")}>
                      {s.block_image && (
                        <div className="min-w-0">
                          <h3 className="mb-1 text-xs font-semibold text-muted-foreground">블록 조합</h3>
                          <div className="overflow-auto rounded border bg-white p-2">
                            <img src={s.block_image} alt={`${s.student_name}의 블록 조합`} className="max-w-none" />
                          </div>
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="mb-1 text-xs font-semibold text-muted-foreground">변환된 Python 코드</h3>
                        <pre className="overflow-auto rounded bg-muted p-2 font-mono text-xs">{s.code}</pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
