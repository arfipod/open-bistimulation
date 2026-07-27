import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from './audioEngine';

class FakeAudioParam {
  value = 0;
  setValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
  exponentialRampToValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
}

class FakeGainNode {
  gain = new FakeAudioParam();
  connect = vi.fn();
}

class FakeStereoPannerNode {
  pan = new FakeAudioParam();
  connect = vi.fn();
}

class FakeOscillatorNode {
  type = '';
  frequency = new FakeAudioParam();
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeBufferSourceNode {
  buffer: unknown = null;
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeBiquadFilterNode {
  type = '';
  frequency = new FakeAudioParam();
  connect = vi.fn();
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  state: AudioContextState = 'suspended';
  currentTime = 3;
  sampleRate = 1_000;
  destination = {};
  gains: FakeGainNode[] = [];
  panners: FakeStereoPannerNode[] = [];
  oscillators: FakeOscillatorNode[] = [];
  sources: FakeBufferSourceNode[] = [];
  filters: FakeBiquadFilterNode[] = [];
  buffers: Float32Array[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createGain() {
    const node = new FakeGainNode();
    this.gains.push(node);
    return node;
  }

  createStereoPanner() {
    const node = new FakeStereoPannerNode();
    this.panners.push(node);
    return node;
  }

  createOscillator() {
    const node = new FakeOscillatorNode();
    this.oscillators.push(node);
    return node;
  }

  createBuffer(_channels: number, size: number) {
    const data = new Float32Array(size);
    this.buffers.push(data);
    return {
      getChannelData: vi.fn(() => data),
    };
  }

  createBufferSource() {
    const node = new FakeBufferSourceNode();
    this.sources.push(node);
    return node;
  }

  createBiquadFilter() {
    const node = new FakeBiquadFilterNode();
    this.filters.push(node);
    return node;
  }
}

function installAudioContext() {
  FakeAudioContext.instances = [];
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: FakeAudioContext,
  });
  Object.defineProperty(window, 'webkitAudioContext', {
    configurable: true,
    value: undefined,
  });
}

describe('audio engine', () => {
  beforeEach(() => {
    installAudioContext();
  });

  it('throws a clear error when Web Audio is unavailable', () => {
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'webkitAudioContext', {
      configurable: true,
      value: undefined,
    });

    expect(() => createAudioEngine()).toThrow('Web Audio API is not supported by this browser.');
  });

  it('unlocks once from a user gesture before playing beeps', async () => {
    const engine = createAudioEngine();
    const context = FakeAudioContext.instances[0];

    expect(engine.isUnlocked()).toBe(false);
    expect(() => engine.play('beep', 'left', 2)).toThrow('Audio output is locked');
    expect(context.oscillators).toHaveLength(0);

    const unlockAttempt = engine.unlock();
    expect(context.resume).toHaveBeenCalledTimes(1);
    await unlockAttempt;
    await engine.unlock();
    engine.play('beep', 'left', 2);

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(engine.isUnlocked()).toBe(true);
    expect(context.oscillators).toHaveLength(1);
    expect(context.oscillators[0].type).toBe('sine');
    expect(context.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(760, 3);
    expect(context.panners[0].pan.value).toBe(-1);
    expect(context.oscillators[0].start).toHaveBeenCalledWith(3);
    expect(context.oscillators[0].stop).toHaveBeenCalledWith(3.1);
  });

  it('plays bells and heartbeats with their expected envelopes after unlocking', async () => {
    const engine = createAudioEngine();
    const context = FakeAudioContext.instances[0];

    await engine.unlock();
    engine.play('bell', 'right', 0.5);
    engine.play('heartbeat', 'left', 0.75);

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.oscillators).toHaveLength(3);
    expect(context.oscillators[0].type).toBe('triangle');
    expect(context.oscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(1320, 3.04);
    expect(context.oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(95, 3);
    expect(context.oscillators[2].frequency.setValueAtTime).toHaveBeenCalledWith(82, 3.12);
    expect(context.panners.map((panner) => panner.pan.value)).toEqual([1, -1, -1]);
  });

  it('plays snap sounds through a high-pass filter and disposes the context', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.75);
    const engine = createAudioEngine();
    const context = FakeAudioContext.instances[0];

    await engine.unlock();
    engine.play('snap', 'right', -1);
    engine.dispose();
    engine.dispose();

    expect(context.sources).toHaveLength(1);
    expect(context.filters).toHaveLength(1);
    expect(context.filters[0].type).toBe('highpass');
    expect(context.filters[0].frequency.value).toBe(1200);
    expect(context.buffers[0]).toHaveLength(45);
    expect(context.buffers[0][0]).toBe(0.5);
    expect(context.panners[0].pan.value).toBe(1);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(engine.isUnlocked()).toBe(false);
    await expect(engine.unlock()).rejects.toThrow('Audio output has already been closed.');
  });

  it('surfaces browser unlock rejection without pretending audio is ready', async () => {
    const engine = createAudioEngine();
    const context = FakeAudioContext.instances[0];
    context.resume.mockRejectedValueOnce(new Error('Audio permission was blocked.'));

    await expect(engine.unlock()).rejects.toThrow('Audio permission was blocked.');
    expect(engine.isUnlocked()).toBe(false);
  });

  it('rejects unlock when resume resolves but the context stays suspended', async () => {
    const engine = createAudioEngine();
    const context = FakeAudioContext.instances[0];
    context.resume.mockResolvedValueOnce(undefined);

    await expect(engine.unlock()).rejects.toThrow('The browser did not allow audio output.');
    expect(engine.isUnlocked()).toBe(false);
  });
});
