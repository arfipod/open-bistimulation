import type { TactileSide, VisualSettings, VisualStimulus } from './sessionTypes';

export type VisualStimulusLabelKey =
  | 'visual.stimulus.dot'
  | 'visual.stimulus.dog'
  | 'visual.stimulus.flower'
  | 'visual.stimulus.sun'
  | 'visual.stimulus.star'
  | 'visual.stimulus.heart'
  | 'visual.stimulus.smile';

export interface VisualStimulusPreset {
  value: VisualStimulus;
  labelKey: VisualStimulusLabelKey;
  preview: string;
  forward: string | null;
  reverse: string | null;
}

export const DEFAULT_VISUAL_STIMULUS: VisualStimulus = 'dot';

export const VISUAL_STIMULI: VisualStimulusPreset[] = [
  { value: 'dot', labelKey: 'visual.stimulus.dot', preview: '●', forward: null, reverse: null },
  { value: 'dog', labelKey: 'visual.stimulus.dog', preview: '🐶', forward: '🐕', reverse: '🐶' },
  { value: 'flower', labelKey: 'visual.stimulus.flower', preview: '🌸', forward: '🌸', reverse: '🏵️' },
  { value: 'sun', labelKey: 'visual.stimulus.sun', preview: '☀️', forward: '☀️', reverse: '🌞' },
  { value: 'star', labelKey: 'visual.stimulus.star', preview: '⭐', forward: '⭐', reverse: '🌟' },
  { value: 'heart', labelKey: 'visual.stimulus.heart', preview: '💙', forward: '💙', reverse: '❤️' },
  { value: 'smile', labelKey: 'visual.stimulus.smile', preview: '☺️', forward: '☺️', reverse: '😊' },
];

export function getVisualStimulusPreset(value: VisualSettings['stimulus']): VisualStimulusPreset {
  return VISUAL_STIMULI.find((preset) => preset.value === value) ?? VISUAL_STIMULI[0];
}

export function getVisualStimulusContent(visual: VisualSettings, side: TactileSide): string | null {
  const preset = getVisualStimulusPreset(visual.stimulus ?? DEFAULT_VISUAL_STIMULUS);

  if (preset.value === 'dot') {
    return null;
  }

  if (visual.stimulusAlternatesSides === false) {
    return preset.preview;
  }

  return side === 'right' ? preset.forward : preset.reverse;
}

export function isEmojiStimulus(visual: VisualSettings): boolean {
  return getVisualStimulusPreset(visual.stimulus ?? DEFAULT_VISUAL_STIMULUS).value !== 'dot';
}
