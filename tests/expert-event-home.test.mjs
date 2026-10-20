import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createDocument,FixtureElement} from './dom-fixture.mjs';
import * as model from '../public/expert-event-model.js';
import {progressMarkup,eventCount,icon,escapeHtml} from '../public/expert-event-ui.js';
import {DEMO_SCENE_GROUPS,buildDemoScene} from '../public/expert-event-demo.js';

const source=readFileSync(new URL('../public/expert-event-home.js',import.meta.url),'utf8');
const T=model.START+10*3600000;
test('retired expert introduction is removed from the shipped DOM and its dedicated styles',()=>{
  const html=readFileSync(new URL('../public/home.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../public/expert-refinement.css',import.meta.url),'utf8');
  assert.doesNotMatch(html,/expert-welcome|expert-hero-main|expert-spectrum|真伪图库|份专家报告/);
  assert.doesNotMatch(css,/expert-welcome|expert-hero-main|expert-spectrum/);
  const document=createDocument(html);
  assert.equal(document.querySelectorAll('#expertCta').length,1,'existing category picker keeps one entry');
});
// The real controller uses remove() when switching between upload and report.
if(!FixtureElement.prototype.remove)FixtureElement.prototype.remove=function(){
  if(this.parentElement)this.parentElement.nodes=this.parentElement.nodes.filter(node=>node!==this);
  this.parentElement=null;
};

function fixture({initial=model.fresh(),now=T,expertVisible=true}={}) {
  let state=structuredClone(initial),clock=now;
  const events=new Map(),microtasks=[],timers=new Map(),intervals=[],dialogs=[],progress=[];
  const draws=[],hubs=[],rules=[],rankings=[],navigations=[],scenes=[];
  const document=createDocument('<div id="app"><div id="expertHome"></div><div id="expertPickerRoot" hidden></div></div>');
  document.hidden=false;document.getElementById('expertHome').hidden=!expertVisible;
  const window={
    parent:{},jianxActive:true,
    addEventListener(type,fn){const list=events.get(type)||[];list.push(fn);events.set(type,list);},
    dispatchEvent(event){for(const listener of events.get(event.type)||[])listener(event);}
  };
  const emit=(type,detail)=>window.dispatchEvent({type,detail});
  window.jianxNavigate=(route,options)=>navigations.push({route,...options});
  window.jianxSetTab=tab=>{
    document.getElementById('expertHome').hidden=tab!=='expert';
    document.getElementById('expertPickerRoot').hidden=true;
    if(tab==='expert')emit('expert-tab-open');
  };
  window.expertPicker={open(){document.getElementById('expertPickerRoot').hidden=false;}};
  // home-card-entry registers first and selects the tab before the extension sees the intent.
  window.addEventListener('jianx-shell',event=>{
    if(event.detail.type==='activate')window.jianxSetTab(event.detail.route==='expert'?'expert':'ai');
  });
  let timerId=0;
  const context=vm.createContext({
    ...model,window,document,location:{search:'?tab=expert'},URLSearchParams,Intl,
    DEMO_SCENE_GROUPS,
    applyDemoScene:(id,options={})=>{
      const scene=buildDemoScene(id,options);
      scenes.push({id,options:{...options}});
      if(scene.persist){state=structuredClone(scene.state);clock=scene.now;emit('expert-event-change');}
      return scene;
    },
    FormData:class {
      constructor(form){
        this.values=new Map(form.querySelectorAll('select').map(select=>[
          select.getAttribute('name'),
          select.value||select.querySelector('option[selected]')?.value||select.querySelector('option')?.value
        ]));
      }
      get(name){return this.values.get(name)??null;}
    },
    crypto:{randomUUID},matchMedia:()=>({matches:true}),
    queueMicrotask:fn=>microtasks.push(fn),requestAnimationFrame:fn=>microtasks.push(fn),
    setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},
    clearTimeout:id=>timers.delete(id),setInterval:fn=>{intervals.push(fn);return intervals.length;},
    loadEvent:()=>structuredClone(state),
    saveEvent:next=>{state=structuredClone(next);emit('expert-event-change');return structuredClone(state);},
    eventNow:()=>clock,setEventClock:value=>{clock=value;emit('expert-event-change');},
    resetEvent:()=>{state=model.fresh();clock=T;emit('expert-event-change');return structuredClone(state);},
    machineMarkup:()=>'<div class="gm-machine"></div>',mountMachine:()=>({destroy(){}}),
    prizeArt:()=>'<span class="prize-art"></span>',
    progressMarkup,eventCount,icon,esc:escapeHtml,focusProgress(){},
    openProgress:options=>progress.push(structuredClone(options)),openLeaderboard:kind=>rankings.push(kind),
    openRules:options=>rules.push(options),openDraw:options=>draws.push(options),
    openActivityHub:options=>hubs.push(options),
    closeEventDialog:()=>{for(const dialog of dialogs)dialog.open=false;},
    showEventDialog:(title,body,options={})=>{
      for(const previous of dialogs)previous.open=false;
      const dialog=document.createElement('dialog');dialog.innerHTML=body;dialog.open=true;dialog.title=title;
      dialog.className=options.className||'';
      dialog.close=()=>{dialog.open=false;};dialogs.push(dialog);return dialog;
    }
  });
  vm.runInContext(source.replace(/^import .*;\n/gm,''),context,{filename:'expert-event-home.js'});
  const flush=()=>{let guard=0;while(microtasks.length){assert(++guard<100,'microtasks should settle');microtasks.shift()();}};
  return {
    document,window,dialogs,progress,draws,hubs,rules,rankings,navigations,scenes,emit,flush,
    get state(){return structuredClone(state);},
    setState(value){state=structuredClone(value);emit('expert-event-change');},
    setClock(value){clock=value;},
    enter(){emit('expert-tab-open');flush();},
    visible(){document.hidden=false;for(const listener of document.events.get('visibilitychange')||[])listener({type:'visibilitychange'});flush();},
    tick(){for(const fn of intervals)fn();flush();},
    finishAI(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}flush();}
  };
}

test('expired activity keeps free upload available without promising milestone rewards',()=>{
  const f=fixture({now:model.END});
  f.window.onExpertSelected({category:'美妆',name:'气垫粉底'});
  f.flush();
  assert.equal(f.document.querySelector('.eh-order-benefit'),null);
  assert.match(f.document.querySelector('.eh-price-summary').textContent,/全部品类免费/);
  f.document.querySelector('[data-submit]').click();
  assert.equal(f.state.orders.length,1);
  assert.equal(f.state.orders[0].eligible,false);
  assert.equal(f.progress.length,0);
});

test('AI conversion after deadline retains free expert CTA without lottery or progress promises',()=>{
  const f=fixture({now:model.END,expertVisible:false});
  f.window.jianxShowBeautyDemo();f.finishAI();
  const card=f.document.querySelector('.eh-convert-card');
  assert.equal(card.querySelector('.eh-benefits'),null);
  assert.equal(card.querySelector('.ev-progress'),null);
  assert.match(card.querySelector('[data-ai-expert]').textContent,/免费专鉴/);
  assert.doesNotMatch(card.querySelector('[data-ai-expert]').textContent,/攒|抽奖/);
  assert.match(card.querySelector('.eh-convert-scope').textContent,/活动已结束/);
});

test('eligible upload opens progress after submission while card upload never opens activity progress',()=>{
  for(const [category,expected] of [['美妆',1],['卡牌',0],['配饰',0]]){
    const f=fixture();f.window.onExpertSelected({category,name:'演示商品'});f.flush();
    assert.equal(Boolean(f.document.querySelector('.eh-order-benefit')),expected===1);
    f.document.querySelector('[data-submit]').click();
    assert.equal(f.progress.length,expected);
    assert.equal(eventCount(f.state),expected);
  }
});

test('a first ticket claimed in the center still gets its guide once on the expert homepage',()=>{
  const initial=model.claimDaily(model.fresh(),T).state;
  const f=fixture({initial});f.enter();
  assert.equal(f.dialogs.length,1);
  assert.match(f.dialogs[0].title,/好运/);
  assert.equal(f.state.guideShownTicketId,initial.guideTicketId);
  f.dialogs[0].close();f.enter();
  assert.equal(f.dialogs.length,1);
  const reloaded=fixture({initial:f.state});reloaded.enter();
  assert.equal(reloaded.dialogs.length,0,'shown guide survives module reload');
});

test('used or expired first guide tickets never cause another guide',()=>{
  const claimed=model.claimDaily(model.fresh(),T).state;
  const used=model.draw(claimed,{pool:'ordinary',count:1,requestId:'guide'},T,()=>0).state;
  const consumed=fixture({initial:used});consumed.enter();
  assert.equal(consumed.dialogs.length,0);
  const expired=fixture({initial:claimed,now:T+model.DAY});expired.enter();
  assert.equal(expired.dialogs.length,0);
  assert.equal(expired.state.tickets.length,2);
  assert.equal(model.balances(expired.state,T+model.DAY).daily,1);
});

test('returning to a visible expert page after midnight automatically grants the new daily ticket',()=>{
  const f=fixture();f.enter();f.dialogs[0].close();
  f.document.hidden=true;f.setClock(T+model.DAY);f.visible();
  assert.equal(f.state.tickets.length,2);
  assert.equal(model.balances(f.state,T+model.DAY).daily,1);
  assert.equal(f.dialogs.length,1,'new days do not replay onboarding');
});

test('calendar refresh grants a new daily ticket when the expert page stays open across midnight',()=>{
  const f=fixture();f.enter();f.dialogs[0].close();
  f.setClock(T+model.DAY);f.tick();
  assert.equal(model.balances(f.state,T+model.DAY).daily,1);
  assert.equal(f.state.tickets.length,2);
  f.tick();assert.equal(f.state.tickets.length,2);
  f.setClock(model.END);f.tick();
  assert.deepEqual(model.balances(f.state,model.END),{ordinary:0,advanced:0,daily:0});
});

test('card-expert shell intent suppresses onboarding even though the earlier listener opens expert tab',()=>{
  const f=fixture({expertVisible:false});
  f.emit('jianx-shell',{type:'activate',route:'expert',intent:'card-expert'});f.flush();
  assert.equal(f.dialogs.length,0);
  assert.equal(f.state.tickets.length,0);
  assert.match(f.document.querySelector('.eh-selected-product').textContent,/卡牌/);
  f.document.querySelector('[data-submit]').click();f.flush();
  assert.equal(f.progress.length,0);
  assert.equal(f.dialogs.length,0);
  assert.equal(f.state.orders[0].eligible,false);
});

test('explicit expert selection does not put a native guide in front of the category picker',()=>{
  const f=fixture({expertVisible:false});
  f.window.openExpertSelection();f.flush();
  assert.equal(f.document.getElementById('expertPickerRoot').hidden,false);
  assert.equal(f.dialogs.length,0);
});

test('upload/report overlay stays above the existing navbar so its back control remains reachable',()=>{
  const css=file=>readFileSync(new URL(`../public/${file}`,import.meta.url),'utf8');
  const declarations=(content,selector)=>{
    const blocks=[...content.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([,selectors])=>selectors.split(',').map(s=>s.trim()).includes(selector));
    return blocks.flatMap(([, ,body])=>[...body.matchAll(/z-index\s*:\s*(\d+)/g)].map(match=>Number(match[1]))).at(-1);
  };
  const flow=declarations(css('expert-event-home.css'),'.eh-flow');
  const navbar=declarations(css('original.css'),'.navbar');
  assert(Number.isFinite(flow)&&Number.isFinite(navbar));
  assert(flow>navbar,`flow z-index ${flow} must exceed navbar ${navbar}`);
});

test('demo milestones grant immediately usable tickets instead of future-dated balances',()=>{
  for(const [count,ordinary,advanced] of [[9,4,0],[14,6,1],[50,20,5]]){
    const f=fixture();
    f.document.querySelector('[data-eh="demo"]').click();
    f.dialogs.at(-1).querySelector(`[data-scene="progress-${count}"]`).click();f.flush();
    assert.equal(eventCount(f.state),count);
    assert.equal(model.balances(f.state,T).ordinary,ordinary);
    assert.equal(model.balances(f.state,T).advanced,advanced);
    assert.ok(f.state.orders.every(order=>order.at<=T));
    assert.ok(f.state.orders.filter(order=>order.result).every(order=>order.resultAt<=T));
  }
});

test('expert home is a compact display entry without inline progress, draw controls or category list',()=>{
  const f=fixture({initial:buildDemoScene('progress-14').state});
  const home=f.document.getElementById('expertEvent');
  assert(home.querySelector('.eh-machine-display'));
  assert.equal(home.querySelector('.ev-progress'),null);
  assert.equal(home.querySelector('[data-draw]'),null);
  assert.equal(home.querySelector('[data-pool]'),null);
  assert.doesNotMatch(home.textContent,/美妆[、/\s]+包袋|鞋靴[、/\s]+服饰|手表[、/\s]+数码/);
  const hubButtons=home.querySelectorAll('[data-eh="hub"]');
  assert.equal(hubButtons.length,2,'the machine and main button open the same shared hub');
  for(const button of hubButtons)button.click();
  assert.equal(f.hubs.length,2);
  assert.equal(f.draws.length,0,'home never starts a draw without the hub');
  home.querySelector('[data-eh="progress"]').click();
  assert.equal(f.progress.length,1);
  home.querySelector('[data-eh="center"]').click();
  assert.deepEqual(f.navigations.at(-1),{route:'lottery',event:'expert'},'expert entry replaces any retained card campaign context');
});

test('active AI conversion retains the full milestone track and moves category scope into rules',()=>{
  const f=fixture({initial:buildDemoScene('progress-14').state,expertVisible:false});
  f.window.jianxShowBeautyDemo();f.finishAI();
  const card=f.document.querySelector('.eh-convert-card'),track=card.querySelector('.ev-progress');
  assert(track);
  assert.equal(track.classList.contains('is-compact'),false);
  assert.equal(track.dataset.current,'14');
  for(const step of [2,10,14])assert(track.querySelector(`[data-step="${step}"]`));
  assert(card.querySelector('.eh-benefits'));
  assert.equal(card.querySelector('.eh-convert-scope'),null);
  assert.doesNotMatch(card.textContent,/美妆[、/\s]+包袋|鞋靴[、/\s]+服饰|手表[、/\s]+数码/);
  card.querySelector('[data-ai-rules]').click();
  assert.equal(f.rules.length,1);
  card.querySelector('[data-ai-expert]').click();f.flush();
  assert.match(f.document.querySelector('.eh-selected-product').textContent,/圣罗兰/);
  assert(f.document.querySelector('[data-submit]'),'AI conversion goes directly to the upload flow');
});

test('simulation panel exposes all six groups with replay and initial-state recovery',()=>{
  const f=fixture();
  f.document.querySelector('[data-eh="demo"]').click();
  const panel=f.dialogs.at(-1),groups=panel.querySelectorAll('.eh-scene-group');
  assert.equal(groups.length,6);
  assert.deepEqual(groups.map(group=>group.querySelector('h3').textContent),[
    '新手体验','累计进度','抽奖效果','特殊状态','排行榜','卡牌活动'
  ]);
  assert.equal(panel.querySelectorAll('[data-scene]').length,23);
  assert.equal(panel.querySelector('[data-replay]').disabled,true);
  assert(panel.querySelector('[data-reset]'));
});

test('progress scene triggers reward feedback and replay restores the same earned state',()=>{
  const f=fixture();
  f.document.querySelector('[data-eh="demo"]').click();
  f.dialogs.at(-1).querySelector('[data-scene="progress-10"]').click();f.flush();
  assert.equal(eventCount(f.state),10);
  assert.deepEqual(f.progress.at(-1),{reward:{pool:'advanced',amount:1}});
  const changed=model.submitOrder(f.state,{id:'after-scene',category:'美妆'},T).state;
  f.setState(changed);
  assert.equal(eventCount(f.state),11);
  f.document.querySelector('[data-eh="demo"]').click();
  assert.equal(f.dialogs.at(-1).querySelector('[data-replay]').disabled,false);
  f.dialogs.at(-1).querySelector('[data-replay]').click();f.flush();
  assert.equal(eventCount(f.state),10);
  assert.equal(f.progress.length,2);
  assert.deepEqual(f.scenes.map(scene=>scene.id),['progress-10','progress-10']);
  f.document.querySelector('[data-eh="demo"]').click();
  f.dialogs.at(-1).querySelector('[data-reset]').click();f.flush();
  assert.equal(eventCount(f.state),0);
  assert.deepEqual(model.balances(f.state,T),{ordinary:1,advanced:0,daily:1});
  assert.equal(f.scenes.at(-1).id,'first');
  assert.match(f.dialogs.at(-1).title,/好运/);
});

test('draw setup passes targeted five-draw parameters and an isolated random callback to shared draw UI',()=>{
  const f=fixture(),originalRandom=Math.random;
  f.document.querySelector('[data-eh="demo"]').click();
  f.dialogs.at(-1).querySelector('[data-scene="draw"]').click();
  const form=f.dialogs.at(-1).querySelector('form');
  form.querySelector('[name="pool"]').value='advanced';
  form.querySelector('[name="count"]').value='1';
  const outcome=form.querySelector('[name="outcome"]');
  outcome.value='mixed';outcome.dispatchEvent({type:'change'});
  assert.equal(form.querySelector('[name="count"]').value,'5');
  form.dispatchEvent({type:'submit'});f.flush();
  const call=f.draws.at(-1);
  assert.equal(call.pool,'advanced');
  assert.equal(call.count,5);
  assert.equal(typeof call.random,'function');
  assert.equal(Math.random,originalRandom);
  assert.equal(model.balances(f.state,T).advanced,5);
  const result=model.draw(f.state,{pool:call.pool,count:call.count,requestId:'controller-preview'},T,call.random);
  assert.deepEqual(result.batch.rewards.map(reward=>reward.type),['physical','voucher','none','voucher','voucher']);
  f.setState(result.state);
  f.document.querySelector('[data-eh="demo"]').click();
  f.dialogs.at(-1).querySelector('[data-replay]').click();f.flush();
  const replay=f.draws.at(-1);
  assert.equal(f.draws.length,2);
  assert.equal(model.balances(f.state,T).advanced,5);
  assert.notEqual(replay.random,call.random,'replay creates a fresh draw sequence');
  assert.deepEqual(model.draw(f.state,{pool:replay.pool,count:replay.count,requestId:'controller-replay'},T,replay.random).batch.rewards.map(reward=>reward.type),
    ['physical','voucher','none','voucher','voucher']);
});

test('random draw setup retains natural randomness and defaults to an ordinary single draw',()=>{
  const f=fixture();
  f.document.querySelector('[data-eh="demo"]').click();
  f.dialogs.at(-1).querySelector('[data-scene="draw"]').click();
  f.dialogs.at(-1).querySelector('form').dispatchEvent({type:'submit'});f.flush();
  const call=f.draws.at(-1);
  assert.equal(call.pool,'ordinary');assert.equal(call.count,1);assert.equal(call.random,undefined);
});

test('scene destinations route card history and ended ticket filters to the center',()=>{
  for(const [id,event,ticketStatus] of [['card-history','card-past',undefined],['card-next','card-next',undefined],['ended','expert','expired']]){
    const f=fixture({initial:buildDemoScene('daily-used').state});
    f.document.querySelector('[data-eh="demo"]').click();
    f.dialogs.at(-1).querySelector(`[data-scene="${id}"]`).click();f.flush();
    assert.equal(f.navigations.at(-1).route,'lottery');
    assert.equal(f.navigations.at(-1).event,event);
    assert.equal(f.navigations.at(-1).ticketStatus,ticketStatus);
  }
});

test('excluded-category and leaderboard scene actions dispatch to their correct surfaces',()=>{
  const f=fixture();
  f.document.querySelector('[data-eh="demo"]').click();
  f.dialogs.at(-1).querySelector('[data-scene="rank-dual"]').click();f.flush();
  assert.equal(f.rankings.at(-1),'true');
  assert.equal(f.state.demoRanking,true);
  f.document.querySelector('[data-eh="demo"]').click();
  f.dialogs.at(-1).querySelector('[data-scene="excluded"]').click();f.flush();
  assert.match(f.document.querySelector('.eh-selected-product').textContent,/卡牌/);
  f.document.querySelector('[data-submit]').click();f.flush();
  assert.equal(f.progress.length,0);
  assert.equal(f.state.orders.at(-1).eligible,false);
});

test('full-screen appraisal flow isolates background controls and restores them on return',()=>{
  const f=fixture();f.window.onExpertSelected({category:'美妆',name:'气垫粉底'});
  assert.equal(f.document.getElementById('expertHome').inert,true);
  assert.equal(f.document.activeElement,f.document.querySelector('[data-flow-back]'));
  f.document.querySelector('[data-flow-back]').click();
  assert.equal(f.document.getElementById('expertHome').inert,false);
  assert.equal(f.document.querySelector('.eh-flow'),null);
});
