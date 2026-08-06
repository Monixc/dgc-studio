import AppShell, { STUDENT_MENU } from "@/components/layout/AppShell";
import BlockTutorialRunner from "@/features/block-tutorial/BlockTutorialRunner";

export default function BlockTutorial() {
  return (
    <AppShell menu={STUDENT_MENU} homePath="/student">
      <BlockTutorialRunner />
    </AppShell>
  );
}
