import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const root = resolve('docs/design-skill');
function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? markdownFiles(resolve(directory, entry.name)) :
      entry.name.endsWith('.md') ? [resolve(directory, entry.name)] : []);
}
test('versioned design skill has valid identity and resolvable reference links', () => {
  const skill = readFileSync(resolve(root, 'SKILL.md'), 'utf8');
  assert.match(skill, /^---\nname: tuling-jianx-design\ndescription: "[^"\n]+"\n---/);
  for (const file of markdownFiles(root)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      if (/^(https?:|#|\/)/.test(match[1])) continue;
      assert.ok(existsSync(resolve(dirname(file), match[1].split('#')[0])), `${file}: ${match[1]}`);
    }
  }
});
test('campaign tokens stay scoped away from ordinary product surfaces', () => {
  const tokens = readFileSync(resolve(root, 'assets/tokens.css'), 'utf8');
  const block = tokens.match(/\.jx-campaign\s*\{([^}]+)\}/)?.[1];
  assert.ok(block, 'campaign values require an opt-in scope');
  for (const color of ['#315bff', '#853bff', '#f03ddb', '#48e8ff', '#ffd36b'])
    assert.ok(block.toLowerCase().includes(color), `missing campaign color ${color}`);
});
