import { useEffect, useRef, useState } from "react";
import { Folder } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 컬러피커 드래그 중 매 픽셀마다 onChange(=input 이벤트)로 뮤테이션이 나가면
 * 리렌더가 겹쳐 네이티브 팝업이 바로 닫혀버림 → 드래그 종료(change 이벤트)에만 커밋.
 */
export function FolderColorSwatch({
  color, onChange, className,
}: {
  color: string | null | undefined;
  onChange: (color: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [liveColor, setLiveColor] = useState(color ?? "#94a3b8");
  useEffect(() => setLiveColor(color ?? "#94a3b8"), [color]);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const handleCommit = (e: Event) => onChange((e.target as HTMLInputElement).value);
    el.addEventListener("change", handleCommit);
    return () => el.removeEventListener("change", handleCommit);
  }, [onChange]);

  return (
    <label
      className="flex shrink-0 cursor-pointer items-center justify-center rounded-md p-0.5 hover:bg-accent"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onDragStart={(e) => e.preventDefault()}
      title="폴더 색상"
    >
      <Folder
        className={cn("size-4", !color && "text-muted-foreground", className)}
        style={color ? { color, fill: color, fillOpacity: 0.2 } : undefined}
      />
      <input
        ref={inputRef}
        type="color"
        value={liveColor}
        onChange={(e) => setLiveColor(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="sr-only"
      />
    </label>
  );
}
