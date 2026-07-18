import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  NOTIFICATIONS_KEY,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

export function useNotifications(userId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [...NOTIFICATIONS_KEY, userId],
    queryFn: () => listNotifications(userId!),
    enabled: !!userId,
  });

  // 새 알림 실시간 수신 → 캐시 무효화 (RLS로 본인 행만 전달됨)
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => void qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY, userId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc, userId]);

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY, userId] }),
  });
  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(userId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY, userId] }),
  });

  return { ...query, markRead, markAllRead };
}
