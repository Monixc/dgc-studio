import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth, RequireRole, Home } from "@/components/RouteGuards";
import { usePresenceTracker } from "@/hooks/usePresence";
import Dashboard from "@/pages/Dashboard";
import Classes from "@/pages/Classes";
import LiveClass from "@/pages/LiveClass";
import Problems from "@/pages/Problems";
import StudentDashboard from "@/pages/StudentDashboard";
import MyClass from "@/pages/MyClass";
import FlowchartPractice from "@/pages/FlowchartPractice";
import PythonPractice from "@/pages/PythonPractice";
import BlockPractice from "@/pages/BlockPractice";
import BlockTutorial from "@/pages/BlockTutorial";
import TypingPractice from "@/pages/TypingPractice";
import Solve from "@/pages/Solve";
import TeacherShop from "@/pages/TeacherShop";
import StudentShop from "@/pages/StudentShop";
import Students from "@/pages/Students";
import Lessons from "@/pages/Lessons";
import LessonView from "@/pages/LessonView";
import StudentSubmissionReview from "@/pages/StudentSubmissionReview";
import NotFound from "@/pages/NotFound";

// ponytail: 블록 코딩 임시 비활성화. 재오픈 시 true로.
const BLOCK_CODING_ENABLED = false;

const StudentPortfolio = lazy(() => import("@/pages/StudentPortfolio"));
const StudentPortfolioEditor = lazy(() => import("@/pages/StudentPortfolioEditor"));
const StudentPortfolioReview = lazy(() => import("@/pages/StudentPortfolioReview"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
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
          <Suspense fallback={<div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">화면을 불러오는 중…</div>}>
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
              path="/students"
              element={
                <RequireRole role="teacher">
                  <Students />
                </RequireRole>
              }
            />
            <Route
              path="/students/:studentId/problems/:problemId"
              element={
                <RequireRole role="teacher">
                  <StudentSubmissionReview />
                </RequireRole>
              }
            />
            <Route
              path="/students/:studentId/portfolio/:submissionId"
              element={
                <RequireRole role="teacher">
                  <StudentPortfolioReview />
                </RequireRole>
              }
            />
            <Route
              path="/classes/:classId/live"
              element={
                <RequireRole role="teacher">
                  <LiveClass />
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
              path="/lessons"
              element={
                <RequireRole role="teacher">
                  <Lessons />
                </RequireRole>
              }
            />
            <Route
              path="/student"
              element={
                <RequireRole role="student">
                  <StudentDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/student/myclass"
              element={
                <RequireRole role="student">
                  <MyClass />
                </RequireRole>
              }
            />
            <Route
              path="/student/lessons/:lessonId"
              element={
                <RequireRole role="student">
                  <LessonView />
                </RequireRole>
              }
            />
            <Route
              path="/student/lessons/:lessonId/problems/:problemId"
              element={
                <RequireRole role="student">
                  <LessonView />
                </RequireRole>
              }
            />
            <Route
              path="/practice/flowchart"
              element={
                <RequireRole role="student">
                  <FlowchartPractice />
                </RequireRole>
              }
            />
            <Route
              path="/practice/general"
              element={
                <RequireRole role="student">
                  <PythonPractice />
                </RequireRole>
              }
            />
            <Route
              path="/practice/block"
              element={
                BLOCK_CODING_ENABLED ? (
                  <RequireRole role="student">
                    <BlockPractice />
                  </RequireRole>
                ) : (
                  <Navigate to="/student" replace />
                )
              }
            />
            <Route
              path="/practice/block/tutorial/:tutorialId"
              element={
                BLOCK_CODING_ENABLED ? (
                  <RequireRole role="student">
                    <BlockTutorial />
                  </RequireRole>
                ) : (
                  <Navigate to="/student" replace />
                )
              }
            />
            <Route
              path="/practice/typing"
              element={
                <RequireAuth>
                  <TypingPractice />
                </RequireAuth>
              }
            />
            <Route
              path="/shop"
              element={
                <RequireRole role="teacher">
                  <TeacherShop />
                </RequireRole>
              }
            />
            <Route
              path="/student/shop"
              element={
                <RequireRole role="student">
                  <StudentShop />
                </RequireRole>
              }
            />
            <Route
              path="/student/portfolio"
              element={
                <RequireRole role="student">
                  <StudentPortfolio />
                </RequireRole>
              }
            />
            <Route
              path="/student/portfolio/:documentId/edit"
              element={
                <RequireRole role="student">
                  <StudentPortfolioEditor />
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
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
