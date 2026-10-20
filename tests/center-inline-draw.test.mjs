import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDocument,FixtureElement} from './dom-fixture.mjs';
import {START,fresh,submitOrder,balances} from '../public/expert-event-model.js';
import {EVENT_KEY,eventNow,loadEvent,saveEvent,setEventClock} from '../public/expert-event-session.js';
import {closeEventDialog} from '../public/expert-event-ui.js';

const T=START+10*3600000;
let instance=0;
function orders(count) {
  let state=fresh('inline-test');
  for(let i=1;i<=count;i++)state=submitOrder(state,{id:`order-${i}`,category:'美妆'},T+i).state;
  return state;
}

async function harness(t,state=orders(50)) {
  t.mock.timers.enable({apis:['setTimeout']});
  t.mock.method(Math,'random',()=>.4);
  const document=createDocument(await readFile(new URL('../public/activity.html',import.meta.url),'utf8'));
  const decorate=element=>{
    if(element.tagName!=='DIALOG')return element;
    element.showModal=()=>{element.open=true;};
    element.close=(reason='')=>{
      if(!element.open)return;
      element.open=false;element.returnValue=reason;
      element.dispatchEvent({type:'close',bubbles:false});
    };
    element.remove=()=>{
      if(element.parentElement)element.parentElement.nodes=element.parentElement.nodes.filter(node=>node!==element);
      element.parentElement=null;
    };
    return element;
  };
  const create=document.createElement.bind(document);
  document.createElement=tag=>decorate(create(tag));
  document.querySelectorAll('dialog').forEach(decorate);
  // The actual controller uses attribute-prefix selectors to lock all draw and
  // pool buttons. Extend only this fixture's selector subset, not app behavior.
  const matches=FixtureElement.prototype.matches;
  t.mock.method(FixtureElement.prototype,'matches',function(selector) {
    return selector.split(',').some(part=>{
      const prefixes=[...part.matchAll(/\[([\w-]+)\^=["']([^"']*)["']\]/g)];
      if(prefixes.some(([,name,prefix])=>!this.getAttribute(name)?.startsWith(prefix)))return false;
      return matches.call(this,part.replace(/\[[\w-]+\^=["'][^"']*["']\]/g,'')||'*');
    });
  });
  const store=new Map(),writes=[],window=new EventTarget(),navigation=[];
  const location={hash:'#lottery'};
  window.jianxRoute=route=>navigation.push(route);
  const replacements={
    document,window,location,
    history:{replaceState:(_state,_title,hash)=>{location.hash=hash;}},
    localStorage:{
      getItem:key=>store.get(key)??null,
      setItem:(key,value)=>{store.set(key,value);writes.push(key);},
    },
    requestAnimationFrame:callback=>callback(),
    matchMedia:()=>({matches:false}),
  };
  const previous=new Map(Object.keys(replacements).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value]of Object.entries(replacements))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  setEventClock(T+1000);saveEvent(state);
  await import(`../public/activity-center.js?inline-test=${++instance}`);
  const click=selector=>{
    const target=typeof selector==='string'?document.querySelector(selector):selector;
    assert(target,`missing click target: ${selector}`);
    for(const listener of document.events.get('click')||[])listener({target});
    return target;
  };
  click('[data-action="event:expert"]');
  writes.length=0;
  t.after(()=>{
    window.dispatchEvent(new CustomEvent('jianx-shell',{detail:{type:'visibility',active:false}}));
    closeEventDialog();
    for(const [key,descriptor]of previous) {
      if(descriptor)Object.defineProperty(globalThis,key,descriptor);
      else delete globalThis[key];
    }
  });
  return {
    document,window,writes,navigation,click,
    dialog:()=>document.querySelector('.ev-center-result'),
    snapshot:()=>loadEvent(),
    balance:()=>balances(loadEvent(),eventNow()),
    shell:detail=>window.dispatchEvent(new CustomEvent('jianx-shell',{detail})),
  };
}

test('inline five-draw persists once, locks controls, and skips without re-debiting',async t=>{
  const h=await harness(t),before=h.balance(),machine=h.document.querySelector('.gm-machine');
  const draw=h.document.querySelector('[data-action="draw:5"]');
  h.click(draw);h.click(draw);
  assert.equal(h.snapshot().draws.length,1);
  assert.equal(h.snapshot().draws[0].rewards.length,5);
  assert.equal(h.balance().ordinary,before.ordinary-5);
  assert.equal(h.balance().advanced,before.advanced);
  assert.deepEqual(h.writes,[EVENT_KEY]);
  assert.equal(h.document.querySelector('.gm-machine'),machine,'save notifications must retain the running machine');
  assert.equal(machine.dataset.phase,'spinning');
  assert.equal(draw.disabled,true);
  for(const pool of h.document.querySelectorAll('.ac-pool-selector button'))assert.equal(pool.disabled,true);
  assert.equal(h.document.querySelector('[data-action="skip-draw"]').hidden,false);
  h.click('[data-action="skip-draw"]');
  h.click('[data-action="skip-draw"]');
  t.mock.timers.tick(10000);
  assert(h.dialog());
  assert.equal(h.snapshot().draws.length,1);
  assert.deepEqual(h.writes,[EVENT_KEY]);
  assert.equal(h.balance().ordinary,before.ordinary-5);
  assert.equal(h.document.querySelectorAll('.gacha-celebration').length,0,'completed celebration removes its decoration');
});

test('single-draw completion reveals once and uses only the selected advanced ticket',async t=>{
  const h=await harness(t),before=h.balance();
  h.click('[data-action="pool:advanced"]');
  h.click('[data-action="draw:1"]');
  const machine=h.document.querySelector('.gm-machine');
  assert.equal(h.snapshot().draws[0].pool,'advanced');
  assert.equal(h.balance().advanced,before.advanced-1);
  assert.equal(h.balance().ordinary,before.ordinary);
  t.mock.timers.tick(2799);
  assert.equal(h.dialog(),null);
  assert.equal(machine.dataset.phase,'dropping');
  t.mock.timers.tick(1);
  assert(h.dialog());
  assert.equal(h.document.querySelectorAll('.ev-center-result').length,1);
  assert.equal(h.snapshot().draws.length,1);
  assert.deepEqual(h.writes,[EVENT_KEY]);
  t.mock.timers.tick(10000);
  assert.equal(h.document.querySelectorAll('.ev-center-result').length,1);
  assert.equal(h.snapshot().draws.length,1);
});

test('switching to My Prizes during animation retains the committed batch and cancels late result overlays',async t=>{
  const h=await harness(t);
  h.click('[data-action="draw:1"]');
  const saved=h.snapshot(),id=saved.draws[0].id;
  h.click('[data-action="route-prizes"]');
  assert(h.document.querySelector(`[data-action="result:expert:${id}"]`));
  assert.equal(h.document.querySelector('#tab-prizes').getAttribute('aria-selected'),'true');
  t.mock.timers.tick(10000);
  assert.equal(h.dialog(),null);
  assert.deepEqual(h.snapshot(),saved);
  assert.deepEqual(h.writes,[EVENT_KEY]);
  h.click('[data-action="route-lottery"]');
  assert(h.document.querySelector('.ac-choices'));
  h.click('[data-action="event:expert"]');
  assert.equal(h.document.querySelector('[data-action="draw:1"]').disabled,false);
  assert.deepEqual(h.snapshot(),saved);
});

test('shell navigation away preserves the draw and leaves no delayed overlay on return',async t=>{
  const h=await harness(t);
  h.click('[data-action="draw:5"]');
  const saved=h.snapshot();
  h.shell({type:'visibility',active:false});
  t.mock.timers.tick(10000);
  assert.equal(h.dialog(),null);
  assert.deepEqual(h.snapshot(),saved);
  h.shell({type:'activate',route:'prizes'});
  assert(h.document.querySelector(`[data-action="result:expert:${saved.draws[0].id}"]`));
  assert.deepEqual(h.snapshot(),saved);
  assert.deepEqual(h.writes,[EVENT_KEY]);
});

test('disabled insufficient-ticket actions do not save a draw or mutate legacy history',async t=>{
  const h=await harness(t,orders(0));
  h.click('[data-action="pool:advanced"]');
  assert.equal(h.document.querySelector('[data-action="draw:1"]').disabled,true);
  h.click('[data-action="draw:1"]');
  assert.equal(h.snapshot().draws.length,0);
  assert.deepEqual(h.writes,[]);
  h.click('[data-action="choose-activity"]');
  h.click('[data-action="event:card-past"]');
  h.click('[data-action="draw-one"]');
  assert.equal(h.snapshot().draws.length,0);
  assert.deepEqual(h.writes,[]);
});

test('Double 11 ticket status switches stay inline, include both pools, and never alter stored balances',async t=>{
  const h=await harness(t,orders(10)),before=h.snapshot(),balance=h.balance();
  assert(h.document.querySelector('.et-tickets'));
  assert.match(h.document.querySelector('#et-ticket-records').textContent,/高级抽奖券/);
  h.click('[data-action="tickets-used"]');
  assert.equal(h.document.querySelector('[data-action="tickets-used"]').getAttribute('aria-pressed'),'true');
  assert.match(h.document.querySelector('#et-ticket-records').textContent,/暂无抽奖券使用记录/);
  assert.equal(h.document.querySelector('#ac-dialog').open,undefined);
  h.click('[data-action="tickets-expired"]');
  assert.equal(h.document.querySelector('[data-action="tickets-expired"]').getAttribute('aria-pressed'),'true');
  assert.match(h.document.querySelector('#et-ticket-records').textContent,/暂无已过期抽奖券/);
  h.click('[data-action="tickets-unused"]');
  assert.match(h.document.querySelector('#et-ticket-records').textContent,/普通抽奖券/);
  assert.match(h.document.querySelector('#et-ticket-records').textContent,/高级抽奖券/);
  assert.deepEqual(h.snapshot(),before);
  assert.deepEqual(h.balance(),balance);
  assert.deepEqual(h.writes,[]);
});

test('closing a revealed result removes celebration immediately without changing the saved draw',async t=>{
  const h=await harness(t);
  h.click('[data-action="pool:advanced"]');
  h.click('[data-action="draw:1"]');
  h.click('[data-action="skip-draw"]');
  const dialog=h.dialog(),saved=h.snapshot();
  assert(dialog);
  assert(dialog.querySelector('.gacha-celebration'));
  dialog.close();
  assert.equal(dialog.querySelector('.gacha-celebration'),null);
  assert.equal(dialog.isConnected,false);
  t.mock.timers.tick(10000);
  assert.equal(h.dialog(),null);
  assert.deepEqual(h.snapshot(),saved);
  assert.deepEqual(h.writes,[EVENT_KEY]);
});
