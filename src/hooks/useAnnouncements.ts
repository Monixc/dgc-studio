import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ANNOUNCEMENTS_KEY, createAnnouncement, deleteAnnouncement, listAnnouncements } from "@/lib/announcements";
import { notifyPush } from "@/lib/push";

export function useAnnouncements() {
  return useQuery({ queryKey: ANNOUNCEMENTS_KEY, queryFn: listAnnouncements });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { teacherId: string; title: string; body: string }) =>
      createAnnouncement(args.teacherId, args),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
      void notifyPush("announcement", row.id);
    },
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY }),
  });
}
