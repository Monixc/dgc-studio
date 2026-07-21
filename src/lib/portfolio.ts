import { supabase } from "@/integrations/supabase/client";
import type {
  ClassRow,
  JsonValue,
  PortfolioAsset,
  PortfolioComment,
  PortfolioDocument,
  PortfolioSubmission,
} from "@/integrations/supabase/types";

export const PORTFOLIO_ASSETS_BUCKET = "portfolio-assets";

export interface PortfolioDocumentInput {
  title: string;
  contentJson: JsonValue;
  contentText: string;
}

export type PortfolioCommentAnchor =
  | { anchorType: "document" }
  | { anchorType: "asset"; assetId: string; imageNumber?: number | null }
  | {
      anchorType: "range";
      startPosition: number;
      endPosition: number;
      startLine?: number | null;
      endLine?: number | null;
      quotedText?: string | null;
    };

export interface PortfolioCommentInput {
  body: string;
  anchor: PortfolioCommentAnchor;
}

export interface PortfolioSubmissionFilters {
  documentId?: string;
  classId?: string;
  studentId?: string;
}

export class PortfolioRevisionConflictError extends Error {
  constructor() {
    super("포트폴리오 문서가 다른 곳에서 수정되었습니다.");
    this.name = "PortfolioRevisionConflictError";
  }
}

export async function listPortfolioClasses(studentId: string): Promise<ClassRow[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId);
  if (membershipError) throw membershipError;
  const classIds = [...new Set((memberships ?? []).map((row) => row.class_id as string))];
  if (!classIds.length) return [];

  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .in("id", classIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ClassRow[];
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("로그인이 필요합니다.");
  return data.user.id;
}

function documentPayload(input: PortfolioDocumentInput) {
  return {
    title: input.title,
    content_json: input.contentJson,
    content_text: input.contentText,
  };
}

function commentPayload(input: PortfolioCommentInput) {
  if (input.anchor.anchorType === "document") {
    return {
      body: input.body,
      anchor_type: "document" as const,
      asset_id: null,
      asset_index: null,
      start_position: null,
      end_position: null,
      start_line: null,
      end_line: null,
      quoted_text: null,
    };
  }

  if (input.anchor.anchorType === "asset") {
    return {
      body: input.body,
      anchor_type: "asset" as const,
      asset_id: input.anchor.assetId,
      asset_index: input.anchor.imageNumber ?? null,
      start_position: null,
      end_position: null,
      start_line: null,
      end_line: null,
      quoted_text: null,
    };
  }

  return {
    body: input.body,
    anchor_type: "range" as const,
    asset_id: null,
    asset_index: null,
    start_position: input.anchor.startPosition,
    end_position: input.anchor.endPosition,
    start_line: input.anchor.startLine ?? null,
    end_line: input.anchor.endLine ?? null,
    quoted_text: input.anchor.quotedText ?? null,
  };
}

export async function listPortfolioDocuments(): Promise<PortfolioDocument[]> {
  const { data, error } = await supabase
    .from("portfolio_documents")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PortfolioDocument[];
}

export async function getPortfolioDocument(documentId: string): Promise<PortfolioDocument | null> {
  const { data, error } = await supabase
    .from("portfolio_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw error;
  return data as PortfolioDocument | null;
}

export async function createPortfolioDocument(input: PortfolioDocumentInput): Promise<PortfolioDocument> {
  const studentId = await requireUserId();
  const { data, error } = await supabase
    .from("portfolio_documents")
    .insert({ student_id: studentId, ...documentPayload(input) })
    .select()
    .single();
  if (error) throw error;
  return data as PortfolioDocument;
}

export async function updatePortfolioDocument(
  documentId: string,
  expectedRevision: number,
  input: PortfolioDocumentInput,
): Promise<PortfolioDocument> {
  const { data, error } = await supabase
    .from("portfolio_documents")
    .update({ ...documentPayload(input), revision: expectedRevision + 1 })
    .eq("id", documentId)
    .eq("revision", expectedRevision)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new PortfolioRevisionConflictError();
  return data as PortfolioDocument;
}

export async function deletePortfolioDocument(documentId: string): Promise<void> {
  const assets = await listPortfolioAssets(documentId);
  const { error } = await supabase.from("portfolio_documents").delete().eq("id", documentId);
  if (error) throw error;

  if (assets.length) {
    const { error: storageError } = await supabase.storage
      .from(PORTFOLIO_ASSETS_BUCKET)
      .remove(assets.map((asset) => asset.storage_path));
    if (storageError) throw storageError;
  }
}

export async function submitPortfolioDocument(
  documentId: string,
  expectedRevision: number,
): Promise<PortfolioSubmission> {
  const { data, error } = await supabase.rpc("submit_portfolio_document", {
    p_document_id: documentId,
    p_expected_revision: expectedRevision,
  });
  if (error) throw error;
  return data as PortfolioSubmission;
}

export async function listPortfolioSubmissions(
  filters: PortfolioSubmissionFilters = {},
): Promise<PortfolioSubmission[]> {
  let query = supabase
    .from("portfolio_submissions")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (filters.documentId) query = query.eq("document_id", filters.documentId);
  if (filters.classId) query = query.eq("class_id", filters.classId);
  if (filters.studentId) query = query.eq("student_id", filters.studentId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PortfolioSubmission[];
}

export async function listPortfolioAssets(documentId: string): Promise<PortfolioAsset[]> {
  const { data, error } = await supabase
    .from("portfolio_assets")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PortfolioAsset[];
}

export async function listPortfolioSubmissionAssets(submissionId: string): Promise<PortfolioAsset[]> {
  const { data: links, error: linksError } = await supabase
    .from("portfolio_submission_assets")
    .select("asset_id")
    .eq("submission_id", submissionId);
  if (linksError) throw linksError;
  const assetIds = (links ?? []).map((link) => link.asset_id as string);
  if (!assetIds.length) return [];

  const { data, error } = await supabase
    .from("portfolio_assets")
    .select("*")
    .in("id", assetIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PortfolioAsset[];
}

export async function uploadPortfolioAsset(documentId: string, file: File): Promise<PortfolioAsset> {
  const studentId = await requireUserId();
  const assetId = crypto.randomUUID();
  const storagePath = `${studentId}/${documentId}/${assetId}`;
  const { error: uploadError } = await supabase.storage
    .from(PORTFOLIO_ASSETS_BUCKET)
    .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("portfolio_assets")
    .insert({
      id: assetId,
      document_id: documentId,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(PORTFOLIO_ASSETS_BUCKET).remove([storagePath]);
    throw error;
  }
  return data as PortfolioAsset;
}

export async function deletePortfolioAsset(asset: PortfolioAsset): Promise<void> {
  const { error } = await supabase.from("portfolio_assets").delete().eq("id", asset.id);
  if (error) throw error;

  const { error: storageError } = await supabase.storage
    .from(PORTFOLIO_ASSETS_BUCKET)
    .remove([asset.storage_path]);
  if (storageError) throw storageError;
}

async function fetchAssetStoragePath(assetId: string): Promise<string> {
  const { data: asset, error: assetError } = await supabase
    .from("portfolio_assets")
    .select("storage_path")
    .eq("id", assetId)
    .single();
  if (assetError) throw assetError;
  return asset.storage_path as string;
}

export async function getPortfolioAssetSignedUrl(assetId: string, expiresIn = 3600): Promise<string> {
  let storagePath: string;
  try {
    storagePath = await fetchAssetStoragePath(assetId);
  } catch (error) {
    // 제출 직후 열람 시 세션 토큰 갱신과 겹치는 드문 경합으로 0 rows(PGRST116)가 뜰 수 있어 1회 재시도.
    if ((error as { code?: string }).code !== "PGRST116") throw error;
    await new Promise((resolve) => setTimeout(resolve, 600));
    storagePath = await fetchAssetStoragePath(assetId);
  }

  const { data, error } = await supabase.storage
    .from(PORTFOLIO_ASSETS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function listPortfolioComments(submissionId: string): Promise<PortfolioComment[]> {
  const { data, error } = await supabase
    .from("portfolio_comments")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PortfolioComment[];
}

export async function createPortfolioComment(
  submissionId: string,
  input: PortfolioCommentInput,
): Promise<PortfolioComment> {
  const authorId = await requireUserId();
  const { data, error } = await supabase
    .from("portfolio_comments")
    .insert({ submission_id: submissionId, author_id: authorId, ...commentPayload(input) })
    .select()
    .single();
  if (error) throw error;
  return data as PortfolioComment;
}

export async function updatePortfolioComment(
  commentId: string,
  input: PortfolioCommentInput,
): Promise<PortfolioComment> {
  const { data, error } = await supabase
    .from("portfolio_comments")
    .update(commentPayload(input))
    .eq("id", commentId)
    .select()
    .single();
  if (error) throw error;
  return data as PortfolioComment;
}

export async function deletePortfolioComment(commentId: string): Promise<void> {
  const { error } = await supabase.from("portfolio_comments").delete().eq("id", commentId);
  if (error) throw error;
}
