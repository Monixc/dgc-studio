import type { CharStatus } from '@tajarace/core';
import { useCallback, useEffect, useMemo, useRef } from 'react';

export interface TypingDisplayProps {
  text: string;
  charStatuses: readonly CharStatus[];
  cursorIndex: number;
  onInput: (char: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  variant?: 'plain' | 'code';
  onKeyEvent?: (code: string, key: string) => void;
}

const TAB_SIZE = 2;

function getTabDisplayWidth(column: number, tabSize = TAB_SIZE): number {
  return tabSize - (column % tabSize);
}

function getColumnBeforeIndex(text: string, lineStart: number, index: number): number {
  let column = 0;
  for (let i = lineStart; i < index; i++) {
    const char = text[i];
    if (char === '\t') {
      column += getTabDisplayWidth(column);
    } else if (char !== '\n') {
      column += 1;
    }
  }
  return column;
}

function buildLineRanges(text: string): { start: number; end: number }[] {
  const lines: { start: number; end: number }[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      lines.push({ start, end: i + 1 });
      start = i + 1;
    }
  }
  lines.push({ start, end: text.length });
  return lines;
}

export function TypingDisplay({
  text,
  charStatuses,
  cursorIndex,
  onInput,
  onBackspace,
  disabled = false,
  autoFocus = true,
  variant = 'plain',
  onKeyEvent,
}: TypingDisplayProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lines = useMemo(() => buildLineRanges(text), [text]);

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputRef.current?.focus();
    }
  }, [autoFocus, disabled, text]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      onKeyEvent?.(e.code, e.key);

      if (disabled) return;

      if (e.key === 'Backspace') {
        e.preventDefault();
        onBackspace();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        onInput('\n');
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        onInput('\t');
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onInput(e.key);
      }
    },
    [disabled, onInput, onBackspace, onKeyEvent],
  );

  const renderChar = (char: string, i: number, tabWidthCh?: number) => {
    const status = charStatuses[i] ?? 'pending';
    const isCurrent = i === cursorIndex && !disabled;
    const cls = [`tj-char-${status}`, isCurrent ? 'tj-char-current' : ''].filter(Boolean).join(' ');
    if (char === '\n') {
      return <span key={i} className={cls}>{'\n'}</span>;
    }
    if (char === '\t') {
      const width = tabWidthCh ?? TAB_SIZE;
      return (
        <span
          key={i}
          className={`${cls} tj-char-tab`}
          style={{ width: `${width}ch` }}
          aria-hidden="true"
        >
          {'\u00A0'}
        </span>
      );
    }
    if (char === ' ') {
      return (
        <span key={i} className={`${cls} tj-char-space`}>
          {' '}
        </span>
      );
    }
    return (
      <span key={i} className={cls}>
        {char}
      </span>
    );
  };

  const codeContent = (
    <div className="tj-code-lines">
      {lines.map((line, li) => (
        <div key={li} className="tj-code-line">
          <span className="tj-line-number">{li + 1}</span>
          <span className="tj-line-content">
            {text.slice(line.start, line.end).split('').map((_, offset) => {
              const i = line.start + offset;
              const char = text[i]!;
              if (char === '\t') {
                const column = getColumnBeforeIndex(text, line.start, i);
                return renderChar(char, i, getTabDisplayWidth(column));
              }
              return renderChar(char, i);
            })}
          </span>
        </div>
      ))}
    </div>
  );

  const plainContent = (
    <div className="tj-typing-area">
      {text.split('').map((char, i) => renderChar(char, i))}
    </div>
  );

  return (
    <div
      className={`tj-typing-wrapper ${variant === 'code' ? 'tj-typing-code' : ''}`}
      onClick={() => inputRef.current?.focus()}
      role="textbox"
      tabIndex={-1}
    >
      <input
        ref={inputRef}
        className="tj-input-hidden"
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="typing input"
      />
      {variant === 'code' ? (
        <div className="tj-code-window">{codeContent}</div>
      ) : (
        plainContent
      )}
    </div>
  );
}

export interface StatsBarProps {
  wpm: number;
  accuracy: number;
  progress: number;
  extra?: React.ReactNode;
}

export function StatsBar({ wpm, accuracy, progress, extra }: StatsBarProps) {
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
      <div className="tj-stat">
        <span className="tj-stat-label">WPM</span>
        <span className="tj-stat-value" style={{ color: 'var(--accent)' }}>{wpm}</span>
      </div>
      <div className="tj-stat">
        <span className="tj-stat-label">정확도</span>
        <span className="tj-stat-value">{accuracy}%</span>
      </div>
      <div className="tj-stat">
        <span className="tj-stat-label">진행률</span>
        <span className="tj-stat-value">{Math.round(progress * 100)}%</span>
      </div>
      {extra}
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export interface SessionTimerProps {
  remainingMs: number;
  snippetsCompleted: number;
}

export function SessionTimer({ remainingMs, snippetsCompleted }: SessionTimerProps) {
  const isLow = remainingMs < 60_000;
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
      <div className="tj-stat">
        <span className="tj-stat-label">남은 시간</span>
        <span
          className="tj-stat-value"
          style={{ color: isLow ? 'var(--warning)' : 'var(--text)', fontSize: 24 }}
        >
          {formatTime(remainingMs)}
        </span>
      </div>
      <div className="tj-stat">
        <span className="tj-stat-label">완료 스니펫</span>
        <span className="tj-stat-value" style={{ fontSize: 24 }}>{snippetsCompleted}</span>
      </div>
    </div>
  );
}
