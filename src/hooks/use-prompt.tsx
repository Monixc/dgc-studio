import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PromptOptions {
  title?: string;
  defaultValue?: string;
}

/** window.prompt 대체: `const v = await prompt("..."); if (v === null) return;` 처럼 사용. */
export function usePrompt() {
  const [options, setOptions] = useState<PromptOptions | null>(null);
  const [value, setValue] = useState("");
  const resolveRef = useRef<(value: string | null) => void>();

  const prompt = useCallback((input: PromptOptions | string, defaultValue = "") => {
    const opts = typeof input === "string" ? { title: input, defaultValue } : input;
    setOptions(opts);
    setValue(opts.defaultValue ?? "");
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const close = (result: string | null) => {
    resolveRef.current?.(result);
    setOptions(null);
  };

  const dialog = (
    <Dialog open={options !== null} onOpenChange={(open) => !open && close(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{options?.title ?? "입력"}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && close(value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => close(null)}>취소</Button>
          <Button onClick={() => close(value)}>확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { prompt, dialog };
}
