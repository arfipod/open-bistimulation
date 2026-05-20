import type { TactileDeviceStatus, TactileSettings } from '../domain/sessionTypes';
import { ConnectionBadge } from './ConnectionBadge';

interface TactilePanelProps {
  tactile: TactileSettings;
  leftDevice: TactileDeviceStatus;
  rightDevice: TactileDeviceStatus;
  onChange: (next: TactileSettings) => void;
}

export function TactilePanel({ tactile, leftDevice, rightDevice, onChange }: TactilePanelProps) {
  return (
    <section className="control-panel">
      <header className="panel-header">
        <h2>Tactile</h2>
        <label className="switch">
          <input
            type="checkbox"
            checked={tactile.enabled}
            onChange={(event) => onChange({ ...tactile, enabled: event.target.checked })}
          />
          <span />
        </label>
      </header>

      <div className="device-status-grid">
        <ConnectionBadge connected={leftDevice.connected} label={`Left phone${leftDevice.unsupported ? ' without vibration' : ''}`} />
        <ConnectionBadge connected={rightDevice.connected} label={`Right phone${rightDevice.unsupported ? ' without vibration' : ''}`} />
      </div>

      <div className="field-group">
        <label htmlFor="pulse-duration">Pulse duration: {tactile.pulseDurationMs} ms</label>
        <input
          id="pulse-duration"
          type="range"
          min="40"
          max="600"
          step="10"
          value={tactile.pulseDurationMs}
          onChange={(event) => onChange({ ...tactile, pulseDurationMs: Number(event.target.value) })}
        />
      </div>

      <div className="field-group">
        <label htmlFor="tactile-gap">Pausa interna: {tactile.gapMs} ms</label>
        <input
          id="tactile-gap"
          type="range"
          min="0"
          max="300"
          step="10"
          value={tactile.gapMs}
          onChange={(event) => onChange({ ...tactile, gapMs: Number(event.target.value) })}
        />
      </div>

      <p className="panel-note">
        Use two Android phones with Chrome/Samsung Internet. Each phone is paired from the client QR.
      </p>
    </section>
  );
}
