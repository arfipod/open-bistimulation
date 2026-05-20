import type { AudioSettings, AudioSound } from '../domain/sessionTypes';

interface AuditoryPanelProps {
  audio: AudioSettings;
  onChange: (next: AudioSettings) => void;
}

const sounds: Array<{ value: AudioSound; label: string }> = [
  { value: 'snap', label: 'Finger snap' },
  { value: 'beep', label: 'Beep' },
  { value: 'bell', label: 'Soft bell' },
  { value: 'heartbeat', label: 'Heartbeat' },
];

export function AuditoryPanel({ audio, onChange }: AuditoryPanelProps) {
  return (
    <section className="control-panel">
      <header className="panel-header">
        <h2>Auditory</h2>
        <label className="switch">
          <input
            type="checkbox"
            checked={audio.enabled}
            onChange={(event) => onChange({ ...audio, enabled: event.target.checked })}
          />
          <span />
        </label>
      </header>

      <div className="field-group">
        <label>Sound</label>
        <div className="segmented-grid">
          {sounds.map((sound) => (
            <button
              key={sound.value}
              type="button"
              className={audio.sound === sound.value ? 'is-selected' : ''}
              onClick={() => onChange({ ...audio, sound: sound.value })}
            >
              {sound.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="volume">Volumen: {Math.round(audio.volume * 100)}%</label>
        <input
          id="volume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={audio.volume}
          onChange={(event) => onChange({ ...audio, volume: Number(event.target.value) })}
        />
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={audio.therapistMuted}
          onChange={(event) => onChange({ ...audio, therapistMuted: event.target.checked })}
        />
        Mute for therapist
      </label>
    </section>
  );
}
