import type { ReactNode } from 'react';
import { ConnectionBadge } from './ConnectionBadge';
import { LanguageToggle } from './LanguageToggle';
import { useI18n } from '../lib/i18n';

interface AppHeaderProps {
  title?: string;
  connectionLabel?: string;
  connected?: boolean;
  actions?: ReactNode;
}

export function AppHeader({ title = 'open-bistimulation', connectionLabel, connected, actions }: AppHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="app-header">
      <a className="brand" href="/" aria-label={t('app.brandAria')}>
        <img className="brand-icon" src="/app-icon.svg" alt="" aria-hidden="true" />
        <span className="brand-wordmark">
          <span>open</span>
          <span>bistimulation</span>
        </span>
      </a>
      {title ? <strong className="header-title">{title}</strong> : null}
      <div className="header-spacer" />
      <div className="header-actions">
        {connectionLabel ? <ConnectionBadge connected={Boolean(connected)} label={connectionLabel} /> : null}
        {actions}
        <LanguageToggle />
      </div>
    </header>
  );
}
