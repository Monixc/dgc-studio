import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthForm from "./AuthForm";
import { Button } from "@/components/ui/button";

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

  const close = () => setOpen(null);
  const onSuccess = () => {
    close();
    navigate("/", { replace: true });
  };

  return (
    <div className="relative">
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

      {open && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={close} />
          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border bg-background p-4 shadow-lg">
            <AuthForm initialMode={open} onSuccess={onSuccess} />
          </div>
        </>
      )}
    </div>
  );
}
