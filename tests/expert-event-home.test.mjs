import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createDocument,FixtureElement} from './dom-fixture.mjs';
import * as model from '../public/expert-event-model.js';
import {progressMarkup,eventCount,icon,escapeHtml} from '../public/expert-event-ui.js';

const source=readFileSync(new URL('../public/expert-event-home.js',import.meta.url),'utf8');
const T=model.START+10*3600000;
// The real controller uses remove() when switching between upload and report.
if(!FixtureElement.prototype.remove)FixtureElement.prototype.remove=function(){
  if(this.parentElement)this.parentElement.nodes=this.parentElement.nodes.filter(node=>node!==this);
  this.parentElement=null;
};

function fixture({initial=model.fresh(),now=T,expertVisible=true}={}) {
  let state=structuredClone(initial),clock=now;
  const events=new Map(),microtasks=[],timers=new Map(),intervals=[],dialogs=[],progress=[];
  const document=createDocument('<div id="app"><div id="expertHome"></div><div id="expertPickerRoot" hidden></div></div>');
  document.hidden=false;document.getElementById('expertHome').hidden=!expertVisible;
  const window={
    parent:{},jianxActive:true,
    addEventListener(type,fn){const list=events.get(type)||[];list.push(fn);events.set(type,list);},
    dispatchEvent(event){for(const listener of events.get(event.type)||[])listener(event);}
  };
  const emit=(type,detail)=>window.dispatchEvent({type,detail});
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
    openProgress:options=>progress.push(options),openLeaderboard(){},openRules(){},openDraw(){},
    closeEventDialog:()=>{for(const dialog of dialogs)dialog.open=false;},
    showEventDialog:(title,body)=>{
      const dialog=document.createElement('dialog');dialog.innerHTML=body;dialog.open=true;dialog.title=title;
      dialog.close=()=>{dialog.open=false;};dialogs.push(dialog);return dialog;
    }
  });
  vm.runInContext(source.replace(/^import .*;\n/gm,''),context,{filename:'expert-event-home.js'});
  const flush=()=>{let guard=0;while(microtasks.length){assert(++guard<100,'microtasks should settle');microtasks.shift()();}};
  return {
    document,window,dialogs,progress,emit,flush,
    get state(){return structuredClone(state);},
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
    f.dialogs.at(-1).querySelector(`[data-scene="${count}"]`).click();f.flush();
    assert.equal(eventCount(f.state),count);
    assert.equal(model.balances(f.state,T).ordinary,ordinary);
    assert.equal(model.balances(f.state,T).advanced,advanced);
    assert.ok(f.state.orders.every(order=>order.at<=T));
    assert.ok(f.state.orders.filter(order=>order.result).every(order=>order.resultAt<=T));
  }
});

test('full-screen appraisal flow isolates background controls and restores them on return',()=>{
  const f=fixture();f.window.onExpertSelected({category:'美妆',name:'气垫粉底'});
  assert.equal(f.document.getElementById('expertHome').inert,true);
  assert.equal(f.document.activeElement,f.document.querySelector('[data-flow-back]'));
  f.document.querySelector('[data-flow-back]').click();
  assert.equal(f.document.getElementById('expertHome').inert,false);
  assert.equal(f.document.querySelector('.eh-flow'),null);
});
