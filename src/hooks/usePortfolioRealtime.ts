import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PORTFOLIO_SUBMISSIONS_KEY } from "@/hooks/usePortfolio";

/**
 * 포트폴리오 제출/피드백 실시간 반영. 학생 제출 → 교사, 교사 피드백 → 학생 방향 모두
 * 새로고침 없이 react-query 캐시를 무효화한다. (RLS로 본인이 볼 수 있는 행만 수신)
 */
export function usePortfolioRealtime(enabled = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const ch = supabase
      .channel(`portfolio-changes:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "portfolio_submissions" },
        () => {
          void qc.invalidateQueries({ queryKey: PORTFOLIO_SUBMISSIONS_KEY });
          void qc.invalidateQueries({ queryKey: ["student-management", "portfolio-submissions"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "portfolio_comments" },
        () => {
          void qc.invalidateQueries({ queryKey: ["portfolio", "comments"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [enabled, qc]);
}
