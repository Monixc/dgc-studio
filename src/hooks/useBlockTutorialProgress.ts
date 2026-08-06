import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BLOCK_TUTORIAL_PROGRESS_KEY,
  listCompletedMissionIds,
  markMissionComplete,
} from "@/lib/blockTutorialProgress";

export function useCompletedMissionIds(studentId: string | undefined) {
  return useQuery({
    queryKey: [...BLOCK_TUTORIAL_PROGRESS_KEY, studentId],
    queryFn: () => listCompletedMissionIds(studentId!),
    enabled: !!studentId,
  });
}

export function useMarkMissionComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, missionId }: { studentId: string; missionId: string }) =>
      markMissionComplete(studentId, missionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOCK_TUTORIAL_PROGRESS_KEY }),
  });
}
