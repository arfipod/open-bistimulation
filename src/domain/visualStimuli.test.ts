import { describe, expect, it } from 'vitest';
import { DEFAULT_SESSION_STATE } from './defaults';
import { getVisualStimulusContent } from './visualStimuli';

describe('visual stimuli', () => {
  it('alternates emoji content by side by default', () => {
    const visual = { ...DEFAULT_SESSION_STATE.visual, stimulus: 'dog' as const };

    expect(getVisualStimulusContent(visual, 'left')).toBe('🐶');
    expect(getVisualStimulusContent(visual, 'right')).toBe('🐕');
  });

  it('uses the same emoji on both sides when side alternation is disabled', () => {
    const visual = { ...DEFAULT_SESSION_STATE.visual, stimulus: 'dog' as const, stimulusAlternatesSides: false };

    expect(getVisualStimulusContent(visual, 'left')).toBe('🐶');
    expect(getVisualStimulusContent(visual, 'right')).toBe('🐶');
  });
});
