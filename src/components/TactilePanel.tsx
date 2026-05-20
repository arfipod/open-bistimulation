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
        <h2>Táctil</h2>
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
        <ConnectionBadge connected={leftDevice.connected} label={`Móvil izquierdo${leftDevice.unsupported ? ' sin vibración' : ''}`} />
        <ConnectionBadge connected={rightDevice.connected} label={`Móvil derecho${rightDevice.unsupported ? ' sin vibración' : ''}`} />
      </div>

      <div className="field-group">
        <label htmlFor="pulse-duration">Duración de pulso: {tactile.pulseDurationMs} ms</label>
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
        Usa dos móviles Android con Chrome/Samsung Internet. Cada móvil se vincula desde el QR del cliente.
      </p>
    </section>
  );
}
