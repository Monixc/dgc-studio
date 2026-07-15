import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { POINTS_KEY, awardPoints, listPointsRanking } from "@/lib/points";

export function usePointsRanking() {
  return useQuery({ queryKey: POINTS_KEY, queryFn: listPointsRanking });
}

export function useAwardPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { teacherId: string; studentId: string; amount: number; reason: string }) =>
      awardPoints(args.teacherId, args.studentId, args.amount, args.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: POINTS_KEY }),
  });
}
