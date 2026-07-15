import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { signUp, isValidUsername } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Signup() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);
  const [teacherCode, setTeacherCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidUsername(username)) {
      toast.error("아이디는 영문/숫자/._- 2~32자입니다.");
      return;
    }
    if (password.length < 6) {
      toast.error("비밀번호는 6자 이상입니다.");
      return;
    }
    setBusy(true);
    try {
      await signUp(username, password, isTeacher ? teacherCode : undefined);
      await refreshProfile();
      if (isTeacher && !teacherCode) toast.warning("선생 코드를 입력하지 않아 학생으로 가입되었습니다.");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "회원가입 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>회원가입</CardTitle>
          <CardDescription>선생님은 가입 코드를 입력하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">아이디</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">비밀번호</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isTeacher} onChange={(e) => setIsTeacher(e.target.checked)} />
              선생님으로 가입
            </label>
            {isTeacher && (
              <div className="space-y-1.5">
                <Label htmlFor="teacherCode">선생 가입 코드</Label>
                <Input id="teacherCode" value={teacherCode} onChange={(e) => setTeacherCode(e.target.value)} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "가입 중…" : "회원가입"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            이미 계정이 있나요?{" "}
            <Link to="/login" className="text-primary underline">
              로그인
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
