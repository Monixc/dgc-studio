import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  GraduationCap, LayoutDashboard, Workflow, Blocks, Code2, Keyboard,
  ShoppingBag, PanelLeftClose, PanelLeftOpen,
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
  { label: "순서도 연습", icon: Workflow, to: "/teacher" },
  { label: "블럭 코딩", icon: Blocks, soon: true },
  { label: "파이썬 문제 풀이", icon: Code2, to: "/teacher" },
  { label: "타자 연습", icon: Keyboard, soon: true },
  { label: "포인트 상점", icon: ShoppingBag, soon: true },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
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
            item={{ label: "대시보드", icon: LayoutDashboard, to: "/dashboard" }}
            active={loc.pathname === "/dashboard"}
            collapsed={collapsed}
            onClick={() => nav("/dashboard")}
          />
          <div className="my-2 border-t" />
          {MENU.map((it) => (
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
