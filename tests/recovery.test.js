const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'..','recover-workspace.html'),'utf8');

test('復旧ページは既存配置とお気に入りだけを認証済み共有APIへ送る',()=>{
  for(const value of ['stepWorkspaceConfigV1','stepWorkspaceFavoritesV1','stepStaffAppAuth','saveWorkspaceConfig','systemPortalSessionToken'])assert.match(html,new RegExp(value));
  assert.match(html,/workspaceConfig:config/);
  assert.doesNotMatch(html,/stepStaffAppPassword/);
});

test('復旧前に項目と追加カードを画面で確認できる',()=>{
  assert.match(html,/項目 \$\{categoryNames\.length\}件・追加カード \$\{customNames\.length\}件/);
  assert.match(html,/追加カード：\$\{customNames\.join/);
  assert.match(html,/この配置を全端末へ復旧する/);
});
