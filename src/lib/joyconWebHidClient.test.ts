import { beforeEach, describe, expect, it, vi } from 'vitest';
import { disconnectJoyConDevices, listJoyConDevices, neutralJoyCon, pulseJoyCon, requestJoyConDevices } from './joyconWebHidClient';

const NINTENDO_VENDOR_ID = 0x057e;
const JOYCON_LEFT_PRODUCT_ID = 0x2006;
const JOYCON_RIGHT_PRODUCT_ID = 0x2007;

function makeHidDevice(productId: number, productName: string, batteryPowerInfo = 0x80): HIDDevice {
  let inputReportListener: ((event: HIDInputReportEvent) => void) | null = null;
  const device = {
    opened: false,
    vendorId: NINTENDO_VENDOR_ID,
    productId,
    productName,
    collections: [{ usagePage: 0x01, usage: 0x05, type: 0, children: [] }],
    open: vi.fn(async () => {
      device.opened = true;
    }),
    close: vi.fn(async () => {
      device.opened = false;
    }),
    forget: vi.fn(async () => undefined),
    sendReport: vi.fn(async (reportId: number) => {
      if (reportId === 0x01 && inputReportListener) {
        queueMicrotask(() => {
          inputReportListener?.({
            type: 'inputreport',
            device: device as unknown as HIDDevice,
            reportId: 0x30,
            data: new DataView(Uint8Array.from([0x00, batteryPowerInfo]).buffer),
          } as HIDInputReportEvent);
        });
      }
    }),
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'inputreport') {
        inputReportListener = listener as (event: HIDInputReportEvent) => void;
      }
    }),
    removeEventListener: vi.fn((type: string) => {
      if (type === 'inputreport') {
        inputReportListener = null;
      }
    }),
    dispatchEvent: vi.fn(() => true),
  };

  return device as unknown as HIDDevice;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function installHidWithGetDevices(getDevices: () => Promise<HIDDevice[]>) {
  const hid = {
    getDevices: vi.fn(getDevices),
    requestDevice: vi.fn(async () => getDevices()),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  };

  Object.defineProperty(navigator, 'hid', {
    configurable: true,
    value: hid,
  });

  return hid;
}

function installHid(devices: HIDDevice[]) {
  return installHidWithGetDevices(async () => devices);
}

function rumbleProfiles(device: HIDDevice): number[][] {
  const sendReport = device.sendReport as unknown as ReturnType<typeof vi.fn>;

  return sendReport.mock.calls
    .filter(([reportId]) => reportId === 0x10)
    .map(([, payload]) => Array.from((payload as Uint8Array).slice(1, 5)));
}

describe('joyconWebHidClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('lists granted left and right Joy-Con devices from WebHID', async () => {
    installHid([
      makeHidDevice(JOYCON_LEFT_PRODUCT_ID, 'Joy-Con (L)', 0x80),
      makeHidDevice(JOYCON_RIGHT_PRODUCT_ID, 'Joy-Con (R)', 0x60),
    ]);

    await expect(listJoyConDevices()).resolves.toEqual([
      expect.objectContaining({ side: 'left', product: 'Joy-Con (L)', vendorId: '0x057e', productId: '0x2006', battery: expect.objectContaining({ percent: 100 }) }),
      expect.objectContaining({ side: 'right', product: 'Joy-Con (R)', vendorId: '0x057e', productId: '0x2007', battery: expect.objectContaining({ percent: 75 }) }),
    ]);
  });

  it('requests Joy-Con access with Nintendo HID filters', async () => {
    const hid = installHid([makeHidDevice(JOYCON_LEFT_PRODUCT_ID, 'Joy-Con (L)')]);

    await requestJoyConDevices();

    expect(hid.requestDevice).toHaveBeenCalledWith({
      filters: [
        { vendorId: NINTENDO_VENDOR_ID, productId: JOYCON_LEFT_PRODUCT_ID },
        { vendorId: NINTENDO_VENDOR_ID, productId: JOYCON_RIGHT_PRODUCT_ID },
      ],
    });
  });

  it('forgets granted Joy-Con devices when disconnecting', async () => {
    const left = makeHidDevice(JOYCON_LEFT_PRODUCT_ID, 'Joy-Con (L)');
    const right = makeHidDevice(JOYCON_RIGHT_PRODUCT_ID, 'Joy-Con (R)');
    installHid([left, right]);

    await disconnectJoyConDevices();

    expect(left.forget).toHaveBeenCalledTimes(1);
    expect(right.forget).toHaveBeenCalledTimes(1);
  });

  it('sends enable, rumble, and neutral output reports for a pulse', async () => {
    vi.useFakeTimers();
    let performanceNow = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => performanceNow);
    const left = makeHidDevice(JOYCON_LEFT_PRODUCT_ID, 'Joy-Con (L)');
    installHid([left]);

    const pulse = pulseJoyCon({ side: 'left', intensity: 'low', duration: 20, repeats: 1 });
    await vi.advanceTimersByTimeAsync(40);
    performanceNow = 25;
    await vi.advanceTimersByTimeAsync(24);
    await vi.advanceTimersByTimeAsync(30);
    await vi.advanceTimersByTimeAsync(180);

    await pulse;

    expect(left.open).toHaveBeenCalledTimes(1);
    expect(left.sendReport).toHaveBeenCalledWith(0x01, expect.any(Uint8Array));
    expect(left.sendReport).toHaveBeenCalledWith(0x10, expect.any(Uint8Array));
    expect(left.sendReport).toHaveBeenCalledTimes(3);
    expect((left.sendReport as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]).toHaveLength(48);
  });

  it('neutralizes every available controller even when only one side is connected', async () => {
    vi.useFakeTimers();
    const left = makeHidDevice(JOYCON_LEFT_PRODUCT_ID, 'Joy-Con (L)');
    installHid([left]);

    const neutral = neutralJoyCon({ side: 'both' });
    await vi.advanceTimersByTimeAsync(30);
    await neutral;

    expect(rumbleProfiles(left)).toEqual([[0x00, 0x01, 0x40, 0x40]]);
  });

  it('cancels an active rumble before queuing neutral so no stale intensity frame follows it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
    const left = makeHidDevice(JOYCON_LEFT_PRODUCT_ID, 'Joy-Con (L)');
    installHid([left]);

    const pulse = pulseJoyCon({ side: 'left', intensity: 'high', duration: 500, repeats: 1 });
    await vi.advanceTimersByTimeAsync(50);
    const neutral = neutralJoyCon({ side: 'both' });
    await vi.advanceTimersByTimeAsync(100);
    const [pulseResult] = await Promise.all([pulse, neutral]);

    const profiles = rumbleProfiles(left);
    const firstNeutralIndex = profiles.findIndex((profile) => profile.join(',') === [0x00, 0x01, 0x40, 0x40].join(','));

    expect(profiles.some((profile) => profile.join(',') === [0x28, 0x88, 0x60, 0x61].join(','))).toBe(true);
    expect(firstNeutralIndex).toBeGreaterThanOrEqual(0);
    expect(profiles.slice(firstNeutralIndex + 1)).toEqual([]);
    expect(pulseResult.events).toContainEqual(expect.objectContaining({ type: 'cancel', reason: 'neutral requested' }));
  });

  it('serializes concurrent pulse requests for the same controller', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
    const left = makeHidDevice(JOYCON_LEFT_PRODUCT_ID, 'Joy-Con (L)');
    installHid([left]);

    const lowPulse = pulseJoyCon({ side: 'left', intensity: 'low', duration: 20, repeats: 1 });
    const highPulse = pulseJoyCon({ side: 'left', intensity: 'high', duration: 20, repeats: 1 });
    await vi.advanceTimersByTimeAsync(350);
    await Promise.all([lowPulse, highPulse]);

    expect(rumbleProfiles(left)).toEqual([
      [0x40, 0x40, 0x60, 0x41],
      [0x00, 0x01, 0x40, 0x40],
      [0x28, 0x88, 0x60, 0x61],
      [0x00, 0x01, 0x40, 0x40],
    ]);
  });

  it('drops queued stale pulses and serializes a new neutral behind the active device write', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
    const left = makeHidDevice(JOYCON_LEFT_PRODUCT_ID, 'Joy-Con (L)');
    installHid([left]);

    const activePulse = pulseJoyCon({ side: 'left', intensity: 'low', duration: 500, repeats: 1 });
    const queuedPulse = pulseJoyCon({ side: 'left', intensity: 'medium', duration: 500, repeats: 1 });
    await vi.advanceTimersByTimeAsync(50);
    const neutral = neutralJoyCon({ side: 'left' });
    await vi.advanceTimersByTimeAsync(100);
    const [, queuedResult] = await Promise.all([activePulse, queuedPulse, neutral]);

    const profiles = rumbleProfiles(left);
    const neutralIndex = profiles.findIndex((profile) => profile.join(',') === [0x00, 0x01, 0x40, 0x40].join(','));

    expect(profiles.some((profile) => profile.join(',') === [0x40, 0x40, 0x60, 0x41].join(','))).toBe(true);
    expect(profiles.some((profile) => profile.join(',') === [0x98, 0x30, 0x61, 0x46].join(','))).toBe(false);
    expect(profiles.slice(neutralIndex + 1)).toEqual([]);
    expect(queuedResult.events).toContainEqual(expect.objectContaining({ type: 'cancel', reason: 'superseded before start' }));
  });

  it('drops an older pulse whose device lookup resolves after a newer neutral command', async () => {
    vi.useFakeTimers();
    const left = makeHidDevice(JOYCON_LEFT_PRODUCT_ID, 'Joy-Con (L)');
    const pulseDevices = deferred<HIDDevice[]>();
    const neutralDevices = deferred<HIDDevice[]>();
    let lookupCount = 0;
    installHidWithGetDevices(() => {
      lookupCount += 1;
      return lookupCount === 1 ? pulseDevices.promise : neutralDevices.promise;
    });

    const pulse = pulseJoyCon({ side: 'left', intensity: 'high', duration: 500, repeats: 1 });
    const neutral = neutralJoyCon({ side: 'left' });

    neutralDevices.resolve([left]);
    await vi.advanceTimersByTimeAsync(30);
    await neutral;
    expect(rumbleProfiles(left)).toEqual([[0x00, 0x01, 0x40, 0x40]]);

    pulseDevices.resolve([left]);
    const pulseResult = await pulse;

    expect(rumbleProfiles(left)).toEqual([[0x00, 0x01, 0x40, 0x40]]);
    expect(pulseResult.events).toContainEqual(expect.objectContaining({ type: 'cancel', reason: 'superseded before start' }));
  });
});
