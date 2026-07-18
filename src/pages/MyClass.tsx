import { useAuth } from "@/hooks/useAuth";
import { useAssignedProblems } from "@/hooks/useClasses";
import AppShell, { STUDENT_MENU } from "@/components/layout/AppShell";
import PracticeList from "@/components/student/PracticeList";

export default function MyClass() {
  const { user } = useAuth();
  const { data: problems = [] } = useAssignedProblems(user?.id);

  return (
    <AppShell menu={STUDENT_MENU} homePath="/student">
      <PracticeList title="내 수업" problems={problems} solveScope="myclass" />
    </AppShell>
  );
}
