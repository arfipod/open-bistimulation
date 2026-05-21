import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getJoyConBridgeStatus,
  listJoyConDevices,
  neutralJoyCon,
  pulseJoyCon,
  JoyConBridgeClientError,
} from './joyconBridgeClient';

const baseUrl = 'http://127.0.0.1:5174';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('joyconBridgeClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads status and devices from the local bridge endpoints', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, mode: 'node-hid', bridgeVersion: '0.1.0' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, devices: [{ side: 'left', product: 'Joy-Con (L)' }] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getJoyConBridgeStatus(baseUrl)).resolves.toMatchObject({ mode: 'node-hid' });
    await expect(listJoyConDevices(baseUrl)).resolves.toEqual([{ side: 'left', product: 'Joy-Con (L)' }]);

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:5174/api/joycon/status', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:5174/api/joycon/devices', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('posts pulse and neutral commands as JSON', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ ok: true, events: [] })));
    vi.stubGlobal('fetch', fetchMock);

    await pulseJoyCon(baseUrl, { side: 'left', intensity: 'high', duration: 120, repeats: 1 });
    await neutralJoyCon(baseUrl, { side: 'both' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:5174/api/joycon/pulse',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side: 'left', intensity: 'high', duration: 120, repeats: 1 }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:5174/api/joycon/neutral',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ side: 'both' }),
      }),
    );
  });

  it('treats non-2xx and ok false bridge responses as errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: false, error: 'No left Joy-Con was found.' }))
      .mockResolvedValueOnce(jsonResponse({ ok: false, error: 'Origin is not allowed.' }, 403));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getJoyConBridgeStatus(baseUrl)).rejects.toThrow('No left Joy-Con was found.');
    await expect(getJoyConBridgeStatus(baseUrl)).rejects.toMatchObject({ status: 403 });
  });

  it('aborts requests that do not complete', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = getJoyConBridgeStatus(baseUrl);
    const assertion = expect(request).rejects.toThrow('Joy-Con bridge request timed out.');
    await vi.advanceTimersByTimeAsync(2500);

    await assertion;
    await expect(request).rejects.toBeInstanceOf(JoyConBridgeClientError);
  });
});
