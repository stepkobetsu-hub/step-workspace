const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');

test('起動時は認証確認画面だけを表示する',()=>{assert.match(html,/body data-state="checking"/);assert.match(html,/id="loginScreen" hidden/);assert.match(html,/id="appShell" hidden/);assert.match(app,/setScreen\('checking'\)/)});
test('スタッフ共通認証と台帳APIを再利用する',()=>{assert.match(app,/api\('staffLogin'/);assert.match(app,/api\('getSystemRegistry'\)/);assert.match(app,/stepStaffAppAuth/);assert.match(app,/\['2','3','4'\]/)});
test('アプリカードは通常のリンクを使う',()=>{assert.match(html,/<a class="app-link">/);assert.match(app,/link\.href=app\.url/);assert.doesNotMatch(app,/window\.location/)});
test('明示ログアウトで認証情報だけを削除する',()=>{assert.match(app,/api\('logoutSystemPortal'\)/);assert.match(app,/removeItem\(AUTH_KEY\)/);assert.match(app,/removeItem\(STAFF_CODE_KEY\)/);assert.match(app,/removeItem\(STAFF_PASSWORD_KEY\)/)});
test('お気に入りと最近使ったアプリを端末へ保存する',()=>{assert.match(app,/stepWorkspaceFavoritesV1/);assert.match(app,/stepWorkspaceRecentV1/);assert.match(app,/slice\(0,5\)/)});
test('開発情報を画面文言に露出しない',()=>{for(const term of ['Apps Script Project ID','commit SHA','Worker名','D1','R2','API URL','調査メモ'])assert.doesNotMatch(html,new RegExp(term))});
