import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth, RequireRole, RoleLanding } from "@/components/RouteGuards";
import TeacherProblems from "@/pages/TeacherProblems";
import StudentProblems from "@/pages/StudentProblems";
import Solve from "@/pages/Solve";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RoleLanding />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
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
