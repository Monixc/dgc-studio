/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  GraduationCap, LayoutDashboard, Users, FileText, Keyboard,
  ShoppingBag, PanelLeftClose, PanelLeftOpen, BookOpen, Workflow, Code2, Blocks,
  ChevronDown, ClipboardList, NotebookPen,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Header from "@/components/layout/Header";

interface Item {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  soon?: boolean;
  children?: Item[];
}

const MENU: Item[] = [
  { label: "반 관리", icon: Users, to: "/classes" },
  { label: "학생 관리", icon: GraduationCap, to: "/students" },
  { label: "문제 관리", icon: FileText, to: "/problems" },
  { label: "타자 연습", icon: Keyboard, to: "/practice/typing" },
  { label: "포인트 상점", icon: ShoppingBag, to: "/shop" },
];

export const STUDENT_MENU: Item[] = [
  { label: "내 수업", icon: BookOpen, to: "/myclass" },
  {
    label: "문제 풀이",
    icon: ClipboardList,
    children: [
      { label: "순서도 연습", icon: Workflow, to: "/practice/flowchart" },
      { label: "파이썬 코딩", icon: Code2, to: "/practice/general" },
      { label: "블럭 코딩", icon: Blocks, to: "/practice/block" },
    ],
  },
  { label: "타자 연습", icon: Keyboard, to: "/practice/typing" },
  { label: "포트폴리오", icon: NotebookPen, to: "/student/portfolio" },
  { label: "포인트 상점", icon: ShoppingBag, to: "/student/shop" },
];

// 모바일 하단 탭은 좁아서 학생은 핵심 메뉴만 노출. 나머지는 데스크톱 사이드바에서.
const STUDENT_MOBILE_LABELS = ["포트폴리오", "포인트 상점"];
const STUDENT_MOBILE_LABEL_OVERRIDES: Record<string, string> = { "포트폴리오": "첨삭 확인" };
const MOBILE_HIDDEN_LABELS = ["타자 연습"];

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

  const mobileMenu = menu === STUDENT_MENU
    ? menu.flatMap((it) => it.children ?? [it])
        .filter((it) => STUDENT_MOBILE_LABELS.includes(it.label))
        .map((it) => (STUDENT_MOBILE_LABEL_OVERRIDES[it.label] ? { ...it, label: STUDENT_MOBILE_LABEL_OVERRIDES[it.label] } : it))
    : menu.filter((it) => !MOBILE_HIDDEN_LABELS.includes(it.label));
  const allItems: Item[] = [{ label: "대시보드", icon: LayoutDashboard, to: homePath }, ...mobileMenu];

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <aside className={cn("hidden md:flex flex-col border-r bg-background transition-all", collapsed ? "w-16" : "w-56")}>
        <div className={cn("flex h-14 items-center gap-2 border-b px-3", collapsed && "justify-center px-0")}>
          {!collapsed && <GraduationCap className="shrink-0 text-primary" />}
          {!collapsed && <span className="text-lg font-bold">디랩과천</span>}
          <button
            className={cn("rounded p-1 text-muted-foreground hover:bg-accent", !collapsed && "ml-auto")}
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
          {menu.map((it) =>
            it.children ? (
              <NavGroup
                key={it.label}
                item={it}
                pathname={loc.pathname}
                collapsed={collapsed}
                onNavigate={(child) => go(child)}
              />
            ) : (
              <NavButton
                key={it.label}
                item={it}
                active={!!it.to && loc.pathname === it.to}
                collapsed={collapsed}
                onClick={() => go(it)}
              />
            ),
          )}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
        {allItems.map((it) => (
          <BottomNavButton
            key={it.label}
            item={it}
            active={!!it.to && loc.pathname === it.to}
            onClick={() => (it.to === homePath ? nav(homePath) : go(it))}
          />
        ))}
      </nav>
    </div>
  );
}

/* ── 접이식 그룹 메뉴 ── */
function NavGroup({
  item, pathname, collapsed, onNavigate,
}: { item: Item; pathname: string; collapsed: boolean; onNavigate: (child: Item) => void }) {
  const isChildActive = item.children?.some((c) => c.to && pathname.startsWith(c.to)) ?? false;
  const [open, setOpen] = useState(isChildActive);
  const Icon = item.icon;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        title={collapsed ? item.label : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-full px-3 py-2 text-sm transition",
          isChildActive ? "text-primary font-medium" : "text-foreground hover:bg-accent",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon className="size-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </>
        )}
      </button>
      {!collapsed && open && item.children && (
        <div className="ml-5 mt-0.5 space-y-0.5 border-l pl-3">
          {item.children.map((child) => (
            <NavButton
              key={child.label}
              item={child}
              active={!!child.to && pathname.startsWith(child.to)}
              collapsed={false}
              onClick={() => onNavigate(child)}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NavButton({
  item, active, collapsed, onClick, compact,
}: { item: Item; active?: boolean; collapsed: boolean; onClick: () => void; compact?: boolean }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-full px-3 text-sm transition",
        compact ? "py-1.5" : "py-2",
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

function BottomNavButton({ item, active, onClick }: { item: Item; active?: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-2 text-[10px]",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

