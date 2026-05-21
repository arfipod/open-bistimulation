import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SESSION_STATE } from '../domain/defaults';
import type { AudioSettings, TactileDeviceStatus, TactileSettings, VisualSettings } from '../domain/sessionTypes';
import { renderWithI18n } from '../test/render';
import { AuditoryPanel } from './AuditoryPanel';
import { TactilePanel } from './TactilePanel';
import { VisualPanel } from './VisualPanel';

function deviceStatus(overrides: Partial<TactileDeviceStatus>): TactileDeviceStatus {
  return {
    side: overrides.side ?? 'left',
    deviceId: null,
    label: null,
    connected: false,
    lastSeenAtMs: null,
    ...overrides,
  };
}

describe('VisualPanel', () => {
  it('updates visual settings from toggles, swatches, direction, order, position, and sliders', () => {
    const visual: VisualSettings = { ...DEFAULT_SESSION_STATE.visual };
    const onChange = vi.fn();
    const { container } = renderWithI18n(<VisualPanel visual={visual} onChange={onChange} />);

    const enabled = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(enabled);
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, enabled: false });

    fireEvent.click(screen.getByRole('button', { name: 'Color #ffffff' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, color: '#ffffff' });

    fireEvent.click(screen.getByRole('button', { name: 'Background #111827' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, background: '#111827' });

    fireEvent.change(screen.getByLabelText('Speed: 5'), { target: { value: '12' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, speed: 12 });

    fireEvent.click(screen.getByRole('button', { name: 'Diagonal up' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, direction: 'diagonal-up' });

    fireEvent.click(screen.getByRole('button', { name: 'Random' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, motionOrder: 'random' });

    fireEvent.click(screen.getByRole('button', { name: 'Bottom' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, verticalPosition: 'bottom' });

    fireEvent.change(screen.getByLabelText('Size: 52px'), { target: { value: '80' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, dotSize: 80 });
  });

  it('treats legacy diagonal direction as diagonal down in the selected control', () => {
    renderWithI18n(<VisualPanel visual={{ ...DEFAULT_SESSION_STATE.visual, direction: 'diagonal' }} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Diagonal down' })).toHaveClass('is-selected');
  });
});

describe('AuditoryPanel', () => {
  it('updates audio enabled state, selected sound, volume, and therapist mute', () => {
    const audio: AudioSettings = { ...DEFAULT_SESSION_STATE.audio };
    const onChange = vi.fn();
    const { container } = renderWithI18n(<AuditoryPanel audio={audio} onChange={onChange} />);

    const enabled = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(enabled);
    expect(onChange).toHaveBeenLastCalledWith({ ...audio, enabled: true });

    fireEvent.click(screen.getByRole('button', { name: 'Soft bell' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...audio, sound: 'bell' });

    fireEvent.change(screen.getByLabelText('Volume: 70%'), { target: { value: '0.25' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...audio, volume: 0.25 });

    fireEvent.click(screen.getByLabelText('Mute for therapist'));
    expect(onChange).toHaveBeenLastCalledWith({ ...audio, therapistMuted: false });
  });
});

describe('TactilePanel', () => {
  it('updates tactile settings and renders connection/unsupported state', () => {
    const tactile: TactileSettings = { ...DEFAULT_SESSION_STATE.tactile };
    const onChange = vi.fn();
    const { container } = renderWithI18n(
      <TactilePanel
        tactile={tactile}
        leftDevice={deviceStatus({ side: 'left', connected: true, unsupported: true })}
        rightDevice={deviceStatus({ side: 'right', connected: false })}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('Left phone without vibration')).toBeInTheDocument();
    expect(screen.getByText('Right phone')).toBeInTheDocument();

    const enabled = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(enabled);
    expect(onChange).toHaveBeenLastCalledWith({ ...tactile, enabled: true });

    fireEvent.change(screen.getByLabelText('Pulse duration: 120 ms'), { target: { value: '240' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...tactile, pulseDurationMs: 240 });

    fireEvent.change(screen.getByLabelText('Internal pause: 40 ms'), { target: { value: '120' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...tactile, gapMs: 120 });
  });
});
