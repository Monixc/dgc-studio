import {
  calculateAccuracy,
  calculateProgress,
  calculateRawWpm,
  calculateWpm,
  type CharStatus,
  type SessionStatus,
  type TypingEvent,
  type TypingEventListener,
  type TypingSessionOptions,
  type TypingStats,
} from './types.js';

export class TypingSession {
  private _text: string;

  get text(): string {
    return this._text;
  }
  private readonly charsPerWord: number;
  private status: SessionStatus = 'idle';
  private cursorIndex = 0;
  private correctChars = 0;
  private incorrectChars = 0;
  private totalTyped = 0;
  private startTime = 0;
  private elapsedMs = 0;
  private pauseStart = 0;
  private charStatuses: CharStatus[];
  private listeners = new Set<TypingEventListener>();

  constructor(options: TypingSessionOptions) {
    this._text = options.text;
    this.charsPerWord = options.charsPerWord ?? 5;
    this.charStatuses = Array.from({ length: this.text.length }, () => 'pending' as CharStatus);
  }

  getStatus(): SessionStatus {
    return this.status;
  }

  getCursorIndex(): number {
    return this.cursorIndex;
  }

  getCharStatuses(): readonly CharStatus[] {
    return this.charStatuses;
  }

  getStats(): TypingStats {
    const elapsed = this.getElapsedMs();
    return {
      wpm: calculateWpm(this.correctChars, elapsed, this.charsPerWord),
      rawWpm: calculateRawWpm(this.totalTyped, elapsed, this.charsPerWord),
      accuracy: calculateAccuracy(this.correctChars, this.totalTyped),
      correctChars: this.correctChars,
      incorrectChars: this.incorrectChars,
      totalTyped: this.totalTyped,
      elapsedMs: elapsed,
      progress: calculateProgress(this.cursorIndex, this.text.length),
    };
  }

  subscribe(listener: TypingEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (this.status !== 'idle') return;
    this.status = 'active';
    this.startTime = Date.now();
    this.emit({ type: 'start' });
  }

  pause(): void {
    if (this.status !== 'active') return;
    this.status = 'paused';
    this.pauseStart = Date.now();
    this.emit({ type: 'pause' });
  }

  resume(): void {
    if (this.status !== 'paused') return;
    this.elapsedMs += Date.now() - this.pauseStart;
    this.status = 'active';
    this.emit({ type: 'resume' });
  }

  /** 단일 문자 입력 처리 */
  handleInput(char: string): void {
    if (this.status === 'idle') this.start();
    if (this.status !== 'active') return;
    if (this.cursorIndex >= this.text.length) return;

    const expected = this.text[this.cursorIndex]!;
    const correct = char === expected;

    this.charStatuses[this.cursorIndex] = correct ? 'correct' : 'incorrect';
    this.totalTyped++;
    if (correct) this.correctChars++;
    else this.incorrectChars++;

    this.cursorIndex++;
    this.emit({ type: 'keystroke', char, correct, index: this.cursorIndex - 1 });

    if (this.cursorIndex >= this.text.length) {
      this.finish();
    }
  }

  /** 백스페이스 처리 */
  handleBackspace(): void {
    if (this.status !== 'active') return;
    if (this.cursorIndex <= 0) return;

    this.cursorIndex--;
    const wasCorrect = this.charStatuses[this.cursorIndex] === 'correct';
    const wasIncorrect = this.charStatuses[this.cursorIndex] === 'incorrect';

    this.charStatuses[this.cursorIndex] = 'pending';
    this.totalTyped = Math.max(0, this.totalTyped - 1);
    if (wasCorrect) this.correctChars = Math.max(0, this.correctChars - 1);
    if (wasIncorrect) this.incorrectChars = Math.max(0, this.incorrectChars - 1);

    this.emit({ type: 'backspace', index: this.cursorIndex });
  }

  /** 전체 텍스트 붙여넣기 방지용 — 한 번에 여러 문자 처리 */
  handlePaste(text: string): void {
    for (const char of text) {
      if (this.cursorIndex >= this.text.length) break;
      this.handleInput(char);
    }
  }

  reset(newText?: string): void {
    if (newText !== undefined) {
      this._text = newText;
      this.charStatuses = Array.from({ length: newText.length }, () => 'pending' as CharStatus);
    } else {
      this.charStatuses = Array.from({ length: this._text.length }, () => 'pending' as CharStatus);
    }
    this.status = 'idle';
    this.cursorIndex = 0;
    this.correctChars = 0;
    this.incorrectChars = 0;
    this.totalTyped = 0;
    this.startTime = 0;
    this.elapsedMs = 0;
    this.pauseStart = 0;
  }

  private finish(): void {
    this.status = 'finished';
    const stats = this.getStats();
    this.emit({ type: 'finish', stats });
  }

  private getElapsedMs(): number {
    if (this.status === 'idle') return 0;
    if (this.status === 'paused') return this.elapsedMs + (this.pauseStart - this.startTime);
    if (this.startTime === 0) return this.elapsedMs;
    return this.elapsedMs + (Date.now() - this.startTime);
  }

  private emit(event: TypingEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

