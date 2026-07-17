import { describe, it, expect } from 'vitest';
import { TypingSession, calculateWpm, calculateAccuracy, wpmToRaceSpeed } from './index.js';

describe('TypingSession', () => {
  it('tracks correct typing', () => {
    const session = new TypingSession({ text: 'abc' });
    session.handleInput('a');
    session.handleInput('b');
    expect(session.getCursorIndex()).toBe(2);
    expect(session.getStats().correctChars).toBe(2);
  });

  it('tracks incorrect typing', () => {
    const session = new TypingSession({ text: 'abc' });
    session.handleInput('x');
    expect(session.getStats().incorrectChars).toBe(1);
    expect(session.getCharStatuses()[0]).toBe('incorrect');
  });

  it('finishes when text complete', () => {
    const session = new TypingSession({ text: 'a' });
    let finished = false;
    session.subscribe((e) => {
      if (e.type === 'finish') finished = true;
    });
    session.handleInput('a');
    expect(finished).toBe(true);
    expect(session.getStatus()).toBe('finished');
  });
});

describe('calculateWpm', () => {
  it('returns 0 for zero elapsed', () => {
    expect(calculateWpm(10, 0)).toBe(0);
  });
});

describe('calculateAccuracy', () => {
  it('returns 100 for perfect typing', () => {
    expect(calculateAccuracy(10, 10)).toBe(100);
  });
});

describe('wpmToRaceSpeed', () => {
  it('normalizes WPM to 0-1', () => {
    expect(wpmToRaceSpeed(60, 120)).toBe(0.5);
    expect(wpmToRaceSpeed(150, 120)).toBe(1);
  });
});
