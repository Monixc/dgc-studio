import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ANNOUNCEMENTS_KEY, createAnnouncement, deleteAnnouncement, listAnnouncements } from "@/lib/announcements";

export function useAnnouncements() {
  return useQuery({ queryKey: ANNOUNCEMENTS_KEY, queryFn: listAnnouncements });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { teacherId: string; title: string; body: string }) =>
      createAnnouncement(args.teacherId, args),
    onSuccess: () => qc.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY }),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY }),
  });
}
