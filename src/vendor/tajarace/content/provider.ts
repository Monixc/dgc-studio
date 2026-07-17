import { ALL_CONTENT } from './data.js';
import type { ContentCategory, ContentProvider, PracticeContent } from './types.js';

export function createContentProvider(customContent?: PracticeContent[]): ContentProvider {
  const items = customContent ?? ALL_CONTENT;

  return {
    getCategories(): ContentCategory[] {
      return ['english', 'python', 'lua', 'javascript', 'html'];
    },

    getByCategory(category: ContentCategory): PracticeContent[] {
      return items.filter((c) => c.category === category);
    },

    getById(id: string): PracticeContent | undefined {
      return items.find((c) => c.id === id);
    },

    getRandom(category: ContentCategory): PracticeContent {
      const pool = items.filter((c) => c.category === category);
      if (pool.length === 0) {
        throw new Error(`No content for category: ${category}`);
      }
      return pool[Math.floor(Math.random() * pool.length)]!;
    },
  };
}
