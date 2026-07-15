// 프로필 표시 설정(이름 오버라이드 + 아바타 색). localStorage 저장 —
// ponytail: profiles RLS 가 자기수정 막음. DB 동기화 필요하면 avatar_color 컬럼 + self-update 정책 추가.

export const AVATAR_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

export interface ProfilePrefs {
  displayName?: string;
  avatarColor: string;
}

const key = (id: string) => `flowpy:profile:${id}`;

/** id 해시로 안정적 기본 색 선택. */
export function colorFromId(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function loadPrefs(id: string): ProfilePrefs {
  try {
    const raw = localStorage.getItem(key(id));
    if (raw) return JSON.parse(raw) as ProfilePrefs;
  } catch {
    /* noop */
  }
  return { avatarColor: colorFromId(id) };
}

export function savePrefs(id: string, prefs: ProfilePrefs) {
  localStorage.setItem(key(id), JSON.stringify(prefs));
}
