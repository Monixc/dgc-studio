import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import type { Role } from "@/integrations/supabase/types";
import Landing from "@/pages/Landing";

function Loading() {
  return <div className="flex min-h-screen items-center justify-center text-muted-foreground">불러오는 중…</div>;
}

/** profile row가 없는(삭제됨/유효하지 않은) 세션. role 기반 라우팅으로는 목적지가 없어 무한 리다이렉트가 되므로 로그아웃 처리. */
function OrphanedSession() {
  useEffect(() => {
    void signOut();
  }, []);
  return <Loading />;
}

/** 로그인 필요. 미로그인 시 랜딩(/)으로. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** 특정 role 필요. 불일치 시 각자 홈으로. */
export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { session, role: myRole, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/" replace />;
  if (myRole === null) return <OrphanedSession />;
  if (myRole !== role) return <Navigate to={myRole === "teacher" ? "/dashboard" : "/student"} replace />;
  return <>{children}</>;
}

/** "/" : 로그인 시 role 홈으로, 미로그인 시 랜딩 페이지. */
export function Home() {
  const { session, role, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Landing />;
  if (role === null) return <OrphanedSession />;
  return <Navigate to={role === "teacher" ? "/dashboard" : "/student"} replace />;
}
