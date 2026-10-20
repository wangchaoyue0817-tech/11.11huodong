import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../public/site-shell.js', import.meta.url), 'utf8');
function fixture(hash = '#home') {
  const events = new Map(), frames = [], loading = {hidden: true}, historyCalls = [];
  const location = {hash, origin: 'http://localhost:4181'};
  const document = {
    title: '',
    querySelector(selector) { assert.equal(selector, '.site-shell'); return {append(frame) { frames.push(frame); }}; },
    getElementById(id) { assert.equal(id, 'site-loading'); return loading; },
    createElement(tag) {
      assert.equal(tag, 'iframe');
      const sent = [];
      return {dataset: {}, hidden: false, sent, contentWindow: {postMessage(message, origin) { sent.push({message: structuredClone(message), origin}); }}};
    }
  };
  const history = Object.fromEntries(['pushState', 'replaceState'].map(type => [type, (state, _title, url) => {
    historyCalls.push({type, state, url});
    location.hash = new URL(url, location.origin).hash;
  }]));
  const context = vm.createContext({document, location, history, window: {addEventListener(type, callback) { events.set(type, callback); }}});
  vm.runInContext(source, context, {filename: 'site-shell.js'});
  const send = (frame, message, overrides = {}) => events.get('message')({
    origin: location.origin, source: frame.contentWindow, data: {channel: 'jianx-module', ...message}, ...overrides
  });
  const navigate = route => { location.hash = `#${route}`; events.get('hashchange')(); };
  return {frames, document, location, events, loading, historyCalls, send, navigate};
}
const lastActivation = frame => frame.sent.filter(entry => entry.message.type === 'activate').at(-1)?.message;

test('five public routes activate only the two extracted modules', () => {
  for (const route of ['home', 'expert', 'card', 'lottery', 'prizes']) {
    const f = fixture(`#${route}`);
    assert.equal(f.frames.length, 1);
    const frame = f.frames[0];
    assert.equal(frame.dataset.module, ['home', 'expert'].includes(route) ? 'home' : 'card');
    if (route === 'expert') assert.match(frame.src, /tab=expert/);
    f.send(frame, {type: 'ready'});
    assert.equal(lastActivation(frame).route, route);
    assert.equal(f.loading.hidden, true);
  }
  for (const route of ['skin', 'skin-management', 'orders', 'unknown']) {
    const f = fixture(`#${route}`);
    assert.equal(f.location.hash, '#home');
    assert.equal(f.frames[0].dataset.module, 'home');
  }
});

test('module navigation waits for ready and preserves photo intent across iframe activation', () => {
  const f = fixture();
  const home = f.frames[0];
  f.send(home, {type: 'ready'});
  f.send(home, {type: 'navigate', route: 'card', intent: 'choose-card', photo: {url: 'blob:photo'}});
  assert.equal(f.location.hash, '#card');
  assert.equal(f.frames.length, 2);
  const card = f.frames[1];
  assert.equal(home.hidden, true);
  assert.equal(lastActivation(card), undefined);
  f.send(card, {type: 'ready'});
  assert.deepEqual(lastActivation(card), {channel: 'jianx-shell', type: 'activate', route: 'card', intent: 'choose-card', photo: {url: 'blob:photo'}});
  f.send(card, {type: 'navigate', route: 'lottery'});
  assert.equal(f.frames.length, 2);
  assert.equal(lastActivation(card).route, 'lottery');
});

test('a late ready message from the inactive module cannot dismiss active loading', () => {
  const f = fixture();
  const home = f.frames[0];
  f.navigate('card');
  const card = f.frames[1];
  f.send(home, {type: 'ready'});
  assert.equal(home.hidden, true);
  assert.equal(f.loading.hidden, false, 'active card module is still waiting for ready');
  assert.equal(lastActivation(home), undefined);
  f.send(card, {type: 'ready'});
  assert.equal(f.loading.hidden, true);
  assert.equal(lastActivation(card).route, 'card');
});

test('new conversation resets loaded modules and activates home without creating a third frame', () => {
  const f = fixture();
  const home = f.frames[0];
  f.send(home, {type: 'ready'});
  f.send(home, {type: 'navigate', route: 'card'});
  const card = f.frames[1];
  f.send(card, {type: 'ready'});
  f.send(card, {type: 'new-chat'});
  assert.equal(f.location.hash, '#home');
  assert.equal(home.hidden, false);
  assert.equal(card.hidden, true);
  assert.equal(f.frames.length, 2);
  for (const frame of f.frames) assert.ok(frame.sent.some(entry => entry.message.type === 'reset-chat'));
  assert.equal(lastActivation(home).intent, 'new-chat');
});

test('back navigation and same-module route messages keep URL, title and visibility synchronized', () => {
  const f = fixture();
  const home = f.frames[0];
  f.send(home, {type: 'ready'});
  f.navigate('lottery');
  const card = f.frames[1];
  f.send(card, {type: 'ready'});
  f.send(card, {type: 'route', route: 'prizes'});
  assert.equal(f.location.hash, '#prizes');
  assert.match(f.document.title, /我的奖品/);
  assert.equal(f.historyCalls.at(-1).type, 'replaceState');
  f.location.hash = '#home';
  f.events.get('popstate')();
  assert.equal(home.hidden, false);
  assert.equal(card.hidden, true);
  assert.equal(lastActivation(home).route, 'home');
  f.send(card, {type: 'route', route: 'prizes'});
  assert.equal(f.location.hash, '#home', 'inactive module cannot overwrite active route');
});

test('messages from wrong origins, unknown windows and invalid destinations are ignored', () => {
  const f = fixture();
  const home = f.frames[0];
  f.send(home, {type: 'ready'});
  f.send(home, {type: 'navigate', route: 'card'}, {origin: 'https://other.invalid'});
  f.send(home, {type: 'navigate', route: 'card'}, {source: {}});
  f.send(home, {type: 'navigate', route: 'orders'});
  assert.equal(f.location.hash, '#home');
  assert.equal(f.frames.length, 1);
});
