import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve(process.cwd(), 'supabase/schema.sql'), 'utf8');

function functionDefinition(name: string): string {
  const start = schema.indexOf(`create or replace function public.${name}(`);
  expect(start, `${name} must be defined`).toBeGreaterThanOrEqual(0);

  const end = schema.indexOf('\n$$;', start);
  expect(end, `${name} must have a complete body`).toBeGreaterThan(start);
  return schema.slice(start, end);
}

describe('session schema safety contract', () => {
  it('uses only the dedicated heartbeat operation for ordinary liveness writes', () => {
    expect(functionDefinition('therapist_save_state')).not.toContain(
      'therapist_heartbeat_at',
    );
    expect(functionDefinition('therapist_save_preferences')).not.toContain(
      'therapist_heartbeat_at',
    );
    expect(functionDefinition('therapist_heartbeat')).toContain(
      'therapist_heartbeat_at = now()',
    );
  });

  it('keeps terminal safety operations authoritative and heartbeat-safe', () => {
    expect(functionDefinition('therapist_stop_session')).toContain(
      "'status', 'stopped'",
    );
    expect(functionDefinition('end_bls_session')).toContain("'ended'");
  });
});
