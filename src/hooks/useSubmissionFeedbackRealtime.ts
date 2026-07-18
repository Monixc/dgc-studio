import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** 교사 문제 첨삭(submission_comments)을 학생 화면에 실시간 반영. RLS로 본인 관련 행만 수신. */
export function useSubmissionFeedbackRealtime(enabled = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const ch = supabase
      .channel(`submission-comments:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submission_comments" },
        () => void qc.invalidateQueries({ queryKey: ["my-submission-feedback"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [enabled, qc]);
}
