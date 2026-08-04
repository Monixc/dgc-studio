import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import type { AppNotification } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export default function NotificationBell({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const { data: notifications = [], markRead, markAllRead } = useNotifications(userId);
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read_at).length;

  const openItem = (n: AppNotification) => {
    if (!n.read_at) markRead.mutate(n.id);
    setOpen(false);
    if (n.url) navigate(n.url);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          title="알림"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute right-0.5 top-0.5 min-w-4 justify-center px-1 py-0 text-[10px] font-semibold text-white"
            >
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[90vw] overflow-hidden p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">알림</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              className="h-auto gap-1 px-0 py-0 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3.5" /> 모두 읽음
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">알림이 없습니다.</p>
          ) : (
            notifications.map((n) => (
              <Button
                key={n.id}
                variant="ghost"
                onClick={() => openItem(n)}
                className={cn(
                  "h-auto w-full flex-col items-start justify-start gap-0.5 border-b px-3 py-2.5 text-left font-normal last:border-b-0 hover:bg-accent",
                  !n.read_at && "bg-primary/5",
                )}
              >
                <span className="flex items-center gap-2">
                  {!n.read_at && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                  <span className="truncate text-sm font-medium">{n.title}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                </span>
                {n.body && <span className="truncate pl-3.5 text-xs text-muted-foreground">{n.body}</span>}
              </Button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
