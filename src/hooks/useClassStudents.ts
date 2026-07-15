import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CLASS_STUDENTS_KEY,
  listAllStudents,
  listClassStudentIds,
  setClassStudents,
} from "@/lib/classStudents";

export function useAllStudents() {
  return useQuery({
    queryKey: [...CLASS_STUDENTS_KEY, "all"],
    queryFn: listAllStudents,
  });
}

export function useClassStudentIds(classId: string | undefined) {
  return useQuery({
    queryKey: [...CLASS_STUDENTS_KEY, classId],
    queryFn: () => listClassStudentIds(classId!),
    enabled: !!classId,
  });
}

export function useSetClassStudents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, studentIds }: { classId: string; studentIds: string[] }) =>
      setClassStudents(classId, studentIds),
    onSuccess: (_, { classId }) =>
      qc.invalidateQueries({ queryKey: [...CLASS_STUDENTS_KEY, classId] }),
  });
}
