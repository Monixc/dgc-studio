import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PROBLEM_FOLDERS_KEY,
  listFolders,
  ensureDefaultFolders,
  createFolder,
  renameFolder,
  deleteFolder,
} from "@/lib/problemFolders";

export function useFolders(userId: string | undefined) {
  return useQuery({
    queryKey: [...PROBLEM_FOLDERS_KEY, userId],
    queryFn: async () => ensureDefaultFolders(userId!, await listFolders(userId!)),
    enabled: !!userId,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, name, parentId }: { userId: string; name: string; parentId?: string | null }) =>
      createFolder(userId, name, parentId ?? null),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROBLEM_FOLDERS_KEY }),
  });
}

export function useRenameFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameFolder(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROBLEM_FOLDERS_KEY }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFolder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROBLEM_FOLDERS_KEY }),
  });
}
