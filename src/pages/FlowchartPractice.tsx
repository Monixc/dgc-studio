import AppShell, { STUDENT_MENU } from "@/components/layout/AppShell";
import PracticeList from "@/components/student/PracticeList";

export default function FlowchartPractice() {
  return (
    <AppShell menu={STUDENT_MENU} homePath="/student">
      <PracticeList title="순서도 연습" category="flowchart" />
    </AppShell>
  );
}
