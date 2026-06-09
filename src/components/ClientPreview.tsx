import { useEffect, useId, useState } from 'react';
import type { SessionState } from '../domain/sessionTypes';
import { useI18n } from '../lib/i18n';
import { StimulusStage } from './StimulusStage';

interface ClientPreviewProps {
  state: SessionState;
  serverTimeOffsetMs: number;
  panelCollapsible?: boolean;
  defaultPanelCollapsed?: boolean;
  autoCollapse?: boolean;
}

export function ClientPreview({
  state,
  serverTimeOffsetMs,
  panelCollapsible = false,
  defaultPanelCollapsed = false,
  autoCollapse = false,
}: ClientPreviewProps) {
  const { t } = useI18n();
  const panelBodyId = useId();
  const [panelCollapsed, setPanelCollapsed] = useState(Boolean(panelCollapsible && (defaultPanelCollapsed || autoCollapse)));

  useEffect(() => {
    if (panelCollapsible) {
      setPanelCollapsed(Boolean(defaultPanelCollapsed || autoCollapse));
    }
  }, [autoCollapse, defaultPanelCollapsed, panelCollapsible]);

  return (
    <section className={`client-preview panel ${panelCollapsed ? 'is-collapsed' : ''}`}>
      <header className="panel-header">
        <h2>{t('preview.title')}</h2>
        {panelCollapsible ? (
          <button
            className="collapse-toggle-button"
            type="button"
            aria-expanded={!panelCollapsed}
            aria-controls={panelBodyId}
            aria-label={panelCollapsed ? t('common.expandPanel') : t('common.collapsePanel')}
            onClick={() => setPanelCollapsed((collapsed) => !collapsed)}
          >
            <CollapseGlyph collapsed={panelCollapsed} />
          </button>
        ) : null}
      </header>
      {!panelCollapsed ? <StimulusStage state={state} serverTimeOffsetMs={serverTimeOffsetMs} className="preview-stage" /> : null}
    </section>
  );
}

function CollapseGlyph({ collapsed }: { collapsed: boolean }) {
  return (
    <span className={`collapse-glyph ${collapsed ? 'is-collapsed' : ''}`} aria-hidden="true">
      {collapsed ? '+' : '-'}
    </span>
  );
}
