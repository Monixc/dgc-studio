import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface OnlineUser {
  id: string;
  name: string;
  role: string;
}

const TOPIC = "online-users";

/** 로그인 상태면 전역 presence 채널에 자신을 등록. App 최상단에 1회 마운트. */
export function usePresenceTracker() {
  const { user, profile } = useAuth();
  useEffect(() => {
    if (!user || !profile) return;
    const ch = supabase.channel(TOPIC, { config: { presence: { key: user.id } } });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void ch.track({ id: user.id, name: profile.display_name, role: profile.role });
      }
    });
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, profile]);
}

/** 현재 접속 중인 사용자 목록. tracker 가 등록한 presence 를 서버 sync 로 읽음. */
export function useOnlineUsers(): OnlineUser[] {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  useEffect(() => {
    const ch = supabase.channel(TOPIC);
    const sync = () => {
      const state = ch.presenceState<OnlineUser>();
      setUsers(Object.values(state).map((metas) => metas[0]).filter(Boolean));
    };
    ch.on("presence", { event: "sync" }, sync);
    ch.subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);
  return users;
}
