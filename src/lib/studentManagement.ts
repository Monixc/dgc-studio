import { supabase } from "@/integrations/supabase/client";
import type {
  ClassRow,
  PointsLedgerEntry,
  Profile,
  StudentManagementNote,
  Submission,
  SubmissionComment,
  TypingPracticeLog,
} from "@/integrations/supabase/types";

export interface ManagedStudent extends Profile {
  classes: ClassRow[];
}

export interface StudentSubmission extends Submission {
  problem_title: string;
}

// SEC-3: 담당(내 반에 소속된) 학생만 반환. 전체 학생 열거·PII 노출 차단.
export async function listManagedStudents(teacherId: string): Promise<ManagedStudent[]> {
  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("*")
    .eq("created_by", teacherId)
    .order("created_at", { ascending: true });
  if (classesError) {
    throw new Error(`담당 반 조회 실패: ${classesError.message}`);
  }

  const classRows = (classes ?? []) as ClassRow[];
  const classIds = classRows.map((row) => row.id);
  if (!classIds.length) return [];

  const { data: memberData, error: memberError } = await supabase
    .from("class_students")
    .select("class_id, student_id")
    .in("class_id", classIds);
  if (memberError) {
    throw new Error(`학생 소속 조회 실패: ${memberError.message}`);
  }
  const memberships = (memberData ?? []) as { class_id: string; student_id: string }[];
  const studentIds = [...new Set(memberships.map((m) => m.student_id))];
  if (!studentIds.length) return [];

  const { data: students, error: studentsError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", studentIds)
    .eq("role", "student")
    .order("display_name", { ascending: true });
  if (studentsError) {
    throw new Error(`학생 프로필 조회 실패: ${studentsError.message}`);
  }

  const classById = new Map(classRows.map((row) => [row.id, row]));
  const classesByStudent = new Map<string, ClassRow[]>();
  for (const membership of memberships) {
    const classroom = classById.get(membership.class_id);
    if (classroom) classesByStudent.set(membership.student_id, [...(classesByStudent.get(membership.student_id) ?? []), classroom]);
  }
  return ((students ?? []) as Profile[]).map((student) => ({ ...student, classes: classesByStudent.get(student.id) ?? [] }));
}

export async function listStudentTypingLogs(
  studentId: string,
  days = 30,
): Promise<TypingPracticeLog[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - Math.max(0, days - 1));

  const { data, error } = await supabase
    .from("typing_practice_logs")
    .select("*")
    .eq("student_id", studentId)
    .gte("completed_at", since.toISOString())
    .order("completed_at", { ascending: true });
  if (error) throw new Error(`타자 기록 조회 실패: ${error.message}`);
  return (data ?? []) as TypingPracticeLog[];
}

export async function listStudentPointEarnings(
  studentId: string,
  limit = 100,
): Promise<PointsLedgerEntry[]> {
  const { data, error } = await supabase
    .from("points_ledger")
    .select("*")
    .eq("student_id", studentId)
    .gt("amount", 0)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`포인트 획득 이력 조회 실패: ${error.message}`);
  return (data ?? []) as PointsLedgerEntry[];
}

export async function getStudentManagementNote(studentId: string): Promise<StudentManagementNote | null> {
  const { data, error } = await supabase.from("student_management_notes").select("*").eq("student_id", studentId).maybeSingle();
  if (error) throw error;
  return data as StudentManagementNote | null;
}

export async function saveStudentManagementNote(params: {
  studentId: string;
  birthDate: string | null;
  notes: string;
  updatedBy: string;
}): Promise<void> {
  const { error } = await supabase.from("student_management_notes").upsert({
    student_id: params.studentId,
    birth_date: params.birthDate,
    notes: params.notes,
    updated_by: params.updatedBy,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function listStudentSubmissions(studentId: string): Promise<StudentSubmission[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("user_id", studentId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  const submissions = (data ?? []) as Submission[];
  const problemIds = [...new Set(submissions.map((submission) => submission.problem_id))];
  if (!problemIds.length) return [];

  const { data: problems, error: problemsError } = await supabase.from("problems").select("id, title").in("id", problemIds);
  if (problemsError) throw problemsError;
  const titleById = new Map((problems ?? []).map((problem) => [problem.id as string, problem.title as string]));
  return submissions.map((submission) => ({ ...submission, problem_title: titleById.get(submission.problem_id) ?? "삭제된 문제" }));
}

export async function listSubmissionComments(submissionId: string): Promise<SubmissionComment[]> {
  const { data, error } = await supabase
    .from("submission_comments")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SubmissionComment[];
}

export async function createSubmissionComment(params: { submissionId: string; authorId: string; body: string }): Promise<void> {
  const body = params.body.trim();
  if (!body) return;
  const { error } = await supabase.from("submission_comments").insert({
    submission_id: params.submissionId,
    author_id: params.authorId,
    body,
  });
  if (error) throw error;
}
