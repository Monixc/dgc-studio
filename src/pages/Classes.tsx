import AppShell from "@/components/layout/AppShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ClassManager from "@/components/admin/ClassManager";
import ProblemManager from "@/components/admin/ProblemManager";

export default function Classes() {
  return (
    <AppShell>
      <Tabs defaultValue="classes" className="flex h-full flex-col">
        <div className="border-b bg-background px-4 pt-3">
          <TabsList>
            <TabsTrigger value="classes">반 관리</TabsTrigger>
            <TabsTrigger value="problems">문제 관리</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="classes" className="flex-1 overflow-hidden">
          <ClassManager />
        </TabsContent>
        <TabsContent value="problems" className="flex-1 overflow-hidden">
          <ProblemManager />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
