import { useState } from "react";
import AppShell, { STUDENT_MENU } from "@/components/layout/AppShell";
import PracticeList from "@/components/student/PracticeList";
import BlockTutorialHub from "@/features/block-tutorial/BlockTutorialHub";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "tutorial" | "problems";

export default function BlockPractice() {
  const [tab, setTab] = useState<Tab>("tutorial");

  return (
    <AppShell menu={STUDENT_MENU} homePath="/student">
      <div className="flex items-center gap-1 border-b px-6 pt-4">
        {([
          ["tutorial", "기본 튜토리얼"],
          ["problems", "문제"],
        ] as const).map(([value, label]) => (
          <Button
            key={value}
            variant="ghost"
            className={cn(
              "rounded-none border-b-2 border-transparent px-3 pb-3 font-medium text-muted-foreground hover:bg-transparent",
              tab === value && "border-primary text-foreground"
            )}
            onClick={() => setTab(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {tab === "tutorial" ? <BlockTutorialHub /> : <PracticeList category="block" />}
    </AppShell>
  );
}
