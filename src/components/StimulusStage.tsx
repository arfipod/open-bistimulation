import { useEffect, useRef } from 'react';
import { getMotionSnapshot, getServerNowMs, getStimulusPosition } from '../domain/motion';
import type { SessionState } from '../domain/sessionTypes';
import { getVisualStimulusContent } from '../domain/visualStimuli';

interface StimulusStageProps {
  state: SessionState;
  serverTimeOffsetMs: number;
  className?: string;
  label?: string;
}

export function StimulusStage({ state, serverTimeOffsetMs, className = '', label }: StimulusStageProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let frame = 0;
    let cancelled = false;
    const shouldAnimate =
      state.visual.enabled && (state.status === 'running' || state.status === 'stopping');

    const render = () => {
      const stage = stageRef.current;
      const dot = dotRef.current;

      if (stage && dot) {
        const rect = stage.getBoundingClientRect();
        const nowMs = getServerNowMs(serverTimeOffsetMs);
        const snapshot = getMotionSnapshot(state, nowMs);
        const position = getStimulusPosition(state.visual, snapshot.elapsedMs, rect.width, rect.height);
        const dotSize = state.visual.dotSize;
        const stimulusContent = getVisualStimulusContent(state.visual, snapshot.side);

        dot.style.width = `${dotSize}px`;
        dot.style.height = `${dotSize}px`;
        dot.style.backgroundColor = stimulusContent ? 'transparent' : state.visual.color;
        dot.style.fontSize = `${Math.round(dotSize * 0.92)}px`;
        dot.style.opacity = state.visual.enabled ? '1' : '0';
        dot.style.transform = `translate3d(${position.x - dotSize / 2}px, ${position.y - dotSize / 2}px, 0)`;
        dot.textContent = stimulusContent ?? '';
        dot.classList.toggle('is-emoji', Boolean(stimulusContent));
      }

      if (!cancelled && shouldAnimate) {
        frame = window.requestAnimationFrame(render);
      }
    };

    frame = window.requestAnimationFrame(render);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [serverTimeOffsetMs, state]);

  return (
    <div
      ref={stageRef}
      className={`stimulus-stage ${className}`}
      style={{ backgroundColor: state.visual.background }}
    >
      {label ? <div className="stage-label">{label}</div> : null}
      <div ref={dotRef} className="stimulus-dot" aria-hidden="true" />
    </div>
  );
}
