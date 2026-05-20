import type { SessionState } from '../domain/sessionTypes';
import { StimulusStage } from './StimulusStage';

interface ClientPreviewProps {
  state: SessionState;
  serverTimeOffsetMs: number;
}

export function ClientPreview({ state, serverTimeOffsetMs }: ClientPreviewProps) {
  return (
    <section className="client-preview panel">
      <h2>What Client Sees</h2>
      <StimulusStage state={state} serverTimeOffsetMs={serverTimeOffsetMs} className="preview-stage" />
    </section>
  );
}
