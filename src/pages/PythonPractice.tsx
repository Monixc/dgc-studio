import AppShell, { STUDENT_MENU } from "@/components/layout/AppShell";
import PracticeList from "@/components/student/PracticeList";

export default function PythonPractice() {
  return (
    <AppShell menu={STUDENT_MENU} homePath="/student">
      <PracticeList title="파이썬 코딩" category="general" />
    </AppShell>
  );
}
