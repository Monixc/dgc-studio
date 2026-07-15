import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/integrations/supabase/types";
import Landing from "@/pages/Landing";

function Loading() {
  return <div className="flex min-h-screen items-center justify-center text-muted-foreground">불러오는 중…</div>;
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
  if (myRole !== role) return <Navigate to={myRole === "teacher" ? "/teacher" : "/student"} replace />;
  return <>{children}</>;
}

/** "/" : 로그인 시 role 홈으로, 미로그인 시 랜딩 페이지. */
export function Home() {
  const { session, role, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Landing />;
  return <Navigate to={role === "teacher" ? "/dashboard" : "/student"} replace />;
}
