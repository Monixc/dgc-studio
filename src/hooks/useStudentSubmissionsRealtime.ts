import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * 문제 제출 실시간 반영. 학생이 답안을 제출하면 교사 학생관리/검토 목록이
 * 새로고침 없이 갱신된다. (RLS로 교사는 본인 문제의 제출만 수신)
 */
export function useStudentSubmissionsRealtime(enabled = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const ch = supabase
      .channel(`submissions-changes:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions" },
        () => {
          void qc.invalidateQueries({ queryKey: ["student-management", "submissions"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [enabled, qc]);
}
