import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

/** window.confirm 대체: `if (!(await confirm("..."))) return;` 처럼 사용. */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<(value: boolean) => void>();

  const confirm = useCallback((input: ConfirmOptions | string) => {
    setOptions(typeof input === "string" ? { description: input } : input);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolveRef.current?.(result);
    setOptions(null);
  };

  const dialog = (
    <Dialog open={options !== null} onOpenChange={(open) => !open && close(false)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{options?.title ?? "확인"}</DialogTitle>
          <DialogDescription>{options?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            {options?.cancelText ?? "취소"}
          </Button>
          <Button variant={options?.destructive ? "destructive" : "default"} onClick={() => close(true)}>
            {options?.confirmText ?? "확인"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, dialog };
}
