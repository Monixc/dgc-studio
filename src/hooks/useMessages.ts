import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MESSAGES_KEY, listAllTeachers, listMyMessages, listStudentTeachers, sendMessage } from "@/lib/messages";
import { notifyPush } from "@/lib/push";

export function useAllTeachers() {
  return useQuery({ queryKey: [...MESSAGES_KEY, "teachers"], queryFn: listAllTeachers });
}

export function useStudentTeachers(studentId: string | undefined) {
  return useQuery({
    queryKey: [...MESSAGES_KEY, "student-teachers", studentId],
    queryFn: () => listStudentTeachers(studentId!),
    enabled: !!studentId,
  });
}

export function useMyMessages(userId: string | undefined) {
  return useQuery({
    queryKey: [...MESSAGES_KEY, "mine", userId],
    queryFn: () => listMyMessages(userId!),
    enabled: !!userId,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { senderId: string; recipientId: string; body: string }) =>
      sendMessage(args.senderId, args.recipientId, args.body),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: MESSAGES_KEY });
      void notifyPush("message", row.id);
    },
  });
}
