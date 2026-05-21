import { describe, expect, it, vi } from 'vitest';
import { clientUrl, copyToClipboard, parseCurrentRoute, therapistUrl } from './url';

function locationFrom(path: string): Location {
  return new URL(path, 'https://app.example') as unknown as Location;
}

describe('url helpers', () => {
  it('parses landing, legal, not-found, therapist, and client routes', () => {
    expect(parseCurrentRoute(locationFrom('/'))).toEqual({ page: 'landing' });
    expect(parseCurrentRoute(locationFrom('/privacy'))).toEqual({ page: 'privacy' });
    expect(parseCurrentRoute(locationFrom('/unknown?t=token'))).toEqual({ page: 'not-found' });
    expect(parseCurrentRoute(locationFrom('/session/abc/therapist?t=therapist%20token'))).toEqual({
      page: 'therapist',
      sessionId: 'abc',
      token: 'therapist token',
    });
    expect(parseCurrentRoute(locationFrom('/session/abc/client?t=client-token'))).toEqual({
      page: 'client',
      sessionId: 'abc',
      token: 'client-token',
    });
    expect(parseCurrentRoute(locationFrom('/session/abc/tactile/left?t=client-token'))).toEqual({
      page: 'not-found',
    });
    expect(parseCurrentRoute(locationFrom('/session/abc/tactile/middle?t=client-token'))).toEqual({
      page: 'not-found',
    });
  });

  it('builds role URLs from the current origin and encodes tokens', () => {
    const origin = window.location.origin;

    expect(therapistUrl('session-1', 'a token&b')).toBe(`${origin}/session/session-1/therapist?t=a%20token%26b`);
    expect(clientUrl('session-1', 'client/token')).toBe(`${origin}/session/session-1/client?t=client%2Ftoken`);
  });

  it('copies with the Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await copyToClipboard('hello');

    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to a hidden textarea when Clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    const execCommand = vi.spyOn(document, 'execCommand');

    await copyToClipboard('fallback');

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });
});
