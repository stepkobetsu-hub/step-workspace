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
test('既定のお気に入りは主要業務を最大5件選ぶ',()=>{const ids=core.defaultFavoriteIds(core.buildApps(records));assert.ok(ids.includes('billing'));assert.ok(ids.includes('invoice'));assert.ok(ids.includes('message'));assert.ok(ids.length<=5)});
test('HTTP以外や要確認の値をリンクにしない',()=>{assert.equal(core.firstUrl({'利用者向けURL':'要確認'}),'');assert.equal(core.firstUrl({'利用者向けURL':'javascript:alert(1)'}),'')});
