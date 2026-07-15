import { supabase } from "@/integrations/supabase/client";

// 학생/선생이 이메일 없이 아이디로 쓰도록 username 을 합성 이메일로 매핑.
const EMAIL_DOMAIN = "flowpy.local";

export function usernameToEmail(username: string): string {
  const normalized = username.trim().toLowerCase();
  return `${normalized}@${EMAIL_DOMAIN}`;
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{2,32}$/i.test(username.trim());
}

export async function signUp(username: string, password: string, teacherCode?: string) {
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: username.trim() } },
  });
  if (error) throw error;

  // 이메일 확인이 켜진 프로젝트면 세션이 없을 수 있음 — 그 경우 선생 승격은 로그인 후로 미룸.
  if (teacherCode && data.session) {
    await claimTeacher(teacherCode);
  }
  return data;
}

export async function signIn(username: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** 선생 코드 검증 후 role=teacher 승격. 성공 여부 반환. */
export async function claimTeacher(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("claim_teacher", { code });
  if (error) throw error;
  return data === true;
}
