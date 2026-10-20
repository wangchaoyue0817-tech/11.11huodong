import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import {machineMarkup, mountMachine, prizeArt} from '../public/capsule-machine.js';

function fixture(t, {reduced = false} = {}) {
  t.mock.timers.enable({apis: ['setTimeout']});
  const previous = globalThis.matchMedia;
  globalThis.matchMedia = () => ({matches: reduced});
  t.after(() => {
    if (previous === undefined) delete globalThis.matchMedia;
    else globalThis.matchMedia = previous;
  });
  const attributes = new Map();
  const live = {textContent: ''};
  const title = {textContent: ''};
  const showcase = {innerHTML: ''};
  const balls = {innerHTML: ''};
  const machine = {
    dataset: {pool: 'ordinary', phase: 'idle', count: '1'},
    classList: {contains: name => name === 'gm-machine'},
    querySelector: name => ({'.gm-live': live, '.gm-pool-title': title, '.gm-showcase': showcase, '.gm-balls': balls}[name] || null),
    setAttribute: (name, value) => attributes.set(name, value),
  };
  const controller = mountMachine(machine);
  t.after(() => controller.destroy());
  return {machine, live, title, showcase, balls, attributes, controller};
}

test('single draw drops before revealing and callback occurs exactly once', t => {
  const f = fixture(t);
  let calls = 0;
  assert.equal(f.controller.play({count: 1, onReveal: () => calls++}), true);
  assert.equal(f.machine.dataset.phase, 'spinning');
  assert.equal(f.attributes.get('aria-busy'), 'true');
  t.mock.timers.tick(1649);
  assert.equal(f.machine.dataset.phase, 'spinning');
  t.mock.timers.tick(1);
  assert.equal(f.machine.dataset.phase, 'dropping');
  assert.equal(calls, 0);
  t.mock.timers.tick(1150);
  assert.equal(f.machine.dataset.phase, 'revealed');
  assert.equal(calls, 1);
  assert.equal(f.attributes.get('aria-busy'), 'false');
  f.controller.skip();
  t.mock.timers.tick(20000);
  assert.equal(calls, 1);
});

test('five draws have a longer sequence and reveal the entire batch together', t => {
  const f = fixture(t);
  let calls = 0;
  f.controller.play({count: 5, pool: 'premium', onReveal: () => calls++});
  assert.equal(f.machine.dataset.pool, 'premium');
  assert.equal(f.machine.dataset.count, '5');
  assert.equal(f.title.textContent, '五重惊喜');
  t.mock.timers.tick(2800);
  assert.equal(f.machine.dataset.phase, 'spinning');
  assert.equal(calls, 0);
  t.mock.timers.tick(150);
  assert.equal(f.machine.dataset.phase, 'dropping');
  t.mock.timers.tick(1549);
  assert.equal(calls, 0);
  t.mock.timers.tick(1);
  assert.equal(calls, 1);
  assert.match(f.live.textContent, /五枚/);
});

test('double play is ignored without replacing the registered callback', t => {
  const f = fixture(t);
  const calls = [];
  f.controller.play({count: 1, onReveal: () => calls.push('first')});
  assert.equal(f.controller.play({count: 5, onReveal: () => calls.push('second')}), false);
  assert.equal(f.machine.dataset.count, '1');
  f.controller.skip();
  assert.deepEqual(calls, ['first']);
  t.mock.timers.tick(10000);
  assert.deepEqual(calls, ['first']);
});

test('skip supports both phases and a later draw cannot be completed by stale timers', t => {
  const f = fixture(t);
  const calls = [];
  f.controller.play({count: 1, onReveal: () => calls.push(1)});
  t.mock.timers.tick(1650);
  f.controller.skip();
  assert.equal(f.controller.play({count: 5, onReveal: () => calls.push(5)}), true);
  t.mock.timers.tick(1150);
  assert.deepEqual(calls, [1]);
  assert.equal(f.machine.dataset.phase, 'spinning');
  f.controller.skip();
  f.controller.skip();
  t.mock.timers.tick(10000);
  assert.deepEqual(calls, [1, 5]);
});

test('destroy cancels pending callbacks and disables future animation', t => {
  const f = fixture(t);
  let calls = 0;
  f.controller.play({count: 5, onReveal: () => calls++});
  t.mock.timers.tick(3000);
  f.controller.destroy();
  f.controller.destroy();
  f.controller.skip();
  t.mock.timers.tick(10000);
  assert.equal(calls, 0);
  assert.equal(f.machine.dataset.phase, 'destroyed');
  assert.equal(f.controller.play({count: 1}), false);
  assert.equal(f.attributes.get('aria-busy'), 'false');
});

test('reduced motion reveals promptly while preserving one callback', t => {
  const f = fixture(t, {reduced: true});
  let calls = 0;
  f.controller.play({count: 5, onReveal: () => calls++});
  t.mock.timers.tick(100);
  assert.equal(f.machine.dataset.phase, 'revealed');
  assert.equal(calls, 1);
  f.controller.skip();
  assert.equal(calls, 1);
});

test('invalid count fails before starting the visual transaction', t => {
  const f = fixture(t);
  assert.throws(() => f.controller.play({count: 2}), RangeError);
  assert.throws(() => f.controller.play({count: '5'}), RangeError);
  assert.equal(f.machine.dataset.phase, 'idle');
  assert.throws(() => mountMachine(null), TypeError);
});

test('mounting from a wrapper uses the same machine instance', t => {
  const f = fixture(t);
  const wrapper = {querySelector: name => name === '.gm-machine' ? f.machine : null};
  const controller = mountMachine(wrapper);
  t.after(() => controller.destroy());
  controller.play({count: 1});
  assert.equal(f.machine.dataset.phase, 'spinning');
});

test('product aliases map to present assets, including future generated sprite positions', async () => {
  const aliases = {
    ysl: 'ysl', 'YSL气垫': 'ysl',
    'coach-belt': 'c-belt', 'COACH腰带': 'c-belt',
    razer: 'razer', '雷蛇耳机': 'razer',
    'coach-wallet': 'c-wallet', 'COACH钱包': 'c-wallet',
    makeup: 'makeup', skincare: 'skincare', perfume: 'perfume',
    '鉴定券': 'voucher', 'expert-voucher': 'voucher', '再接再厉': 'none',
  };
  for (const [alias, file] of Object.entries(aliases)) {
    const html = prizeArt(alias);
    assert.match(html, new RegExp(`assets/gacha/${file}\\.svg`));
    assert.match(html, /role="img" aria-label="[^"]+"/);
    await access(new URL(`../public/assets/gacha/${file}.svg`, import.meta.url));
    if (file !== 'none') assert.match(html, /gm-prize-art--sprite-ready/);
  }
  assert.match(prizeArt('c-wallet'), /--gm-sprite-x:100%;--gm-sprite-y:0%/);
  assert.match(prizeArt('voucher'), /--gm-sprite-x:100%;--gm-sprite-y:100%/);
  assert.doesNotMatch(prizeArt('ysl', {className: '" onclick="bad'}), /class="[^"]*" onclick/);
});

test('generated prize sheet is a 4 by 2 grid of square cells with alpha support', async () => {
  const png = await readFile(new URL('../public/assets/gacha/prizes-sheet.png', import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), png.readUInt32BE(20) * 2);
  assert.ok([4, 6].includes(png[25]), 'PNG must carry grayscale or RGB alpha');
  const css = await readFile(new URL('../public/capsule-machine.css', import.meta.url), 'utf8');
  assert.match(css, /\.gm-prize-art--sprite-ready \{ background-image:/);
  assert.match(css, /background-size: 400% 200%/);
});

test('machine markup carries no business actions and includes decorative balls and scoped accessibility', () => {
  const html = machineMarkup({pool: 'premium', compact: true});
  assert.match(html, /gm-machine--compact/);
  assert.match(html, /data-pool="premium"/);
  assert.equal((html.match(/class="gm-ball gm-ball--/g) || []).length, 11);
  assert.equal((html.match(/class="gm-drop-ball gm-drop-ball--/g) || []).length, 5);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /<button|onclick=|localStorage|<script/);
});

test('ordinary machine presents only sample prizes and vouchers, while advanced presents its four physical prizes', () => {
  const ordinary = machineMarkup({pool: 'ordinary'});
  for (const id of ['makeup', 'skincare', 'perfume', 'voucher']) {
    assert.match(ordinary, new RegExp(`assets/gacha/${id}\\.svg`));
  }
  assert.doesNotMatch(ordinary, /assets\/gacha\/(?:ysl|c-belt|razer|c-wallet)\.svg/);
  for (const pool of ['advanced', 'premium']) {
    const advanced = machineMarkup({pool});
    for (const id of ['ysl', 'c-belt', 'razer', 'c-wallet', 'voucher']) {
      assert.match(advanced, new RegExp(`assets/gacha/${id}\\.svg`));
    }
    assert.doesNotMatch(advanced, /assets\/gacha\/(?:makeup|skincare|perfume)\.svg/);
    assert.equal((advanced.match(/class="gm-ball-star"/g) || []).length, 3);
  }
  assert.equal((ordinary.match(/class="gm-ball-star"/g) || []).length, 3);
});

test('playing a different pool refreshes the prize showcase and capsule contents', t => {
  const f = fixture(t);
  f.controller.play({pool: 'advanced', count: 1});
  assert.match(f.showcase.innerHTML, /assets\/gacha\/c-belt\.svg/);
  assert.match(f.balls.innerHTML, /assets\/gacha\/voucher\.svg/);
  assert.doesNotMatch(f.balls.innerHTML, /assets\/gacha\/makeup\.svg/);
  f.controller.skip();
  f.controller.play({pool: 'ordinary', count: 1});
  assert.match(f.showcase.innerHTML, /assets\/gacha\/makeup\.svg/);
  assert.match(f.balls.innerHTML, /assets\/gacha\/perfume\.svg/);
  assert.doesNotMatch(f.balls.innerHTML, /assets\/gacha\/ysl\.svg/);
});

test('machine has no global business state and CSS stops movement for reduced motion', async () => {
  const js = await readFile(new URL('../public/capsule-machine.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/capsule-machine.css', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /localStorage|sessionStorage|fetch\(/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /max-width: 360px/);
  assert.match(css, /gm-tumble-one/);
  assert.match(css, /gm-tumble-five/);
});
