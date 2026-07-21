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
import { hydrateSubmission } from "@/lib/submissions";

export interface ManagedStudent extends Profile {
  classes: ClassRow[];
}

export interface StudentSubmission extends Submission {
  problem_title: string;
}

// 교사 공유 모델: 내 반 학생뿐 아니라 전체 학생을 반환하고, 소속 반을 함께 붙인다.
export async function listManagedStudents(_teacherId: string): Promise<ManagedStudent[]> {
  const { data: students, error: studentsError } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "student")
    .order("display_name", { ascending: true });
  if (studentsError) {
    throw new Error(`학생 프로필 조회 실패: ${studentsError.message}`);
  }
  const studentRows = (students ?? []) as Profile[];
  if (!studentRows.length) return [];

  // 소속 반 매핑(교사는 전체 반/소속 조회 가능). 실패해도 학생 목록은 반환.
  const { data: memberData } = await supabase.from("class_students").select("class_id, student_id");
  const memberships = (memberData ?? []) as { class_id: string; student_id: string }[];
  const classIds = [...new Set(memberships.map((m) => m.class_id))];
  const classById = new Map<string, ClassRow>();
  if (classIds.length) {
    const { data: classes } = await supabase.from("classes").select("*").in("id", classIds);
    for (const row of (classes ?? []) as ClassRow[]) classById.set(row.id, row);
  }
  const classesByStudent = new Map<string, ClassRow[]>();
  for (const membership of memberships) {
    const classroom = classById.get(membership.class_id);
    if (classroom) classesByStudent.set(membership.student_id, [...(classesByStudent.get(membership.student_id) ?? []), classroom]);
  }
  return studentRows.map((student) => ({ ...student, classes: classesByStudent.get(student.id) ?? [] }));
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
  const submissions = ((data ?? []) as Submission[]).map(hydrateSubmission);
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

export async function createSubmissionComment(params: { submissionId: string; authorId: string; body: string }): Promise<string | null> {
  const body = params.body.trim();
  if (!body) return null;
  const { data, error } = await supabase
    .from("submission_comments")
    .insert({
      submission_id: params.submissionId,
      author_id: params.authorId,
      body,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data?.id as string) ?? null;
}

export interface MyProblemFeedbackItem {
  id: string;
  submissionId: string;
  problemId: string;
  problemTitle: string;
  submittedAt: string;
  body: string;
  createdAt: string;
}

/** 학생 본인의 전체 문제 제출에 달린 교사 첨삭 전체(문제 무관, 최신순). */
export async function listMyAllSubmissionFeedback(userId: string): Promise<MyProblemFeedbackItem[]> {
  const submissions = await listStudentSubmissions(userId);
  if (!submissions.length) return [];
  const subById = new Map(submissions.map((s) => [s.id, s]));

  const { data, error } = await supabase
    .from("submission_comments")
    .select("*")
    .in("submission_id", submissions.map((s) => s.id))
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as SubmissionComment[]).flatMap((c) => {
    const sub = subById.get(c.submission_id);
    if (!sub) return [];
    return [{
      id: c.id,
      submissionId: c.submission_id,
      problemId: sub.problem_id,
      problemTitle: sub.problem_title,
      submittedAt: sub.submitted_at,
      body: c.body,
      createdAt: c.created_at,
    }];
  });
}

/** 학생 본인이 이 문제에 제출한 것들에 달린 교사 첨삭 전체(최신순). */
export async function listMySubmissionFeedback(userId: string, problemId: string): Promise<SubmissionComment[]> {
  const { data: subs, error: subsError } = await supabase
    .from("submissions")
    .select("id")
    .eq("user_id", userId)
    .eq("problem_id", problemId);
  if (subsError) throw subsError;
  const ids = (subs ?? []).map((s) => s.id as string);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("submission_comments")
    .select("*")
    .in("submission_id", ids)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SubmissionComment[];
}
