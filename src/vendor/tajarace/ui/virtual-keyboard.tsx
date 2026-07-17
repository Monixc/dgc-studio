import { useMemo } from 'react';

const ROWS = [
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
] as const;

const KEY_LABELS: Record<string, string> = {
  ' ': 'Space',
  Enter: '↵',
  Tab: 'Tab',
  Backspace: '⌫',
  Shift: '⇧',
};

function charToKey(char: string): string | null {
  if (char === ' ') return ' ';
  if (char === '\n') return 'Enter';
  if (char === '\t') return 'Tab';
  if (char.length === 1) return char.toLowerCase();
  return null;
}

function codeToKey(code: string): string | null {
  if (code === 'Space') return ' ';
  if (code === 'Enter') return 'Enter';
  if (code === 'Tab') return 'Tab';
  if (code === 'Backspace') return 'Backspace';
  if (code.startsWith('Key')) return code.slice(3).toLowerCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Bracket')) {
    const map: Record<string, string> = { BracketLeft: '[', BracketRight: ']' };
    return map[code] ?? null;
  }
  const special: Record<string, string> = {
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backslash: '\\',
    Minus: '-',
    Equal: '=',
    Backquote: '`',
  };
  return special[code] ?? null;
}

export interface VirtualKeyboardProps {
  activeKey?: string;
  nextChar?: string;
}

export function VirtualKeyboard({ activeKey, nextChar }: VirtualKeyboardProps) {
  const nextKey = useMemo(() => (nextChar ? charToKey(nextChar) : null), [nextChar]);
  const pressedKey = useMemo(() => (activeKey ? codeToKey(activeKey) : null), [activeKey]);

  function keyClass(key: string): string {
    const classes = ['tj-kb-key'];
    if (key === nextKey) classes.push('tj-kb-key-next');
    if (key === pressedKey) classes.push('tj-kb-key-active');
    return classes.join(' ');
  }

  return (
    <div className="tj-keyboard">
      {ROWS.map((row, ri) => (
        <div key={ri} className="tj-kb-row">
          {row.map((key) => (
            <div key={key} className={keyClass(key)}>
              {KEY_LABELS[key] ?? key.toUpperCase()}
            </div>
          ))}
        </div>
      ))}
      <div className="tj-kb-row">
        <div className={`tj-kb-key tj-kb-key-wide ${nextKey === 'Tab' ? 'tj-kb-key-next' : ''} ${pressedKey === 'Tab' ? 'tj-kb-key-active' : ''}`}>
          Tab
        </div>
        <div className={`tj-kb-key tj-kb-key-space ${nextKey === ' ' ? 'tj-kb-key-next' : ''} ${pressedKey === ' ' ? 'tj-kb-key-active' : ''}`}>
          Space
        </div>
        <div className={`tj-kb-key tj-kb-key-wide ${nextKey === 'Enter' ? 'tj-kb-key-next' : ''} ${pressedKey === 'Enter' ? 'tj-kb-key-active' : ''}`}>
          ↵
        </div>
      </div>
    </div>
  );
}
