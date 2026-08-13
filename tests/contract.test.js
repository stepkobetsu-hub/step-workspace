const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');

test('all card links open in a safe new tab',()=>{assert.match(app,/link\.target='_blank'/);assert.match(app,/link\.rel='noopener noreferrer'/)});
test('categories can be added and deleted through saved history',()=>{assert.match(app,/delete-category-button/);assert.match(app,/deleteCategory\(/);assert.match(app,/removedCategories/);assert.match(app,/commitConfig\(config=>/)});

test('起動時は認証確認画面だけを表示する',()=>{assert.match(html,/body data-state="checking"/);assert.match(html,/id="loginScreen" hidden/);assert.match(html,/id="appShell" hidden/);assert.match(app,/setScreen\('checking'\)/)});
test('スタッフ共通認証と台帳・機能カタログを再利用する',()=>{assert.match(app,/api\('staffLogin'/);assert.match(app,/api\('getSystemRegistry'\)/);assert.match(app,/workspace-apps\.json/);assert.match(app,/app-catalog\.json/);assert.match(app,/mergeRegistrySources/);assert.match(app,/mergeCatalogSources/);assert.match(app,/stepStaffAppAuth/);assert.match(app,/\['2','3','4'\]/)});
test('アプリカードは通常のリンクを使う',()=>{assert.match(html,/<a class="app-link">/);assert.match(app,/link\.href=app\.url/);assert.doesNotMatch(app,/window\.location/)});
test('Googleスプレッドシートのカードは専用SVGアイコンを表示する',()=>{assert.match(app,/sheet-app-icon/);assert.match(app,/Google スプレッドシート/);assert.match(app,/sheet-grid/)});
test('Sheetsカードは分類アイコンと同じ大きさのSheetsマークを横に併記する',()=>{assert.match(html,/class="app-icons"/);assert.match(html,/class="sheet-app-icon"/);assert.match(app,/sheet\.hidden=app\.iconType!==\'google-sheet\'/)});
test('項目編集・カード移動・端末指定を端末へ保存する',()=>{assert.match(html,/id="settingsButton"/);assert.match(html,/id="organizeButton"/);assert.match(html,/aria-label="利用端末"/);assert.match(app,/stepWorkspaceConfigV1/);assert.match(app,/moveApp\(/);assert.match(app,/setDevice\(/);assert.match(app,/showModal\(\)/);assert.match(app,/dragstart/)});
test('戻る・進むと同一項目内の並べ替えを提供する',()=>{assert.match(html,/id="undoButton"/);assert.match(html,/id="redoButton"/);assert.match(html,/class="move-up"/);assert.match(html,/class="move-down"/);assert.match(app,/undoConfig\(/);assert.match(app,/redoConfig\(/);assert.match(app,/reorderApp\(/)});
test('カード追加とアーカイブ・復元・完全削除を提供する',()=>{for(const id of ['addCardButton','archiveButton','addCardDialog','archiveDialog','archiveList'])assert.match(html,new RegExp(`id="${id}"`));assert.match(app,/addCard\(/);assert.match(app,/archiveApp\(/);assert.match(app,/restoreApp\(/);assert.match(app,/permanentlyDeleteApp\(/);assert.match(app,/この操作は戻せません/)});
test('明示ログアウトで認証情報だけを削除する',()=>{assert.match(app,/api\('logoutSystemPortal'\)/);assert.match(app,/removeItem\(AUTH_KEY\)/);assert.match(app,/removeItem\(STAFF_CODE_KEY\)/);assert.match(app,/removeItem\(STAFF_PASSWORD_KEY\)/)});
test('お気に入りと最近使ったアプリを端末へ保存する',()=>{assert.match(app,/stepWorkspaceFavoritesV1/);assert.match(app,/stepWorkspaceRecentV1/);assert.match(app,/slice\(0,5\)/)});
test('開発情報を画面文言に露出しない',()=>{for(const term of ['Apps Script Project ID','commit SHA','Worker名','D1','R2','API URL','調査メモ'])assert.doesNotMatch(html,new RegExp(term))});
