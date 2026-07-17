import { supabase } from "@/integrations/supabase/client";
import type {
  ClassRow,
  Profile,
  StudentManagementNote,
  Submission,
  SubmissionComment,
} from "@/integrations/supabase/types";

export interface ManagedStudent extends Profile {
  classes: ClassRow[];
}

export interface StudentSubmission extends Submission {
  problem_title: string;
}

export async function listManagedStudents(teacherId: string): Promise<ManagedStudent[]> {
  const [{ data: students, error: studentsError }, { data: classes, error: classesError }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "student").order("display_name", { ascending: true }),
    supabase.from("classes").select("*").eq("created_by", teacherId).order("created_at", { ascending: true }),
  ]);
  if (studentsError) throw studentsError;
  if (classesError) throw classesError;

  const classRows = (classes ?? []) as ClassRow[];
  const classIds = classRows.map((row) => row.id);
  let memberships: { class_id: string; student_id: string }[] = [];
  if (classIds.length) {
    const { data, error } = await supabase
      .from("class_students")
      .select("class_id, student_id")
      .in("class_id", classIds);
    if (error) throw error;
    memberships = (data ?? []) as { class_id: string; student_id: string }[];
  }

  const classesByStudent = new Map<string, ClassRow[]>();
  const classById = new Map(classRows.map((row) => [row.id, row]));
  for (const membership of memberships) {
    const classroom = classById.get(membership.class_id);
    if (classroom) classesByStudent.set(membership.student_id, [...(classesByStudent.get(membership.student_id) ?? []), classroom]);
  }
  return ((students ?? []) as Profile[]).map((student) => ({ ...student, classes: classesByStudent.get(student.id) ?? [] }));
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
