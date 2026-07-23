import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LESSONS_KEY,
  listLessons,
  getLesson,
  createLesson,
  updateLesson,
  deleteLesson,
  listClassLessonIds,
  setClassLessons,
  listAssignedLessons,
  type NewLesson,
} from "@/lib/lessons";

export function useLessons(userId: string | undefined) {
  return useQuery({
    queryKey: [...LESSONS_KEY, userId],
    queryFn: () => listLessons(userId!),
    enabled: !!userId,
  });
}

export function useLesson(id: string | undefined) {
  return useQuery({
    queryKey: [...LESSONS_KEY, "one", id],
    queryFn: () => getLesson(id!),
    enabled: !!id,
  });
}

export function useCreateLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: Partial<NewLesson> }) =>
      createLesson(userId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: LESSONS_KEY }),
  });
}

export function useUpdateLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<NewLesson> }) => updateLesson(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: LESSONS_KEY }),
  });
}

export function useDeleteLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLesson(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: LESSONS_KEY }),
  });
}

export function useClassLessonIds(classId: string | undefined) {
  return useQuery({
    queryKey: [...LESSONS_KEY, "class", classId],
    queryFn: () => listClassLessonIds(classId!),
    enabled: !!classId,
  });
}

export function useSetClassLessons() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, lessonIds }: { classId: string; lessonIds: string[] }) =>
      setClassLessons(classId, lessonIds),
    onSuccess: (_, { classId }) =>
      qc.invalidateQueries({ queryKey: [...LESSONS_KEY, "class", classId] }),
  });
}

export function useAssignedLessons(studentId: string | undefined) {
  return useQuery({
    queryKey: [...LESSONS_KEY, "assigned", studentId],
    queryFn: () => listAssignedLessons(studentId!),
    enabled: !!studentId,
  });
}
