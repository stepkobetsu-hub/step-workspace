const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../core.js');

const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'..','app-catalog.json'),'utf8'));
const required=['id','displayName','description','category','productionUrl','parentSystem','keywords','favorite','recent','status'];

test('機能カタログは必要な内部項目を全件保持する',()=>{
  assert.equal(catalog.schemaVersion,1);
  assert.ok(catalog.apps.length>=19);
  for(const app of catalog.apps){for(const field of required)assert.ok(Object.hasOwn(app,field),`${app.id}: ${field}`);assert.ok(['active','hidden','legacy'].includes(app.status));assert.ok(Array.isArray(app.keywords));assert.ok(core.isUrl(app.productionUrl))}
});

test('スタッフ用アプリと講師ポータルの子機能を保持する',()=>{
  const active=catalog.apps.filter(app=>app.status==='active');
  assert.ok(active.filter(app=>app.parentSystem==='スタッフ用アプリ').length>=13);
  assert.equal(active.filter(app=>app.parentSystem==='講師ポータル').length,4);
  for(const name of ['面談メモ','ポイント設定','生徒・講師QR／入退室管理','過去問アップロード','授業報告','給与明細'])assert.ok(active.some(app=>app.displayName===name),name);
});

test('旧版と非公開画面は業務ホームの表示対象外になる',()=>{
  const visible=core.buildApps(catalog.apps);
  assert.ok(!visible.some(app=>app.status!=='active'));
  assert.ok(!visible.some(app=>/旧・不達|入塾後フォロー/.test(app.name)));
});

test('activeカードのIDと本番URLは重複しない',()=>{
  const active=catalog.apps.filter(app=>app.status==='active');
  assert.equal(new Set(active.map(app=>app.id)).size,active.length);
  assert.equal(new Set(active.map(app=>core.urlKey(app.productionUrl))).size,active.length);
});

test('用途語検索は関係のない同一カテゴリー機能を混ぜない',()=>{
  const visible=core.buildApps(catalog.apps);
  const payroll=core.filterApps(visible,'給与').map(app=>app.displayName||app.name);
  assert.ok(payroll.includes('給与明細'));
  assert.ok(!payroll.includes('授業報告'));
  assert.deepEqual(core.filterApps(visible,'面談').map(app=>app.name),['面談メモ']);
});
