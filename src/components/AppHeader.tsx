import type { ReactNode } from 'react';
import { ConnectionBadge } from './ConnectionBadge';

interface AppHeaderProps {
  title?: string;
  connectionLabel?: string;
  connected?: boolean;
  actions?: ReactNode;
}

export function AppHeader({ title = 'open-binstimulation', connectionLabel, connected, actions }: AppHeaderProps) {
  return (
    <header className="app-header">
      <a className="brand" href="/" aria-label="Open Binstimulation Home">
        <span>open</span>-binstimulation
      </a>
      {title ? <strong className="header-title">{title}</strong> : null}
      <div className="header-spacer" />
      {connectionLabel ? <ConnectionBadge connected={Boolean(connected)} label={connectionLabel} /> : null}
      {actions}
    </header>
  );
}
