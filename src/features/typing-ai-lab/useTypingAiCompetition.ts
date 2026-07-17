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
                void attachMatch(id);
              }
            });
        }, 1500);
      } else if (res.match_id) {
        await attachMatch(res.match_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "매칭 실패");
      setPhase("idle");
    }
  }, [attachMatch, displayName, poolIds, userId]);

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

  const beginPlay = useCallback(async () => {
    if (!match) return;
    await startMatch(match.id);
    setPhase("playing");
  }, [match]);

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
      await finishMatch(match.id, args);
      setPhase("finished");
    },
    [match],
  );

  const leave = useCallback(async () => {
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
    myPool,
    joinQueue,
    cancel,
    beginPlay,
    broadcastProgress,
    complete,
    leave,
    attachMatch,
  };
}
