import type { RouteInfo } from '../domain/sessionTypes';

export function parseCurrentRoute(location: Location = window.location): RouteInfo {
  const parts = location.pathname.split('/').filter(Boolean);
  const token = new URLSearchParams(location.search).get('t') ?? undefined;

  if (parts.length === 0) {
    return { page: 'landing' };
  }

  if (parts.length === 1 && (parts[0] === 'legal' || parts[0] === 'privacy' || parts[0] === 'terms' || parts[0] === 'disclaimer')) {
    return { page: parts[0] };
  }

  if (parts[0] !== 'session' || !parts[1]) {
    return { page: 'not-found' };
  }

  const sessionId = parts[1];
  const roleSegment = parts[2];

  if (roleSegment === 'therapist') {
    return { page: 'therapist', sessionId, token };
  }

  if (roleSegment === 'client') {
    return { page: 'client', sessionId, token };
  }

  return { page: 'not-found' };
}

export function therapistUrl(sessionId: string, therapistToken: string): string {
  return `${window.location.origin}/session/${sessionId}/therapist?t=${encodeURIComponent(therapistToken)}`;
}

export function clientUrl(sessionId: string, clientToken: string): string {
  return `${window.location.origin}/session/${sessionId}/client?t=${encodeURIComponent(clientToken)}`;
}

export async function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
}
