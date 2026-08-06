/** 튜토리얼 마스코트: 유령 캐릭터 + 몬스터. speech 지정 시 말풍선에 텍스트 표시(실행 결과 미리보기용). */
export default function GhostMascot({
  speech,
  mood = "idle",
  className,
}: {
  speech?: string;
  mood?: "idle" | "happy" | "confused";
  className?: string;
}) {
  const ghostEyes =
    mood === "happy"
      ? { l: "M 30 46 Q 35 39 40 46", r: "M 56 46 Q 61 39 66 46" }
      : mood === "confused"
        ? { l: "M 30 44 L 40 48", r: "M 56 48 Q 61 42 66 46" }
        : { l: "M 31 46 Q 35 42 39 46", r: "M 57 46 Q 61 42 65 46" };
  const ghostMouth =
    mood === "happy"
      ? "M 36 58 Q 48 68 60 58"
      : mood === "confused"
        ? "M 38 60 Q 44 56 48 60 Q 52 64 58 60"
        : "M 40 58 Q 48 62 56 58";

  const monsterEyes =
    mood === "happy"
      ? { l: "M 12 14 L 18 18", r: "M 26 18 L 20 14" } // 기절(x자 눈)
      : { l: null, r: null };

  return (
    <div className={className}>
      {speech && (
        <div className="relative mb-1 max-w-[220px] rounded-2xl border bg-card px-3 py-2 text-sm shadow-sm">
          {speech}
          <svg className="absolute -bottom-2 left-8 text-card" width="16" height="10" viewBox="0 0 16 10" fill="currentColor">
            <path d="M0 0 L8 10 L16 0 Z" />
          </svg>
        </div>
      )}
      <div className="flex items-end gap-1">
        {/* 유령 캐릭터 */}
        <svg width="88" height="96" viewBox="0 0 96 106" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M48 8 C22 8 10 28 10 54 L10 92 C10 96 14 97 17 94 L25 86 L34 95 C36 97 40 97 42 95 L48 88 L54 95 C56 97 60 97 62 95 L71 86 L79 94 C82 97 86 96 86 92 L86 54 C86 28 74 8 48 8 Z"
            fill="#bfe3ff"
          />
          <ellipse cx="30" cy="52" rx="8" ry="9" fill="#ffffff" opacity="0.6" />
          <path d={ghostEyes.l} stroke="#274860" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d={ghostEyes.r} stroke="#274860" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d={ghostMouth} stroke="#274860" strokeWidth="3" strokeLinecap="round" fill="none" />
          <ellipse cx="22" cy="58" rx="6" ry="4" fill="#8fd0ff" opacity="0.7" />
          <ellipse cx="74" cy="58" rx="6" ry="4" fill="#8fd0ff" opacity="0.7" />
        </svg>

        {/* 작은 몬스터 */}
        <svg width="44" height="40" viewBox="0 0 44 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M22 4 C10 4 3 13 3 24 C3 31 8 36 15 36 L29 36 C36 36 41 31 41 24 C41 13 34 4 22 4 Z"
            fill="#9be89b"
          />
          <path d="M8 12 L4 4 M14 8 L12 0 M34 8 L38 2" stroke="#5fae5f" strokeWidth="2.5" strokeLinecap="round" />
          {mood === "happy" ? (
            <>
              <path d={monsterEyes.l!} stroke="#2b4a2b" strokeWidth="2.5" strokeLinecap="round" />
              <path d={monsterEyes.r!} stroke="#2b4a2b" strokeWidth="2.5" strokeLinecap="round" />
            </>
          ) : (
            <>
              <ellipse cx="15" cy="20" rx="3" ry="3.5" fill="#2b4a2b" />
              <ellipse cx="29" cy="20" rx="3" ry="3.5" fill="#2b4a2b" />
            </>
          )}
          <path d="M15 28 Q22 24 29 28" stroke="#2b4a2b" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    </div>
  );
}
