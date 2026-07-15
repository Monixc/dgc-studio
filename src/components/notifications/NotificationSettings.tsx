import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { pushSupported, getPushSubscription, subscribePush, unsubscribePush } from "@/lib/push";
import { Button } from "@/components/ui/button";

export default function NotificationSettings() {
  const { user } = useAuth();
  const userId = user!.id;
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = pushSupported();

  useEffect(() => {
    if (!supported) return;
    getPushSubscription().then((sub) => setSubscribed(!!sub));
  }, [supported]);

  async function toggle() {
    setBusy(true);
    try {
      if (subscribed) {
        await unsubscribePush();
        setSubscribed(false);
        toast.success("알림을 껐습니다.");
      } else {
        await subscribePush(userId);
        setSubscribed(true);
        toast.success("알림을 켰습니다.");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">알림</h1>

      <div className="max-w-md rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          {subscribed ? <Bell className="size-6 text-primary" /> : <BellOff className="size-6 text-muted-foreground" />}
          <div className="flex-1">
            <div className="font-medium">브라우저 알림 받기</div>
            <p className="text-sm text-muted-foreground">
              공지사항, 쪽지, 구매 요청/승인, 수업 시작 30분 전 알림을 이 기기로 받습니다.
            </p>
          </div>
        </div>
        {!supported ? (
          <p className="mt-3 text-sm text-destructive">이 브라우저는 웹 푸시를 지원하지 않습니다.</p>
        ) : (
          <Button className="mt-4 w-full" onClick={toggle} disabled={busy}>
            {busy ? "처리 중…" : subscribed ? "알림 끄기" : "알림 켜기"}
          </Button>
        )}
      </div>
    </div>
  );
}
