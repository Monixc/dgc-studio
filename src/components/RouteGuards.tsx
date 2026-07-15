import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/integrations/supabase/types";

function Loading() {
  return <div className="flex min-h-screen items-center justify-center text-muted-foreground">불러오는 중…</div>;
}

/** 로그인 필요. 미로그인 시 /login 으로. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

/** 특정 role 필요. 불일치 시 각자 홈으로. */
export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { session, role: myRole, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login" replace />;
  if (myRole !== role) return <Navigate to={myRole === "teacher" ? "/teacher" : "/student"} replace />;
  return <>{children}</>;
}

/** "/" 진입 시 role 기반 리다이렉트. */
export function RoleLanding() {
  const { session, role, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={role === "teacher" ? "/teacher" : "/student"} replace />;
}
