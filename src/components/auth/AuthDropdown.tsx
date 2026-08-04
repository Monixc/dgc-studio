import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthForm from "./AuthForm";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

type AuthMode = null | "login" | "signup";

/** 헤더에서 여는 드롭다운 인증 팝업(로그인/회원가입 탭). trigger 를 주면 기본 버튼 대신 그걸로 연다.
 * openState/onOpenStateChange 를 주면 외부에서 열림 상태를 제어한다(다른 트리거가 이 팝업을 열 때 사용). */
export default function AuthDropdown({
  trigger,
  openState,
  onOpenStateChange,
}: {
  trigger?: React.ReactNode;
  openState?: AuthMode;
  onOpenStateChange?: (mode: AuthMode) => void;
}) {
  const [internalOpen, setInternalOpen] = useState<AuthMode>(null);
  const open = openState !== undefined ? openState : internalOpen;
  const setOpen = onOpenStateChange ?? setInternalOpen;
  const navigate = useNavigate();
  const anchorRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(null);
  const onSuccess = () => {
    close();
    navigate("/", { replace: true });
  };

  return (
    <Popover open={open !== null} onOpenChange={(v) => !v && close()}>
      <PopoverAnchor asChild>
        <div className="relative" ref={anchorRef}>
          {trigger ? (
            <div onClick={() => setOpen("signup")}>{trigger}</div>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen("login")}>
                로그인
              </Button>
              <Button onClick={() => setOpen("signup")}>회원가입</Button>
            </div>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="end"
        className="w-72"
        onInteractOutside={(e) => {
          if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
      >
        <AuthForm key={open} initialMode={open ?? "login"} onSuccess={onSuccess} />
      </PopoverContent>
    </Popover>
  );
}
