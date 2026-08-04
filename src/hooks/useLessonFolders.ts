import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LESSON_FOLDERS_KEY,
  listLessonFolders,
  createLessonFolder,
  renameLessonFolder,
  updateLessonFolderColor,
  deleteLessonFolder,
} from "@/lib/lessonFolders";

export function useLessonFolders(userId: string | undefined) {
  return useQuery({
    queryKey: [...LESSON_FOLDERS_KEY, userId],
    queryFn: () => listLessonFolders(userId!),
    enabled: !!userId,
  });
}

export function useCreateLessonFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, name, parentId }: { userId: string; name: string; parentId?: string | null }) =>
      createLessonFolder(userId, name, parentId ?? null),
    onSuccess: () => qc.invalidateQueries({ queryKey: LESSON_FOLDERS_KEY }),
  });
}

export function useRenameLessonFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameLessonFolder(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: LESSON_FOLDERS_KEY }),
  });
}

export function useUpdateLessonFolderColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, color }: { id: string; color: string }) => updateLessonFolderColor(id, color),
    onSuccess: () => qc.invalidateQueries({ queryKey: LESSON_FOLDERS_KEY }),
  });
}

export function useDeleteLessonFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLessonFolder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: LESSON_FOLDERS_KEY }),
  });
}
