const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../core.js');

const records=[
  {ID:'billing','システム名':'請求管理システムV3.1（学費計算・請求データ作成）','利用者向けURL':'https://example.com/billing','概要':'技術情報を含む長い説明 Apps Script'},
  {ID:'invoice','システム名':'STEP請求書PDF作成・配信システム','利用者向けURL':'https://example.com/invoice'},
  {ID:'message','システム名':'STEP配信システム','利用者向けURL':'https://example.com/message','概要':'生徒・保護者への連絡'},
  {ID:'teacher','システム名':'講師ポータル','利用者向けURL':'https://example.com/teacher'},
  {ID:'grades','システム名':'成績管理','利用者向けURL':'https://example.com/grades'}
];

test('台帳の正式URLを優先してアプリへ変換する',()=>{const app=core.toApp(records[0]);assert.equal(app.url,'https://example.com/billing');assert.equal(app.categoryId,'billing')});
test('請求管理と請求書PDFを別アプリとして保持する',()=>{const apps=core.buildApps(records);assert.notEqual(apps[0].id,apps[1].id);assert.equal(apps.filter(app=>app.categoryId==='billing').length,2)});
test('日本語の名前・説明・キーワードでリアルタイム検索できる',()=>{const apps=core.buildApps(records);assert.deepEqual(core.filterApps(apps,'請求').map(app=>app.id),['billing','invoice']);assert.ok(core.filterApps(apps,'はいしん').some(app=>app.id==='message'))});
test('用途別に5分類する',()=>{const apps=core.buildApps(records);assert.equal(apps.find(app=>app.id==='message').categoryId,'contact');assert.equal(apps.find(app=>app.id==='teacher').categoryId,'teacher');assert.equal(apps.find(app=>app.id==='grades').categoryId,'student')});
test('説明文に請求が含まれても講師予定は講師へ分類し請求検索へ混ぜない',()=>{const app=core.toApp({ID:'schedule','システム名':'講師予定・夏休み出勤登録','概要':'請求処理と連携する講師予定'});assert.equal(app.categoryId,'teacher');assert.equal(core.filterApps([app],'請求').length,0)});
test('出退くんQRは台帳分類に講師が含まれても連絡・受付へ分類する',()=>{const app=core.toApp({ID:'qr','システム名':'出退くんQR作成・読取','分類':'生徒・講師'});assert.equal(app.categoryId,'contact')});
test('既定のお気に入りは主要業務を最大5件選ぶ',()=>{const ids=core.defaultFavoriteIds(core.buildApps(records));assert.ok(ids.includes('billing'));assert.ok(ids.includes('invoice'));assert.ok(ids.includes('message'));assert.ok(ids.length<=5)});
test('HTTP以外や要確認の値をリンクにしない',()=>{assert.equal(core.firstUrl({'利用者向けURL':'要確認'}),'');assert.equal(core.firstUrl({'利用者向けURL':'javascript:alert(1)'}),'')});
test('SYSTEM_REGISTRYの正式一覧を解析する',()=>{const md='| 正式名称 | 状態 | 利用者向け本番URL | リポジトリ |\n|---|---|---|---|\n| 成績管理 | 本番 | https://example.com/grades | [repo](https://github.com/x/y) |\n| 生徒マスタ | 本番 | 要確認 | 要確認 |\n';const items=core.parseRegistryMarkdown(md);assert.equal(items.length,2);assert.equal(items[0]['正式名称'],'成績管理');assert.equal(items[0]['利用者向けURL'],'https://example.com/grades')});
test('Markdown正式一覧へAPI詳細をマージし不足登録も残す',()=>{const api=[{'システム名':'成績管理','概要':'成績を管理','利用者向けURL':'https://example.com/grades'}];const markdown=[{'正式名称':'成績管理','状態':'本番','利用者向けURL':'https://example.com/grades'},{'正式名称':'過去問保管DB','状態':'本番','利用者向けURL':'https://example.com/past'}];const merged=core.mergeRegistrySources(api,markdown);assert.equal(merged.length,2);assert.equal(merged[0]['概要'],'成績を管理');assert.equal(merged[1]['正式名称'],'過去問保管DB')});
