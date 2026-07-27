import type {
  JoyConBatterySummary,
  JoyConCommandResult,
  JoyConDeviceSummary,
  JoyConIntensity,
  JoyConSide,
  NeutralJoyConOptions,
  PulseJoyConOptions,
} from './joyconTypes';

export type { JoyConCommandResult, JoyConDeviceSummary, JoyConIntensity, JoyConSide, NeutralJoyConOptions, PulseJoyConOptions } from './joyconTypes';

const NINTENDO_VENDOR_ID = 0x057e;
const JOYCON_LEFT_PRODUCT_ID = 0x2006;
const JOYCON_RIGHT_PRODUCT_ID = 0x2007;
const REPORT_DATA_BYTES = 48;
const DEFAULT_FRAME_INTERVAL_MS = 24;
const BATTERY_READ_TIMEOUT_MS = 900;
const MIN_DURATION_MS = 20;
const MAX_DURATION_MS = 5000;
const MIN_REPEATS = 1;
const MAX_REPEATS = 20;
const BATTERY_LABELS = ['Empty', 'Critical', 'Low', 'Medium', 'Full'];

const RUMBLE_PROFILES: Record<JoyConIntensity | 'neutral', number[]> = {
  neutral: [0x00, 0x01, 0x40, 0x40],
  low: [0x40, 0x40, 0x60, 0x41],
  medium: [0x98, 0x30, 0x61, 0x46],
  high: [0x28, 0x88, 0x60, 0x61],
};

interface NormalizedPulseOptions {
  durationMs: number;
  repeats: number;
  intensity: JoyConIntensity;
}

interface JoyConEvent {
  time: string;
  type: string;
  [key: string]: unknown;
}

interface DeviceOutputState {
  generation: number;
  tail: Promise<void>;
  activeController: AbortController | null;
}

type PhysicalJoyConSide = Exclude<JoyConSide, 'both'>;
type SideEpochSnapshot = Partial<Record<PhysicalJoyConSide, number>>;

let packetCounter = 0;
const deviceOutputStates = new WeakMap<HIDDevice, DeviceOutputState>();
const sideCommandEpochs: Record<PhysicalJoyConSide, number> = {
  left: 0,
  right: 0,
};
const activeSideControllers: Record<PhysicalJoyConSide, Set<AbortController>> = {
  left: new Set(),
  right: new Set(),
};

export class JoyConWebHidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JoyConWebHidError';
  }
}

class JoyConOutputCancelledError extends Error {
  constructor() {
    super('Joy-Con output was cancelled.');
    this.name = 'JoyConOutputCancelledError';
  }
}

function toHex(value: number | undefined, width = 4): string | null {
  if (value === undefined) {
    return null;
  }

  return `0x${Number(value).toString(16).padStart(width, '0')}`;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
  }

  if (signal.aborted) {
    return Promise.reject(new JoyConOutputCancelledError());
  }

  return new Promise((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, ms);

    const handleAbort = () => {
      globalThis.clearTimeout(timeoutId);
      reject(new JoyConOutputCancelledError());
    };

    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function requestedSides(side: JoyConSide): PhysicalJoyConSide[] {
  return side === 'both' ? ['left', 'right'] : [side];
}

function captureSideEpochs(side: JoyConSide): SideEpochSnapshot {
  return Object.fromEntries(requestedSides(side).map((requestedSide) => [requestedSide, sideCommandEpochs[requestedSide]]));
}

function invalidateSideEpochs(side: JoyConSide): void {
  for (const requestedSide of requestedSides(side)) {
    sideCommandEpochs[requestedSide] += 1;
    for (const controller of activeSideControllers[requestedSide]) {
      controller.abort();
    }
  }
}

function isSideEpochCurrent(side: PhysicalJoyConSide, snapshot: SideEpochSnapshot): boolean {
  return snapshot[side] === sideCommandEpochs[side];
}

function getDeviceOutputState(device: HIDDevice): DeviceOutputState {
  const current = deviceOutputStates.get(device);

  if (current) {
    return current;
  }

  const created: DeviceOutputState = {
    generation: 0,
    tail: Promise.resolve(),
    activeController: null,
  };
  deviceOutputStates.set(device, created);
  return created;
}

function enqueueDeviceOutput<T>(device: HIDDevice, operation: () => Promise<T>): Promise<T> {
  const outputState = getDeviceOutputState(device);
  const result = outputState.tail.catch(() => undefined).then(operation);
  outputState.tail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function cancelPendingDeviceOutput(device: HIDDevice): DeviceOutputState {
  const outputState = getDeviceOutputState(device);
  outputState.generation += 1;
  outputState.activeController?.abort();
  return outputState;
}

function throwIfOutputCancelled(outputState: DeviceOutputState, generation: number, signal: AbortSignal): void {
  if (signal.aborted || outputState.generation !== generation) {
    throw new JoyConOutputCancelledError();
  }
}

function nextPacketCounter(): number {
  packetCounter = (packetCounter + 1) & 0x0f;
  return packetCounter;
}

function getWebHid(): HID {
  const hid = typeof navigator === 'undefined' ? undefined : navigator.hid;

  if (!hid) {
    throw new JoyConWebHidError('This browser does not support WebHID. Use Google Chrome or Microsoft Edge over HTTPS or localhost.');
  }

  return hid;
}

export function isJoyConWebHidSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.hid?.requestDevice === 'function' && typeof navigator.hid?.getDevices === 'function';
}

export function classifyJoyConDevice(device: Pick<HIDDevice, 'productId' | 'productName' | 'vendorId'>): Exclude<JoyConSide, 'both'> | 'unknown' {
  if (device.vendorId === NINTENDO_VENDOR_ID && device.productId === JOYCON_LEFT_PRODUCT_ID) return 'left';
  if (device.vendorId === NINTENDO_VENDOR_ID && device.productId === JOYCON_RIGHT_PRODUCT_ID) return 'right';

  const product = (device.productName ?? '').toLowerCase();
  if (product.includes('joy-con') && (product.includes('(l)') || product.includes('left'))) return 'left';
  if (product.includes('joy-con') && (product.includes('(r)') || product.includes('right'))) return 'right';
  return 'unknown';
}

function summarizeDevice(device: HIDDevice, index: number, battery: JoyConBatterySummary | null = null): JoyConDeviceSummary {
  const primaryCollection = device.collections[0];

  return {
    index,
    side: classifyJoyConDevice(device),
    product: device.productName,
    vendorId: toHex(device.vendorId) ?? undefined,
    productId: toHex(device.productId) ?? undefined,
    usagePage: toHex(primaryCollection?.usagePage) ?? null,
    usage: toHex(primaryCollection?.usage) ?? null,
    battery,
  };
}

function isNintendoDevice(device: HIDDevice): boolean {
  return device.vendorId === NINTENDO_VENDOR_ID;
}

function isKnownJoyCon(device: HIDDevice): boolean {
  return isNintendoDevice(device) && classifyJoyConDevice(device) !== 'unknown';
}

function emit(events: JoyConEvent[], type: string, data: Record<string, unknown> = {}): void {
  events.push({ time: new Date().toISOString(), type, ...data });
}

function outputReportData(payload: number[]): Uint8Array {
  const data = new Uint8Array(REPORT_DATA_BYTES);
  data.set(payload.slice(0, REPORT_DATA_BYTES));
  return data;
}

function buildRumblePayload(profileName: JoyConIntensity | 'neutral'): number[] {
  const frame = RUMBLE_PROFILES[profileName];
  return [nextPacketCounter(), ...frame, ...frame];
}

function buildSubcommandPayload(subcommandId: number, subcommandData: number[] = [], profileName: JoyConIntensity | 'neutral' = 'neutral'): number[] {
  const frame = RUMBLE_PROFILES[profileName];
  return [nextPacketCounter(), ...frame, ...frame, subcommandId, ...subcommandData];
}

function normalizePulseOptions(options: PulseJoyConOptions): NormalizedPulseOptions {
  const durationMs = Number(options.duration);
  const repeats = Number(options.repeats);
  const intensity = options.intensity;

  if (intensity !== 'low' && intensity !== 'medium' && intensity !== 'high') throw new JoyConWebHidError('Intensity must be low, medium, or high.');
  if (!Number.isFinite(durationMs) || durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) {
    throw new JoyConWebHidError(`Pulse duration must be between ${MIN_DURATION_MS} and ${MAX_DURATION_MS} ms.`);
  }
  if (!Number.isInteger(repeats) || repeats < MIN_REPEATS || repeats > MAX_REPEATS) {
    throw new JoyConWebHidError(`Repeats must be between ${MIN_REPEATS} and ${MAX_REPEATS}.`);
  }

  return { durationMs, repeats, intensity };
}

async function getGrantedJoyConHidDevices(): Promise<HIDDevice[]> {
  const hid = getWebHid();
  const devices = await hid.getDevices();
  return devices.filter(isKnownJoyCon);
}

async function ensureOpen(device: HIDDevice, events: JoyConEvent[]): Promise<void> {
  if (device.opened) {
    return;
  }

  emit(events, 'open', { device: summarizeDevice(device, 0) });
  await device.open();
}

async function sendReport(device: HIDDevice, reportId: number, payload: number[], label: string, events: JoyConEvent[], quiet = false): Promise<void> {
  await device.sendReport(reportId, outputReportData(payload));

  if (!quiet) {
    emit(events, 'write', { label, reportId: toHex(reportId, 2), writtenBytes: REPORT_DATA_BYTES + 1 });
  }
}

function unknownBattery(error?: unknown): JoyConBatterySummary {
  return {
    label: 'Unknown',
    level: null,
    percent: null,
    charging: null,
    ...(error instanceof Error ? { error: error.message } : {}),
  };
}

function parseBatteryReport(reportId: number, data: DataView): JoyConBatterySummary | null {
  if (![0x21, 0x23, 0x30, 0x31, 0x32].includes(reportId) || data.byteLength < 2) return null;

  const powerInfo = data.getUint8(1);
  const level = (powerInfo >> 5) & 0x07;
  const known = level >= 0 && level <= 4;

  return {
    rawPowerInfo: toHex(powerInfo, 2),
    reportId: toHex(reportId, 2),
    level: known ? level : null,
    label: known ? BATTERY_LABELS[level] : 'Unknown',
    percent: known ? level * 25 : null,
    charging: (powerInfo & 0x10) !== 0,
  };
}

function waitForBatteryReport(device: HIDDevice): Promise<JoyConBatterySummary | null> {
  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;

    const cleanup = () => {
      if (timeoutId !== undefined) {
        globalThis.clearTimeout(timeoutId);
      }
      device.removeEventListener('inputreport', handleInputReport as EventListener);
    };

    const handleInputReport = (event: HIDInputReportEvent) => {
      const battery = parseBatteryReport(event.reportId, event.data);
      if (!battery) return;

      cleanup();
      resolve(battery);
    };

    timeoutId = globalThis.setTimeout(() => {
      cleanup();
      resolve(null);
    }, BATTERY_READ_TIMEOUT_MS);

    device.addEventListener('inputreport', handleInputReport as EventListener);
  });
}

async function readBatterySnapshot(device: HIDDevice): Promise<JoyConBatterySummary> {
  const wasOpened = device.opened;

  try {
    if (!device.opened) {
      await device.open();
    }

    const report = waitForBatteryReport(device);
    await sendReport(device, 0x01, buildSubcommandPayload(0x03, [0x30]), 'set input report mode', [], true);

    return (await report) ?? unknownBattery();
  } catch (error) {
    return unknownBattery(error);
  } finally {
    if (!wasOpened && device.opened) {
      try {
        await device.close();
      } catch {
        // Closing can fail if the controller disconnects while reading battery.
      }
    }
  }
}

async function enableVibration(device: HIDDevice, events: JoyConEvent[], signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    throw new JoyConOutputCancelledError();
  }

  await sendReport(device, 0x01, buildSubcommandPayload(0x48, [0x01]), 'enable vibration', events);
  await sleep(40, signal);
}

async function sendNeutral(device: HIDDevice, events: JoyConEvent[], signal?: AbortSignal): Promise<void> {
  await sendReport(device, 0x10, buildRumblePayload('neutral'), 'neutral', events);
  await sleep(30, signal);
}

async function streamRumble(
  device: HIDDevice,
  intensity: JoyConIntensity,
  durationMs: number,
  events: JoyConEvent[],
  outputState: DeviceOutputState,
  generation: number,
  signal: AbortSignal,
): Promise<void> {
  const startedAt = nowMs();
  let frameCount = 0;

  do {
    throwIfOutputCancelled(outputState, generation, signal);
    await sendReport(device, 0x10, buildRumblePayload(intensity), `rumble ${intensity}`, events, true);
    frameCount += 1;
    await sleep(DEFAULT_FRAME_INTERVAL_MS, signal);
  } while (nowMs() - startedAt < durationMs);

  emit(events, 'stream', { intensity, durationMs, frameCount });
}

async function neutralAfterPulse(
  device: HIDDevice,
  events: JoyConEvent[],
  signal: AbortSignal,
  callback: () => Promise<void>,
): Promise<void> {
  let callbackError: unknown;

  try {
    await callback();
  } catch (error) {
    callbackError = error;
  }

  if (callbackError instanceof JoyConOutputCancelledError) {
    throw callbackError;
  }

  try {
    await sendNeutral(device, events, signal);
  } catch (error) {
    if (error instanceof JoyConOutputCancelledError) {
      throw error;
    }

    emit(events, 'error', { label: 'neutral', error: error instanceof Error ? error.message : 'Neutral rumble failed.' });
    if (!callbackError) throw error;
  }

  if (callbackError) throw callbackError;
}

function selectTargets(devices: HIDDevice[], side: JoyConSide): HIDDevice[] {
  if (devices.length === 0) {
    throw new JoyConWebHidError('No Joy-Con devices are available to this browser. Pair them over Bluetooth, then use Add Joy-Cons.');
  }

  const sides: Array<Exclude<JoyConSide, 'both'>> = side === 'both' ? ['left', 'right'] : [side];

  return sides.map((requestedSide) => {
    const match = devices.find((device) => classifyJoyConDevice(device) === requestedSide);

    if (!match) {
      throw new JoyConWebHidError(`No ${requestedSide} Joy-Con has been added to this browser.`);
    }

    return match;
  });
}

function selectNeutralTargets(devices: HIDDevice[], side: JoyConSide): HIDDevice[] {
  if (side !== 'both') {
    return selectTargets(devices, side);
  }

  if (devices.length === 0) {
    throw new JoyConWebHidError('No Joy-Con devices are available to this browser. Pair them over Bluetooth, then use Add Joy-Cons.');
  }

  return devices;
}

export async function requestJoyConDevices(): Promise<JoyConDeviceSummary[]> {
  const hid = getWebHid();

  try {
    await hid.requestDevice({
      filters: [
        { vendorId: NINTENDO_VENDOR_ID, productId: JOYCON_LEFT_PRODUCT_ID },
        { vendorId: NINTENDO_VENDOR_ID, productId: JOYCON_RIGHT_PRODUCT_ID },
      ],
    });
  } catch (error) {
    if (error instanceof JoyConWebHidError) {
      throw error;
    }

    throw new JoyConWebHidError('Joy-Con selection was cancelled or blocked by the browser.');
  }

  return listJoyConDevices();
}

export async function disconnectJoyConDevices(): Promise<void> {
  invalidateSideEpochs('both');
  const devices = await getGrantedJoyConHidDevices();
  const events: JoyConEvent[] = [];

  await Promise.all(
    devices.map((device) => {
      cancelPendingDeviceOutput(device);

      return enqueueDeviceOutput(device, async () => {
        try {
          if (device.opened) {
            await sendNeutral(device, events);
            await device.close();
          }

          await device.forget?.();
        } catch (error) {
          throw new JoyConWebHidError(error instanceof Error ? error.message : 'Joy-Con disconnect failed.');
        }
      });
    }),
  );
}

export async function listJoyConDevices(): Promise<JoyConDeviceSummary[]> {
  const devices = await getGrantedJoyConHidDevices();
  return Promise.all(
    devices.map(async (device, index) => {
      const battery = await enqueueDeviceOutput(device, () => readBatterySnapshot(device));
      return summarizeDevice(device, index, battery);
    }),
  );
}

export async function pulseJoyCon(options: PulseJoyConOptions): Promise<JoyConCommandResult> {
  const commandEpochs = captureSideEpochs(options.side);
  const pulseOptions = normalizePulseOptions(options);
  const devices = await getGrantedJoyConHidDevices();
  const targets = selectTargets(devices, options.side);
  const events: JoyConEvent[] = [];

  await Promise.all(
    targets.map((target) => {
      const targetSide = classifyJoyConDevice(target);

      if (targetSide === 'unknown' || !isSideEpochCurrent(targetSide, commandEpochs)) {
        emit(events, 'cancel', { side: targetSide, reason: 'superseded before start' });
        return Promise.resolve();
      }

      const outputState = getDeviceOutputState(target);
      const generation = outputState.generation;

      return enqueueDeviceOutput(target, async () => {
        if (outputState.generation !== generation || !isSideEpochCurrent(targetSide, commandEpochs)) {
          emit(events, 'cancel', { side: targetSide, reason: 'superseded before start' });
          return;
        }

        const controller = new AbortController();
        outputState.activeController = controller;
        activeSideControllers[targetSide].add(controller);

        try {
          throwIfOutputCancelled(outputState, generation, controller.signal);
          await ensureOpen(target, events);
          throwIfOutputCancelled(outputState, generation, controller.signal);
          await enableVibration(target, events, controller.signal);

          for (let index = 0; index < pulseOptions.repeats; index += 1) {
            throwIfOutputCancelled(outputState, generation, controller.signal);
            emit(events, 'pulse', {
              side: classifyJoyConDevice(target),
              repeat: index + 1,
              repeats: pulseOptions.repeats,
              intensity: pulseOptions.intensity,
              durationMs: pulseOptions.durationMs,
            });
            await neutralAfterPulse(target, events, controller.signal, async () => {
              await streamRumble(
                target,
                pulseOptions.intensity,
                pulseOptions.durationMs,
                events,
                outputState,
                generation,
                controller.signal,
              );
            });
            await sleep(60, controller.signal);
          }
        } catch (error) {
          if (error instanceof JoyConOutputCancelledError) {
            emit(events, 'cancel', { side: classifyJoyConDevice(target), reason: 'neutral requested' });
            return;
          }

          throw error;
        } finally {
          activeSideControllers[targetSide].delete(controller);
          if (outputState.activeController === controller) {
            outputState.activeController = null;
          }
        }
      });
    }),
  );

  return { ok: true, events };
}

export async function neutralJoyCon(options: NeutralJoyConOptions): Promise<JoyConCommandResult> {
  invalidateSideEpochs(options.side);
  const devices = await getGrantedJoyConHidDevices();
  const targets = selectNeutralTargets(devices, options.side);
  const events: JoyConEvent[] = [];

  await Promise.all(
    targets.map((target) => {
      cancelPendingDeviceOutput(target);

      return enqueueDeviceOutput(target, async () => {
        await ensureOpen(target, events);
        await sendNeutral(target, events);
      });
    }),
  );

  return { ok: true, events };
}
