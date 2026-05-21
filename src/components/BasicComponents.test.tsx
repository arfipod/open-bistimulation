import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';
import { ConnectionBadge } from './ConnectionBadge';
import { ErrorView } from './ErrorView';
import { InviteClient } from './InviteClient';
import { KoFiWidget } from './KoFiWidget';
import { LanguageToggle } from './LanguageToggle';
import { LoadingView } from './LoadingView';
import { QRCodeCard } from './QRCodeCard';

const mocks = vi.hoisted(() => ({
  toDataURL: vi.fn(),
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: mocks.toDataURL,
  },
}));

describe('basic components', () => {
  it('renders the header with connection state, actions, and language toggle', () => {
    renderWithI18n(
      <AppHeader
        title="Therapist"
        connected
        connectionLabel="Realtime connected"
        actions={<button type="button">Action</button>}
      />,
    );

    expect(screen.getByLabelText('Open Bistimulation home')).toHaveAttribute('href', '/');
    expect(screen.getByText('Therapist')).toBeInTheDocument();
    expect(screen.getByText('Realtime connected')).toHaveClass('is-connected');
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch language to Spanish' })).toHaveTextContent('EN');
  });

  it('toggles language and updates labels', () => {
    renderWithI18n(<LanguageToggle />);

    fireEvent.click(screen.getByRole('button', { name: 'Switch language to Spanish' }));

    expect(screen.getByRole('button', { name: 'Cambiar idioma a ingles' })).toHaveTextContent('ES');
  });

  it('renders footer, support widget, loading view, connection badges, and error view', () => {
    renderWithI18n(
      <>
        <AppFooter />
        <KoFiWidget />
        <LoadingView />
        <ConnectionBadge connected={false} label="Offline" />
        <ErrorView message="Broken link" />
      </>,
    );

    expect(screen.getByText(/made with/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Support' })).toHaveAttribute('href', 'https://ko-fi.com/anrubiof');
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toHaveClass('is-disconnected');
    expect(screen.getByText('Could not open the session')).toBeInTheDocument();
    expect(screen.getByText('Broken link')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/');
  });

  it('builds and copies client invitation links', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderWithI18n(<InviteClient sessionId="session-1" clientToken="client token" />);

    const expectedUrl = `${window.location.origin}/session/session-1/client?t=client%20token`;
    expect(screen.getByText(expectedUrl)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith(expectedUrl);
  });

  it('generates QR cards and copies their links', async () => {
    mocks.toDataURL.mockResolvedValue('data:image/png;base64,qr');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderWithI18n(<QRCodeCard title="Left phone" url="https://app.example/left" helper="Scan me" />);

    expect(screen.getByText('Generating QR...')).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'QR Left phone' })).toHaveAttribute('src', 'data:image/png;base64,qr');
    expect(mocks.toDataURL).toHaveBeenCalledWith('https://app.example/left', { width: 180, margin: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith('https://app.example/left');
  });
});
