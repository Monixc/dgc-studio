import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PROBLEMS_KEY } from "@/lib/problems";

/** problems 테이블 변경을 구독해 react-query 캐시를 무효화(발행/수정 즉시 반영). */
export function useProblemsRealtime(enabled = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const ch = supabase
      .channel("problems-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "problems" }, () => {
        qc.invalidateQueries({ queryKey: PROBLEMS_KEY });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [enabled, qc]);
}
