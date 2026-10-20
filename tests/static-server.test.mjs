import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request} from 'node:http';
import {mkdtemp, mkdir, writeFile, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createStaticServer, parseArguments} from '../scripts/serve.mjs';

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'jianx-server-'));
  const root = path.join(directory, 'public');
  await mkdir(root);
  await Promise.all([
    writeFile(path.join(root, 'index.html'), '<h1>首页</h1>'),
    writeFile(path.join(root, 'card.html'), '<h1>卡牌</h1>'),
    writeFile(path.join(root, 'home.html'), '<h1>AI 鉴定</h1>'),
    writeFile(path.join(root, 'app.js'), 'export const ready = true;'),
    writeFile(path.join(root, 'app.css'), 'body{color:purple}'),
    writeFile(path.join(directory, 'private.txt'), 'private'),
    writeFile(path.join(root, '.env'), 'not-public')
  ]);
  await symlink(path.join(directory, 'private.txt'), path.join(root, 'escape.txt'));
  const server = await createStaticServer({root});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, {recursive: true, force: true});
  });
  const send = (url, method = 'GET') => new Promise((resolve, reject) => {
    const req = request({host: '127.0.0.1', port: server.address().port, path: url, method}, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({status: response.statusCode, headers: response.headers, text: Buffer.concat(chunks).toString()}));
    });
    req.on('error', reject);
    req.end();
  });
  return send;
}

test('static routes serve the index and extensionless modules, with query strings', async t => {
  const send = await fixture(t);
  for (const url of ['/', '/index.html', '/card', '/card.html?embedded=1', '/home?embedded=1']) {
    const response = await send(url);
    assert.equal(response.status, 200, url);
    assert.match(response.headers['content-type'], /^text\/html/);
  }
  assert.match((await send('/card')).text, /卡牌/);
  assert.equal((await send('/missing-route')).status, 404);
});

test('module MIME, HEAD and unsupported methods behave correctly', async t => {
  const send = await fixture(t);
  assert.match((await send('/app.js?v=2')).headers['content-type'], /^text\/javascript/);
  assert.match((await send('/app.css')).headers['content-type'], /^text\/css/);
  const head = await send('/card', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.text, '');
  assert.ok(Number(head.headers['content-length']) > 0);
  const post = await send('/card', 'POST');
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
});

test('encoded traversal, hidden files and symlinks cannot escape the public directory', async t => {
  const send = await fixture(t);
  for (const url of ['/../private.txt', '/%2e%2e/private.txt', '/a/%2e%2e/%2e%2e/private.txt', '/%2e%2e%5cprivate.txt', '/.env', '/%00']) {
    assert.equal((await send(url)).status, 403, url);
  }
  assert.equal((await send('/escape.txt')).status, 404);
  assert.equal((await send('/%ZZ')).status, 400);
});

test('dev CLI accepts explicit host and port and rejects malformed arguments', () => {
  const options = parseArguments(['--host', '127.0.0.1', '--port', '4181']);
  assert.equal(options.host, '127.0.0.1');
  assert.equal(options.port, 4181);
  for (const args of [['--port', 'wrong'], ['--port', '65536'], ['--unknown', 'x'], ['--host']]) {
    assert.throws(() => parseArguments(args));
  }
});
