import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument} from './dom-fixture.mjs';
import {START,END,VOUCHER_END,fresh,submitOrder} from '../public/expert-event-model.js';
import {eventCount,progressMarkup,resultMarkup} from '../public/expert-event-ui.js';

const T=START+10*3600000;
function orders(count) {
  let state=fresh('current-user');
  for(let i=1;i<=count;i++)state=submitOrder(state,{id:`expert-${i}`,category:'美妆'},T+i).state;
  return state;
}
const view=html=>createDocument(`<main>${html}</main>`);

test('14 submitted orders display their real cumulative count and keep earlier milestones available',()=>{
  const state=orders(14),document=view(progressMarkup(state));
  assert.equal(eventCount(state),14);
  assert.match(document.querySelector('.ev-progress-heading').textContent,/已完成\s*14\s*单/);
  const milestones=document.querySelectorAll('[data-step]');
  assert.deepEqual(milestones.map(node=>Number(node.dataset.step)),[2,4,6,8,10,12,14,16,18,20]);
  for(const step of [2,10,14])assert.equal(document.querySelector(`[data-step="${step}"]`).classList.contains('is-done'),true);
  assert.equal(document.querySelector('[data-step="16"]').classList.contains('is-next'),true);
  assert.equal(document.querySelector('[data-step="16"]').classList.contains('is-done'),false);
  assert.equal(document.querySelector('.ev-milestone-scroll').tabIndex,0);
  assert.match(document.querySelector('.ev-progress-note').textContent,/再鉴\s*2\s*单/);
});

test('the tenth milestone is advanced instead of ordinary and the next milestone continues at twelve',()=>{
  const before=view(progressMarkup(orders(9)));
  const tenth=before.querySelector('[data-step="10"]');
  assert.equal(tenth.classList.contains('is-premium'),true);
  assert.equal(tenth.classList.contains('is-next'),true);
  assert.equal(tenth.querySelector('small').textContent,'高级券');
  assert.match(before.querySelector('.ev-progress-note').textContent,/再鉴\s*1\s*单，得高级券/);
  const after=view(progressMarkup(orders(10)));
  assert.equal(after.querySelector('[data-step="10"]').classList.contains('is-done'),true);
  assert.equal(after.querySelector('[data-step="12"]').classList.contains('is-next'),true);
  assert.equal(after.querySelector('[data-step="12"] small').textContent,'普通券');
  assert.equal(after.querySelectorAll('[data-step="10"]').length,1);
});

test('compact AI card progress and full dialog show the same actual history',()=>{
  const state=orders(14);
  const full=view(progressMarkup(state)),compact=view(progressMarkup(state,{compact:true}));
  assert.equal(full.querySelector('.ev-progress-heading').textContent,compact.querySelector('.ev-progress-heading').textContent);
  assert.deepEqual(full.querySelectorAll('[data-step]').map(node=>node.getAttribute('aria-label')),compact.querySelectorAll('[data-step]').map(node=>node.getAttribute('aria-label')));
});

test('progress excludes card and other categories, other users, and submissions outside activity',()=>{
  let state=orders(2);
  for(const [id,category,now] of [
    ['card','卡牌',T],['other','配饰',T],['early','包袋',START-1],['late','美妆',END]
  ])state=submitOrder(state,{id,category},now).state;
  state.orders.push({id:'different-user',uid:'other',category:'美妆',eligible:true,at:T});
  state.orders.push({id:'excluded-even-if-valid-category',uid:state.uid,category:'美妆',eligible:false,at:T});
  assert.equal(state.orders.length,8);
  assert.equal(eventCount(state),2);
  assert.match(view(progressMarkup(state)).querySelector('.ev-progress-heading').textContent,/已完成\s*2\s*单/);
});

test('all six approved category groups contribute to the same progress count',()=>{
  let state=fresh();
  ['beauty','bags','footwear','apparel','watches','electronics-appliances'].forEach((category,index)=>{
    state=submitOrder(state,{id:`group-${index}`,category},T).state;
  });
  assert.equal(eventCount(state),6);
  assert.match(view(progressMarkup(state)).querySelector('.ev-progress-note').textContent,/距高级券\s*4\s*单/);
});

test('a no-prize single draw shows encouragement and directs the user to expert identification',()=>{
  const document=view(resultMarkup({pool:'ordinary',rewards:[{id:'no-prize',type:'none'}]}));
  assert.equal(document.querySelector('h2').textContent,'再接再厉');
  assert.equal(document.querySelectorAll('.ev-result-card').length,1);
  assert.equal(document.querySelector('.ev-result-card').classList.contains('is-empty'),true);
  assert.equal(document.querySelector('.ev-result-card strong').textContent,'再接再厉');
  assert.equal(document.querySelectorAll('.is-physical').length,0);
  assert.match(document.querySelector('[data-result-expert]').textContent,/免费，去专鉴/);
  assert.doesNotMatch(document.querySelector('.ev-result-heading').textContent,/好礼已抵达/);
});

test('five draw results retain each blank result and distinguish the actual physical and voucher wins',()=>{
  const document=view(resultMarkup({
    pool:'advanced',rewards:[
      {id:'p',type:'physical',prizeId:'ysl-cushion'},
      {id:'v1',type:'voucher',expiresAt:VOUCHER_END},
      {id:'n1',type:'none'},
      {id:'v2',type:'voucher',expiresAt:VOUCHER_END},
      {id:'n2',type:'none'}
    ]
  }));
  assert.equal(document.querySelector('h2').textContent,'好礼已抵达');
  const cards=document.querySelectorAll('.ev-result-card');
  assert.equal(cards.length,5);
  assert.equal(cards.filter(card=>card.classList.contains('is-empty')).length,2);
  assert.equal(cards.filter(card=>card.classList.contains('is-physical')).length,1);
  assert.deepEqual(cards.map(card=>card.querySelector('strong').textContent),['YSL气垫','专家鉴定券','再接再厉','专家鉴定券','再接再厉']);
  assert.match(document.querySelector('.ev-result-heading').textContent,/高级奖池\s*·\s*五连抽/);
  assert.match(document.querySelector('[data-result-again]').textContent,/再扭五次/);
});

test('five blanks do not become a five-prize celebration',()=>{
  const document=view(resultMarkup({pool:'ordinary',rewards:Array.from({length:5},(_,index)=>({id:`empty-${index}`,type:'none'}))}));
  assert.equal(document.querySelector('h2').textContent,'再接再厉');
  assert.equal(document.querySelectorAll('.ev-result-card.is-empty').length,5);
  assert.doesNotMatch(document.querySelector('.ev-result-heading').textContent,/好礼已抵达/);
});
