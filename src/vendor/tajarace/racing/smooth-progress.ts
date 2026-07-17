import { wpmToRaceSpeed } from '@tajarace/core';

const DEFAULT_MIN_WPM = 20;
const DEFAULT_MAX_WPM = 120;
const DEFAULT_CHARS_PER_WORD = 5;
const SPEED_SMOOTHING = 0.2;

export interface SmoothProgressOptions {
  minWpm?: number;
  maxWpm?: number;
  charsPerWord?: number;
}

/** WPM 기반으로 트랙 위치를 연속 이동시키는 추적기 (후퇴 없음, 최저 속도 유지) */
export class SmoothProgressTracker {
  private visualProgress = 0;
  private currentSpeed: number;
  private readonly minSpeed: number;
  private readonly maxWpm: number;
  private readonly charsPerWord: number;

  constructor(options: SmoothProgressOptions = {}) {
    const minWpm = options.minWpm ?? DEFAULT_MIN_WPM;
    this.maxWpm = options.maxWpm ?? DEFAULT_MAX_WPM;
    this.charsPerWord = options.charsPerWord ?? DEFAULT_CHARS_PER_WORD;
    this.minSpeed = wpmToRaceSpeed(minWpm, this.maxWpm);
    this.currentSpeed = this.minSpeed;
  }

  reset(): void {
    this.visualProgress = 0;
    this.currentSpeed = this.minSpeed;
  }

  setTargetFromWpm(wpm: number): void {
    const target = Math.max(this.minSpeed, wpmToRaceSpeed(wpm, this.maxWpm));
    this.currentSpeed += (target - this.currentSpeed) * SPEED_SMOOTHING;
    this.currentSpeed = Math.max(this.minSpeed, this.currentSpeed);
  }

  /** 오타·백스페이스 시 최저 속도로만 감속 (위치는 후퇴하지 않음) */
  applyPenalty(): void {
    this.currentSpeed = this.minSpeed;
  }

  snapTo(progress: number): void {
    this.visualProgress = Math.max(this.visualProgress, Math.min(1, progress));
  }

  tick(deltaMs: number, textLength: number): number {
    if (textLength <= 0 || this.visualProgress >= 1) return this.visualProgress;

    const effectiveWpm = this.currentSpeed * this.maxWpm;
    const charsPerMin = effectiveWpm * this.charsPerWord;
    const charsPerMs = charsPerMin / 60000;
    this.visualProgress = Math.min(
      1,
      this.visualProgress + (charsPerMs * deltaMs) / textLength,
    );
    return this.visualProgress;
  }

  getProgress(): number {
    return this.visualProgress;
  }

  getSpeed(): number {
    return this.currentSpeed;
  }
}
