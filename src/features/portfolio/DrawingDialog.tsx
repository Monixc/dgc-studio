import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Redo2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface DrawingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (file: File) => void | Promise<void>;
}

const COLORS = ["#111827", "#dc2626", "#2563eb", "#16a34a", "#9333ea"];
const WIDTHS = [2, 5, 10];

export function DrawingDialog({ open, onOpenChange, onSave }: DrawingDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const rectRef = useRef<DOMRect | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [eraser, setEraser] = useState(false);
  const [format, setFormat] = useState<"image/webp" | "image/png">("image/webp");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const snapshot = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) {
      historyRef.current.push(context.getImageData(0, 0, canvas.width, canvas.height));
      if (historyRef.current.length > 30) historyRef.current.shift();
    }
  }, []);

  const clearCanvas = useCallback((remember = true) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    if (remember) snapshot();
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
  }, [snapshot]);

  // 백킹 스토어 크기는 레이아웃 박스(ResizeObserver) 기준으로 맞춘다.
  // getBoundingClientRect 는 Radix 다이얼로그 열림 애니메이션(transform: scale)에 영향받아
  // 축소된 값을 주므로, 그걸로 캔버스를 잡으면 표시 크기와 어긋나 좌표가 밀린다.
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sizeTo = (cssWidth: number, cssHeight: number) => {
      if (cssWidth === 0 || cssHeight === 0) return;
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssWidth * scale);
      canvas.height = Math.round(cssHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.lineCap = "round";
      context.lineJoin = "round";
      historyRef.current = [];
      clearCanvas(false);
    };

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) sizeTo(box.width, box.height);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [open, clearCanvas]);

  const point = (event: { clientX: number; clientY: number }) => {
    const rect = rectRef.current ?? canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    rectRef.current = event.currentTarget.getBoundingClientRect();
    snapshot();
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = point(event);
    context.globalCompositeOperation = "source-over";
    context.strokeStyle = eraser ? "#ffffff" : color;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(x, y);
    // 점 하나만 찍어도 보이도록.
    context.lineTo(x + 0.01, y);
    context.stroke();
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    context.globalCompositeOperation = "source-over";
    context.strokeStyle = eraser ? "#ffffff" : color;
    context.lineWidth = width;
    // 합쳐진 이벤트(getCoalescedEvents)를 모두 그려 끊김을 줄인다.
    const moves = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const move of moves.length ? moves : [event.nativeEvent]) {
      const { x, y } = point(move);
      context.lineTo(x, y);
    }
    context.stroke();
  };

  const stopDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    event.currentTarget.getContext("2d")?.closePath();
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const previous = historyRef.current.pop();
    if (context && previous) context.putImageData(previous, 0, 0);
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) => value ? resolve(value) : reject(new Error("그림을 내보내지 못했습니다.")),
          format,
          format === "image/webp" ? 0.92 : undefined,
        );
      });
      const extension = format === "image/webp" ? "webp" : "png";
      await onSave(new File([blob], `drawing-${Date.now()}.${extension}`, { type: format }));
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "그림을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>그림 그리기</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2" aria-label="그리기 도구">
          {COLORS.map((item) => (
            <button
              key={item}
              type="button"
              aria-label={`펜 색상 ${item}`}
              aria-pressed={!eraser && color === item}
              className="size-8 rounded-full border-2 border-background ring-1 ring-border aria-pressed:ring-2 aria-pressed:ring-primary"
              style={{ backgroundColor: item }}
              onClick={() => {
                setColor(item);
                setEraser(false);
              }}
            />
          ))}
          {WIDTHS.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={width === item ? "secondary" : "ghost"}
              onClick={() => setWidth(item)}
            >
              {item}px
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={eraser ? "secondary" : "ghost"}
            aria-pressed={eraser}
            onClick={() => setEraser((value) => !value)}
          >
            <Eraser /> 지우개
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={undo}>
            <Redo2 className="-scale-x-100" /> 실행 취소
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => clearCanvas()}>
            <Trash2 /> 전체 지우기
          </Button>
        </div>

        <canvas
          ref={canvasRef}
          className="h-[min(55vh,520px)] w-full touch-none rounded-md border bg-white"
          aria-label="그림 캔버스"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
        />

        <div className="flex items-center justify-end gap-2">
          {error && <p className="mr-auto text-sm text-destructive" role="alert">{error}</p>}
          <label className="text-sm">
            <span className="sr-only">내보내기 형식</span>
            <select
              className="h-9 rounded-md border bg-background px-2"
              value={format}
              onChange={(event) => setFormat(event.target.value as "image/webp" | "image/png")}
            >
              <option value="image/webp">WebP</option>
              <option value="image/png">PNG</option>
            </select>
          </label>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button type="button" disabled={saving} onClick={save}>
            {saving ? "저장 중…" : "그림 첨부"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
