import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { ConsoleLine } from "@/components/editor/EditorPanel";

export interface LiveCodePayload {
  code: string;
  problemId: string;
  problemTitle: string;
  problemDescription: string;
  category: string;
  flowchart: unknown;
  /** 학생이 직접 실행한 결과(있으면). 코드만 바뀌고 실행 안 했으면 없음. */
  executionResult?: ConsoleLine[];
}

const topic = (studentId: string) => `live-code:${studentId}`;

/** 학생 쪽: Solve.tsx 에서 풀이 중 코드를 실시간 브로드캐스트(디바운스, DB 저장 없음). */
export function useBroadcastLiveCode(studentId: string | undefined, payload: LiveCodePayload | null) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!studentId) return;
    const ch = supabase.channel(topic(studentId));
    ch.subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [studentId]);

  useEffect(() => {
    if (!payload) return;
    const t = setTimeout(() => {
      channelRef.current?.send({ type: "broadcast", event: "code", payload });
    }, 400);
    return () => clearTimeout(t);
  }, [payload]);
}

/** 선생 쪽: 특정 학생의 실시간 코드 구독. 학생이 아직 브로드캐스트 안 했으면 null. */
export function useLiveCodeFeed(studentId: string | null): LiveCodePayload | null {
  const [state, setState] = useState<LiveCodePayload | null>(null);

  useEffect(() => {
    setState(null);
    if (!studentId) return;
    const ch = supabase.channel(topic(studentId));
    ch.on("broadcast", { event: "code" }, ({ payload }) => setState(payload as LiveCodePayload));
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [studentId]);

  return state;
}
