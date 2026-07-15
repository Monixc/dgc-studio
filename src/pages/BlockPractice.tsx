import AppShell, { STUDENT_MENU } from "@/components/layout/AppShell";
import PracticeList from "@/components/student/PracticeList";

export default function BlockPractice() {
  return (
    <AppShell menu={STUDENT_MENU} homePath="/student">
      <PracticeList title="블럭 코딩" category="block" />
    </AppShell>
  );
}
