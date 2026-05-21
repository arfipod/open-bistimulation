import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const scannedExtensions = new Set(['.html', '.json', '.md', '.ts', '.tsx']);
const explicitFiles = new Set(['LICENSE']);

const forbiddenClaims = [
  { label: 'HIPAA compliant', pattern: /\bHIPAA\s+compliant\b/gi },
  { label: 'GDPR compliant', pattern: /\bGDPR\s+compliant\b/gi },
  { label: 'clinically validated', pattern: /\bclinically\s+validated\b/gi },
  { label: 'medical device', pattern: /\bmedical\s+device\b/gi, allowedNegative: /\bnot\s+(?:a\s+)?medical\s+device\b/i },
  { label: 'diagnose', pattern: /\bdiagnose\b/gi, allowedNegative: /\b(?:not|does\s+not|do\s+not)\s+diagnose\b/i },
  { label: 'cure', pattern: /\bcure\b/gi, allowedNegative: /\b(?:not|does\s+not|do\s+not)\s+cure\b/i },
  { label: 'treat trauma', pattern: /\btreat\s+trauma\b/gi },
  { label: 'endorsed by bilateralstimulation.io', pattern: /\bendorsed\s+by\s+bilateralstimulation\.io\b/gi },
  { label: 'charity-style payment wording: donate', pattern: /\bdonate\b/gi },
  { label: 'charity-style payment wording: donation', pattern: /\bdonation\b/gi },
  { label: 'charity-style payment wording: donations', pattern: /\bdonations\b/gi },
  { label: 'charity-style payment wording: donar', pattern: /\bdonar\b/gi },
  { label: 'charity-style payment wording: donación', pattern: /\bdonación\b/gi },
  { label: 'charity-style payment wording: donaciones', pattern: /\bdonaciones\b/gi },
];

function shouldScan(filePath) {
  if (explicitFiles.has(filePath)) {
    return true;
  }

  const dot = filePath.lastIndexOf('.');
  return dot >= 0 && scannedExtensions.has(filePath.slice(dot));
}

function collectFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    const rel = relative(root, absolute);

    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        files.push(...collectFiles(absolute));
      }
      continue;
    }

    if (entry.isFile() && shouldScan(rel)) {
      files.push(absolute);
    }
  }

  return files;
}

const violations = [];

for (const file of collectFiles(root)) {
  const rel = relative(root, file);

  if (rel === 'scripts/legal-check.mjs') {
    continue;
  }

  if (statSync(file).size > 1_000_000) {
    continue;
  }

  const lines = readFileSync(file, 'utf8').split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const claim of forbiddenClaims) {
      claim.pattern.lastIndex = 0;

      if (!claim.pattern.test(line)) {
        continue;
      }

      if (claim.allowedNegative?.test(line)) {
        continue;
      }

      violations.push(`${rel}:${index + 1}: forbidden legal/medical claim "${claim.label}"`);
    }
  });
}

if (violations.length > 0) {
  console.error('Legal copy check failed:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Legal copy check passed.');
