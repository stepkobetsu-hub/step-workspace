const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'..','rebuild-workspace.html'),'utf8');

test('貼り付けられた7項目39カードを正本として再作成する',()=>{
  for(const item of [['生徒・授業',7],['時間割',4],['連絡・受付',8],['管理・運営',4],['請求・会計',4],['講師・給与',7],['ポータル・ホーム',5]])assert.match(html,new RegExp(`label:'${item[0]}'.*count:${item[1]}`));
  assert.match(html,/const definitions=\[/);
  assert.match(html,/URL確認済み/);
});

test('残存する同名カードと正式台帳URLを優先して引き継ぐ',()=>{
  assert.match(html,/function recoveredUrl\(name\)/);
  assert.match(html,/oldConfig\.customApps/);
  assert.match(html,/oldOverrides\[app\.id\]\?\.url\|\|app\.productionUrl/);
  assert.match(html,/return known\[name\]\|\|''/);
});

test('URL不明カードだけリンク切れを表示して後から編集可能にする',()=>{
  assert.match(html,/displayName=recovered\?name:`リンク切れ\$\{name\}`/);
  assert.match(html,/#link-missing-/);
  assert.match(html,/cardOverrides\[id\]=\{name:displayName,description,url/);
});

test('再作成内容を認証済み共有APIと同じ端末へ保存する',()=>{
  assert.match(html,/action:'saveWorkspaceConfig'/);
  assert.match(html,/workspaceConfig:rebuilt/);
  assert.match(html,/localStorage\.setItem\('stepWorkspaceConfigV1'/);
  assert.doesNotMatch(html,/stepStaffAppPassword/);
  assert.match(html,/replaceCatalog:true/);
  assert.match(html,/removedCategories:\['admin'\]/);
});
