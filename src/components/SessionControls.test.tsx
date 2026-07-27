import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SESSION_STATE } from '../domain/defaults';
import type { SessionState } from '../domain/sessionTypes';
import { renderWithI18n } from '../test/render';
import { SessionControlActions, SessionControls } from './SessionControls';

function makeState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    ...DEFAULT_SESSION_STATE,
    visual: { ...DEFAULT_SESSION_STATE.visual },
    audio: { ...DEFAULT_SESSION_STATE.audio },
    tactile: { ...DEFAULT_SESSION_STATE.tactile },
    ...overrides,
  };
}

describe('SessionControls', () => {
  it('edits fixed round duration, free mode, step buttons, and presets', () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
    const onRoundDurationChange = vi.fn();

    renderWithI18n(
      <SessionControls
        state={makeState()}
        serverTimeOffsetMs={0}
        roundDurationMs={60_000}
        onRoundDurationChange={onRoundDurationChange}
      />,
    );

    expect(screen.getByText('Remaining')).toBeInTheDocument();
    expect(screen.getAllByText('1:00')).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'Presets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Free' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '1:00' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '5:00' })).toHaveAttribute('aria-pressed', 'false');

    const input = screen.getByLabelText('Round duration in minutes and seconds, or free');
    fireEvent.change(input, { target: { value: '2:05' } });
    fireEvent.blur(input);
    expect(onRoundDurationChange).toHaveBeenLastCalledWith(125_000);

    fireEvent.click(screen.getByRole('button', { name: '+10s' }));
    expect(onRoundDurationChange).toHaveBeenLastCalledWith(70_000);

    fireEvent.click(screen.getByRole('button', { name: '-10s' }));
    expect(onRoundDurationChange).toHaveBeenLastCalledWith(50_000);

    fireEvent.click(screen.getByRole('button', { name: '5:00' }));
    expect(onRoundDurationChange).toHaveBeenLastCalledWith(300_000);

    fireEvent.click(screen.getByRole('button', { name: 'Free' }));
    expect(onRoundDurationChange).toHaveBeenLastCalledWith(null);
  });

  it('reverts invalid duration drafts and clamps duration inputs', () => {
    const onRoundDurationChange = vi.fn();

    renderWithI18n(
      <SessionControls
        state={makeState()}
        serverTimeOffsetMs={0}
        roundDurationMs={60_000}
        onRoundDurationChange={onRoundDurationChange}
      />,
    );

    const input = screen.getByLabelText('Round duration in minutes and seconds, or free');
    fireEvent.change(input, { target: { value: 'nope' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('1:00');
    expect(onRoundDurationChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('1:00');
    expect(onRoundDurationChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '1:60' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('1:00');
    expect(onRoundDurationChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.blur(input);
    expect(onRoundDurationChange).toHaveBeenLastCalledWith(10_000);

    fireEvent.change(input, { target: { value: '9999:00' } });
    fireEvent.blur(input);
    expect(onRoundDurationChange).toHaveBeenLastCalledWith(3_600_000);
  });

  it('sets an unlimited round only from explicit free text or the Free button', () => {
    const onRoundDurationChange = vi.fn();

    renderWithI18n(
      <SessionControls
        state={makeState()}
        serverTimeOffsetMs={0}
        roundDurationMs={60_000}
        onRoundDurationChange={onRoundDurationChange}
      />,
    );

    const input = screen.getByLabelText('Round duration in minutes and seconds, or free');
    fireEvent.change(input, { target: { value: 'free' } });
    fireEvent.blur(input);
    expect(onRoundDurationChange).toHaveBeenLastCalledWith(null);

    onRoundDurationChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Free' }));
    expect(onRoundDurationChange).toHaveBeenCalledWith(null);
  });

  it('disables duration controls while the session is stopping or busy', () => {
    renderWithI18n(
      <SessionControls
        state={makeState({ status: 'stopping' })}
        serverTimeOffsetMs={0}
        roundDurationMs={60_000}
        onRoundDurationChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Free' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '+10s' })).toBeDisabled();
  });
});

describe('SessionControlActions', () => {
  const actions = {
    onStart: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onStop: vi.fn(),
    onReset: vi.fn(),
    onSavePreferences: vi.fn(),
  };

  it('shows idle actions and invokes their callbacks', () => {
    renderWithI18n(<SessionControlActions state={makeState()} {...actions} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start BLS' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));

    expect(actions.onStart).toHaveBeenCalledTimes(1);
    expect(actions.onReset).toHaveBeenCalledTimes(1);
    expect(actions.onSavePreferences).toHaveBeenCalledTimes(1);
  });

  it('shows running and paused action sets', () => {
    const { rerender } = renderWithI18n(<SessionControlActions state={makeState({ status: 'running' })} {...actions} />);

    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();

    rerender(<SessionControlActions state={makeState({ status: 'paused' })} {...actions} />);

    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
  });

  it('shows a disabled stopping action while stop animation is active', () => {
    renderWithI18n(<SessionControlActions state={makeState({ status: 'stopping' })} {...actions} />);

    expect(screen.getByRole('button', { name: 'Stopping...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it('keeps emergency Stop available while ordinary work is pending', () => {
    const { rerender } = renderWithI18n(
      <SessionControlActions state={makeState({ status: 'running' })} {...actions} busy />,
    );

    expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save preferences' })).toBeDisabled();

    rerender(
      <SessionControlActions
        state={makeState({ status: 'running' })}
        {...actions}
        busy
        safetyBusy
      />,
    );

    expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled();
  });
});
