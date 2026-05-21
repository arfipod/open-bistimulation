import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SESSION_STATE } from '../domain/defaults';
import type { SessionState } from '../domain/sessionTypes';
import { renderWithI18n } from '../test/render';
import { SessionStats } from './SessionStats';
import { StimulusStage } from './StimulusStage';

function makeState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    ...DEFAULT_SESSION_STATE,
    visual: { ...DEFAULT_SESSION_STATE.visual, speed: 20 },
    audio: { ...DEFAULT_SESSION_STATE.audio },
    tactile: { ...DEFAULT_SESSION_STATE.tactile },
    ...overrides,
  };
}

function installRaf() {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();

  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextId;
    nextId += 1;
    callbacks.set(id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    callbacks.delete(id);
  });

  return {
    runNext() {
      const [id, callback] = callbacks.entries().next().value as [number, FrameRequestCallback];
      callbacks.delete(id);
      callback(0);
    },
    count() {
      return callbacks.size;
    },
  };
}

describe('StimulusStage', () => {
  it('renders and animates the stimulus dot from current motion state', () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      right: 400,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const raf = installRaf();

    const { container, unmount } = renderWithI18n(
      <StimulusStage state={makeState()} serverTimeOffsetMs={0} className="custom-stage" label="Preview" />,
    );

    const stage = container.querySelector('.stimulus-stage') as HTMLElement;
    const dot = container.querySelector('.stimulus-dot') as HTMLElement;

    expect(stage).toHaveClass('custom-stage');
    expect(stage.style.backgroundColor).toBe('rgb(201, 206, 209)');
    expect(screen.getByText('Preview')).toBeInTheDocument();

    act(() => raf.runNext());

    expect(dot.style.width).toBe('52px');
    expect(dot.style.height).toBe('52px');
    expect(dot.style.backgroundColor).toBe('rgb(5, 0, 168)');
    expect(dot.style.opacity).toBe('1');
    expect(dot.style.transform).toBe('translate3d(174px, 124px, 0)');

    unmount();
    expect(raf.count()).toBe(0);
  });

  it('hides the dot when visual stimulation is disabled', () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      right: 400,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const raf = installRaf();

    const { container } = renderWithI18n(
      <StimulusStage
        state={makeState({ visual: { ...DEFAULT_SESSION_STATE.visual, enabled: false } })}
        serverTimeOffsetMs={0}
      />,
    );

    act(() => raf.runNext());

    expect((container.querySelector('.stimulus-dot') as HTMLElement).style.opacity).toBe('0');
  });
});

describe('SessionStats', () => {
  it('renders elapsed time, passes, and completed sets', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);

    renderWithI18n(
      <SessionStats
        state={makeState({
          status: 'running',
          startedAtMs: 0,
          motionStartedAtMs: 0,
          setsCompleted: 2,
        })}
        serverTimeOffsetMs={0}
      />,
    );

    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('0:01')).toBeInTheDocument();
    expect(screen.getByText('Passes')).toBeInTheDocument();
    expect(screen.getByText('Sets')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
