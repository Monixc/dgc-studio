import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  cancelQueue,
  finishMatch,
  forfeitMatch,
  getMatch,
  quickMatch,
  startMatch,
  type MatchPlayerRow,
  type MatchRow,
} from "@/lib/typing-ai-lab";

export type CompetitionPhase =
  | "idle"
  | "queued"
  | "countdown"
  | "playing"
  | "finished"
  | "abandoned";

export interface OpponentProgress {
  userId: string;
  name: string;
  datasetSize: number;
  accuracy: number;
  totalPreview: number;
  online: boolean;
}

interface ProgressPayload {
  userId: string;
  name: string;
  datasetSize: number;
  accuracy: number;
  totalPreview: number;
}

const DISCONNECT_MS = 30_000;
const TEST_MATCH_ID = "local-test-match";
// ponytail: 5초 안에 사람 상대가 안 잡히면 봇으로 자동 전환. 실제 대전자가 드물어
// 무한 대기( "상대 찾는 중…" )로 봇이 안 뜨는 문제 방지. 대기 시간은 필요 시 조정.
const BOT_FALLBACK_MS = 5_000;

export function useTypingAiCompetition(args: {
  userId: string;
  displayName: string;
  poolIds: string[];
}) {
  const { userId, displayName, poolIds } = args;
  const [phase, setPhase] = useState<CompetitionPhase>("idle");
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [players, setPlayers] = useState<MatchPlayerRow[]>([]);
  const [opponent, setOpponent] = useState<OpponentProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSeenRef = useRef(Date.now());
  const pollRef = useRef<number | null>(null);
  const disconnectRef = useRef<number | null>(null);
  const botTimerRef = useRef<number | null>(null);

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (disconnectRef.current) {
      window.clearTimeout(disconnectRef.current);
      disconnectRef.current = null;
    }
    if (botTimerRef.current) {
      window.clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }
  }, []);

  const attachMatch = useCallback(
    async (matchId: string) => {
      cleanupChannel();
      const { match: m, players: ps } = await getMatch(matchId);
      setMatch(m);
      setPlayers(ps);
      setPhase(m.status === "playing" ? "playing" : m.status === "finished" ? "finished" : m.status === "abandoned" ? "abandoned" : "countdown");

      const ch = supabase.channel(`typing-ai-lab:${matchId}`, {
        config: { presence: { key: userId } },
      });
      channelRef.current = ch;

      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState<{ id: string; name: string }>();
        const onlineIds = new Set(Object.keys(state));
        const opp = ps.find((p) => p.user_id !== userId);
        if (opp) {
          const online = onlineIds.has(opp.user_id);
          if (online) {
            lastSeenRef.current = Date.now();
            if (disconnectRef.current) {
              window.clearTimeout(disconnectRef.current);
              disconnectRef.current = null;
            }
          } else if (!disconnectRef.current && (m.status === "countdown" || m.status === "playing")) {
            disconnectRef.current = window.setTimeout(() => {
              void forfeitMatch(matchId).then(() => setPhase("abandoned"));
            }, DISCONNECT_MS);
          }
          setOpponent((prev) => ({
            userId: opp.user_id,
            name: opp.display_name || "상대",
            datasetSize: prev?.datasetSize ?? 0,
            accuracy: prev?.accuracy ?? 100,
            totalPreview: prev?.totalPreview ?? 0,
            online,
          }));
        }
      });

      ch.on("broadcast", { event: "progress" }, ({ payload }) => {
        const p = payload as ProgressPayload;
        if (p.userId === userId) return;
        lastSeenRef.current = Date.now();
        setOpponent((prev) => ({
          userId: p.userId,
          name: p.name,
          datasetSize: p.datasetSize,
          accuracy: p.accuracy,
          totalPreview: p.totalPreview,
          online: prev?.online ?? true,
        }));
      });

      ch.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ id: userId, name: displayName });
        }
      });

      // DB status 폴링 (시작/종료 동기화)
      pollRef.current = window.setInterval(() => {
        void getMatch(matchId).then(({ match: latest, players: pls }) => {
          setMatch(latest);
          setPlayers(pls);
          if (latest.status === "playing") setPhase((ph) => (ph === "countdown" ? "playing" : ph));
          if (latest.status === "finished") setPhase("finished");
          if (latest.status === "abandoned") setPhase("abandoned");
        });
      }, 2000);
    },
    [cleanupChannel, displayName, userId],
  );

  const startTestMatch = useCallback(async () => {
    try {
      await cancelQueue();
    } catch {
      // 로컬 테스트는 큐 취소 실패와 무관하게 시작 가능
    }
    cleanupChannel();
    const now = new Date().toISOString();
    const testMatch: MatchRow = {
      id: TEST_MATCH_ID,
      status: "countdown",
      seed: Date.now(),
      started_at: null,
      finished_at: null,
      created_at: now,
    };
    setMatch(testMatch);
    setPlayers([
      {
        match_id: TEST_MATCH_ID,
        user_id: userId,
        display_name: displayName,
        pool_ids: poolIds,
        total_score: null,
        grade: null,
        dataset_size: null,
        forfeit: false,
      },
    ]);
    setOpponent({
      userId: "test-opponent",
      name: "TEST-07",
      datasetSize: 0,
      accuracy: 94,
      totalPreview: 0,
      online: true,
    });
    setError(null);
    setPhase("countdown");
  }, [cleanupChannel, displayName, poolIds, userId]);

  const joinQueue = useCallback(async () => {
    setError(null);
    try {
      const res = await quickMatch(displayName, poolIds);
      if (res.status === "queued") {
        setPhase("queued");
        // 매칭 대기 폴링: 내가 매치에 들어갔는지
        pollRef.current = window.setInterval(() => {
          void supabase
            .from("typing_ai_lab_match_players")
            .select("match_id, typing_ai_lab_matches!inner(status)")
            .eq("user_id", userId)
            .in("typing_ai_lab_matches.status", ["countdown", "playing"])
            .limit(1)
            .maybeSingle()
            .then(({ data }) => {
              const id = (data as { match_id?: string } | null)?.match_id;
              if (id) {
                if (pollRef.current) window.clearInterval(pollRef.current);
                if (botTimerRef.current) {
                  window.clearTimeout(botTimerRef.current);
                  botTimerRef.current = null;
                }
                void attachMatch(id);
              }
            });
        }, 1500);
        // 사람 상대가 없으면 봇(TEST-07) 자동 투입
        botTimerRef.current = window.setTimeout(() => {
          botTimerRef.current = null;
          void startTestMatch();
        }, BOT_FALLBACK_MS);
      } else if (res.match_id) {
        await attachMatch(res.match_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "매칭 실패");
      setPhase("idle");
    }
  }, [attachMatch, displayName, poolIds, startTestMatch, userId]);

  const cancel = useCallback(async () => {
    try {
      await cancelQueue();
    } catch {
      // ignore
    }
    cleanupChannel();
    setPhase("idle");
    setMatch(null);
    setPlayers([]);
    setOpponent(null);
  }, [cleanupChannel]);

  const stopSimulation = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const beginPlay = useCallback(async () => {
    if (!match) return;
    if (match.id === TEST_MATCH_ID) {
      stopSimulation();
      pollRef.current = window.setInterval(() => {
        setOpponent((prev) => prev && ({
          ...prev,
          datasetSize: prev.datasetSize + (Math.random() > 0.45 ? 1 : 0),
          accuracy: Math.max(82, Math.min(99, prev.accuracy + (Math.random() - 0.5) * 3)),
          totalPreview: Math.round((prev.totalPreview + Math.random() * 2.4) * 10) / 10,
        }));
      }, 900);
      setPhase("playing");
      return;
    }
    await startMatch(match.id);
    setPhase("playing");
  }, [match, stopSimulation]);

  const broadcastProgress = useCallback(
    (payload: Omit<ProgressPayload, "userId" | "name">) => {
      channelRef.current?.send({
        type: "broadcast",
        event: "progress",
        payload: { ...payload, userId, name: displayName },
      });
    },
    [displayName, userId],
  );

  const complete = useCallback(
    async (args: {
      totalScore: number;
      grade: string;
      datasetSize: number;
      resultId?: string | null;
    }) => {
      if (!match) return;
      if (match.id === TEST_MATCH_ID) {
        stopSimulation();
        cleanupChannel();
        setPhase("finished");
        return;
      }
      await finishMatch(match.id, args);
      setPhase("finished");
    },
    [cleanupChannel, match, stopSimulation],
  );

  const leave = useCallback(async () => {
    if (match?.id === TEST_MATCH_ID) {
      cleanupChannel();
      setPhase("idle");
      setMatch(null);
      setPlayers([]);
      setOpponent(null);
      return;
    }
    if (match && (phase === "countdown" || phase === "playing")) {
      try {
        await forfeitMatch(match.id);
      } catch {
        // ignore
      }
    } else if (phase === "queued") {
      await cancel();
      return;
    }
    cleanupChannel();
    setPhase("idle");
    setMatch(null);
    setPlayers([]);
    setOpponent(null);
  }, [cancel, cleanupChannel, match, phase]);

  useEffect(() => () => cleanupChannel(), [cleanupChannel]);

  const myPool =
    players.find((p) => p.user_id === userId)?.pool_ids?.length
      ? players.find((p) => p.user_id === userId)!.pool_ids
      : poolIds;

  return {
    phase,
    match,
    players,
    opponent,
    error,
    isTestMatch: match?.id === TEST_MATCH_ID,
    myPool,
    joinQueue,
    startTestMatch,
    cancel,
    beginPlay,
    stopSimulation,
    broadcastProgress,
    complete,
    leave,
    attachMatch,
  };
}
