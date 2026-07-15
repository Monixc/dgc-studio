import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthForm from "./AuthForm";
import { Button } from "@/components/ui/button";

/** 헤더에서 여는 드롭다운 인증 팝업(로그인/회원가입 탭). trigger 를 주면 기본 버튼 대신 그걸로 연다. */
export default function AuthDropdown({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState<null | "login" | "signup">(null);
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
