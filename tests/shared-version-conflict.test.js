const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.v20260814-30.js'),'utf8');

test('共有保存は読み込んだ版番号を必ず送る',()=>{
  assert.match(app,/expectedVersion:state\.sharedVersion/);
  assert.match(app,/async function ensureSharedReady/);
  assert.match(app,/api\('getWorkspaceConfig'\)/);
});

test('古い版の保存は最新版を読み直して変更のやり直しを案内する',()=>{
  assert.match(app,/WORKSPACE_VERSION_CONFLICT/);
  assert.match(app,/applySharedPayload\(result\.sharedState,result\.version\)/);
  assert.match(app,/変更をもう一度/);
});

test('未保存変更の待機中は定期同期で上書きしない',()=>{
  assert.match(app,/state\.sharedPublishing\|\|state\.sharedSaveTimer/);
  assert.match(app,/state\.sharedSaveTimer=null/);
});

test('復旧ページも保存直前に最新版を取得する',()=>{
  for(const file of ['recover-workspace.html','repair-workspace-v2.html','rebuild-workspace.html']){
    const html=fs.readFileSync(path.join(root,file),'utf8');
    assert.match(html,/action:'getWorkspaceConfig'/,file);
    assert.match(html,/expectedVersion:Number\(latest\.version\|\|0\)/,file);
  }
});
