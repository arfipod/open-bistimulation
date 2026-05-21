import type { SessionState } from '../domain/sessionTypes';
import { useI18n } from '../lib/i18n';
import { StimulusStage } from './StimulusStage';

interface ClientPreviewProps {
  state: SessionState;
  serverTimeOffsetMs: number;
}

export function ClientPreview({ state, serverTimeOffsetMs }: ClientPreviewProps) {
  const { t } = useI18n();

  return (
    <section className="client-preview panel">
      <h2>{t('preview.title')}</h2>
      <StimulusStage state={state} serverTimeOffsetMs={serverTimeOffsetMs} className="preview-stage" />
    </section>
  );
}
