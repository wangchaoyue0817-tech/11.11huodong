import * as EventModel from './expert-event-model.js';
import {loadEvent, saveEvent, eventNow} from './expert-event-session.js';
import {PRIZES as CARD_PRIZES, END as CARD_END, START as CARD_START, validateAddress} from './lottery-model.js';
import {ticketInventory as cardTicketInventory} from './ticket-inventory.js';
import {prizeArt} from './capsule-machine.js';

const {START, END, VOUCHER_END, PRIZES, active, balances, claimDaily, ticketInventory} = EventModel;
const CARD_KEY = 'jianx-card-preview-v1';
const eligibleNames = ['美妆', '包袋', '鞋靴', '服饰', '手表', '数码3C'];
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const time = value => Number.isFinite(value) ? new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(value) : '时间待确认';
const date = value => Number.isFinite(value) ? new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(value) : '以原活动记录为准';
const poolName = pool => pool === 'advanced' ? '高级抽奖券' : pool === 'welcome' ? '新人五连抽券' : '普通抽奖券';
const glyphs = {
  ticket:'<path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Z"/><path d="M15 5v3m0 3v2m0 3v3"/>',
  crown:'<path d="m3 6 4 4 5-6 5 6 4-4-2 13H5L3 6Zm3 9h12"/>',
  arrow:'<path d="m9 5 7 7-7 7"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  gift:'<path d="M3 8h18v4H3zm2 4v9h14v-9M12 8v13"/><path d="M12 8C9 8 5 7 5 4.5A2.5 2.5 0 0 1 9.5 3C11 5 12 8 12 8Zm0 0c3 0 7-1 7-3.5A2.5 2.5 0 0 0 14.5 3C13 5 12 8 12 8Z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  shield:'<path d="m12 3 8 4v6c0 4-4 7-8 9-4-2-8-5-8-9V7l8-4Z"/><path d="m8 12 3 3 5-5"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  none:'<circle cx="12" cy="12" r="8"/><path d="M9 10h.01M15 10h.01M8 15c2 1.3 6 1.3 8 0"/>',
  cards:'<rect x="6" y="3" width="13" height="18" rx="2"/><path d="M3 6v12m7-11h5m-5 4h5m-5 4h3"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${glyphs[name] || glyphs.ticket}</svg>`;
const empty = (title, copy, action = '') => `<div class="ac-empty">${icon('ticket')}<h3>${escapeHTML(title)}</h3><p>${escapeHTML(copy)}</p>${action}</div>`;
const button = (label, action, style='ac-primary', disabled=false) => `<button class="${style}" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;

export function earnedPrizes(state) {
  return (state.draws || []).flatMap(batch => (batch.rewards || []).filter(reward => ['physical','voucher'].includes(reward.type)).map(reward => ({...reward, pool:batch.pool, at:reward.at ?? batch.at, batchId:batch.id})));
}

export function eligibleOrderCount(state) {
  return (state.orders || []).filter(order => order.uid === state.uid && order.eligible !== false && active(order.at) && (EventModel.isEligibleCategory ? EventModel.isEligibleCategory(order.category) : eligibleNames.includes(order.category))).length;
}

export function recordMarkup(batch, prizes = PRIZES) {
  const rewards = batch.rewards || [];
  const label = `${poolName(batch.pool)} · ${rewards.length === 5 ? '五连扭蛋' : '单次扭蛋'}`;
  return `<article class="ac-record-group"><header class="ac-record-head"><strong>${label}</strong><small>${time(batch.at)}</small></header><div class="ac-record-prizes">${rewards.map(reward => {
    const title = reward.type === 'none' ? '再接再厉' : reward.type === 'voucher' ? '专家鉴定券' : prizes.find(prize => prize.id === reward.prizeId)?.name || reward.name || '实物奖品';
    return `<div class="ac-record-item is-${escapeHTML(reward.type)}">${icon(reward.type === 'physical' ? 'gift' : reward.type === 'none' ? 'none' : 'ticket')}<span>${escapeHTML(title)}</span><small>${reward.type === 'none' ? '未中奖' : '× 1'}</small></div>`;
  }).join('')}</div></article>`;
}

export function legacyFixture() {
  const at = CARD_START + 2 * 86400000 + 10 * 3600000;
  const vouchers = [
    {id:'sample-card-voucher-used',type:'voucher',at,expiresAt:at + 7 * 86400000,used:true},
    {id:'sample-card-voucher-expired',type:'voucher',at,expiresAt:at + 7 * 86400000,used:false},
  ];
  return {
    version:1,uid:'sample-card-user',registeredAt:CARD_START,welcome:{at,expiresAt:at + 86400000,used:true},ordinary:2,
    days:{},events:[],invites:[],physicalWon:true,addresses:{},
    ledger:[
      {id:'sample-use-ordinary',source:'普通单抽',amount:-1,at:at + 3600000,type:'ordinary'},
      {id:'sample-use-welcome',source:'新人五连抽',amount:-5,at:at + 1000,type:'welcome'},
      {id:'sample-grant-ordinary',source:'专家鉴定',amount:3,at,type:'ordinary'},
      {id:'sample-grant-welcome',source:'新人礼包',amount:5,at,type:'welcome'},
    ],
    draws:[
      {id:'sample-batch-ordinary',pool:'ordinary',at:at + 3600000,rewards:[{...vouchers[1]}]},
      {id:'sample-batch-welcome',pool:'welcome',at:at + 1000,rewards:[
        {id:'sample-card-physical',type:'physical',prizeId:'coin',at},
        {...vouchers[0]},
        ...Array.from({length:3},(_,i) => ({id:`sample-card-voucher-${i}`,type:'voucher',at,expiresAt:at + 7 * 86400000,used:false})),
      ]},
    ],
    vouchers:[...vouchers,...Array.from({length:3},(_,i) => ({id:`sample-card-voucher-${i}`,type:'voucher',at,expiresAt:at + 7 * 86400000,used:false}))],
  };
}

// Read the old session as it was stored. Neither rendering nor switching events
// changes its key, dates, clock mode, balances, addresses, or historical records.
export function readLegacy(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(CARD_KEY));
    const state = saved?.state;
    if(state?.version === 1 && Array.isArray(state.draws) && Array.isArray(state.ledger)) {
      return {state:{...state,vouchers:state.vouchers || [],addresses:state.addresses || {}},isDemo:false};
    }
  } catch {}
  return {state:legacyFixture(),isDemo:true};
}

export function legacyInventory(state) {
  const inventory = cardTicketInventory(state, Math.max(CARD_END, Date.now()));
  return {...inventory, used:inventory.lots.filter(lot => lot.used > 0)};
}

export function ticketRows(inventory, status='unused') {
  const lots = inventory[status] || [];
  if(!lots.length)return empty(status === 'used' ? '还没有使用记录' : status === 'expired' ? '暂无已过期抽奖券' : '暂无未使用抽奖券', status === 'unused' ? '完成活动品类的专家鉴定，积累下一次好运。' : '每一张抽奖券的去向，都保留在这里。');
  return `<div class="ac-list">${lots.map(lot => {
    const pool = lot.pool || lot.type;
    const amount = status === 'used' ? lot.used : lot.remaining;
    return `<article class="ac-list-row is-${status}"><span class="ac-list-icon ${pool === 'advanced' ? 'is-gold' : ''}">${icon(pool === 'advanced' ? 'crown' : 'ticket')}</span><div class="ac-list-copy"><strong>${poolName(pool)}</strong><p>${escapeHTML(lot.source)} · ${time(lot.at)}<br>${lot.sourceKey === 'daily' ? '每日赠券 · 当天有效' : `有效至 ${date(lot.expiresAt - 1)}`}</p></div><div class="ac-list-value">${status === 'used' ? `已使用 ${amount}` : status === 'expired' ? `已过期 ${amount}` : amount}<small>张</small></div></article>`;
  }).join('')}</div>`;
}

export function prizeMarkup(reward, state, now, legacy=false) {
  const physical = reward.type === 'physical';
  const list = legacy ? CARD_PRIZES : PRIZES;
  const prize = list.find(item => item.id === reward.prizeId);
  const voucher = (state.vouchers || []).find(item => item.id === reward.id) || reward;
  const used = Boolean(voucher.used), expired = !used && now >= (voucher.expiresAt ?? VOUCHER_END);
  const title = physical ? prize?.name || '实物奖品' : '专家鉴定券';
  const address = state.addresses?.[reward.id];
  const status = physical ? address ? '已填写收货信息' : '待完善收货信息' : used ? '已使用' : expired ? '已过期' : '可使用';
  const visual = physical && legacy ? icon('gift') : prizeArt(physical ? reward.prizeId : 'voucher');
  return `<article class="ac-prize-card ${physical ? 'is-physical' : ''}"><div class="ac-prize-main"><div class="ac-prize-art">${visual}</div><div><small>${physical ? '实物好礼' : '免费专家鉴别 · 1 次'}</small><h3>${escapeHTML(title)}</h3><p>${physical ? `${escapeHTML(prize?.spec || '1 份')} · ${legacy ? '卡牌第一期' : poolName(reward.pool)}` : `有效至 ${date((voucher.expiresAt ?? VOUCHER_END) - 1)}`}</p><span class="ac-prize-badge ${used || expired ? 'is-dim' : ''}">${status}</span></div></div>
    ${address ? `<div class="ac-address-summary"><strong>${escapeHTML(address.name)} · ${escapeHTML(String(address.phone || '').replace(/^(\d{3})\d{4}(\d{4})$/,'$1****$2'))}</strong><p>${escapeHTML(address.region)} ${escapeHTML(address.detail)}</p></div>` : ''}
    ${physical && !legacy ? button(address ? '修改收货信息' : '填写收货信息',`address:${reward.id}`,'ac-gold') : !physical && !used && !expired && !legacy ? button('去使用','go-expert','ac-secondary') : ''}
    <div class="ac-prize-source"><span>${legacy ? '卡牌第一期' : '专鉴扭蛋活动'} · ${poolName(reward.pool)}</span><span>${time(reward.at)}</span></div></article>`;
}

let currentEvent = 'expert', route = 'lottery', selectedPool = 'ordinary', detailTab = 'tickets', ticketStatus = 'unused', prizeFilter = 'all';
let ui = null, toastTimer = null, lastFocus = null, renderQueued = false, drawing = false;
const $ = id => document.getElementById(id);
const legacyData = () => readLegacy(globalThis.localStorage);

function eventSwitch() {
  return `<div class="ac-event-switch" role="tablist" aria-label="选择活动">${[
    ['expert','专鉴扭蛋活动','10.27 — 11.10'],
    ['card-past','卡牌第一期','已结束 · 查记录'],
    ['card-next','卡牌下一期','敬请期待'],
  ].map(([id,label,note]) => `<button role="tab" aria-selected="${currentEvent === id}" data-action="event:${id}">${label}<small>${note}</small></button>`).join('')}</div>`;
}

function detailTabs() {
  return `<div class="ac-detail-tabs" role="tablist" aria-label="活动详情">${[['tickets','我的抽奖券'],['records','抽奖记录'],['rules','奖池与规则']].map(([key,label]) => `<button role="tab" aria-selected="${detailTab === key}" data-action="detail:${key}">${label}</button>`).join('')}</div>`;
}

function ticketFilters(inventory) {
  return `<div class="ac-filter-row" aria-label="抽奖券状态">${[['unused','未使用'],['used','已使用'],['expired','已过期']].map(([key,label]) => `<button aria-pressed="${ticketStatus === key}" data-action="ticket:${key}">${label} ${inventory.counts[key] || 0}</button>`).join('')}<span class="ac-filter-spacer"></span><button data-action="earning-history">获得记录</button></div>`;
}

function eventRules(state) {
  return `<div class="ac-rules"><h3>参与规则</h3><ol>
    <li>活动时间为 2026 年 10 月 27 日 00:00 至 11 月 11 日 00:00（北京时间）。11 月 11 日当天已结束。</li>
    <li>美妆、包袋、鞋靴、服饰、手表、数码3C 专家鉴定提交成功后计入活动。累计每 2 单送 1 张普通抽奖券，每 10 单送 1 张高级抽奖券，该节点不同时赠送普通券。跨天累计，无上限。</li>
    <li>每天首次进入自动赠送 1 张普通抽奖券，仅当天有效，未使用不延续到次日。鉴定获得的抽奖券在活动结束时失效，使用时优先消耗即将到期的券。</li>
    <li>先选择券种，再单次或五次抽取。五连扭蛋消耗 5 张同类券，普通券与高级券不能混用。</li>
    <li>本活动普通池与高级池合计，每位用户最多获得 1 次实物奖品，与卡牌活动独立。各池内有库存的实物等概率抽取。实物全部抽完或用户已中过实物时，实物概率转为鉴定券：鉴定券 80%，再接再厉 20%。</li>
    <li>抽中的专家鉴定券每张可兑换 1 次免费专鉴，统一有效至 2026 年 12 月 12 日 23:59:59。</li>
    <li>鉴真王者、避雷王者分别按活动期间出具的专家鉴真、鉴假结果计数。并列时先达到该单数者在前。鉴真榜前三名每人获 200 元现金红包与称号，避雷榜前三名每人获称号及不限品类、次数的终身免费专鉴权益。同一用户可同时获得两榜奖励。</li>
  </ol><p>奖品图片为展示效果，具体规格以后续活动说明为准。当前为交互体验版，鉴定、抽奖及榜单均为演示数据。</p></div>`;
}

function poolRules(state) {
  return ['advanced','ordinary'].map(pool => `<section><header class="ac-pool-head ${pool === 'advanced' ? 'is-advanced' : ''}">${icon(pool === 'advanced' ? 'crown' : 'ticket')}<h3>${pool === 'advanced' ? '高级' : '普通'}奖池</h3><small>使用${poolName(pool)}</small></header><div class="ac-product-grid">${PRIZES.filter(prize => prize.pool === pool).map(prize => `<article class="ac-product" data-pool="${pool}"><div class="ac-product-art">${prizeArt(prize.id)}</div><strong>${escapeHTML(prize.name)}</strong><small>${prize.quantity == null ? '精选小样 · 规格待公布' : `活动限量 ${prize.quantity} 份${state.stocks?.[prize.id] === 0 ? ' · 已抽完' : ''}`}</small></article>`).join('')}</div><div class="ac-probabilities ${pool === 'advanced' ? 'is-advanced' : ''}"><span><strong>${pool === 'advanced' ? '5' : '8'}%</strong>实物好礼</span><span><strong>${pool === 'advanced' ? '75' : '72'}%</strong>专家鉴定券</span><span><strong>20%</strong>再接再厉</span></div></section>`).join('') + eventRules(state);
}

function progress(state) {
  const count = eligibleOrderCount(state), next = count + (2 - count % 2);
  return `<section class="ac-progress-card"><div class="ac-section-title"><h2>认真鉴别，好运再近一步</h2><button class="ac-link" data-action="go-expert">去专鉴 ${icon('arrow')}</button></div>${ui?.progressMarkup ? ui.progressMarkup(state,{compact:true}) : `<div class="ac-progress-summary"><strong>${count}</strong><span>单累计鉴定</span></div><div class="ac-mini-track"><i style="width:${count % 10 * 10}%"></i></div><p>再鉴定 ${next-count} 单，获得 1 张${next % 10 === 0 ? '高级' : '普通'}抽奖券</p>`}</section>`;
}

function expertLottery(state, now) {
  const balance = balances(state,now), count = balance[selectedPool], started = active(now);
  const inventory = ticketInventory(state,now);
  const body = detailTab === 'tickets' ? ticketFilters(inventory) + ticketRows(inventory,ticketStatus) : detailTab === 'records' ? state.draws.length ? state.draws.map(batch => recordMarkup(batch)).join('') : empty('下一份好运，等你开启','每次扭蛋的完整结果都会记录在这里。') : poolRules(state);
  return `<section class="ac-hero"><div class="ac-hero-orbit" aria-hidden="true"></div><div class="ac-eyebrow">图灵专鉴 · 双十一限时活动</div><h2>每一份认真<br><em>都有好运回应</em></h2><p>免费专鉴，解锁你的下一颗惊喜。</p></section>
    <div class="ac-date-row"><span>10.27 00:00 — 11.11 00:00</span><span class="ac-status-dot">${now < START ? '即将开始' : now >= END ? '活动已结束' : '活动进行中'}</span></div>
    <section aria-label="选择抽奖券"><div class="ac-section-title"><h2>选择一张好运入场券</h2><small>不同券种，对应不同奖池</small></div><div class="ac-pools">${['ordinary','advanced'].map(pool => `<button class="ac-ticket" data-pool="${pool}" data-action="pool:${pool}" aria-pressed="${selectedPool === pool}">${selectedPool === pool ? `<span class="ac-ticket-selected">${icon('check')}</span>` : ''}<span class="ac-ticket-label">${icon(pool === 'advanced' ? 'crown' : 'ticket')}${poolName(pool)}</span><strong class="ac-ticket-number">${balance[pool]}<small>张可用</small></strong><span class="ac-ticket-note">${pool === 'advanced' ? 'YSL / COACH 等品质好礼' : '精选小样 / 免费鉴定券'}</span></button>`).join('')}</div>
    <p class="ac-expiry-note">${icon('clock')}${balance.daily ? `<span>含 <strong>${balance.daily} 张今日赠券</strong>，今日有效，优先使用</span>` : '<span>鉴定获得的抽奖券，活动结束时失效</span>'}</p>
    <div class="ac-draw-actions">${button('扭一次<small>消耗 1 张' + (selectedPool === 'advanced' ? '高级券' : '普通券') + '</small>','draw:1','ac-secondary',!started || count < 1)}${button('五连扭蛋<small>一次收获 5 份惊喜</small>','draw:5',selectedPool === 'advanced' ? 'ac-gold' : 'ac-primary',!started || count < 5)}</div>
    <p class="ac-draw-status">${!started ? now < START ? '活动开始后，可领取每日赠券并参与扭蛋' : '抽奖券已失效，历史记录与已得奖品仍可查看' : count < 1 ? '当前券种暂无可用券，去专鉴积累好运' : count < 5 ? '五连扭蛋需 5 张同类券，当前还差 ' + (5-count) + ' 张' : '五颗扭蛋，一起揭晓 · 普通券与高级券不混用'}</p></section>
    ${progress(state)}<button class="ac-benefit-strip" data-action="ranking"><span class="ac-benefit-icon">${icon('crown')}</span><span><strong>鉴真王者 & 避雷王者</strong><small>冲刺前三，赢现金红包与终身专鉴权益</small></span>${icon('arrow')}</button>
    ${detailTabs()}<section aria-label="活动记录与规则">${body}</section>`;
}

function oldLottery() {
  const {state,isDemo} = legacyData(), inventory = legacyInventory(state);
  const prizes = earnedPrizes(state);
  const oldRules = `<div class="ac-rules"><h3>第一期活动已结束</h3><ol><li>活动时间：2026 年 9 月 25 日至 10 月 8 日 00:00。所有剩余抽奖券均已失效，不可继续抽奖或转入新活动。</li><li>第一期新人五连抽、鉴定赠券、分享和邀请的历史记录保留展示。已获得的鉴定券仍按原记录的到期时间展示。</li><li>实物中奖和收货信息保留在「我的奖品」，与本期专鉴活动分别管理。</li></ol></div><div class="ac-product-grid" style="margin-top:18px">${CARD_PRIZES.map(prize => `<article class="ac-product"><div class="ac-product-art">${icon('gift')}</div><strong>${escapeHTML(prize.name)}</strong><small>${escapeHTML(prize.spec)}</small></article>`).join('')}</div>`;
  return `<div class="ac-history-banner">${icon('clock')}<div><strong>第一期已结束，好运记录仍在</strong><p>2026.09.25 — 10.08<br>抽奖券已失效，中奖记录与收货信息保留。</p></div></div>${isDemo ? '<p class="ac-demo-note">尚无你的第一期记录，以下为历史数据展示示例。</p>' : ''}<div class="ac-history-stats"><div><strong>${inventory.counts.expired}</strong><span>已过期抽奖券</span></div><div><strong>${inventory.counts.used}</strong><span>累计使用</span></div><div><strong>${prizes.length}</strong><span>累计奖品</span></div></div>${button('查看第一期奖品','route-prizes','ac-secondary')}${detailTabs()}${detailTab === 'tickets' ? ticketFilters(inventory)+ticketRows(inventory,ticketStatus) : detailTab === 'records' ? state.draws.map(batch => recordMarkup(batch,CARD_PRIZES)).join('') || empty('还没有第一期抽奖记录','该期已有的记录会保留在这里。') : oldRules}`;
}

function nextLottery() {
  return `<section class="ac-upcoming"><div class="ac-next-visual">${icon('cards')}</div><div class="ac-eyebrow" style="justify-content:center">卡牌收藏季</div><h2>下一场好运<br>值得一起期待</h2><p>新一期卡牌活动尚未开始。<br>开启后可在这里查看规则、领取抽奖券。<br>上一期记录继续为你保留。</p>${button('先去参加专鉴活动','event:expert','ac-primary')}<div class="ac-upcoming-features"><span>${icon('gift')}新人五连抽</span><span>${icon('shield')}卡牌 AI / 专家鉴定获券</span><span>${icon('ticket')}分享与邀请好礼</span></div><p class="ac-page-note">具体开放时间与规则以后续活动公告为准</p></section>`;
}

function prizesPage(state, now) {
  if(currentEvent === 'card-next')return nextLottery();
  const legacy = currentEvent === 'card-past';
  const old = legacy ? legacyData() : null;
  if(legacy)state = old.state;
  const all = earnedPrizes(state), rewards = all.filter(reward => prizeFilter === 'all' || reward.type === prizeFilter);
  return `<header class="ac-prizes-heading"><div><h2>收下你的好运</h2><p>${legacy ? '卡牌第一期 · 历史奖品' : '专鉴活动 · 你的每份认真都有回响'}</p></div><div class="ac-prize-count">${all.length}<small>份累计奖品</small></div></header>${legacy && old.isDemo ? '<p class="ac-demo-note">以下为第一期历史记录展示示例。</p>' : ''}<div class="ac-filter-row" aria-label="奖品类型">${[['all','全部奖品'],['physical','实物好礼'],['voucher','鉴定券']].map(([key,label]) => `<button data-action="prize:${key}" aria-pressed="${prizeFilter === key}">${label} ${all.filter(item => key === 'all' || item.type === key).length}</button>`).join('')}</div>${rewards.length ? rewards.map(reward => prizeMarkup(reward,state,legacy ? Math.max(CARD_END,Date.now()) : now,legacy)).join('') : empty('你的好运正在路上','抽中的实物和鉴定券会出现在这里。',button('去抽奖中心','route-lottery','ac-secondary'))}<p class="ac-page-note">${legacy ? '历史奖品保留原有期限 · 本页只展示第一期记录' : '鉴定券有效至 12 月 12 日 · 再接再厉不计入奖品数量'}</p>`;
}

function render() {
  if(!$('ac-content'))return;
  const state = loadEvent(), now = eventNow();
  $('ac-title').textContent = route === 'prizes' ? '我的奖品' : '抽奖中心';
  document.title = `${$('ac-title').textContent} · 图灵鉴X`;
  document.querySelectorAll('.ac-bottom-nav button').forEach(node => node.setAttribute('aria-current', node.dataset.action === `route-${route}` ? 'page' : 'false'));
  $('ac-content').innerHTML = eventSwitch() + (route === 'prizes' ? prizesPage(state,now) : currentEvent === 'expert' ? expertLottery(state,now) : currentEvent === 'card-past' ? oldLottery() : nextLottery());
  ui?.focusProgress?.($('ac-content'));
}

function scheduleRender() {
  if(renderQueued)return;
  renderQueued = true;
  requestAnimationFrame(() => {renderQueued=false;render();});
}

function navigate(next, notify=true) {
  route = next === 'prizes' ? 'prizes' : 'lottery';
  history.replaceState(null,'',`#${route}`);
  if(notify)window.jianxRoute?.(route);
  render();
  window.scrollTo({top:0,behavior:'auto'});
}

function toast(message) {
  $('ac-toast').textContent = message;
  $('ac-toast').classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('ac-toast').classList.remove('is-visible'),2800);
}

function modal(title, content) {
  lastFocus = document.activeElement;
  $('ac-dialog').innerHTML = `<header class="ac-dialog-head"><h2 id="ac-dialog-title">${title}</h2><button class="ac-icon-button" data-action="close" aria-label="关闭弹窗">${icon('close')}</button></header><div class="ac-dialog-body">${content}</div>`;
  if(!$('ac-dialog').open)$('ac-dialog').showModal();
}

function closeModal() {
  $('ac-dialog').close();
  lastFocus?.focus?.();
}

function showEarnings() {
  const inventory = currentEvent === 'card-past' ? legacyInventory(legacyData().state) : ticketInventory(loadEvent(),eventNow());
  modal('抽奖券获得记录', inventory.lots.length ? `<div class="ac-list">${inventory.lots.map(lot => `<article class="ac-list-row"><span class="ac-list-icon ${(lot.pool || lot.type) === 'advanced' ? 'is-gold' : ''}">${icon('ticket')}</span><div class="ac-list-copy"><strong>${escapeHTML(lot.source)}</strong><p>${poolName(lot.pool || lot.type)} · ${time(lot.at)}<br>已使用 ${lot.used || 0} 张 · ${lot.expiresAt <= (currentEvent === 'card-past' ? Date.now() : eventNow()) ? '已过期' : '剩余'} ${lot.remaining} 张</p></div><div class="ac-list-value">+${lot.total ?? lot.amount}<small>张</small></div></article>`).join('')}</div>` : empty('暂无获券记录','每日赠券与鉴定奖励都会记录在这里。'));
}

function showAddress(id) {
  if(currentEvent !== 'expert')return;
  const state = loadEvent(), reward = earnedPrizes(state).find(item => item.id === id && item.type === 'physical');
  if(!reward)return;
  const address = state.addresses[id] || {};
  modal('收下这份好礼', `<p>填写收货信息，保存后可随时修改。</p><form class="ac-address-form" id="ac-address-form" novalidate data-prize-id="${escapeHTML(id)}">${[['name','收货人','请输入收货人姓名'],['phone','手机号码','请输入 11 位手机号'],['region','所在地区','省 / 市 / 区'],['detail','详细地址','街道、小区与门牌号']].map(([key,label,placeholder]) => `<label class="ac-field">${label}<input name="${key}" value="${escapeHTML(address[key] || '')}" placeholder="${placeholder}" ${key === 'phone' ? 'inputmode="tel" maxlength="11"' : 'maxlength="100"'} autocomplete="off" required aria-describedby="ac-error-${key}"><span class="ac-field-error" id="ac-error-${key}"></span></label>`).join('')}<button type="button" class="ac-link" data-action="sample-address">填入演示地址</button><p class="ac-form-note">体验版请使用演示地址。信息仅保存在当前浏览器。</p><button type="submit" class="ac-primary">保存收货信息</button></form>`);
}

function claimForToday() {
  const result = claimDaily(loadEvent(),eventNow());
  if(result.awarded)saveEvent(result.state);
}

async function handleAction(action) {
  if(action === 'back'){window.jianxNavigate?.('expert',{intent:'gacha'});return;}
  if(action.startsWith('route-')){navigate(action.slice(6));return;}
  if(action.startsWith('event:')){currentEvent=action.slice(6);ticketStatus=currentEvent === 'card-past' ? 'expired' : 'unused';detailTab='tickets';prizeFilter='all';render();return;}
  if(action.startsWith('pool:')){selectedPool=action.slice(5);render();return;}
  if(action.startsWith('detail:')){detailTab=action.slice(7);render();return;}
  if(action.startsWith('ticket:')){ticketStatus=action.slice(7);render();return;}
  if(action.startsWith('prize:')){prizeFilter=action.slice(6);render();return;}
  if(action === 'go-expert'){window.jianxNavigate?.('expert',{intent:'open-expert'});return;}
  if(action === 'close'){closeModal();return;}
  if(action === 'earning-history'){showEarnings();return;}
  if(action.startsWith('address:')){showAddress(action.slice(8));return;}
  if(action === 'sample-address'){
    const form = $('ac-address-form');
    for(const [key,value] of Object.entries({name:'体验用户',phone:'13800000000',region:'北京市 朝阳区',detail:'演示街道 100 号（不用于配送）'}))form.elements[key].value = value;
    return;
  }
  if(action === 'ranking'){
    ui ||= await import('./expert-event-ui.js');
    ui.openLeaderboard();
    return;
  }
  if(action.startsWith('draw:') && currentEvent === 'expert' && !drawing){
    const count = Number(action.slice(5)), state = loadEvent(), now = eventNow();
    if(![1,5].includes(count) || !active(now) || balances(state,now)[selectedPool] < count){toast('当前券种可用抽奖券不足');render();return;}
    drawing = true;
    try{ui ||= await import('./expert-event-ui.js');await ui.openDraw({pool:selectedPool,count,onChange:scheduleRender});}
    finally{drawing=false;scheduleRender();}
  }
}

async function boot() {
  route = location.hash.slice(1) === 'prizes' ? 'prizes' : 'lottery';
  document.addEventListener('click',event => {
    const target = event.target.closest('[data-action]');
    if(target && !target.disabled)handleAction(target.dataset.action).catch(() => toast('暂时无法打开，请稍后重试'));
  });
  document.addEventListener('submit',event => {
    if(event.target.id !== 'ac-address-form')return;
    event.preventDefault();
    const form = event.target, address = Object.fromEntries(new FormData(form));
    Object.keys(address).forEach(key => address[key] = address[key].trim());
    const errors = validateAddress(address);
    Object.entries(errors).forEach(([key,message]) => {$(`ac-error-${key}`).textContent=message;form.elements[key].setAttribute('aria-invalid',String(Boolean(message)));});
    if(Object.values(errors).some(Boolean)){form.querySelector('[aria-invalid="true"]')?.focus();return;}
    const state = loadEvent(), id = form.dataset.prizeId;
    if(!earnedPrizes(state).some(reward => reward.id === id && reward.type === 'physical')){toast('未找到对应奖品');closeModal();return;}
    state.addresses[id] = address;
    saveEvent(state);
    closeModal();
    toast('收货信息已保存，可随时修改');
  });
  $('ac-dialog').addEventListener('click',event => {if(event.target === $('ac-dialog'))closeModal();});
  window.addEventListener('expert-event-change',scheduleRender);
  window.addEventListener('storage',event => {if(event.key === CARD_KEY)scheduleRender();});
  window.addEventListener('hashchange',() => navigate(location.hash.slice(1),false));
  window.addEventListener('jianx-shell',event => {
    const message = event.detail;
    if(message.type === 'visibility' && !message.active){if($('ac-dialog').open)closeModal();return;}
    if(message.type === 'visibility' && message.active){claimForToday();scheduleRender();}
    if(message.type !== 'activate')return;
    if(['expert','card-past','card-next'].includes(message.event))currentEvent = message.event;
    if(['ordinary','advanced'].includes(message.pool))selectedPool = message.pool;
    claimForToday();
    navigate(message.route,false);
    if(message.route === 'ranking')handleAction('ranking');
  });
  document.addEventListener('visibilitychange',() => {if(!document.hidden && window.jianxActive !== false){claimForToday();scheduleRender();}});
  claimForToday();
  render();
  window.jianxReady?.();
  try{ui=await import('./expert-event-ui.js');render();if(location.hash === '#ranking')ui.openLeaderboard();}catch{}
}

if(typeof document !== 'undefined')boot();
