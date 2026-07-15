import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  GraduationCap, LayoutDashboard, Users, FileText, Keyboard,
  ShoppingBag, PanelLeftClose, PanelLeftOpen, BookOpen, Workflow, Code2, Blocks,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Header from "@/components/layout/Header";

interface Item {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  soon?: boolean;
}

const MENU: Item[] = [
  { label: "반 관리", icon: Users, to: "/classes" },
  { label: "문제 관리", icon: FileText, to: "/problems" },
  { label: "타자 연습", icon: Keyboard, soon: true },
  { label: "포인트 상점", icon: ShoppingBag, to: "/shop" },
];

export const STUDENT_MENU: Item[] = [
  { label: "내 수업", icon: BookOpen, to: "/myclass" },
  { label: "순서도 연습", icon: Workflow, to: "/practice/flowchart" },
  { label: "파이썬 코딩", icon: Code2, to: "/practice/general" },
  { label: "블럭 코딩", icon: Blocks, to: "/practice/block" },
  { label: "타자 연습", icon: Keyboard, soon: true },
  { label: "포인트 상점", icon: ShoppingBag, to: "/student/shop" },
];

interface AppShellProps {
  children: React.ReactNode;
  menu?: Item[];
  homePath?: string;
}

export default function AppShell({ children, menu = MENU, homePath = "/dashboard" }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  const go = (it: Item) => {
    if (it.soon) return toast.info(`${it.label}은(는) 준비 중입니다.`);
    if (it.to) nav(it.to);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <aside className={cn("flex flex-col border-r bg-background transition-all", collapsed ? "w-16" : "w-56")}>
        <div className="flex h-14 items-center gap-2 border-b px-3">
          <GraduationCap className="shrink-0 text-primary" />
          {!collapsed && <span className="font-bold">Flow-Py</span>}
          <button
            className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-2">
          <NavButton
            item={{ label: "대시보드", icon: LayoutDashboard, to: homePath }}
            active={loc.pathname === homePath}
            collapsed={collapsed}
            onClick={() => nav(homePath)}
          />
          <div className="my-2 border-t" />
          {menu.map((it) => (
            <NavButton
              key={it.label}
              item={it}
              active={!!it.to && loc.pathname === it.to}
              collapsed={collapsed}
              onClick={() => go(it)}
            />
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function NavButton({
  item, active, collapsed, onClick,
}: { item: Item; active?: boolean; collapsed: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && (
        <span className="flex-1 text-left">
          {item.label}
          {item.soon && <span className="ml-1 text-[10px] text-muted-foreground">준비 중</span>}
        </span>
      )}
    </button>
  );
}
