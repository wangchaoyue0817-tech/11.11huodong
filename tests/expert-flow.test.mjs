import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createDocument} from './dom-fixture.mjs';

const source = filename => readFileSync(new URL(`../public/${filename}`, import.meta.url), 'utf8');
function fixture() {
  const document = createDocument(source('home.html'));
  const window = {addEventListener() {}, jianxRoute() {}};
  const location = {href: 'http://localhost/home.html', search: ''};
  const context = vm.createContext({
    window, document, location, URL, URLSearchParams,
    history: {replaceState(_state, _title, url) { location.href = String(url); }},
    matchMedia: () => ({matches: true}),
    ResizeObserver: class { observe() {} },
    requestAnimationFrame() {}, setInterval() {}, clearInterval() {}, setTimeout() {}, clearTimeout() {}
  });
  for (const filename of ['data.js', 'assets/icon-map.js', 'app.js', 'expert-catalog.js', 'expert-picker.js']) {
    vm.runInContext(source(filename), context, {filename});
  }
  return {document, window, context, node: id => document.getElementById(id), catalog: vm.runInContext('EXPERT_CATALOG', context)};
}

test('home and expert controllers initialize against the actual HTML with no dangling DOM bindings', () => {
  const f = fixture();
  assert.equal(typeof f.node('expertCta').onclick, 'function');
  f.node('expertCta').click();
  assert.equal(f.node('expertPickerRoot').hidden, false);
  assert.equal(f.node('expertPickerRoot').dataset.view, 'categories');
  assert.equal(f.node('epCategoryGrid').children.length, 28);
  assert.equal(f.node('epCategoryTabs').children.length, 28);
  f.node('epClose').click();
  assert.equal(f.node('expertPickerRoot').hidden, true);
});

test('all 28 categories contain valid groups, selectable styles and prices', () => {
  const f = fixture();
  assert.equal(f.catalog.length, 28);
  assert.equal(new Set(f.catalog.map(category => category.id)).size, 28);
  f.node('expertCta').click();
  let checkedGroups = 0, checkedStyles = 0;
  for (const [index, category] of f.catalog.entries()) {
    assert.ok(category.name && category.groupLabel && category.styleLabel && category.icon, category.id);
    assert.ok(Number.isInteger(category.price) && category.price > 0, category.id);
    assert.ok(category.groups.length > 0, category.id);
    f.node('epCategoryGrid').children[index].click();
    assert.equal(f.node('epPrice').textContent, `¥${(category.price / 100).toFixed(2)}`);
    for (const [groupIndex, group] of category.groups.entries()) {
      assert.ok(group.name && group.styles.length, `${category.id}: group ${groupIndex}`);
      f.node('epGroups').querySelector(`[data-ep-group="${groupIndex}"]`).click();
      assert.equal(f.node('epStyles').querySelectorAll('[data-ep-style]').length, group.styles.length);
      for (const [styleIndex, style] of group.styles.entries()) {
        const name = typeof style === 'string' ? style : style.name;
        assert.ok(typeof name === 'string' && name.trim(), `${category.id}: style ${styleIndex}`);
        f.node('epStyles').querySelector(`[data-ep-style="${styleIndex}"]`).click();
        assert.equal(f.node('epConfirm').disabled, false);
        assert.ok(f.node('epSelection').textContent.includes(name));
        checkedStyles++;
      }
      checkedGroups++;
    }
  }
  assert.ok(checkedGroups >= 28 && checkedStyles >= checkedGroups);
});

test('brand and style search filter actual options and recover after no-result queries', () => {
  const f = fixture();
  f.node('expertCta').click();
  f.node('epCategoryGrid').children[0].click();
  f.node('epGroupSearch').value = 'Chanel';
  f.node('epGroupSearch').dispatchEvent({type: 'input'});
  assert.equal(f.node('epGroups').querySelectorAll('[data-ep-group]').length, 1);
  f.node('epGroups').querySelector('[data-ep-group]').click();
  f.node('epStyleSearch').value = 'classic';
  f.node('epStyleSearch').dispatchEvent({type: 'input'});
  assert.equal(f.node('epStyles').querySelectorAll('[data-ep-style]').length, 1);
  assert.match(f.node('epStyles').textContent, /Classic Flap/);
  f.node('epStyleSearch').value = 'does-not-exist';
  f.node('epStyleSearch').dispatchEvent({type: 'input'});
  assert.equal(f.node('epStyles').querySelectorAll('[data-ep-style]').length, 0);
  assert.match(f.node('epStyles').textContent, /没有找到/);
  f.node('epStyleSearch').value = '';
  f.node('epStyleSearch').dispatchEvent({type: 'input'});
  assert.equal(f.node('epStyles').querySelectorAll('[data-ep-style]').length, 3);
});

test('feedback, agreement, and selection confirmation retain their interactive safeguards', () => {
  const f = fixture();
  f.node('expertCta').click();
  f.node('epCategoryGrid').children[0].click();
  f.node('epGroups').querySelector('[data-ep-group]').click();
  f.node('epStyles').querySelector('[data-ep-style]').click();
  f.node('epConfirm').click();
  assert.match(f.node('epStatus').textContent, /请先阅读并勾选/);
  f.node('epAgreementLink').click();
  assert.equal(f.node('expertPickerRoot').dataset.view, 'agreement');
  assert.match(f.node('epAuxView').textContent, /在线鉴别服务协议/);
  f.node('epBack').click();
  f.node('epFeedback').click();
  f.node('epSaveFeedback').click();
  assert.match(f.node('epFeedbackStatus').textContent, /请先填写/);
  f.node('epFeedbackText').value = '宝可梦卡牌 新增系列';
  f.node('epSaveFeedback').click();
  assert.match(f.node('epFeedbackStatus').textContent, /已在本次演示中记录/);
  f.node('epBack').click();
  f.node('epFeedback').click();
  assert.equal(f.node('epFeedbackText').value, '宝可梦卡牌 新增系列');
  f.node('epBack').click();
  f.node('epAgree').checked = true;
  f.node('epAgree').dispatchEvent({type: 'change'});
  f.node('epConfirm').click();
  assert.match(f.node('epConfirm').textContent, /已确认选择/);
  assert.match(f.node('epStatus').textContent, /未创建订单或扣费/);
});
