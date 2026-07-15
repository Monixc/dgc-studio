import AppShell, { STUDENT_MENU } from "@/components/layout/AppShell";
import ShopPanel from "@/components/student/ShopPanel";

export default function StudentShop() {
  return (
    <AppShell menu={STUDENT_MENU} homePath="/student">
      <ShopPanel />
    </AppShell>
  );
}
