import { useEffect, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface OnlineUser {
  id: string;
  name: string;
  role: string;
}

// 단일 채널 싱글턴. tracker(쓰기)와 reader(읽기)가 같은 채널을 공유 —
// 같은 topic 을 두 번 subscribe 하면 supabase 가 throw(특히 StrictMode 이중 마운트).
const TOPIC = "online-users";
let channel: RealtimeChannel | null = null;
let users: OnlineUser[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function startPresence(me: OnlineUser) {
  if (channel) return;
  channel = supabase.channel(TOPIC, { config: { presence: { key: me.id } } });
  channel.on("presence", { event: "sync" }, () => {
    const state = channel!.presenceState<OnlineUser>();
    users = Object.values(state).map((m) => m[0]).filter(Boolean);
    emit();
  });
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") void channel!.track(me);
  });
}

function stopPresence() {
  if (!channel) return;
  void supabase.removeChannel(channel);
  channel = null;
  users = [];
  emit();
}

/** 로그인 상태면 전역 presence 채널에 자신을 등록. App 최상단에 1회 마운트. */
export function usePresenceTracker() {
  const { user, profile } = useAuth();
  useEffect(() => {
    if (!user || !profile) return;
    startPresence({ id: user.id, name: profile.display_name, role: profile.role });
    return () => stopPresence();
  }, [user, profile]);
}

/** 현재 접속 중인 사용자 목록. */
export function useOnlineUsers(): OnlineUser[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => users,
  );
}
