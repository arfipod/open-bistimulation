import type { AudioSound, TactileSide } from './sessionTypes';

export interface AudioEngine {
  play(sound: AudioSound, side: TactileSide, volume: number): void;
  dispose(): void;
}

export function createAudioEngine(): AudioEngine {
  const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error('Web Audio API is not supported by this browser.');
  }

  const context = new AudioContextCtor();

  return {
    play(sound, side, volume) {
      void context.resume();
      const safeVolume = Math.min(1, Math.max(0, volume));

      if (sound === 'snap') {
        playSnap(context, side, safeVolume);
      } else if (sound === 'bell') {
        playBell(context, side, safeVolume);
      } else if (sound === 'heartbeat') {
        playHeartbeat(context, side, safeVolume);
      } else {
        playBeep(context, side, safeVolume);
      }
    },
    dispose() {
      void context.close();
    },
  };
}

function makeOutput(context: AudioContext, side: TactileSide, volume: number): GainNode {
  const gain = context.createGain();
  const panner = context.createStereoPanner();
  gain.gain.value = volume;
  panner.pan.value = side === 'left' ? -1 : 1;
  gain.connect(panner);
  panner.connect(context.destination);
  return gain;
}

function playBeep(context: AudioContext, side: TactileSide, volume: number): void {
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = makeOutput(context, side, volume * 0.25);
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(760, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume * 0.25), now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
  oscillator.connect(gain);
  oscillator.start(now);
  oscillator.stop(now + 0.1);
}

function playBell(context: AudioContext, side: TactileSide, volume: number): void {
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = makeOutput(context, side, volume * 0.18);
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(880, now);
  oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.04);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume * 0.18), now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
  oscillator.connect(gain);
  oscillator.start(now);
  oscillator.stop(now + 0.28);
}

function playHeartbeat(context: AudioContext, side: TactileSide, volume: number): void {
  const now = context.currentTime;
  playThud(context, side, volume, now, 95, 0.09);
  playThud(context, side, volume * 0.75, now + 0.12, 82, 0.11);
}

function playThud(
  context: AudioContext,
  side: TactileSide,
  volume: number,
  startAt: number,
  frequency: number,
  duration: number,
): void {
  const oscillator = context.createOscillator();
  const gain = makeOutput(context, side, volume * 0.35);
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume * 0.35), startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

function playSnap(context: AudioContext, side: TactileSide, volume: number): void {
  const now = context.currentTime;
  const bufferSize = Math.floor(context.sampleRate * 0.045);
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i += 1) {
    const envelope = 1 - i / bufferSize;
    data[i] = (Math.random() * 2 - 1) * envelope;
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = makeOutput(context, side, volume * 0.45);
  filter.type = 'highpass';
  filter.frequency.value = 1200;
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  source.start(now);
  source.stop(now + 0.05);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
