import {START,END,DAY,active,dayKey,balances,claimDaily,submitOrder,completeOrder,isEligibleCategory} from './expert-event-model.js';
import {loadEvent,saveEvent,eventNow,setEventClock,resetEvent} from './expert-event-session.js';
import {machineMarkup,mountMachine,prizeArt} from './capsule-machine.js';
import {progressMarkup,focusProgress,openDraw,openProgress,openLeaderboard,openRules,showEventDialog,closeEventDialog,eventCount,icon,escapeHtml as esc} from './expert-event-ui.js';

const $=id=>document.getElementById(id);
let homePool='ordinary',homeMachine=null,flow=null,reportId=null,product=null,submitting=false,aiTimer=null;
const categoryNames='美妆 / 包袋 / 鞋靴 / 服饰 / 手表 / 数码 3C';
const section=document.createElement('section');section.id='expertEvent';section.className='eh-event';
$('expertHome').append(section);

function renderHome(){
 const s=loadEvent(),now=eventNow(),balance=balances(s,now),n=eventCount(s),enabled=active(now);
 homeMachine?.destroy();
 section.innerHTML=`<div class="eh-section-top"><span class="ev-eyebrow"><i></i> 专鉴有礼 · 限时活动</span><button class="ev-text-button" data-eh="rules">规则 ${icon('arrow')}</button></div>
 <div class="eh-event-title"><div><h2>鉴别每一份热爱<br><em>扭出一份惊喜</em></h2><p>10.27 — 11.10 · 六大品类免费专鉴</p></div><button class="eh-rank-entry" data-eh="ranking">${icon('crown')}<strong>王者榜</strong><span>上榜有礼 ${icon()}</span></button></div>
 <div class="eh-machine-panel">
 <div class="eh-pool-switch"><button data-pool="ordinary" aria-selected="${homePool==='ordinary'}">${icon('ticket')}普通奖池</button><button data-pool="advanced" aria-selected="${homePool==='advanced'}">${icon('crown')}高级奖池</button></div>
 <div class="eh-machine">${machineMarkup({pool:homePool})}</div>
 <div class="eh-prize-caption">${homePool==='advanced'?'YSL 气垫 · COACH · 雷蛇耳机':'美妆小样 · 护肤品小样 · 香水小样'}<span>实物好礼与专家鉴定券</span></div>
 <div class="eh-ticket-balance"><span>${icon('ticket')}可用${homePool==='advanced'?'高级':'普通'}券 <b>${balance[homePool]}</b> 张</span><button data-eh="center">我的抽奖券 ${icon()}</button></div>
 <div class="eh-draw-buttons"><button class="ev-secondary" data-draw="1" ${!enabled||balance[homePool]<1?'disabled':''}><strong>${balance.daily&&homePool==='ordinary'?'免费扭一次':'扭一次'}</strong><small>使用 1 张${homePool==='advanced'?'高级':'普通'}券</small></button><button class="ev-primary ${homePool==='advanced'?'eh-premium-button':''}" data-draw="5" ${!enabled||balance[homePool]<5?'disabled':''}><strong>五次一起扭</strong><small>使用 5 张同种券</small></button></div>
 <div class="eh-daily-note">${icon('clock')} ${!enabled?(now<START?'活动尚未开始':'活动已结束，记录仍可查看'):balance.daily?'今日赠送的 1 张普通券，今天记得用掉':'每天自动领 1 张普通券，当天有效'}</div>
 </div>
 <div class="eh-home-progress">${progressMarkup(s)}</div>
 <button class="ev-primary eh-go-expert" data-eh="expert"><span>${enabled?'限时免费，去专鉴':'免费，去专鉴'}</span>${icon()}</button>
 <p class="eh-scope">${enabled?'每 2 单得普通券，每 10 单得高级券':now<START?'活动开始后，参与品类的专鉴可累计奖励':'活动已结束，仍可免费专鉴'}<br><span>${categoryNames}</span></p>
 <button class="eh-ranking-banner" data-eh="ranking"><span class="eh-medal">${icon('crown')}</span><span><strong>认真鉴别，也能成为王者</strong><small>200 元现金红包 · 终身免费专鉴</small></span>${icon()}</button>
 <div class="eh-footer"><span>交互演示 · ${new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit'}).format(now)}</span><button data-eh="demo">切换演示场景</button></div>`;
 homeMachine=mountMachine(section.querySelector('.gm-machine'));
 section.querySelectorAll('[data-pool]').forEach(b=>b.onclick=()=>{homePool=b.dataset.pool;renderHome();});
 section.querySelectorAll('[data-draw]').forEach(b=>b.onclick=()=>openDraw({pool:homePool,count:Number(b.dataset.draw)}));
 section.querySelectorAll('[data-eh]').forEach(b=>b.onclick=()=>{
  const a=b.dataset.eh;if(a==='rules')openRules();if(a==='ranking')openLeaderboard();
  if(a==='expert')window.openExpertSelection();if(a==='center')window.jianxNavigate('lottery');if(a==='demo')openDemo();
 });
 focusProgress(section);if(!window.jianxActive)homeMachine.destroy();
}
function enterEvent({scroll=false}={}){
 const r=claimDaily(loadEvent(),eventNow());if(r.awarded)saveEvent(r.state);else renderHome();
 if(scroll)requestAnimationFrame(()=>section.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'}));
 const now=eventNow(),guide=r.state.tickets.find(ticket=>ticket.firstGuide&&ticket.remaining>0&&ticket.at<=now&&ticket.expiresAt>now);
 if(active(now)&&guide&&r.state.guideShownTicketId!==guide.id){
  saveEvent({...r.state,guideShownTicketId:guide.id});
  const d=showEventDialog('今天的好运，从这里开始',`<div class="eh-guide"><div class="eh-guide-ticket">${prizeArt('voucher')}</div><span class="ev-eyebrow">每日免费礼遇</span><h2>送你一次免费扭蛋</h2><p>1 张普通抽奖券已到账<br>今日有效，先试试你的手气</p><button class="ev-primary" data-guide>免费扭一次 ${icon()}</button><button class="ev-text-button ev-full" data-later>稍后再用</button></div>`);
  d.querySelector('[data-guide]').onclick=()=>{d.close();openDraw({pool:'ordinary',count:1});};d.querySelector('[data-later]').onclick=()=>d.close();
 }
}
function eventHomeVisible(){
 return !document.hidden&&window.jianxActive!==false&&!$('expertHome').hidden&&!flow&&$('expertPickerRoot')?.hidden!==false;
}
function refreshVisibleEvent(){
 if(eventHomeVisible())enterEvent();
 else if(!document.hidden&&window.jianxActive!==false){renderHome();if(flow?.querySelector('.eh-convert-card'))renderAI();}
}
window.openExpertSelection=()=>{
 closeEventDialog();closeFlow();window.jianxSetTab?.('expert');window.expertPicker?.open();
};
window.onExpertSelected=selection=>openUpload(selection);
window.jianxShowBeautyDemo=()=>{
 clearTimeout(aiTimer);closeFlow();flow=makeFlow('AI 鉴别');
 flow.querySelector('.eh-flow-body').innerHTML=`<div class="eh-ai-loading"><div class="eh-loading-orbit">${icon('shield')}</div><h2>正在观察商品细节</h2><p>识别包装、工艺与印刷特征</p></div>`;
 aiTimer=setTimeout(()=>renderAI(),700);
};
function makeFlow(title){
 const el=document.createElement('section');el.className='eh-flow';el.setAttribute('aria-label',title);
 el.innerHTML=`<header class="eh-flow-nav"><button class="ev-icon-button" data-flow-back aria-label="返回">${icon('back')}</button><strong>${esc(title)}</strong><span>演示</span></header><div class="eh-flow-body"></div>`;
 for(const child of $('app').children)child.inert=true;
 $('app').append(el);el.querySelector('[data-flow-back]').onclick=()=>closeFlow();el.querySelector('[data-flow-back]').focus({preventScroll:true});return el;
}
function closeFlow(){clearTimeout(aiTimer);flow?.remove();flow=null;reportId=null;submitting=false;for(const child of $('app').children)child.inert=false;queueMicrotask(()=>{if(eventHomeVisible())enterEvent();});}
function renderAI(){
 if(!flow)return;
 product={category:'美妆',brand:'圣罗兰 YSL',style:'气垫粉底',name:'圣罗兰 · 气垫粉底'};
 const s=loadEvent(),enabled=active(eventNow());
 flow.querySelector('.eh-flow-body').innerHTML=`<article class="eh-ai-report"><div class="eh-product-top"><span><small>YSL · SAINT LAURENT</small><h2>圣罗兰气垫粉底</h2><p>AI 鉴别报告</p></span>${prizeArt('ysl-cushion')}</div><div class="eh-ai-verdict"><span>${icon('shield')} 正品特征</span><b>75.3<small>%</small></b><p>AI 把握度 · 演示结果</p><div><i></i></div></div><p class="eh-ai-desc">当前图片的包装、标识与工艺呈现正品特征。进一步确认，建议交由专家结合更多细节综合鉴别。</p><div class="eh-ai-metrics"><span>图片完整度 <b>73.2%</b></span><span>已观察点位 <b>4 个</b></span></div></article>
 <article class="eh-convert-card"><div class="eh-convert-glow"></div><div class="eh-convert-top"><span class="eh-expert-badge">${icon('shield')}</span><div><span class="ev-eyebrow">更进一步，交给专业</span><h2>专家一对一鉴别</h2></div><span class="eh-free-badge">${enabled?'限时':'专鉴'}<br><b>免费</b></span></div><p>专家复核关键细节，为你的选择多一份依据。</p>${enabled?`<div class="eh-benefits"><span>${icon('gift')}专鉴还可抽好礼</span><span>2 单得券 · 10 单升级</span></div>${progressMarkup(s,{compact:true})}`:''}<button class="ev-primary" data-ai-expert>${enabled?'免费专鉴，继续攒好运':'免费专鉴'} ${icon()}</button><small class="eh-convert-scope">${enabled?'本活动限美妆、包袋、鞋靴、服饰、手表、数码 3C':eventNow()<START?'专鉴有礼活动尚未开始，当前仍可免费专鉴':'专鉴有礼活动已结束，仍可免费专鉴'}</small></article>
 <p class="ev-demo-note">当前结果为流程演示，不构成真实鉴定结论。</p>`;
 flow.querySelector('[data-ai-expert]').onclick=()=>openUpload(product);
 focusProgress(flow);
}
function openUpload(selection={}){
 closeEventDialog();closeFlow();product={...selection,name:selection.name||[selection.brand,selection.style].filter(Boolean).join(' · ')||'待鉴定商品'};flow=makeFlow('图灵专鉴');
 const eligible=active(eventNow())&&isEligibleCategory(product.category),art=product.category==='美妆'?'ysl-cushion':/包袋/.test(product.category)?'coach-wallet':/手表/.test(product.category)?'coach-belt':/数码|3C/.test(product.category)?'razer-headphones':'ysl-cushion';
 flow.querySelector('.eh-flow-body').innerHTML=`<div class="eh-upload-notice">${icon('shield')}<span><strong>多角度细节，让判断更可靠</strong><small>按点位补充清晰实拍，交由专家综合鉴别</small></span><b>5 / 5</b></div>
 <div class="eh-selected-product"><div><small>${esc(product.category||'专家鉴定')}</small><h2>${esc(product.name)}</h2><p>专家一对一 · 在线鉴别</p></div>${prizeArt(art)}</div>
 <section class="eh-photo-card"><div class="eh-section-label"><strong>${icon('photo')} 鉴别点位</strong><span>5 个点位</span></div><p>照片为演示占位，已为你准备好所需点位</p><div class="eh-photo-grid">${['商品整体','品牌标识','工艺细节','底部信息','背面细节'].map((label,i)=>`<div class="eh-photo-item"><div style="--photo-angle:${i*12-20}deg">${prizeArt(art)}<i>${icon('check')}</i></div><span>${label}${i<2?'<em>必传</em>':''}</span></div>`).join('')}</div></section>
 <div class="eh-price-summary"><div>${icon('shield')}<span><strong>专家一对一鉴别</strong><small>全部品类免费专鉴</small></span></div><span><del>${selection.price?`¥${(selection.price/100).toFixed(2)}`:'¥4.99'}</del><b>¥0</b></span></div>
 ${eligible?'<div class="eh-order-benefit">本单参与专鉴有礼，提交成功即可累计进度</div>':''}
 <button class="ev-primary" data-submit>提交专家评估 ${icon('shield')}</button><p class="eh-agreement">提交即表示同意《图灵鉴X在线鉴别协议》</p>`;
 flow.querySelector('[data-submit]').onclick=()=>{
  if(submitting)return;submitting=true;const id=crypto.randomUUID();
  const r=submitOrder(loadEvent(),{id,category:product.category||'其他',product:product.name},eventNow());
  if(r.error){submitting=false;showEventDialog('提交未完成',`<p>${esc(r.error)}</p>`);return;}
  saveEvent(r.state);reportId=id;renderReport();submitting=false;if(r.order?.eligible)openProgress({reward:r.reward});
 };
}
function renderReport(){
 if(!flow||!reportId)return;
 const s=loadEvent(),order=s.orders.find(o=>o.id===reportId);if(!order)return;
 const resultLabel=order.result==='true'?'鉴真':order.result==='false'?'鉴假':order.result==='unknown'?'暂无法判断':'鉴别中';
 flow.querySelector('.eh-flow-nav strong').textContent='鉴别报告';
 flow.querySelector('.eh-flow-body').innerHTML=`<div class="eh-report-hero"><span class="ev-eyebrow">图灵专家鉴别报告</span><h1>${esc(product?.name||order.product)}</h1><p>${esc(order.category)} · 订单 ${esc(order.id.slice(-8).toUpperCase())}</p><span class="eh-report-status">${icon('shield')} ${order.result?'已完成':'专家已派单'}</span></div>
 <div class="eh-report-metrics"><span>服务方式<b>专家鉴别</b></span><span>鉴别状态<b>${resultLabel}</b></span><span>点位数量<b>5 个</b></span></div>
 <div class="eh-report-result"><div class="eh-section-label"><strong>图灵专家鉴别结果</strong><span>${order.result?'已完成':'已派单'}</span></div><div class="eh-result-shield ${order.result==='false'?'is-false':''}">${icon('shield')}</div><h2>${order.result?`专家结论：${resultLabel}`:'专家正在鉴别中'}</h2><p>${order.result?'当前为模拟结果，用于体验鉴别与榜单联动。':'评估完成后，你可以在此查看专家结论。'}</p></div>
 ${order.eligible?`<div class="eh-report-progress">${progressMarkup(s)}<button class="ev-secondary ev-full" data-report-progress>查看专鉴活动进度 ${icon()}</button></div>`:''}
 <details class="eh-demo-results"><summary>演示：生成专家结果</summary><p>仅用于体验报告与排行榜的联动</p><div>${[['true','鉴真'],['false','鉴假'],['unknown','无法判断']].map(([value,text])=>`<button data-result="${value}" ${order.result?'disabled':''}>${text}</button>`).join('')}</div></details>
 <button class="ev-primary" data-next-order>继续免费专鉴 ${icon()}</button>`;
 flow.querySelector('[data-report-progress]')?.addEventListener('click',()=>openProgress());
 flow.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>{
  const r=completeOrder(loadEvent(),reportId,b.dataset.result,eventNow());saveEvent(r.state);renderReport();
 });
 flow.querySelector('[data-next-order]').onclick=()=>window.openExpertSelection();focusProgress(flow);
}
function openDemo(){
 const d=showEventDialog('切换演示场景',`<div class="eh-demo-options"><p>选择场景体验不同的进度与状态。操作只影响当前浏览器的演示记录。</p>${[['new','重新体验首次免费'],['9','累计 9 单 · 下一单解锁高级券'],['14','累计 14 单 · 查看历史里程碑'],['50','累计 50 单 · 体验高级五连抽'],['next','模拟次日 · 检查每日赠券'],['end','活动结束 · 查看过期状态']].map(([key,label])=>`<button data-scene="${key}">${label}${icon()}</button>`).join('')}</div>`);
 d.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>{
  d.close();const mode=b.dataset.scene;
  if(mode==='new'){resetEvent();enterEvent({scroll:true});return;}
  if(mode==='next'){setEventClock(eventNow()+DAY);enterEvent();return;}
  if(mode==='end'){setEventClock(END+1000);renderHome();return;}
  resetEvent();let s=loadEvent();s=claimDaily(s,eventNow()).state;
  const sceneNow=eventNow();
  for(let i=0;i<Number(mode);i++){const at=sceneNow-(Number(mode)-i)*1000;const r=submitOrder(s,{id:`scenario-${mode}-${i}`,category:'美妆',product:'圣罗兰 · 气垫粉底'},at);s=r.state;if(i%3!==2)s=completeOrder(s,r.order.id,i%3===0?'true':'false',at+500).state;}
  // Clear only the demo introduction ticket for a milestone-focused scenario.
  const daily=s.tickets.find(t=>t.sourceKey==='daily');if(daily)daily.remaining=0;
  saveEvent(s);renderHome();section.scrollIntoView({behavior:'smooth',block:'start'});
 });
}
// Defer tab entry until the shell's intent handler has opened a picker or upload flow.
window.addEventListener('expert-tab-open',()=>queueMicrotask(()=>{if(eventHomeVisible())enterEvent();}));
window.addEventListener('expert-event-change',()=>{
 renderHome();if(flow?.querySelector('.eh-convert-card'))renderAI();if(reportId&&flow?.querySelector('.eh-report-hero'))renderReport();
});
window.addEventListener('jianx-shell',event=>{
 const m=event.detail;
 if(m.type==='visibility'&&!m.active){closeEventDialog();homeMachine?.destroy();}
 if(m.type==='activate'){
  if(m.route==='expert'){
   closeFlow();
   if(m.intent==='card-expert')openUpload({category:'卡牌',brand:'收藏卡',style:'专家鉴别',name:'收藏卡 · 专家鉴别'});
   else if(m.intent==='open-expert')window.openExpertSelection();
   else enterEvent({scroll:m.intent==='gacha'});
  }
  else if(m.route==='home')closeFlow();
 }
 if(m.type==='reset-chat')closeFlow();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)homeMachine?.destroy();else refreshVisibleEvent();});
let calendarState=`${dayKey(eventNow())}:${active(eventNow())}`;
setInterval(()=>{
 const next=`${dayKey(eventNow())}:${active(eventNow())}`;
 if(next!==calendarState){calendarState=next;refreshVisibleEvent();}
},30000);
renderHome();
if(window.parent===window&&new URLSearchParams(location.search).get('tab')==='expert')enterEvent();
