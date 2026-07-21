import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPortfolioComment,
  createPortfolioDocument,
  deletePortfolioComment,
  deletePortfolioDocument,
  listPortfolioComments,
  listPortfolioDocuments,
  listPortfolioSubmissions,
  submitPortfolioDocument,
  updatePortfolioDocument,
  type PortfolioCommentInput,
  type PortfolioDocumentInput,
  type PortfolioSubmissionFilters,
} from "@/lib/portfolio";

export const PORTFOLIO_DOCUMENTS_KEY = ["portfolio", "documents"] as const;
export const PORTFOLIO_SUBMISSIONS_KEY = ["portfolio", "submissions"] as const;

export function usePortfolioDocuments() {
  return useQuery({
    queryKey: PORTFOLIO_DOCUMENTS_KEY,
    queryFn: listPortfolioDocuments,
  });
}

export function usePortfolioSubmissions(filters: PortfolioSubmissionFilters = {}) {
  return useQuery({
    queryKey: [...PORTFOLIO_SUBMISSIONS_KEY, filters],
    queryFn: () => listPortfolioSubmissions(filters),
  });
}

export function usePortfolioComments(submissionId: string | null) {
  return useQuery({
    queryKey: ["portfolio", "comments", submissionId],
    queryFn: () => listPortfolioComments(submissionId!),
    enabled: !!submissionId,
  });
}

export function useCreatePortfolioDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PortfolioDocumentInput) => createPortfolioDocument(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PORTFOLIO_DOCUMENTS_KEY }),
  });
}

export function useUpdatePortfolioDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      documentId,
      expectedRevision,
      input,
    }: {
      documentId: string;
      expectedRevision: number;
      input: PortfolioDocumentInput;
    }) => updatePortfolioDocument(documentId, expectedRevision, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PORTFOLIO_DOCUMENTS_KEY }),
  });
}

export function useDeletePortfolioDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePortfolioDocument,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_DOCUMENTS_KEY });
      void queryClient.invalidateQueries({ queryKey: PORTFOLIO_SUBMISSIONS_KEY });
    },
  });
}

export function useSubmitPortfolioDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      documentId,
      expectedRevision,
    }: {
      documentId: string;
      expectedRevision: number;
    }) => submitPortfolioDocument(documentId, expectedRevision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PORTFOLIO_SUBMISSIONS_KEY }),
  });
}

export function useCreatePortfolioComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      submissionId,
      input,
    }: {
      submissionId: string;
      input: PortfolioCommentInput;
    }) => createPortfolioComment(submissionId, input),
    onSuccess: (comment) => queryClient.invalidateQueries({
      queryKey: ["portfolio", "comments", comment.submission_id],
    }),
  });
}

export function useDeletePortfolioComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId }: { commentId: string; submissionId: string }) =>
      deletePortfolioComment(commentId),
    onSuccess: (_, variables) => queryClient.invalidateQueries({
      queryKey: ["portfolio", "comments", variables.submissionId],
    }),
  });
}
