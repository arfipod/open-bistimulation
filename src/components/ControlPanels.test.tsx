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
    renderWithI18n(<VisualPanel visual={visual} onChange={onChange} />);

    const enabled = screen.getByRole('switch', { name: 'Visual' });
    expect(enabled).toBeChecked();
    fireEvent.click(enabled);
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, enabled: false });

    expect(screen.getByRole('group', { name: 'BLS color' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Color #0500a8' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Color #ffffff' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Color #ffffff' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, color: '#ffffff' });

    expect(screen.getByRole('group', { name: 'Background' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Background #c9ced1' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Background #111827' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, background: '#111827' });

    expect(screen.getByRole('group', { name: 'Stimulus' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stimulus: Dot' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Stimulus: Dog' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, stimulus: 'dog' });

    fireEvent.change(screen.getByLabelText('Speed: 5'), { target: { value: '12' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, speed: 12 });

    expect(screen.getByRole('group', { name: 'Direction' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Horizontal' })).toHaveAttribute('aria-pressed', 'true');
    const diagonalUp = screen.getByRole('button', { name: 'Diagonal up' });
    expect(diagonalUp).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(diagonalUp);
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, direction: 'diagonal-up' });

    expect(screen.getByRole('group', { name: 'Bilateral order' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Left to right' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Random' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, motionOrder: 'random' });

    expect(screen.getByRole('group', { name: 'Vertical position' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Center' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Bottom' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, verticalPosition: 'bottom' });

    fireEvent.change(screen.getByLabelText('Size: 52px'), { target: { value: '80' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, dotSize: 80 });
  });

  it('updates whether emoji stimuli alternate sides', () => {
    const visual: VisualSettings = { ...DEFAULT_SESSION_STATE.visual, stimulus: 'dog', stimulusAlternatesSides: true };
    const onChange = vi.fn();

    renderWithI18n(<VisualPanel visual={visual} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Use different emoji for left and right'));
    expect(onChange).toHaveBeenLastCalledWith({ ...visual, stimulusAlternatesSides: false });
  });

  it('treats legacy diagonal direction as diagonal down in the selected control', () => {
    renderWithI18n(<VisualPanel visual={{ ...DEFAULT_SESSION_STATE.visual, direction: 'diagonal' }} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Diagonal down' })).toHaveClass('is-selected');
    expect(screen.getByRole('button', { name: 'Diagonal down' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('AuditoryPanel', () => {
  it('updates audio enabled state, selected sound, volume, and therapist mute', () => {
    const audio: AudioSettings = { ...DEFAULT_SESSION_STATE.audio };
    const onChange = vi.fn();
    renderWithI18n(<AuditoryPanel audio={audio} onChange={onChange} />);

    const enabled = screen.getByRole('switch', { name: 'Auditory' });
    expect(enabled).not.toBeChecked();
    fireEvent.click(enabled);
    expect(onChange).toHaveBeenLastCalledWith({ ...audio, enabled: true });

    expect(screen.getByRole('group', { name: 'Sound' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finger snap' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Soft bell' })).toHaveAttribute('aria-pressed', 'false');
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
    const onDisconnectDevices = vi.fn();
    const onRefresh = vi.fn();
    const onTestPulse = vi.fn();
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
        onDisconnectDevices={onDisconnectDevices}
        onRefresh={onRefresh}
        onTestPulse={onTestPulse}
      />,
    );

    expect(screen.getByText('Pair both Joy-Cons over Bluetooth on the participant computer, then add them from the participant browser.')).toBeInTheDocument();
    expect(screen.getByText('Browser Joy-Con access')).toBeInTheDocument();
    expect(screen.getByText('Joy-Cons ready')).toBeInTheDocument();
    expect(screen.getByText('Left Joy-Con')).toBeInTheDocument();
    expect(screen.getByText('Right Joy-Con')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.queryByText('Last Joy-Con pulse')).not.toBeInTheDocument();
    expect(screen.queryByText('Pulse count')).not.toBeInTheDocument();

    const enabled = screen.getByRole('switch', { name: 'Tactile' });
    expect(enabled).not.toBeChecked();
    fireEvent.click(enabled);
    expect(onChange).toHaveBeenLastCalledWith({ ...tactile, enabled: true });

    fireEvent.click(screen.getByRole('button', { name: 'Add Joy-Cons' }));
    expect(onRequestDevices).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Joy-Cons' }));
    expect(onDisconnectDevices).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh devices' }));
    expect(onRefresh).toHaveBeenCalled();

    expect(screen.getByRole('group', { name: 'Intensity' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'true');
    const highIntensity = screen.getByRole('button', { name: 'High' });
    expect(highIntensity).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(highIntensity);
    expect(onChange).toHaveBeenLastCalledWith({ ...tactile, intensity: 'high' });
    fireEvent.click(screen.getByRole('button', { name: 'Test left' }));
    expect(onTestPulse).toHaveBeenLastCalledWith({ side: 'left', intensity: 'medium', duration: 120, repeats: 1 });

    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
    expect(container.querySelectorAll('.panel-note')).toHaveLength(1);

    fireEvent.change(screen.getByLabelText('Pulse duration: 120 ms'), { target: { value: '240' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...tactile, pulseDurationMs: 240 });
  });

  it('collapses the Joy-Con status block when requested', () => {
    const tactile: TactileSettings = { ...DEFAULT_SESSION_STATE.tactile };

    renderWithI18n(
      <TactilePanel
        tactile={tactile}
        onChange={vi.fn()}
        webHidSupported
        requestingDevices={false}
        devices={[]}
        leftConnected={false}
        rightConnected={false}
        error={null}
        outputStatus={{
          lastPulseSide: null,
          lastPulseAt: null,
          pulseCount: 0,
          lastError: null,
          skippedPulseCount: 0,
        }}
        deviceStatusCollapsible
        defaultDeviceStatusCollapsed
      />,
    );

    expect(screen.getByText('Browser Joy-Con access')).toBeInTheDocument();
    expect(screen.queryByText('Left Joy-Con')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Browser Joy-Con access/ }));

    expect(screen.getByText('Left Joy-Con')).toBeInTheDocument();
    expect(screen.getByText('Right Joy-Con')).toBeInTheDocument();
  });

  it('can render Joy-Con quick instructions collapsed by default', () => {
    const tactile: TactileSettings = { ...DEFAULT_SESSION_STATE.tactile };

    renderWithI18n(
      <TactilePanel
        tactile={tactile}
        onChange={vi.fn()}
        webHidSupported
        requestingDevices={false}
        devices={[]}
        leftConnected={false}
        rightConnected={false}
        error={null}
        outputStatus={{
          lastPulseSide: null,
          lastPulseAt: null,
          pulseCount: 0,
          lastError: null,
          skippedPulseCount: 0,
        }}
        defaultInstructionsCollapsed
      />,
    );

    expect(screen.getByText('Joy-Con quick instructions').closest('details')).not.toHaveAttribute('open');
  });

  it('collapses the whole tactile panel when requested', () => {
    const tactile: TactileSettings = { ...DEFAULT_SESSION_STATE.tactile };

    renderWithI18n(
      <TactilePanel
        tactile={tactile}
        webHidSupported
        requestingDevices={false}
        devices={[]}
        leftConnected={false}
        rightConnected={false}
        error={null}
        outputStatus={{
          lastPulseSide: null,
          lastPulseAt: null,
          pulseCount: 0,
          lastError: null,
          skippedPulseCount: 0,
        }}
        panelCollapsible
        defaultPanelCollapsed
        onRequestDevices={vi.fn()}
      />,
    );

    expect(screen.getByText('Tactile')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Joy-Cons' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand tactile panel' }));

    expect(screen.getByRole('button', { name: 'Add Joy-Cons' })).toBeInTheDocument();
  });
});
