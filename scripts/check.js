import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { films } from '../lib/cinema.js';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
for (const path of readdirSync(root, { recursive: true }).filter(p => p.endsWith('.js') && !p.startsWith('node_modules/'))) {
  const result = spawnSync(process.execPath, ['--check', new URL(path, root).pathname], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
assert.equal(new Set(films.map(f => f.id)).size, films.length, 'Film IDs must be unique');
for (const film of films) {
  for (const key of ['id', 'title', 'genre', 'mood', 'language', 'description', 'conversation', 'contentNotes', 'audience']) assert.ok(film[key], `${film.id}: missing ${key}`);
  assert.ok(Number.isInteger(film.runtime) && film.runtime > 0 && film.runtime < 180);
  assert.match(film.time, /^([01]\d|2[0-3]):[0-5]\d$/);
  assert.ok([1, 2].includes(film.screen));
  for (const colour of [film.colour, film.ink]) assert.match(colour, /^#[0-9a-f]{6}$/i);
}
console.log('JavaScript syntax and catalogue checks passed.');
