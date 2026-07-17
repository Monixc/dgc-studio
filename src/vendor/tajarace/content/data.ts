import type { ContentCategory, PracticeContent } from './types.js';

export const ENGLISH_TEXTS: PracticeContent[] = [
  {
    id: 'en-1',
    category: 'english',
    title: 'Common Words',
    text: 'the quick brown fox jumps over the lazy dog while typing fast improves accuracy and speed',
    difficulty: 'easy',
  },
  {
    id: 'en-2',
    category: 'english',
    title: 'Tech Vocabulary',
    text: 'algorithm database framework interface module repository deployment authentication encryption',
    difficulty: 'medium',
  },
  {
    id: 'en-3',
    category: 'english',
    title: 'Programming Terms',
    text: 'function variable constant iteration recursion abstraction polymorphism encapsulation inheritance',
    difficulty: 'hard',
  },
];

export const DEV_SNIPPETS: PracticeContent[] = [
  {
    id: 'py-1',
    category: 'python',
    title: 'List Comprehension',
    text: 'squares = [x ** 2 for x in range(10) if x % 2 == 0]',
    difficulty: 'easy',
  },
  {
    id: 'py-2',
    category: 'python',
    title: 'Decorator',
    text: 'def timer(func):\n\tdef wrapper(*args, **kwargs):\n\t\treturn func(*args, **kwargs)\n\treturn wrapper',
    difficulty: 'medium',
  },
  {
    id: 'lua-1',
    category: 'lua',
    title: 'Table Iteration',
    text: 'for key, value in pairs(t) do\n\tprint(key, value)\nend',
    difficulty: 'easy',
  },
  {
    id: 'lua-2',
    category: 'lua',
    title: 'Metatable',
    text: 'local mt = { __index = function(t, k) return t[k] or 0 end }',
    difficulty: 'medium',
  },
  {
    id: 'js-1',
    category: 'javascript',
    title: 'Arrow Function',
    text: 'const sum = (a, b) => a + b;\nconst nums = [1, 2, 3].map(n => n * 2);',
    difficulty: 'easy',
  },
  {
    id: 'js-2',
    category: 'javascript',
    title: 'Async/Await',
    text: 'async function fetchData(url) {\n\tconst res = await fetch(url);\n\treturn res.json();\n}',
    difficulty: 'medium',
  },
  {
    id: 'html-1',
    category: 'html',
    title: 'Semantic HTML',
    text: '<header><nav><ul><li><a href="/">Home</a></li></ul></nav></header>',
    difficulty: 'easy',
  },
  {
    id: 'html-2',
    category: 'html',
    title: 'Form Elements',
    text: '<form action="/submit" method="post"><input type="text" name="user"><button type="submit">Send</button></form>',
    difficulty: 'medium',
  },
];

export const ALL_CONTENT: PracticeContent[] = [...ENGLISH_TEXTS, ...DEV_SNIPPETS];

export function getContentByCategory(category: ContentCategory): PracticeContent[] {
  return ALL_CONTENT.filter((c) => c.category === category);
}
