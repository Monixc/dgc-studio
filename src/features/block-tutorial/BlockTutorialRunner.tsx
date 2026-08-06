import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Lightbulb, Play, Loader2, PartyPopper } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePyodide } from "@/hooks/usePyodide";
import { useCompletedMissionIds, useMarkMissionComplete } from "@/hooks/useBlockTutorialProgress";
import { findTutorial } from "@/features/block-tutorial/tutorials";
import GhostMascot from "@/features/block-tutorial/assets/GhostMascot";
import BlockWorkspacePanel from "@/features/block-coding/BlockWorkspacePanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const IDLE_HINT_MS = 25_000;

export default function BlockTutorialRunner() {
  const { tutorialId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tutorial = findTutorial(tutorialId);
  const { data: completedIds = [], isSuccess: progressLoaded } = useCompletedMissionIds(user?.id);
  const markCompleteMut = useMarkMissionComplete();
  const { run, running } = usePyodide();

  const [missionIndex, setMissionIndex] = useState(0);
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || !progressLoaded || !tutorial) return;
    resumedRef.current = true;
    const firstIncomplete = tutorial.missions.findIndex((m) => !completedIds.includes(m.id));
    if (firstIncomplete > 0) setMissionIndex(firstIncomplete);
  }, [progressLoaded, completedIds, tutorial]);
  const mission = tutorial?.missions[missionIndex];

  const [code, setCode] = useState("");
  const [hintCount, setHintCount] = useState(0);
  const [success, setSuccess] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setCode(mission?.starterCode ?? "");
    setHintCount(0);
    setSuccess(false);
    // mission.id 로 충분 — starterCode는 항상 id에 종속.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission?.id]);

  // 30초 근처(25초) 동안 블록을 하나도 안 놓으면 첫 힌트를 스스로 보여준다.
  useEffect(() => {
    clearTimeout(idleTimer.current);
    if (success || code.trim() !== (mission?.starterCode ?? "").trim()) return;
    idleTimer.current = setTimeout(() => setHintCount((n) => Math.max(n, 1)), IDLE_HINT_MS);
    return () => clearTimeout(idleTimer.current);
  }, [code, success, mission?.starterCode]);

  if (!tutorial || !mission) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        튜토리얼을 찾을 수 없습니다.{" "}
        <button className="underline" onClick={() => navigate("/practice/block")}>
          목록으로
        </button>
      </div>
    );
  }

  async function handleCheck() {
    const result = await run(code, { stdin: mission!.stdin });
    if (!result.ok) {
      const lastLine = result.error?.trim().split("\n").filter(Boolean).pop();
      toast.error(lastLine ? `코드에 오류가 있어요: ${lastLine}` : "코드에 오류가 있어요.");
      return;
    }
    if (!mission!.validate({ code, output: result.output })) {
      toast.error("실행은 됐지만 아직 목표를 달성하지 못했어요. 힌트를 참고해보세요.");
      return;
    }
    setSuccess(true);
    if (user && !completedIds.includes(mission!.id)) {
      markCompleteMut.mutate({ studentId: user.id, missionId: mission!.id });
    }
  }

  function goNext() {
    if (missionIndex + 1 < tutorial!.missions.length) {
      setMissionIndex((i) => i + 1);
    } else {
      navigate("/practice/block");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b bg-background px-4 py-2.5">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => navigate("/practice/block")}>
          <ArrowLeft className="size-4" />
        </Button>
        <span className="truncate font-semibold">{tutorial.title}</span>
        <span className="text-xs text-muted-foreground">
          {missionIndex + 1} / {tutorial.missions.length}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-3 lg:grid-cols-[280px_1fr] lg:overflow-hidden">
        <div className="flex flex-col gap-3 lg:overflow-auto">
          <GhostMascot mood={success ? "happy" : "idle"} speech={mission.story} />

          <Card>
            <CardContent className="space-y-2 p-3 text-sm">
              <p className="font-medium">{mission.objective}</p>
              {mission.tip && <p className="rounded-md bg-sky-50 p-2 text-xs text-sky-800">{mission.tip}</p>}
              {hintCount > 0 && (
                <ul className="space-y-1 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
                  {mission.hints.slice(0, hintCount).map((h, i) => (
                    <li key={i} className="flex gap-1.5">
                      <Lightbulb className="size-3.5 shrink-0" /> {h}
                    </li>
                  ))}
                </ul>
              )}
              {hintCount < mission.hints.length && !success && (
                <Button variant="outline" size="sm" onClick={() => setHintCount((n) => n + 1)}>
                  <Lightbulb className="size-3.5" /> 힌트 보기
                </Button>
              )}
            </CardContent>
          </Card>

          {success ? (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="space-y-3 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-emerald-700">
                  <PartyPopper className="size-4" /> 완료!
                </p>
                <p className="text-emerald-800">{mission.explanation}</p>
                <Button size="sm" onClick={goNext}>
                  {missionIndex + 1 < tutorial.missions.length ? "다음 미션" : "튜토리얼 목록으로"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Button onClick={handleCheck} disabled={running}>
              {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} 실행해서 확인
            </Button>
          )}
        </div>

        <div className="min-h-[420px] overflow-hidden rounded-lg border lg:min-h-0">
          <BlockWorkspacePanel
            key={mission.id}
            starterCode={mission.starterCode}
            initialCode={mission.starterCode}
            onCodeChange={setCode}
            allowedBlockIds={mission.allowedBlockIds}
          />
        </div>
      </div>
    </div>
  );
}
