import {START,END,PRIZES,active,balances,draw,leaderboard,isEligibleCategory} from './expert-event-model.js';
import {loadEvent,saveEvent,eventNow} from './expert-event-session.js';
import {machineMarkup,mountMachine,prizeArt} from './capsule-machine.js';

export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const eventCount=state=>state.orders.filter(o=>o.uid===state.uid&&o.at>=START&&o.at<END&&o.eligible!==false&&isEligibleCategory(o.category)).length;
export const icon=(name='arrow')=>{
 const paths={arrow:'m9 5 7 7-7 7',back:'m15 5-7 7 7 7',close:'m6 6 12 12M18 6 6 18',ticket:'M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5ZM9 8v2m0 4v2',crown:'m3 7 5 4 4-7 4 7 5-4-2 12H5L3 7Z',shield:'m12 3 8 4v6c0 4-8 8-8 8s-8-4-8-8V7l8-4Zm-4 9 3 3 5-6',spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2',gift:'M3 8h18v5H3V8Zm2 5v8h14v-8M12 8v13M12 8C5 8 4 2 8 3c3 0 4 5 4 5s1-5 4-5c4-1 3 5-4 5Z',photo:'M4 4h16v16H4V4Zm0 12 5-5 4 4 3-3 4 4M15 7h1',check:'m5 12 4 4L19 6'};
 return `<svg class="ev-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="${paths[name]||paths.arrow}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
};
export function progressGeometry(count){
 const current=Math.max(0,Math.floor(Number(count)||0)),end=Math.max(10,Math.ceil((current+2)/10)*10);
 return {current,end,next:(Math.floor(current/2)+1)*2,nextHigh:(Math.floor(current/10)+1)*10,
  nodeCount:end/2+1,ratio:current/end,steps:Array.from({length:end/2},(_,i)=>(i+1)*2)};
}
export const rewardArt=(pool='ordinary',className='')=>`<img class="ev-reward-art ${escapeHtml(className)}" src="assets/gacha/reward-${pool==='advanced'?'advanced':'ordinary'}.png" alt="${pool==='advanced'?'高级金色抽奖券':'普通蓝紫抽奖券'}" loading="lazy" decoding="async" draggable="false">`;
export function progressMarkup(state,{compact=false}={}){
 const {current:n,end,next,nextHigh,nodeCount,ratio,steps}=progressGeometry(eventCount(state));
 return `<section class="ev-progress ${compact?'is-compact':''}" aria-label="专鉴活动进度" data-current="${n}">
 <div class="ev-progress-heading"><span>我的专鉴进度</span><span>已完成 <b>${n}</b> 单</span></div>
 <div class="ev-milestone-scroll" tabindex="0" aria-label="左右滑动查看全部奖励里程碑"><div class="ev-milestone-track" style="--ev-node-count:${nodeCount};--ev-progress-ratio:${ratio}">
 <div class="ev-progress-rail" role="progressbar" aria-label="累计专鉴单数" aria-valuemin="0" aria-valuemax="${end}" aria-valuenow="${n}" aria-valuetext="已完成 ${n} 单，下一奖励在第 ${next} 单"><div class="ev-progress-fill" style="width:${ratio*100}%"></div><span class="ev-rail-shine"></span></div>
 <div class="ev-milestone-origin" aria-hidden="true"><span></span><b>出发</b></div>
 ${steps.map(step=>`<div class="ev-milestone ${step<=n?'is-done':''} ${step===next?'is-next':''} ${step%10===0?'is-premium':''}" data-step="${step}" aria-label="第${step}单，${step%10===0?'高级':'普通'}券${step<=n?'已获得':step===next?'下一奖励':'未达成'}"><span class="ev-milestone-dot">${rewardArt(step%10===0?'advanced':'ordinary')}${step<=n?`<i aria-label="已获得">${icon('check')}</i>`:''}</span><b>${step} 单</b><small>${step%10===0?'高级券':'普通券'}</small><span class="ev-node-state">${step<=n?'已获得':step===next?'下一奖励':'待解锁'}</span></div>`).join('')}
 <div class="ev-current-marker" data-current-count="${n}" aria-label="当前累计第 ${n} 单"><span class="ev-current-pin"></span><strong>${n}<small> 单</small></strong></div>
 </div></div><div class="ev-progress-note"><span>再鉴 <b>${next-n}</b> 单，得${next%10===0?'高级':'普通'}券</span><span>${next===nextHigh?'尊享奖池即将开启':`距高级券 ${nextHigh-n} 单`} ${icon('spark')}</span></div>
 </section>`;
}
export function focusProgress(root=document){
 requestAnimationFrame(()=>root.querySelectorAll('.ev-milestone-scroll').forEach(scroll=>{
  const marker=scroll.querySelector('.ev-current-marker');
  if(!marker)return;
  const rect=marker.getBoundingClientRect(),viewport=scroll.getBoundingClientRect();
  const position=rect.left-viewport.left+scroll.scrollLeft+rect.width/2;
  const left=Math.max(0,position-scroll.clientWidth*.45);
  if(scroll.scrollTo)scroll.scrollTo({left,behavior:'instant'});else scroll.scrollLeft=left;
 }));
}
export function goExpert(){
 if(window.openExpertSelection)window.openExpertSelection();
 else window.jianxNavigate?.('expert',{intent:'open-expert'});
}
let currentDialog=null;
export function closeEventDialog(){if(currentDialog?.open)currentDialog.close('programmatic');}
export function showEventDialog(title,body,{className='',onClose}={}){
 closeEventDialog();
 const previousFocus=document.activeElement;
 const dialog=document.createElement('dialog');dialog.className=`ev-dialog ${className}`;
 dialog.innerHTML=`<header class="ev-dialog-head"><span>${escapeHtml(title)}</span><button class="ev-icon-button" data-ev-close aria-label="关闭">${icon('close')}</button></header><div class="ev-dialog-body">${body}</div>`;
 dialog.setAttribute('aria-label',title);document.body.append(dialog);currentDialog=dialog;
 dialog.querySelector('[data-ev-close]').onclick=()=>dialog.close('dismiss');
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close('dismiss');}});
 dialog.addEventListener('close',()=>{const reason=dialog.returnValue||'dismiss';dialog.remove();if(currentDialog===dialog)currentDialog=null;if(reason==='dismiss'&&previousFocus?.isConnected)previousFocus.focus?.({preventScroll:true});onClose?.({reason});},{once:true});
 dialog.showModal();focusProgress(dialog);return dialog;
}
export function openRules({onReturn}={}){
 return showEventDialog('专鉴有礼 · 活动规则',`<div class="ev-rules"><div class="ev-eyebrow">10.27 — 11.10</div><h2>认真鉴别，好礼相伴</h2>
 <p>活动时间：2026 年 10 月 27 日 00:00 至 11 月 11 日 00:00（北京时间）。</p>
 <h3>六大品类，专鉴有礼</h3><p>美妆、包袋、鞋靴、服饰、手表、数码 3C 参与。提交成功即累计 1 单，每 2 单得 1 张普通券；每 10 单得 1 张高级券，该节点不再发普通券。跨天累计，无次数上限。其他品类仍可免费专鉴，不计入本活动。</p>
 <h3>每天一次免费机会</h3><p>每日首次进入活动自动领取 1 张普通券，当天有效，未使用不顺延。鉴定获得的券有效至活动结束。优先使用即将到期的券。</p>
 <h3>普通与高级奖池</h3><p>普通池：实物 8%、鉴定券 72%、再接再厉 20%。高级池：实物 5%、鉴定券 75%、再接再厉 20%。同池可抽实物等概率；库存为零后不再抽出该奖品。</p>
 <p>本活动每人最多获得 1 份实物，普通与高级池合计计算，与卡牌活动独立。已中实物或奖池实物全部领完后，实物概率转为鉴定券。鉴定券有效至 2026 年 12 月 12 日 23:59:59。</p>
 <h3>单抽与五连抽</h3><p>选择一种券，每次使用 1 张或同种 5 张。不同券种、不同活动的券不能混用。结果自动保存，可以稍后在抽奖记录中查看。</p>
 <h3>鉴真王者与避雷王者</h3><p>按活动期间六大品类的专家最终鉴真、鉴假订单数分别排名；同数按先达到者优先。活动结束后才出结果的订单不计入。两榜可同时获奖。</p><p>鉴真榜前三名：每人称号与 200 元现金红包。避雷榜前三名：每人称号与终身免费专鉴权益，不限品类与次数。活动结束时统一结算。</p>
 <p class="ev-demo-note">当前为交互演示。鉴定、奖励、榜单及库存为本机模拟，商品图为奖品示意。</p></div>`,{onClose:({reason})=>{if(reason==='dismiss')onReturn?.();}});
}
export function openProgress({reward=null}={}){
 const s=loadEvent(),n=eventCount(s),premium=reward?.pool==='advanced';
 const d=showEventDialog(reward?'奖励已到账':'专鉴进度已更新',`
 <div class="ev-reward-hero ${premium?'is-premium':''} ${reward?'is-awarded':''}">
 <div class="ev-reward-orbit"></div><div class="ev-reward-rays" aria-hidden="true"></div><div class="ev-reward-particles" aria-hidden="true">${Array.from({length:12},(_,i)=>`<i style="--particle:${i}"></i>`).join('')}</div><div class="ev-reward-emblem">${rewardArt(premium?'advanced':'ordinary')}${reward?'<span class="ev-reward-count">+1</span>':''}</div>
 <span class="ev-eyebrow">${reward?(premium?'高级礼遇 · 已解锁':'专鉴有礼 · 已到账'):'每一单，都有新的期待'}</span>
 <h2>${reward?`${premium?'高级':'普通'}抽奖券 <em>+1</em>`:`已完成 ${n} 单专鉴`}</h2><p>${reward?`第 ${n} 单的奖励已放入抽奖中心`:'提交成功已计入活动进度'}</p>
 </div>${progressMarkup(s)}
 <button class="ev-primary" data-center>${icon('gift')} 去抽奖中心 ${icon()}</button>
 <button class="ev-rank-teaser" data-rank><span class="ev-rank-small">${icon('crown')}</span><span><strong>鉴真王者 · 避雷王者</strong><small>争取 200 元红包与终身免费专鉴</small></span>${icon()}</button>`,{className:premium?'ev-premium-dialog':''});
 d.querySelector('[data-center]').onclick=()=>{d.close('navigate');window.jianxNavigate('lottery',{event:'expert',pool:premium?'advanced':'ordinary'});};
 d.querySelector('[data-rank]').onclick=()=>{d.close();openLeaderboard();};
 return d;
}
export function openDraw({pool='ordinary',count=1,onChange,onReturn,random}={}){
 const s=loadEvent(),now=eventNow();
 const response=draw(s,{pool,count,requestId:crypto.randomUUID()},now,random);
 if(response.error){showEventDialog('暂时无法扭蛋',`<div class="ev-empty">${icon('ticket')}<h2>${escapeHtml(response.error)}</h2><p>完成参与品类的专鉴，继续积攒抽奖机会。</p><button class="ev-primary" data-expert>去专鉴 ${icon()}</button></div>`,{onClose:({reason})=>{if(reason==='dismiss')onReturn?.();}}).querySelector('[data-expert]').onclick=()=>{closeEventDialog();goExpert();};return null;}
 saveEvent(response.state);onChange?.(response);let controller=null,done=false;
 const d=showEventDialog(pool==='advanced'?'高级扭蛋 · 尊享奖池':'好运扭蛋 · 普通奖池',`<div class="ev-draw-stage">${machineMarkup({pool,compact:true})}<h2>${count===5?'五份期待，一起揭晓':'正在送出你的好运'}</h2><p>本次使用 ${count} 张${pool==='advanced'?'高级':'普通'}券</p><button class="ev-text-button" data-skip>跳过动画 ${icon()}</button></div>`,{className:'ev-draw-dialog',onClose:({reason})=>{controller?.destroy();if(reason==='dismiss')onReturn?.();}});
 const reveal=()=>{if(done||!d.open)return;done=true;controller?.destroy();d.querySelector('.ev-dialog-body').innerHTML=resultMarkup(response.batch,{canReturn:Boolean(onReturn)});
 d.querySelector('[data-result-prizes]').onclick=()=>{d.close('navigate');window.jianxNavigate('prizes',{event:'expert',pool:response.batch.pool});};
 d.querySelector('[data-result-expert]').onclick=()=>{d.close('navigate');goExpert();};
 d.querySelector('[data-result-again]').onclick=()=>{d.close('repeat');openDraw({pool,count,onChange,onReturn});};
 d.querySelector('[data-result-back]')?.addEventListener('click',()=>d.close('dismiss'));};
 controller=mountMachine(d.querySelector('.gm-machine')||d.querySelector('.ev-draw-stage'));
 controller.play({count,pool,onReveal:reveal});
 d.querySelector('[data-skip]').onclick=()=>{controller.skip();reveal();};
 return response.batch;
}
export function resultMarkup(batch,{canReturn=false}={}){
 const won=batch.rewards.filter(r=>r.type!=='none'),many=batch.rewards.length===5;
 return `<div class="ev-result-heading"><span class="ev-eyebrow">${batch.pool==='advanced'?'高级奖池':'普通奖池'} · ${many?'五连抽':'单次抽取'}</span><h2>${won.length?'好礼已抵达':'再接再厉'}</h2><p>${won.length?'这份好运，为认真鉴别的你':'完成专鉴，积攒下一份好运'}</p></div>
 <div class="ev-result-grid ${many?'is-five':''}">${batch.rewards.map(r=>`<article class="ev-result-card ${r.type==='physical'?'is-physical':''} ${r.type==='none'?'is-empty':''}">${prizeArt(r.type==='physical'?r.prizeId:r.type)}<strong>${escapeHtml(r.type==='physical'?PRIZES.find(p=>p.id===r.prizeId)?.name:r.type==='voucher'?'专家鉴定券':'再接再厉')}</strong><small>${r.type==='voucher'?'有效至 12.12':r.type==='physical'?'实物奖品 · 已存入我的奖品':'继续积攒好运'}</small></article>`).join('')}</div>
 <div class="ev-result-rule">每鉴定 <b>2</b> 单得普通券 · 每 <b>10</b> 单得高级券</div>
 <button class="ev-primary" data-result-expert>限时免费，去专鉴 ${icon()}</button>
 <div class="ev-result-actions"><button class="ev-text-button" data-result-prizes>查看我的奖品</button><button class="ev-text-button" data-result-again>再扭${many?'五次':'一次'} ${icon()}</button></div>${canReturn?'<button class="ev-text-button ev-full ev-result-back" data-result-back>返回活动，选择其他奖池</button>':''}`;
}

export function activityHubMarkup(state,now,{pool='ordinary'}={}){
 const balance=balances(state,now),available=active(now),advanced=pool==='advanced';
 return `<div class="ev-hub-top"><span class="ev-hub-intro">选一份好礼，开启今天的好运</span><div class="ev-hub-tools"><button data-hub-rules>${icon('spark')}规则</button><button data-hub-rank>${icon('crown')}王者榜</button></div></div>
 <div class="ev-hub-pools" role="tablist" aria-label="选择扭蛋奖池">${['ordinary','advanced'].map(value=>`<button role="tab" data-hub-pool="${value}" aria-selected="${pool===value}">${rewardArt(value)}<span><strong>${value==='advanced'?'高级奖池':'普通奖池'}</strong><small>可用 <b>${balance[value]}</b> 张券</small></span><i>${pool===value?icon('check'):''}</i></button>`).join('')}</div>
 <div class="ev-hub-stage">${machineMarkup({pool,compact:true})}<p>${advanced?'YSL 气垫 · COACH · 雷蛇耳机':'精选美妆、护肤、香水小样'}<span>还有免费专家鉴定券</span></p></div>
 <div class="ev-hub-draw-controls"><button class="ev-secondary" data-hub-draw="1" ${!available||balance[pool]<1?'disabled':''}><strong>${pool==='ordinary'&&balance.daily?'免费扭一次':'扭一次'}</strong><small>使用 1 张${advanced?'高级':'普通'}券</small></button><button class="ev-primary ${advanced?'ev-gold-primary':''}" data-hub-draw="5" ${!available||balance[pool]<5?'disabled':''}><strong>五次一起扭</strong><small>使用 5 张同种券</small></button></div>
 <p class="ev-hub-expiry">${icon('clock')}${!available?(now<START?'活动尚未开始':'活动已结束，奖品与记录保留'):balance.daily&&pool==='ordinary'?'今日赠券当天有效，扭蛋时优先使用':balance[pool]<1?'当前奖池暂无可用券，去专鉴继续积累':'鉴定获得的抽奖券，活动结束时失效'}</p>
 ${progressMarkup(state)}
 <div class="ev-hub-footer"><button class="ev-text-button" data-hub-prizes>${icon('gift')}我的奖品</button><button class="ev-text-button" data-hub-center>抽奖记录 ${icon()}</button><button class="ev-text-button" data-hub-expert>去专鉴 ${icon()}</button></div>`;
}

export function openActivityHub({onChange,pool='ordinary'}={}){
 let selected=pool==='advanced'?'advanced':'ordinary',controller=null,d=null;
 const reopen=()=>openActivityHub({onChange,pool:selected});
 const cleanup=()=>{controller?.destroy();controller=null;window.removeEventListener('expert-event-change',refresh);};
 const render=()=>{
  controller?.destroy();
  d.querySelector('.ev-dialog-body').innerHTML=activityHubMarkup(loadEvent(),eventNow(),{pool:selected});
  controller=mountMachine(d.querySelector('.gm-machine'));
  d.querySelectorAll('[data-hub-pool]').forEach(button=>button.onclick=()=>{selected=button.dataset.hubPool;render();});
  d.querySelectorAll('[data-hub-draw]').forEach(button=>button.onclick=()=>{
   const count=Number(button.dataset.hubDraw);if(button.disabled)return;
   d.close('draw');openDraw({pool:selected,count,onChange,onReturn:reopen});
  });
  d.querySelector('[data-hub-rules]').onclick=()=>{d.close('rules');openRules({onReturn:reopen});};
  d.querySelector('[data-hub-rank]').onclick=()=>{d.close('ranking');openLeaderboard('true',{onReturn:reopen});};
  d.querySelector('[data-hub-prizes]').onclick=()=>{d.close('navigate');window.jianxNavigate?.('prizes',{event:'expert',pool:selected});};
  d.querySelector('[data-hub-center]').onclick=()=>{d.close('navigate');window.jianxNavigate?.('lottery',{event:'expert',pool:selected});};
  d.querySelector('[data-hub-expert]').onclick=()=>{d.close('navigate');goExpert();};
  focusProgress(d);
 };
 const refresh=()=>{if(d?.open)render();};
 d=showEventDialog('专鉴有礼 · 好运扭蛋','',{className:'ev-hub-dialog',onClose:cleanup});
 render();window.addEventListener('expert-event-change',refresh);return d;
}

let demoRankOrders=null;
export function rankingState(state){
 if(state.demoRanking)return state;
 if(!demoRankOrders){
  demoRankOrders=[];const labels=['林','许','周','陈','苏','杨','王','宋','吴','程','叶','江'];
  for(let u=0;u<24;u++){const amount=68-u*2;for(let i=0;i<amount;i++)demoRankOrders.push({id:`rank-demo-${u}-${i}`,uid:`rank-${u}`,category:'美妆',eligible:true,at:START+1000+i*100,result:i%3===u%3?'false':'true',resultAt:START+(u+1)*60000+i*1000});}
  demoRankOrders.names=Array.from({length:24},(_,i)=>({uid:`rank-${i}`,username:`${labels[i%labels.length]}**${String(i+11).slice(-1)}`}));
 }
 return {...state,orders:[...demoRankOrders,...state.orders],users:[...demoRankOrders.names,{uid:state.uid,username:'我'}]};
}
export function openLeaderboard(initial='true',{onReturn}={}){
 let kind=initial;const d=showEventDialog('专鉴荣誉榜','',{className:'ev-ranking-dialog',onClose:({reason})=>{if(reason==='dismiss')onReturn?.();}});
 const render=()=>{
 const s=loadEvent(),ranked=rankingState(s),rows=leaderboard(ranked,kind),me=rows.find(r=>r.uid===s.uid),top=rows.slice(0,3),names=ranked.users||[];
 const name=r=>r?.uid===s.uid?'我':names.find(u=>u.uid===r?.uid)?.username||'鉴**友';
 d.querySelector('.ev-dialog-body').innerHTML=`<div class="ev-ranking-intro"><span class="ev-eyebrow">每一份判断，都值得被看见</span><h2>让专业，成为你的荣誉</h2><p>10.27 — 11.10 · 活动结束统一结算</p></div>
 <div class="ev-segment"><button data-kind="true" aria-selected="${kind==='true'}">鉴真王者</button><button data-kind="false" aria-selected="${kind==='false'}">避雷王者</button></div>
 <div class="ev-rank-benefit">${icon('crown')}<span>前三名每人获得 <b>${kind==='true'?'200 元现金红包':'终身免费专鉴'}</b><small>同时获得「${kind==='true'?'鉴真王者':'避雷王者'}」专属称号</small></span></div>
 <div class="ev-podium">${[1,0,2].map(index=>{const r=top[index];return `<div class="ev-podium-person place-${index+1}"><div class="ev-avatar">${index===0?icon('crown'):icon('shield')}</div><strong>${name(r)}</strong><span>${r?.count||0} 单</span><div class="ev-podium-base"><b>0${index+1}</b></div></div>`;}).join('')}</div>
 <div class="ev-rank-table-head"><span>排名 / 用户</span><span>${kind==='true'?'鉴真':'鉴假'}单数</span></div>
 <div class="ev-rank-list">${rows.slice(3,100).map(r=>`<div class="ev-rank-row"><b>${String(r.rank).padStart(2,'0')}</b><span class="ev-rank-avatar">${icon('shield')}</span><span>${name(r)}</span><strong>${r.count}<small> 单</small></strong></div>`).join('')}</div>
 <div class="ev-my-rank"><span><small>我的排名</small><b>${me?`第 ${me.rank} 名`:'暂未上榜'}</b></span><span><b>${me?.count||0}</b> 单${kind==='true'?'鉴真':'鉴假'}</span><button data-rank-expert>去专鉴 ${icon()}</button></div>
 <button class="ev-text-button ev-full" data-rules>查看榜单规则与奖励 ${icon()}</button><p class="ev-demo-note">榜单含演示用户；本人的排名随模拟专家结果更新。</p>`;
 d.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{kind=b.dataset.kind;render();});
 d.querySelector('[data-rank-expert]').onclick=()=>{d.close('navigate');goExpert();};
 d.querySelector('[data-rules]').onclick=()=>{d.close('rules');openRules({onReturn:()=>openLeaderboard(kind,{onReturn})});};
 };
 render();return d;
}
