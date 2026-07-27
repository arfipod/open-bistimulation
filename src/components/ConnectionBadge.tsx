interface ConnectionBadgeProps {
  connected: boolean;
  label: string;
}

export function ConnectionBadge({ connected, label }: ConnectionBadgeProps) {
  return (
    <span className={`connection-badge ${connected ? 'is-connected' : 'is-disconnected'}`} role="status">
      <span className="connection-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
