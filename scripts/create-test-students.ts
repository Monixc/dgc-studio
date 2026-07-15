// 1회성 스크립트: 테스트용 학생 계정 20개 생성 (일반 회원가입 API 사용).
// 실행: bun run scripts/create-test-students.ts
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnv(new URL("../.env.production.local", import.meta.url).pathname);
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const PASSWORD = "student1234!";
const COUNT = 20;

async function main() {
  const created: string[] = [];
  for (let i = 1; i <= COUNT; i++) {
    const username = `student${String(i).padStart(2, "0")}`;
    const email = `${username}@flowpy.local`;
    const { error } = await supabase.auth.signUp({
      email,
      password: PASSWORD,
      options: { data: { display_name: username } },
    });
    if (error && !error.message.includes("already registered")) {
      console.error(`${username}: 실패 — ${error.message}`);
      continue;
    }
    created.push(username);
    await supabase.auth.signOut();
  }
  console.log(`\n생성 완료 ${created.length}/${COUNT}건, 비밀번호: ${PASSWORD}`);
  console.log(created.join(", "));
}

main();
