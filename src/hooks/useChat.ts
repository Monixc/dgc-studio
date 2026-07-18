import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MESSAGES_KEY, listMyMessages, markMessagesRead, sendMessage } from "@/lib/messages";
import { notifyPush } from "@/lib/push";

/** 채팅(1:1 쪽지) 데이터 + 실시간 + 미읽음 수. 헤더가 한 번만 마운트해 패널/배지에 공유. */
export function useChat(userId: string | undefined) {
  const qc = useQueryClient();
  const key = [...MESSAGES_KEY, "mine", userId];

  const messagesQuery = useQuery({
    queryKey: key,
    queryFn: () => listMyMessages(userId!),
    enabled: !!userId,
  });

  // messages RLS(본인 관련 행만 select) 덕에 필터 없이 구독해도 내 쪽지만 전달됨
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`messages:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => void qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, userId]);

  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);
  const unreadCount = useMemo(
    () => messages.filter((m) => m.recipient_id === userId && !m.read_at).length,
    [messages, userId],
  );

  const send = useMutation({
    mutationFn: (args: { recipientId: string; body: string }) =>
      sendMessage(userId!, args.recipientId, args.body),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: key });
      void notifyPush("message", row.id);
    },
  });

  const markRead = useMutation({
    mutationFn: (counterpartId: string) => markMessagesRead(userId!, counterpartId),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { messages, unreadCount, isLoading: messagesQuery.isLoading, send, markRead };
}
