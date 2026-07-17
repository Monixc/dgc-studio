/** 연습 콘텐츠 카테고리 */
export type ContentCategory = 'english' | 'python' | 'lua' | 'javascript' | 'html';

export interface PracticeContent {
  id: string;
  category: ContentCategory;
  title: string;
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ContentProvider {
  getCategories(): ContentCategory[];
  getByCategory(category: ContentCategory): PracticeContent[];
  getById(id: string): PracticeContent | undefined;
  getRandom(category: ContentCategory): PracticeContent;
}

export const CATEGORY_LABELS: Record<ContentCategory, string> = {
  english: '영문',
  python: 'Python',
  lua: 'Lua',
  javascript: 'JavaScript',
  html: 'HTML',
};

export { createContentProvider } from './provider.js';
export { ENGLISH_TEXTS, DEV_SNIPPETS } from './data.js';
