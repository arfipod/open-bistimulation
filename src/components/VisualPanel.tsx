import { BACKGROUND_COLORS, VISUAL_COLORS } from '../domain/defaults';
import type { VisualDirection, VisualSettings, VerticalPosition } from '../domain/sessionTypes';

interface VisualPanelProps {
  visual: VisualSettings;
  onChange: (next: VisualSettings) => void;
}

const directions: Array<{ value: VisualDirection; label: string }> = [
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'infinity', label: 'Infinito' },
];

const positions: Array<{ value: VerticalPosition; label: string }> = [
  { value: 'top', label: 'Arriba' },
  { value: 'center', label: 'Centro' },
  { value: 'bottom', label: 'Abajo' },
];

export function VisualPanel({ visual, onChange }: VisualPanelProps) {
  return (
    <section className="control-panel">
      <header className="panel-header">
        <h2>Visual</h2>
        <label className="switch">
          <input
            type="checkbox"
            checked={visual.enabled}
            onChange={(event) => onChange({ ...visual, enabled: event.target.checked })}
          />
          <span />
        </label>
      </header>

      <div className="field-group">
        <label>Color BLS</label>
        <div className="swatch-row">
          {VISUAL_COLORS.map((color) => (
            <button
              key={color}
              className={`swatch ${visual.color === color ? 'is-selected' : ''}`}
              style={{ backgroundColor: color }}
              type="button"
              aria-label={`Color ${color}`}
              onClick={() => onChange({ ...visual, color })}
            />
          ))}
          <input
            className="color-input"
            type="color"
            value={visual.color}
            onChange={(event) => onChange({ ...visual, color: event.target.value })}
          />
        </div>
      </div>

      <div className="field-group">
        <label>Fondo</label>
        <div className="swatch-row">
          {BACKGROUND_COLORS.map((background) => (
            <button
              key={background}
              className={`swatch ${visual.background === background ? 'is-selected' : ''}`}
              style={{ backgroundColor: background }}
              type="button"
              aria-label={`Fondo ${background}`}
              onClick={() => onChange({ ...visual, background })}
            />
          ))}
          <input
            className="color-input"
            type="color"
            value={visual.background}
            onChange={(event) => onChange({ ...visual, background: event.target.value })}
          />
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="speed">Velocidad: {visual.speed}</label>
        <input
          id="speed"
          type="range"
          min="1"
          max="20"
          step="0.5"
          value={visual.speed}
          onChange={(event) => onChange({ ...visual, speed: Number(event.target.value) })}
        />
      </div>

      <div className="field-group">
        <label>Direction</label>
        <div className="segmented-grid">
          {directions.map((direction) => (
            <button
              key={direction.value}
              type="button"
              className={visual.direction === direction.value ? 'is-selected' : ''}
              onClick={() => onChange({ ...visual, direction: direction.value })}
            >
              {direction.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-group">
        <label>Vertical position</label>
        <div className="segmented-grid three">
          {positions.map((position) => (
            <button
              key={position.value}
              type="button"
              className={visual.verticalPosition === position.value ? 'is-selected' : ''}
              onClick={() => onChange({ ...visual, verticalPosition: position.value })}
            >
              {position.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="dot-size">Size: {visual.dotSize}px</label>
        <input
          id="dot-size"
          type="range"
          min="20"
          max="100"
          step="2"
          value={visual.dotSize}
          onChange={(event) => onChange({ ...visual, dotSize: Number(event.target.value) })}
        />
      </div>
    </section>
  );
}
