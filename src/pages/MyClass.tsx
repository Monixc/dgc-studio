import { BookOpen } from "lucide-react";
import { CourseShell } from "@/components/student/StudentCourseNav";

export default function MyClass() {
  return (
    <CourseShell>
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
        <BookOpen className="size-8" />
        <p className="text-sm">왼쪽에서 교안이나 문제를 선택하세요.</p>
      </div>
    </CourseShell>
  );
}
