import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SESSION_STATE } from '../domain/defaults';
import type { AudioSettings, TactileSettings, VisualSettings } from '../domain/sessionTypes';
import { renderWithI18n } from '../test/render';
import { AuditoryPanel } from './AuditoryPanel';
import { TactilePanel } from './TactilePanel';
import { VisualPanel } from './VisualPanel';

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

    fireEvent.click(screen.getByLabelText('Mute for controller'));
    expect(onChange).toHaveBeenLastCalledWith({ ...audio, therapistMuted: false });
  });
});

describe('TactilePanel', () => {
  it('updates tactile settings and renders browser Joy-Con controls', () => {
    const tactile: TactileSettings = { ...DEFAULT_SESSION_STATE.tactile };
    const onChange = vi.fn();
    const onRequestDevices = vi.fn();
    const onRefresh = vi.fn();
    const onTestPulse = vi.fn();
    const onNeutral = vi.fn();
    const { container } = renderWithI18n(
      <TactilePanel
        tactile={tactile}
        onChange={onChange}
        webHidSupported
        requestingDevices={false}
        devices={[
          { side: 'left', product: 'Joy-Con (L)', battery: { percent: 75 } },
          { side: 'right', product: 'Joy-Con (R)', battery: null },
        ]}
        leftConnected
        rightConnected
        error={null}
        outputStatus={{
          lastPulseSide: null,
          lastPulseAt: null,
          pulseCount: 0,
          lastError: null,
          skippedPulseCount: 0,
        }}
        onRequestDevices={onRequestDevices}
        onRefresh={onRefresh}
        onTestPulse={onTestPulse}
        onNeutral={onNeutral}
      />,
    );

    expect(screen.getByText('Pair both Joy-Cons over Bluetooth on the participant computer, then add them from the participant browser.')).toBeInTheDocument();
    expect(screen.getByText('Browser Joy-Con access')).toBeInTheDocument();
    expect(screen.getByText('Joy-Cons ready')).toBeInTheDocument();
    expect(screen.getByText('Left Joy-Con')).toBeInTheDocument();
    expect(screen.getByText('Right Joy-Con')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Last Joy-Con pulse')).toBeInTheDocument();
    expect(screen.getByText('Pulse count')).toBeInTheDocument();

    const enabled = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(enabled);
    expect(onChange).toHaveBeenLastCalledWith({ ...tactile, enabled: true });

    fireEvent.click(screen.getByRole('button', { name: 'Add Joy-Cons' }));
    expect(onRequestDevices).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh devices' }));
    expect(onRefresh).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'High' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...tactile, intensity: 'high' });
    fireEvent.click(screen.getByRole('button', { name: 'Test left' }));
    expect(onTestPulse).toHaveBeenLastCalledWith({ side: 'left', intensity: 'medium', duration: 120, repeats: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Stop rumble' }));
    expect(onNeutral).toHaveBeenLastCalledWith('both');

    fireEvent.change(screen.getByLabelText('Pulse duration: 120 ms'), { target: { value: '240' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...tactile, pulseDurationMs: 240 });

    fireEvent.change(screen.getByLabelText('Internal pause: 40 ms'), { target: { value: '120' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...tactile, gapMs: 120 });
  });
});
