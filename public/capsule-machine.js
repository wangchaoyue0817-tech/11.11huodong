/**
 * Shared visual device for the expert landing page and both expert prize pools.
 * This module owns animation only. Ticket spending and prize selection belong
 * to the campaign model, before play() is called.
 */
const ART = {
  ysl: ['ysl', 'YSL 气垫'],
  'c-belt': ['c-belt', 'COACH 腰带'],
  razer: ['razer', '雷蛇耳机'],
  'c-wallet': ['c-wallet', 'COACH 钱包'],
  makeup: ['makeup', '美妆小样'],
  skincare: ['skincare', '护肤品小样'],
  perfume: ['perfume', '香水小样'],
  voucher: ['voucher', '专家鉴定券'],
  none: ['none', '再接再厉'],
};
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function artKey(value) {
  const id = String(value || '').toLowerCase();
  if (ART[id]) return id;
  if (/ysl|气垫/.test(id)) return 'ysl';
  if (/belt|腰带|皮带/.test(id)) return 'c-belt';
  if (/razer|耳机|雷蛇/.test(id)) return 'razer';
  if (/wallet|钱包/.test(id)) return 'c-wallet';
  if (/makeup|美妆/.test(id)) return 'makeup';
  if (/skincare|护肤/.test(id)) return 'skincare';
  if (/perfume|香水/.test(id)) return 'perfume';
  if (/voucher|coupon|ticket|鉴定券|鉴别券/.test(id)) return 'voucher';
  return 'none';
}

export function prizeArt(id, {className = ''} = {}) {
  const [file, label] = ART[artKey(id)];
  const sprite = ['ysl', 'c-belt', 'razer', 'c-wallet', 'makeup', 'skincare', 'perfume', 'voucher'].indexOf(file);
  const position = sprite < 0 ? '' : ` style="--gm-sprite-x:${(sprite % 4) * 100 / 3}%;--gm-sprite-y:${sprite < 4 ? 0 : 100}%"`;
  return `<span class="gm-prize-art gm-prize-art--${file}${sprite >= 0 ? ' gm-prize-art--sprite-ready' : ''}${className ? ` ${escape(className)}` : ''}"${position} role="img" aria-label="${label}"><img src="assets/gacha/${file}.svg" alt="" loading="lazy" decoding="async" draggable="false"></span>`;
}

const BALLS = [
  {x: 13, y: 13, size: 26, turn: -18, color: 'lilac'},
  {x: 43, y: 4, size: 28, turn: 12, color: 'cyan'},
  {x: 69, y: 19, size: 26, turn: 23, color: 'blue'},
  {x: 2, y: 41, size: 28, turn: -30, color: 'blue'},
  {x: 34, y: 37, size: 30, turn: -8, color: 'violet'},
  {x: 68, y: 53, size: 27, turn: 22, color: 'lilac'},
  {x: 15, y: 68, size: 25, turn: 15, color: 'cyan'},
  {x: 44, y: 67, size: 27, turn: -18, color: 'gold'},
  {x: 72, y: 0, size: 13, turn: 26, color: 'violet'},
  {x: 2, y: 6, size: 13, turn: -7, color: 'gold'},
  {x: 47, y: 26, size: 15, turn: 36, color: 'blue'},
];
const POOL_ART = {
  ordinary: {
    showcase: ['makeup', 'skincare', 'perfume', 'voucher'],
    balls: ['makeup', 'voucher', 'skincare', 'perfume', 'makeup', 'skincare', 'perfume', 'voucher'],
  },
  premium: {
    showcase: ['ysl', 'c-belt', 'razer', 'c-wallet'],
    balls: ['c-wallet', 'voucher', 'ysl', 'razer', 'c-belt', 'ysl', 'c-wallet', 'voucher'],
  },
};
const poolTier = pool => ['premium', 'advanced'].includes(pool) ? 'premium' : 'ordinary';
const showcaseMarkup = tier => POOL_ART[tier].showcase.map(id => `<span>${prizeArt(id)}</span>`).join('');
const ballsMarkup = tier => BALLS.map((ball, index) => ballMarkup({...ball, art: POOL_ART[tier].balls[index]}, index)).join('');

function ballMarkup(ball, index) {
  return `<div class="gm-ball gm-ball--${ball.color}${ball.art ? ' gm-ball--prize' : ''}" style="--gm-x:${ball.x}%;--gm-y:${ball.y}%;--gm-size:${ball.size}%;--gm-turn:${ball.turn}deg;--gm-delay:-${index * .81}s;--gm-drift:${6.3 + index * .31}s;--gm-i:${index}" aria-hidden="true">
    <div class="gm-ball-shell"><span class="gm-ball-back"></span>${ball.art ? prizeArt(ball.art) : '<span class="gm-ball-star">✦</span>'}<span class="gm-ball-bottom"></span><span class="gm-ball-seam"></span><span class="gm-ball-glint"></span></div>
  </div>`;
}

export function machineMarkup({pool = 'ordinary', compact = false} = {}) {
  const tier = poolTier(pool);
  return `<div class="gm-machine${compact ? ' gm-machine--compact' : ''}" data-pool="${tier}" data-phase="idle" data-count="1" role="img" aria-label="${tier === 'premium' ? '高级' : '普通'}扭蛋机，透明球舱内展示实物好礼与专家鉴定券">
    <div class="gm-aura" aria-hidden="true"></div>
    <div class="gm-floor" aria-hidden="true"></div>
    <div class="gm-device">
      <div class="gm-crown" aria-hidden="true"><span class="gm-crown-line"></span><span class="gm-crown-orbit"></span><span class="gm-crown-gem"></span></div>
      <div class="gm-head">
        <span class="gm-bolt gm-bolt--left"></span><span class="gm-bolt gm-bolt--right"></span>
        <div class="gm-marquee"><span class="gm-marquee-spark">✦</span><strong class="gm-pool-title">${tier === 'premium' ? '高级好礼' : '扭出惊喜'}</strong><span class="gm-marquee-spark">✦</span></div>
        <div class="gm-showcase" aria-hidden="true">${showcaseMarkup(tier)}</div>
        <div class="gm-running-light" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      </div>
      <div class="gm-side gm-side--left" aria-hidden="true"><span></span><i></i></div>
      <div class="gm-side gm-side--right" aria-hidden="true"><span></span><i></i></div>
      <div class="gm-chamber" aria-hidden="true">
        <div class="gm-chamber-back"><span class="gm-back-orbit"></span><span class="gm-back-grid"></span><span class="gm-back-spark gm-back-spark--a"></span><span class="gm-back-spark gm-back-spark--b"></span></div>
        <div class="gm-balls">${ballsMarkup(tier)}</div>
        <div class="gm-glass"></div><div class="gm-chamber-floor"></div>
      </div>
      <div class="gm-chamber-rim" aria-hidden="true"></div>
      <div class="gm-base">
        <span class="gm-base-trim" aria-hidden="true"></span>
        <div class="gm-dial" aria-hidden="true"><span class="gm-dial-ring"></span><span class="gm-dial-handle"></span><span class="gm-dial-center"></span></div>
        <div class="gm-delivery" aria-hidden="true"><span class="gm-door"></span><span class="gm-delivery-light"></span><div class="gm-dispensed">${Array.from({length: 5}, (_, i) => `<span class="gm-drop-ball gm-drop-ball--${i}" style="--gm-drop-i:${i}"><i></i></span>`).join('')}</div></div>
        <span class="gm-base-light gm-base-light--left" aria-hidden="true"></span><span class="gm-base-light gm-base-light--right" aria-hidden="true"></span>
        <span class="gm-device-label">每一份认真，都值得惊喜</span>
      </div>
      <div class="gm-plinth" aria-hidden="true"><span></span></div>
    </div>
    <span class="gm-live" role="status" aria-live="polite"></span>
  </div>`;
}

/**
 * play() starts a single visual transaction. A second play while running returns
 * false, so repeated taps cannot register a second callback. A completed device
 * can be played again; destroyed devices cannot.
 */
export function mountMachine(element) {
  const machine = element?.classList?.contains('gm-machine') ? element : element?.querySelector('.gm-machine');
  if (!machine) throw new TypeError('mountMachine requires a rendered capsule machine');
  const live = machine.querySelector('.gm-live');
  const title = machine.querySelector('.gm-pool-title');
  let destroyed = false;
  let running = false;
  let callback = null;
  let timers = [];
  let generation = 0;

  const clear = () => {
    timers.forEach(timer => clearTimeout(timer));
    timers = [];
  };
  const say = text => { if (live) live.textContent = text; };
  const complete = () => {
    if (destroyed || !running) return false;
    running = false;
    clear();
    machine.dataset.phase = 'revealed';
    machine.setAttribute('aria-busy', 'false');
    say(machine.dataset.count === '5' ? '五枚扭蛋已开启，查看全部抽奖结果' : '扭蛋已开启，查看抽奖结果');
    const reveal = callback;
    callback = null;
    reveal?.();
    return true;
  };
  return {
    play({count = 1, pool = machine.dataset.pool, onReveal} = {}) {
      if (![1, 5].includes(count)) throw new RangeError('A capsule draw must contain 1 or 5 capsules');
      if (destroyed || running) return false;
      clear();
      running = true;
      callback = typeof onReveal === 'function' ? onReveal : null;
      const currentGeneration = ++generation;
      const tier = poolTier(pool);
      const premium = tier === 'premium';
      if (machine.dataset.pool !== tier) {
        const showcase = machine.querySelector('.gm-showcase');
        const balls = machine.querySelector('.gm-balls');
        if (showcase) showcase.innerHTML = showcaseMarkup(tier);
        if (balls) balls.innerHTML = ballsMarkup(tier);
      }
      machine.dataset.pool = tier;
      machine.dataset.count = String(count);
      machine.dataset.phase = 'spinning';
      machine.setAttribute('aria-busy', 'true');
      machine.setAttribute('aria-label', `${premium ? '高级' : '普通'}扭蛋机，正在抽取 ${count} 次`);
      if (title) title.textContent = count === 5 ? '五重惊喜' : '好运转动中';
      say(count === 5 ? '五枚扭蛋正在转动，将一起揭晓' : '扭蛋正在转动');
      const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      const schedule = (fn, delay) => timers.push(setTimeout(() => {
        if (!destroyed && running && generation === currentGeneration) fn();
      }, delay));
      schedule(() => {
        machine.dataset.phase = 'dropping';
        say(count === 5 ? '五枚扭蛋已落入出球口，即将一起开启' : '扭蛋已落入出球口，即将开启');
      }, reduced ? 0 : count === 5 ? 2950 : 1650);
      schedule(complete, reduced ? 100 : count === 5 ? 4500 : 2800);
      return true;
    },
    skip: complete,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      running = false;
      generation++;
      callback = null;
      clear();
      machine.dataset.phase = 'destroyed';
      machine.setAttribute('aria-busy', 'false');
      say('');
    },
  };
}
