/** 튜토리얼 마스코트 고양이. speech 지정 시 말풍선에 텍스트 표시(실행 결과 미리보기용). */
export default function CatMascot({
  speech,
  mood = "idle",
  className,
}: {
  speech?: string;
  mood?: "idle" | "happy" | "confused";
  className?: string;
}) {
  const eyes =
    mood === "happy"
      ? { l: "M 38 58 Q 44 50 50 58", r: "M 70 58 Q 76 50 82 58" }
      : mood === "confused"
        ? { l: "M 38 56 L 50 60", r: "M 70 60 Q 76 54 82 58" }
        : { l: "M 40 58 Q 44 54 48 58", r: "M 72 58 Q 76 54 80 58" };
  const mouth =
    mood === "happy"
      ? "M 48 74 Q 55 84 62 74 Q 69 84 76 74"
      : mood === "confused"
        ? "M 50 76 Q 56 72 62 76 Q 68 80 74 76"
        : "M 52 75 Q 60 80 68 75";

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
      <svg width="100" height="96" viewBox="0 0 120 116" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* 귀 */}
        <path d="M18 52 C9 52 7 36 14 18 C19 6 32 -1 44 6 C51 10 46 28 39 42 C34 51 27 55 18 52 Z" fill="#f6ab52" />
        <path d="M102 52 C111 52 113 36 106 18 C101 6 88 -1 76 6 C69 10 74 28 81 42 C86 51 93 55 102 52 Z" fill="#f6ab52" />
        <path d="M25 44 C21 33 23 22 31 15 C36 21 38 32 32 41 Z" fill="#f2895f" />
        <path d="M95 44 C99 33 97 22 89 15 C84 21 82 32 88 41 Z" fill="#f2895f" />

        {/* 머리 + 이마 줄무늬 */}
        <ellipse cx="60" cy="64" rx="48" ry="44" fill="#f6ab52" />
        <path d="M53 22 L51 42 L57 42 Z" fill="#ef9a44" />
        <path d="M60 20 L59 42 L65 42 Z" fill="#ef9a44" />
        <path d="M67 22 L69 42 L63 42 Z" fill="#ef9a44" />

        {/* 볼 */}
        <ellipse cx="27" cy="70" rx="13" ry="10" fill="#f5896a" />
        <ellipse cx="93" cy="70" rx="13" ry="10" fill="#f5896a" />

        {/* 입가 흰 털 */}
        <path
          d="M28 76 C24 92 38 106 60 106 C82 106 96 92 92 76 C86 84 74 88 60 88 C46 88 34 84 28 76 Z"
          fill="#fdf6ea"
        />

        {/* 눈 */}
        <path d={eyes.l} stroke="#3a2a1a" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d={eyes.r} stroke="#3a2a1a" strokeWidth="4" strokeLinecap="round" fill="none" />

        {/* 코 + 입 */}
        <ellipse cx="60" cy="68" rx="4.5" ry="3.5" fill="#f2895f" />
        <path d={mouth} stroke="#3a2a1a" strokeWidth="2.5" strokeLinecap="round" fill="none" />

        {/* 수염 */}
        <path d="M4 66 L27 64 M2 76 L27 74 M4 86 L27 82" stroke="#e0904f" strokeWidth="2" strokeLinecap="round" />
        <path d="M116 66 L93 64 M118 76 L93 74 M116 86 L93 82" stroke="#e0904f" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
