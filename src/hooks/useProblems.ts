import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PROBLEMS_KEY,
  listMyProblems,
  listPublishedProblems,
  getProblem,
  createProblem,
  updateProblem,
  deleteProblem,
  type ProblemUpdate,
} from "@/lib/problems";
import type { ProblemCategory } from "@/integrations/supabase/types";

export function useMyProblems(userId: string | undefined) {
  return useQuery({
    queryKey: [...PROBLEMS_KEY, "mine", userId],
    queryFn: () => listMyProblems(userId!),
    enabled: !!userId,
  });
}

export function usePublishedProblems(enabled = true) {
  return useQuery({
    queryKey: [...PROBLEMS_KEY, "published"],
    queryFn: listPublishedProblems,
    enabled,
  });
}

export function useProblem(id: string | undefined) {
  return useQuery({
    queryKey: [...PROBLEMS_KEY, "one", id],
    queryFn: () => getProblem(id!),
    enabled: !!id,
  });
}

export function useCreateProblem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { userId: string; category?: ProblemCategory; folderId?: string | null }) =>
      createProblem(args.userId, args),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROBLEMS_KEY }),
  });
}

export function useUpdateProblem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProblemUpdate }) => updateProblem(id, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: PROBLEMS_KEY });
      qc.setQueryData([...PROBLEMS_KEY, "one", data.id], data);
    },
  });
}

export function useDeleteProblem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProblem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROBLEMS_KEY }),
  });
}
