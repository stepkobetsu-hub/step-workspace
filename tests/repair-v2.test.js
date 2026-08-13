const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'..','repair-workspace-v2.html'),'utf8');

test('完全復旧ページは貼り付け確認済みの7項目と件数を復元する',()=>{
  for(const value of ["label:'生徒・授業',count:7","label:'時間割',count:4","label:'連絡・受付',count:8","label:'管理・運営',count:4","label:'請求・会計',count:4","label:'講師・給与',count:7","label:'ポータル・ホーム',count:5"])assert.match(html,new RegExp(value.replace(/[・（）]/g,'.')));
  assert.match(html,/7項目・39カード（5555あり）/);
});

test('元のカード設定を維持し項目配列だけを補完する',()=>{
  assert.match(html,/const repaired=\{\.\.\.config,categories:/);
  assert.match(html,/workspaceConfig:repaired/);
  assert.match(html,/localStorage\.setItem\('stepWorkspaceConfigV1'/);
  assert.doesNotMatch(html,/stepStaffAppPassword/);
});

test('重複しない7項目と5555を検証するまで保存を許可しない',()=>{
  assert.match(html,/new Set\(ids\)\.size===expected\.length/);
  assert.match(html,/has5555/);
  assert.match(html,/button\.disabled=false/);
});
