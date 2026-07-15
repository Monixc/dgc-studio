import { useState } from "react";
import { toast } from "sonner";
import { signIn, signUp, isValidUsername } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  initialMode?: "login" | "signup";
  onSuccess?: () => void;
}

export default function AuthForm({ initialMode = "login", onSuccess }: Props) {
  const { refreshProfile } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);
  const [teacherCode, setTeacherCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup") {
      if (!isValidUsername(username)) return toast.error("아이디는 영문/숫자/._- 2~32자입니다.");
      if (password.length < 6) return toast.error("비밀번호는 6자 이상입니다.");
    }
    setBusy(true);
    try {
      if (mode === "login") {
        await signIn(username, password);
      } else {
        await signUp(username, password, isTeacher ? teacherCode : undefined);
        if (isTeacher && !teacherCode) toast.warning("선생 코드가 없어 학생으로 가입되었습니다.");
      }
      await refreshProfile();
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message ?? "실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex rounded-md bg-muted p-1 text-sm">
        <button type="button" onClick={() => setMode("login")} className={`flex-1 rounded py-1 ${mode === "login" ? "bg-background shadow" : "text-muted-foreground"}`}>
          로그인
        </button>
        <button type="button" onClick={() => setMode("signup")} className={`flex-1 rounded py-1 ${mode === "signup" ? "bg-background shadow" : "text-muted-foreground"}`}>
          회원가입
        </button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="af-user">아이디</Label>
        <Input id="af-user" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="af-pw">비밀번호</Label>
        <Input id="af-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      {mode === "signup" && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isTeacher} onChange={(e) => setIsTeacher(e.target.checked)} />
            선생님으로 가입
          </label>
          {isTeacher && (
            <div className="space-y-1.5">
              <Label htmlFor="af-code">선생 가입 코드</Label>
              <Input id="af-code" value={teacherCode} onChange={(e) => setTeacherCode(e.target.value)} />
            </div>
          )}
        </>
      )}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "처리 중…" : mode === "login" ? "로그인" : "회원가입"}
      </Button>
    </form>
  );
}
