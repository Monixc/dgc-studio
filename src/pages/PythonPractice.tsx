import AppShell, { STUDENT_MENU } from "@/components/layout/AppShell";
import PracticeList from "@/components/student/PracticeList";

export default function PythonPractice() {
  return (
    <AppShell menu={STUDENT_MENU} homePath="/student">
      <PracticeList category="general" />
    </AppShell>
  );
}
