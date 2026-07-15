import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CLASSES_KEY,
  listClasses,
  createClass,
  renameClass,
  deleteClass,
  listClassProblemIds,
  setClassProblems,
} from "@/lib/classes";

export function useClasses(userId: string | undefined) {
  return useQuery({
    queryKey: [...CLASSES_KEY, userId],
    queryFn: () => listClasses(userId!),
    enabled: !!userId,
  });
}

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, name }: { userId: string; name: string }) => createClass(userId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLASSES_KEY }),
  });
}

export function useRenameClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameClass(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLASSES_KEY }),
  });
}

export function useDeleteClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteClass(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLASSES_KEY }),
  });
}

export function useClassProblemIds(classId: string | undefined) {
  return useQuery({
    queryKey: [...CLASSES_KEY, "problems", classId],
    queryFn: () => listClassProblemIds(classId!),
    enabled: !!classId,
  });
}

export function useSetClassProblems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, problemIds }: { classId: string; problemIds: string[] }) =>
      setClassProblems(classId, problemIds),
    onSuccess: (_, { classId }) =>
      qc.invalidateQueries({ queryKey: [...CLASSES_KEY, "problems", classId] }),
  });
}
