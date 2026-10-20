import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm, access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildSite} from '../build.mjs';

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'jianx-build-'));
  const sourceDir = path.join(directory, 'public');
  const outDir = path.join(directory, 'dist');
  await mkdir(path.join(sourceDir, 'assets'), {recursive: true});
  await writeFile(path.join(sourceDir, 'index.html'), '<h1>首页</h1>');
  await writeFile(path.join(sourceDir, 'assets', 'image.svg'), '<svg/>');
  t.after(() => rm(directory, {recursive: true, force: true}));
  return {sourceDir, outDir};
}

test('build copies nested public assets and removes previously generated stale files', async t => {
  const options = await fixture(t);
  await buildSite(options);
  assert.equal(await readFile(path.join(options.outDir, 'assets/image.svg'), 'utf8'), '<svg/>');
  await rm(path.join(options.sourceDir, 'assets/image.svg'));
  await writeFile(path.join(options.sourceDir, 'index.html'), '<h1>更新</h1>');
  await buildSite(options);
  assert.equal(await readFile(path.join(options.outDir, 'index.html'), 'utf8'), '<h1>更新</h1>');
  await assert.rejects(access(path.join(options.outDir, 'assets/image.svg')));
});

test('build refuses to overwrite an unrelated output directory', async t => {
  const options = await fixture(t);
  await mkdir(options.outDir);
  const unrelated = path.join(options.outDir, 'keep.txt');
  await writeFile(unrelated, 'user-owned');
  await assert.rejects(buildSite(options), /not owned/);
  assert.equal(await readFile(unrelated, 'utf8'), 'user-owned');
});

test('build refuses to remove files added outside a previous build', async t => {
  const options = await fixture(t);
  await buildSite(options);
  const unrelated = path.join(options.outDir, 'keep.txt');
  await writeFile(unrelated, 'user-owned');
  await assert.rejects(buildSite(options), /unrelated files/);
  assert.equal(await readFile(unrelated, 'utf8'), 'user-owned');
});

test('build cannot target the source directory or its ancestors', async t => {
  const options = await fixture(t);
  for (const outDir of [options.sourceDir, path.join(options.sourceDir, 'dist'), path.dirname(options.sourceDir)]) {
    await assert.rejects(buildSite({...options, outDir}), /separate directories/);
  }
});
