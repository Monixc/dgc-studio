// 학생 코드 임시저장 (localStorage). 제출 전 새로고침/이탈에도 코드 보존.
const key = (userId: string, problemId: string) => `flowpy:draft:${userId}:${problemId}`;

export function loadDraft(userId: string, problemId: string): string | null {
  try {
    return localStorage.getItem(key(userId, problemId));
  } catch {
    return null;
  }
}

export function saveDraft(userId: string, problemId: string, code: string): void {
  try {
    localStorage.setItem(key(userId, problemId), code);
  } catch {
    // 저장 실패 무시
  }
}
