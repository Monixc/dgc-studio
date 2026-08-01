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
  listLessonProblemIds,
  setLessonProblems,
  listLessonProblems,
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

export function useLessonProblemIds(lessonId: string | undefined) {
  return useQuery({
    queryKey: [...LESSONS_KEY, "problems", lessonId],
    queryFn: () => listLessonProblemIds(lessonId!),
    enabled: !!lessonId,
  });
}

export function useSetLessonProblems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lessonId, problemIds }: { lessonId: string; problemIds: string[] }) =>
      setLessonProblems(lessonId, problemIds),
    onSuccess: (_, { lessonId }) =>
      qc.invalidateQueries({ queryKey: [...LESSONS_KEY, "problems", lessonId] }),
  });
}

export function useLessonProblems(lessonId: string | undefined) {
  return useQuery({
    queryKey: [...LESSONS_KEY, "problem-list", lessonId],
    queryFn: () => listLessonProblems(lessonId!),
    enabled: !!lessonId,
  });
}

export function useAssignedLessons(studentId: string | undefined) {
  return useQuery({
    queryKey: [...LESSONS_KEY, "assigned", studentId],
    queryFn: () => listAssignedLessons(studentId!),
    enabled: !!studentId,
  });
}
