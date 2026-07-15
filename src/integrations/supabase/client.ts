import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // 개발 초기 셋업 실수를 빨리 드러냄
  console.error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 .env 에 없습니다. .env.example 참고.");
}

export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: { persistSession: true, autoRefreshToken: true },
});
