import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth, RequireRole, Home } from "@/components/RouteGuards";
import { usePresenceTracker } from "@/hooks/usePresence";
import Dashboard from "@/pages/Dashboard";
import Classes from "@/pages/Classes";
import Problems from "@/pages/Problems";
import TeacherProblems from "@/pages/TeacherProblems";
import StudentProblems from "@/pages/StudentProblems";
import Solve from "@/pages/Solve";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, retry: 1 } },
});

/** 로그인 상태면 전역 presence 채널에 자신을 등록(접속 학생 조회용). */
function PresenceGate() {
  usePresenceTracker();
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PresenceGate />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/dashboard"
              element={
                <RequireRole role="teacher">
                  <Dashboard />
                </RequireRole>
              }
            />
            <Route
              path="/classes"
              element={
                <RequireRole role="teacher">
                  <Classes />
                </RequireRole>
              }
            />
            <Route
              path="/problems"
              element={
                <RequireRole role="teacher">
                  <Problems />
                </RequireRole>
              }
            />
            <Route
              path="/teacher"
              element={
                <RequireRole role="teacher">
                  <TeacherProblems />
                </RequireRole>
              }
            />
            <Route
              path="/student"
              element={
                <RequireRole role="student">
                  <StudentProblems />
                </RequireRole>
              }
            />
            <Route
              path="/solve/:problemId"
              element={
                <RequireAuth>
                  <Solve />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
