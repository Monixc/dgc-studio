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

/** 학생 제출 즉시 교사에게 점수 전달. */
export interface LiveSubmitPayload {
  problemId: string;
  problemTitle: string;
  passed: number;
  total: number;
  score: number;
  maxScore: number;
  at: number;
}

const topic = (studentId: string) => `live-code:${studentId}`;

/**
 * 학생 쪽: 풀이 코드 실시간 브로드캐스트(디바운스, DB 저장 없음).
 * - onAnnotate: 교사 첨삭 수신 → 학생 에디터에 반영
 * - 반환 sendSubmit: 제출 결과를 교사에게 즉시 전송
 */
export function useBroadcastLiveCode(
  studentId: string | undefined,
  payload: LiveCodePayload | null,
  opts?: { onAnnotate?: (code: string) => void },
): { sendSubmit: (p: LiveSubmitPayload) => void } {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onAnnotateRef = useRef(opts?.onAnnotate);
  onAnnotateRef.current = opts?.onAnnotate;

  useEffect(() => {
    if (!studentId) return;
    const ch = supabase.channel(topic(studentId));
    ch.on("broadcast", { event: "annotate" }, ({ payload }) => {
      onAnnotateRef.current?.((payload as { code: string }).code);
    });
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

  const sendSubmit = (p: LiveSubmitPayload) => {
    channelRef.current?.send({ type: "broadcast", event: "submit", payload: p });
  };
  return { sendSubmit };
}

/**
 * 선생 쪽: 특정 학생의 실시간 코드/제출 결과 구독 + 첨삭 전송.
 * annotate(code): 학생 에디터로 코드를 밀어넣음.
 */
export function useLiveCodeFeed(studentId: string | null): {
  feed: LiveCodePayload | null;
  submit: LiveSubmitPayload | null;
  annotate: (code: string) => void;
} {
  const [feed, setFeed] = useState<LiveCodePayload | null>(null);
  const [submit, setSubmit] = useState<LiveSubmitPayload | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    setFeed(null);
    setSubmit(null);
    if (!studentId) {
      channelRef.current = null;
      return;
    }
    const ch = supabase.channel(topic(studentId));
    ch.on("broadcast", { event: "code" }, ({ payload }) => setFeed(payload as LiveCodePayload));
    ch.on("broadcast", { event: "submit" }, ({ payload }) => setSubmit(payload as LiveSubmitPayload));
    ch.subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [studentId]);

  const annotate = (code: string) => {
    channelRef.current?.send({ type: "broadcast", event: "annotate", payload: { code } });
  };
  return { feed, submit, annotate };
}
