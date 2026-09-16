/**
 * Dependency-free repository checks run by npm run check.
 * Syntax checks parse JavaScript without executing browser-only globals; the
 * catalogue assertions protect data consumed by the UI, rules and agent prompt.
 * These are not a type checker, accessibility audit or live-provider test.
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { films } from '../backend/cinema/service.js';
import assert from 'node:assert/strict';
// Resolve paths from this script, not the caller's shell directory. Check every
// repository JavaScript file, including tests, but exclude installed dependencies
// from syntax validation. Inherit diagnostics so a failure points to its source.
const root = new URL('../', import.meta.url);
for (const path of readdirSync(root, { recursive: true }).filter(p => p.endsWith('.js') && !p.startsWith('node_modules/'))) {
  const result = spawnSync(process.execPath, ['--check', new URL(path, root).pathname], { stdio: 'inherit' });
  // A missing exit status (for example, failed process creation) is a failure too.
  if (result.status !== 0) process.exit(result.status || 1);
}
// IDs are embedded in dated screening identifiers and agent enums, so duplicates
// would make selection ambiguous even if the display titles looked different.
assert.equal(new Set(films.map(f => f.id)).size, films.length, 'Film IDs must be unique');
for (const film of films) {
  // Both visual and spoken descriptions need complete original catalogue copy.
  // This checks presence, not whether editorial content is factually suitable.
  for (const key of ['id', 'title', 'genre', 'mood', 'language', 'description', 'conversation', 'contentNotes', 'audience']) assert.ok(film[key], `${film.id}: missing ${key}`);
  // Positive whole-minute runtimes, 24-hour slots and valid screens support the
  // deterministic programme. Non-overlap itself is checked by cinema.test.js.
  assert.ok(Number.isInteger(film.runtime) && film.runtime > 0 && film.runtime < 180);
  assert.match(film.time, /^([01]\d|2[0-3]):[0-5]\d$/);
  assert.ok([1, 2].includes(film.screen));
  // Colours are used as inline CSS custom properties. Restrict catalogue values
  // to complete hexadecimal colours rather than arbitrary CSS fragments.
  for (const colour of [film.colour, film.ink]) assert.match(colour, /^#[0-9a-f]{6}$/i);
}
console.log('JavaScript syntax and catalogue checks passed.');
