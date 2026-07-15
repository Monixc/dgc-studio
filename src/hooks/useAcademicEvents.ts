import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ACADEMIC_EVENTS_KEY, createAcademicEvent, deleteAcademicEvent, listAcademicEvents } from "@/lib/academicEvents";

export function useAcademicEvents() {
  return useQuery({ queryKey: ACADEMIC_EVENTS_KEY, queryFn: listAcademicEvents });
}

export function useCreateAcademicEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { teacherId: string; date: string; title: string; description?: string }) =>
      createAcademicEvent(args.teacherId, args),
    onSuccess: () => qc.invalidateQueries({ queryKey: ACADEMIC_EVENTS_KEY }),
  });
}

export function useDeleteAcademicEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAcademicEvent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ACADEMIC_EVENTS_KEY }),
  });
}
