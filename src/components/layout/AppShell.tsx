/* eslint-disable react-refresh/only-export-components */
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, GraduationCap, FileText, Keyboard,
  ShoppingBag, BookOpen, Workflow, Code2, Blocks,
  ClipboardList, NotebookPen,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Header, { type Item } from "@/components/layout/Header";

const MENU: Item[] = [
  { label: "반 관리", icon: Users, to: "/classes" },
  { label: "학생 관리", icon: GraduationCap, to: "/students" },
  { label: "문제 관리", icon: FileText, to: "/problems" },
  { label: "교안 관리", icon: NotebookPen, to: "/lessons" },
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

// 모바일 하단 탭은 좁아서 학생은 핵심 메뉴만 노출. 나머지는 헤더 메뉴에서.
const STUDENT_MOBILE_LABELS = ["포트폴리오", "포인트 상점"];
const STUDENT_MOBILE_LABEL_OVERRIDES: Record<string, string> = { "포트폴리오": "첨삭 확인" };
const MOBILE_HIDDEN_LABELS = ["타자 연습"];

interface AppShellProps {
  children: React.ReactNode;
  menu?: Item[];
  homePath?: string;
}

export default function AppShell({ children, menu = MENU, homePath = "/dashboard" }: AppShellProps) {
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
    <div className="flex h-screen flex-col overflow-hidden bg-muted/30">
      <Header menu={menu} homePath={homePath} onNavigate={go} />
      <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>

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

function BottomNavButton({ item, active, onClick }: { item: Item; active?: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-2 text-[10px]",
        active ? "text-foreground font-medium" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}
