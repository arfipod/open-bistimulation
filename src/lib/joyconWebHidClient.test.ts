import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listJoyConDevices, pulseJoyCon, requestJoyConDevices } from './joyconWebHidClient';

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

function installHid(devices: HIDDevice[]) {
  const hid = {
    getDevices: vi.fn(async () => devices),
    requestDevice: vi.fn(async () => devices),
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

describe('joyconWebHidClient', () => {
  beforeEach(() => {
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
});
