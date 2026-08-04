import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { Bell, ChevronDown, LayoutDashboard, LogOut, MessageSquare, Pencil, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import { AVATAR_COLORS, loadPrefs, savePrefs, type ProfilePrefs } from "@/lib/profile-prefs";
import { CLASS_STUDENTS_KEY, listAllStudents } from "@/lib/classStudents";
import { useStudentTeachers } from "@/hooks/useMessages";
import { useChat } from "@/hooks/useChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import NotificationSettings from "@/components/notifications/NotificationSettings";
import NotificationBell from "@/components/notifications/NotificationBell";
import ChatPanel from "@/components/chat/ChatPanel";
import { cn } from "@/lib/utils";

export interface Item {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  soon?: boolean;
  children?: Item[];
}

interface HeaderProps {
  title?: string;
  menu?: Item[];
  homePath?: string;
  onNavigate?: (item: Item) => void;
}

export default function Header({ title, menu, homePath, onNavigate }: HeaderProps) {
  const { user, profile, role } = useAuth();
  const uid = user!.id;
  const loc = useLocation();
  const [prefs, setPrefs] = useState<ProfilePrefs>(() => loadPrefs(uid));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const navItems: Item[] = homePath
    ? [{ label: "대시보드", icon: LayoutDashboard, to: homePath }, ...(menu ?? [])]
    : menu ?? [];

  const chat = useChat(uid);
  const teacherRecipients = useStudentTeachers(role === "student" ? uid : undefined);
  const studentRecipients = useQuery({
    queryKey: [...CLASS_STUDENTS_KEY, "all"],
    queryFn: listAllStudents,
    enabled: role === "teacher",
  });
  const recipients = role === "teacher" ? studentRecipients.data ?? [] : teacherRecipients.data ?? [];

  const name = prefs.displayName || profile?.display_name || "사용자";
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  const update = (patch: Partial<ProfilePrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(uid, next);
  };

  const startEdit = () => {
    setNameInput(name);
    setEditing(true);
  };
  const saveName = () => {
    update({ displayName: nameInput.trim() || undefined });
    setEditing(false);
  };

  return (
    <header className="flex h-14 items-center gap-2 border-b bg-background px-4 md:px-6">
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="hidden font-logo text-lg font-bold tracking-tight md:inline">RoOS</span>
      </div>
      {title && <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>}
      {navItems.length > 0 && (
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((it) =>
            it.children ? (
              <HeaderNavGroup
                key={it.label}
                item={it}
                pathname={loc.pathname}
                onNavigate={(child) => onNavigate?.(child)}
              />
            ) : (
              <HeaderNavButton
                key={it.label}
                item={it}
                active={!!it.to && loc.pathname === it.to}
                onClick={() => onNavigate?.(it)}
              />
            ),
          )}
        </nav>
      )}
      <div className="ml-auto flex items-center gap-1">
      <NotificationBell userId={uid} />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setChatOpen(true)}
        className="relative text-muted-foreground hover:text-foreground"
        title="채팅"
      >
        <MessageSquare className="size-5" />
        {chat.unreadCount > 0 && (
          <Badge variant="destructive" className="absolute right-0.5 top-0.5 min-w-4 justify-center px-1 text-[10px]">
            {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
          </Badge>
        )}
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="size-10 rounded-full p-1" title={name}>
            <Avatar>
              <AvatarFallback style={{ backgroundColor: prefs.avatarColor }}>{initial}</AvatarFallback>
            </Avatar>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <div className="mb-3 flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="text-base" style={{ backgroundColor: prefs.avatarColor }}>
                {initial}
              </AvatarFallback>
            </Avatar>
            {editing ? (
              <div className="flex flex-1 items-center gap-1">
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  autoFocus
                  className="h-8"
                />
                <Button variant="ghost" size="icon" className="size-7" onClick={saveName} title="저장">
                  <Check className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-between">
                <span className="font-medium">{name}</span>
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={startEdit} title="이름 편집">
                  <Pencil className="size-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="mb-1 text-xs text-muted-foreground">프로필 색상</div>
          <div className="mb-3 flex flex-wrap gap-2">
            {AVATAR_COLORS.map((c) => (
              <Button
                key={c}
                variant="ghost"
                size="icon"
                onClick={() => update({ avatarColor: c })}
                className={cn(
                  "size-7 rounded-full p-0 ring-offset-2 transition hover:opacity-90",
                  prefs.avatarColor === c && "ring-2 ring-foreground",
                )}
                style={{ backgroundColor: c }}
                title={c}
              >
                {prefs.avatarColor === c && <Check className="size-4 text-white" />}
              </Button>
            ))}
          </div>

          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false);
              setNotifOpen(true);
            }}
            className="w-full justify-start gap-2 font-normal"
          >
            <Bell className="size-4" /> 알림 설정
          </Button>
          <Button
            variant="ghost"
            onClick={() => signOut()}
            className="w-full justify-start gap-2 font-normal text-destructive hover:text-destructive"
          >
            <LogOut className="size-4" /> 로그아웃
          </Button>
        </PopoverContent>
      </Popover>
      </div>

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        userId={uid}
        recipients={recipients}
        chat={chat}
      />

      <Dialog open={notifOpen} onOpenChange={setNotifOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>알림 설정</DialogTitle>
          </DialogHeader>
          <NotificationSettings />
        </DialogContent>
      </Dialog>
    </header>
  );
}

function HeaderNavButton({ item, active, onClick }: { item: Item; active: boolean; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        "whitespace-nowrap font-normal hover:bg-transparent",
        active ? "text-foreground font-semibold" : "text-muted-foreground",
      )}
    >
      {item.label}
    </Button>
  );
}

function HeaderNavGroup({
  item, pathname, onNavigate,
}: { item: Item; pathname: string; onNavigate: (child: Item) => void }) {
  const isChildActive = item.children?.some((c) => c.to && pathname.startsWith(c.to)) ?? false;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "gap-1 whitespace-nowrap font-normal hover:bg-transparent data-[state=open]:[&_svg]:rotate-180",
            isChildActive ? "text-foreground font-semibold" : "text-muted-foreground",
          )}
        >
          {item.label}
          <ChevronDown className="size-3.5 transition-transform" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {item.children!.map((child) => {
          const active = !!child.to && pathname.startsWith(child.to);
          return (
            <DropdownMenuItem
              key={child.label}
              onClick={() => onNavigate(child)}
              className={cn(active && "bg-accent font-medium text-foreground")}
            >
              {child.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
