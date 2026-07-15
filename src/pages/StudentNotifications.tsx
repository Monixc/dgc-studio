import AppShell, { STUDENT_MENU } from "@/components/layout/AppShell";
import NotificationSettings from "@/components/notifications/NotificationSettings";

export default function StudentNotifications() {
  return (
    <AppShell menu={STUDENT_MENU} homePath="/student">
      <NotificationSettings />
    </AppShell>
  );
}
