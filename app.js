(function(){
  'use strict';
  const Core=window.StepWorkspaceCore;
  const GAS='https://script.google.com/macros/s/AKfycbypkUc0MqZ07E7pZRglNPeRM56WbCcuWaLpRzi9bVFcPklHDxaaLC7GfzG6ozTGCbEX/exec';
  const REGISTRY_EXPORT='https://stepkobetsu-hub.github.io/step-system-registry/workspace-apps.json?v=20260813-3';
  const APP_CATALOG='app-catalog.json?v=20260813-1';
  const AUTH_KEY='stepStaffAppAuth';
  const STAFF_CODE_KEY='stepStaffAppCode';
  const STAFF_PASSWORD_KEY='stepStaffAppPassword';
  const FAVORITES_KEY='stepWorkspaceFavoritesV1';
  const RECENT_KEY='stepWorkspaceRecentV1';
  const WORKSPACE_CONFIG_KEY='stepWorkspaceConfigV1';
  const ALLOWED_PERMISSIONS=['2','3','4'];
  const state={baseApps:[],allApps:[],apps:[],favorites:[],recent:[],auth:null,config:Core.defaultWorkspaceConfig(),organizing:false,history:{past:[],future:[]}};
  const byId=id=>document.getElementById(id);
  const readJson=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch(_){return fallback}};
  const writeJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(_){}};

  function readAuth(){const value=readJson(AUTH_KEY,null);return value&&value.systemPortalSessionToken?value:null}
  async function api(action,extra){
    const auth=readAuth();
    const response=await fetch(GAS,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({action,systemPortalSessionToken:auth?.systemPortalSessionToken||''},extra||{})),redirect:'follow'});
    const body=await response.text();
    if(!response.ok)throw new Error(`認証サーバーに接続できませんでした（${response.status}）`);
    try{return JSON.parse(body)}catch(_){throw new Error('認証サーバーから正しい応答を受け取れませんでした。')}
  }
  function setScreen(name){
    document.body.dataset.state=name;
    byId('loadingScreen').hidden=name!=='checking';
    byId('loginScreen').hidden=name!=='login';
    byId('appShell').hidden=name!=='home';
  }
  function showLogin(message){
    setScreen('login');
    byId('loginCode').value=localStorage.getItem(STAFF_CODE_KEY)||'';
    byId('loginPassword').value=localStorage.getItem(STAFF_PASSWORD_KEY)||'';
    byId('loginError').textContent=message||'';
    byId('loginError').hidden=!message;
    requestAnimationFrame(()=>{(byId('loginCode').value?byId('loginPassword'):byId('loginCode')).focus()});
  }
  function saveAuth(result,code){
    const value={code,name:result.name||'',permissionLevel:String(result.permissionLevel||''),systemPortalSessionToken:result.systemPortalSessionToken,systemPortalExpiresAt:result.systemPortalExpiresAt||'',savedAt:new Date().toISOString()};
    localStorage.setItem(AUTH_KEY,JSON.stringify(value));state.auth=value;return value;
  }
  async function loginWith(code,password){
    const result=await api('staffLogin',{code,password});
    if(!result.success)throw new Error(result.error||'ログインできませんでした。');
    if(!ALLOWED_PERMISSIONS.includes(String(result.permissionLevel))||!result.systemPortalSessionToken)throw new Error('STEP 業務ホームを利用する権限がありません。');
    localStorage.setItem(STAFF_CODE_KEY,code);localStorage.setItem(STAFF_PASSWORD_KEY,password);saveAuth(result,code);
    return loadRegistry();
  }
  async function loadRegistry(){
    const [result,registryExport,catalogExport]=await Promise.all([api('getSystemRegistry'),fetch(REGISTRY_EXPORT,{cache:'no-store'}).then(response=>response.ok?response.json():null).catch(()=>null),fetch(APP_CATALOG,{cache:'no-store'}).then(response=>response.ok?response.json():null).catch(()=>null)]);
    if(!result.success)throw new Error(result.error||'アプリ一覧を取得できませんでした。');
    const registered=Array.isArray(registryExport?.apps)?registryExport.apps:[];const systems=registered.length?Core.mergeRegistrySources(result.systems,registered):result.systems;const source=Core.mergeCatalogSources(systems,catalogExport?.apps);
    state.auth=readAuth();state.baseApps=Core.buildApps(source);state.config=Core.normalizeWorkspaceConfig(readJson(WORKSPACE_CONFIG_KEY,Core.defaultWorkspaceConfig()));rebuildApps();
    if(!state.apps.length)throw new Error('利用できるアプリが登録されていません。');
    state.favorites=readJson(FAVORITES_KEY,null);
    if(!Array.isArray(state.favorites)){state.favorites=Core.defaultFavoriteIds(state.apps);writeJson(FAVORITES_KEY,state.favorites)}
    state.favorites=state.favorites.filter(id=>state.allApps.some(app=>app.id===id));
    state.recent=(readJson(RECENT_KEY,[])||[]).filter(entry=>state.allApps.some(app=>app.id===entry.id)).slice(0,5);
    renderAll();setScreen('home');
  }
  async function init(){
    setScreen('checking');
    const auth=readAuth();
    if(auth&&ALLOWED_PERMISSIONS.includes(String(auth.permissionLevel))){
      try{await loadRegistry();return}catch(_){}
    }
    const code=localStorage.getItem(STAFF_CODE_KEY)||'';const password=localStorage.getItem(STAFF_PASSWORD_KEY)||'';
    if(code&&password){try{await loginWith(code,password);return}catch(error){showLogin(error.message);return}}
    showLogin();
  }
  function renderAll(){
    const name=state.auth?.name?String(state.auth.name).trim():'';byId('userName').textContent=name;
    byId('appCount').textContent=`${state.apps.length}件のアプリ`;
    renderFavorites();renderRecent();renderCategories();renderSearch();
    updateHistoryButtons();
  }
  const clone=value=>JSON.parse(JSON.stringify(value));
  function rebuildApps(){
    const custom=Core.buildApps(state.config.customApps);const seen=new Set();state.allApps=[...custom,...state.baseApps].filter(app=>{if(seen.has(app.id)||state.config.deleted.includes(app.id))return false;seen.add(app.id);return true});
    state.apps=Core.applyWorkspaceConfig(state.allApps.filter(app=>!state.config.archived.includes(app.id)),state.config);
  }
  function persistConfig(){state.config=Core.normalizeWorkspaceConfig(state.config);writeJson(WORKSPACE_CONFIG_KEY,state.config);rebuildApps();renderAll()}
  function commitConfig(change){state.history.past.push(clone(state.config));state.history.past=state.history.past.slice(-40);state.history.future=[];change(state.config);persistConfig()}
  function undoConfig(){const previous=state.history.past.pop();if(!previous)return;state.history.future.push(clone(state.config));state.config=previous;persistConfig()}
  function redoConfig(){const next=state.history.future.pop();if(!next)return;state.history.past.push(clone(state.config));state.config=next;persistConfig()}
  function updateHistoryButtons(){byId('undoButton').disabled=!state.history.past.length;byId('redoButton').disabled=!state.history.future.length}
  function renderAppIcon(group,app){
    group.querySelector('.app-icon').textContent=app.initial;const sheet=group.querySelector('.sheet-app-icon');sheet.hidden=app.iconType!=='google-sheet';
    if(app.iconType==='google-sheet')sheet.innerHTML='<svg viewBox="0 0 24 24" role="img" aria-label="Google スプレッドシート"><path class="sheet-page" d="M6.5 2h7l4 4v16h-11a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path class="sheet-fold" d="M13.5 2v4h4"/><path class="sheet-grid" d="M8 10.5h6.5M8 14h6.5M8 17.5h6.5M10.2 10.5v7"/></svg>';
  }
  function fillCategoryOptions(select,selected){select.replaceChildren(...state.config.categories.map(category=>{const option=document.createElement('option');option.value=category.id;option.textContent=category.label;option.selected=category.id===selected;return option}))}
  function createCard(app,context){
    const card=byId('appCardTemplate').content.firstElementChild.cloneNode(true);
    card.dataset.appId=app.id;card.dataset.device=app.device;card.classList.add(app.categoryClass);
    const favorite=card.querySelector('.favorite-button');const active=state.favorites.includes(app.id);
    favorite.hidden=!app.favoriteEnabled;favorite.classList.toggle('is-favorite',active);favorite.querySelector('span').textContent=active?'★':'☆';favorite.setAttribute('aria-label',active?`${app.name}をお気に入りから外す`:`${app.name}をお気に入りに追加`);
    if(app.favoriteEnabled)favorite.addEventListener('click',()=>toggleFavorite(app.id));
    const device=card.querySelector('.device-control select');device.value=app.device;device.addEventListener('change',event=>setDevice(app.id,event.target.value));
    card.querySelector('.archive-card-button').addEventListener('click',()=>archiveApp(app.id));
    const move=card.querySelector('.move-control');move.hidden=!(state.organizing&&context==='category');fillCategoryOptions(move.querySelector('select'),app.categoryId);move.querySelector('select').addEventListener('change',event=>moveApp(app.id,event.target.value));move.querySelector('.move-up').addEventListener('click',()=>reorderApp(app.id,-1));move.querySelector('.move-down').addEventListener('click',()=>reorderApp(app.id,1));
    if(state.organizing&&context==='category'){card.draggable=true;card.classList.add('is-organizing');card.addEventListener('dragstart',event=>{card.classList.add('is-dragging');event.dataTransfer.setData('text/plain',app.id);event.dataTransfer.effectAllowed='move'});card.addEventListener('dragend',()=>card.classList.remove('is-dragging'))}
    renderAppIcon(card.querySelector('.app-icons'),app);card.querySelector('.app-copy strong').textContent=app.name;card.querySelector('.app-copy small').textContent=app.description;
    const link=card.querySelector('.app-link');
    if(app.url){link.href=app.url;link.target='_blank';link.rel='noopener noreferrer';if(app.recentEnabled)link.addEventListener('click',()=>recordRecent(app.id))}
    else{card.classList.add('is-unavailable');link.removeAttribute('href');link.setAttribute('aria-disabled','true');card.querySelector('.open-label').textContent='本番URL確認中'}
    return card;
  }
  function replaceCards(root,apps,context){root.replaceChildren(...apps.map(app=>createCard(app,context)))}
  function renderFavorites(){
    const apps=state.favorites.map(id=>state.apps.find(app=>app.id===id)).filter(Boolean);
    replaceCards(byId('favoriteGrid'),apps,'favorite');
    byId('favoriteSection').hidden=!apps.length;
  }
  function renderRecent(){
    const apps=state.recent.map(entry=>state.apps.find(app=>app.id===entry.id)).filter(Boolean);
    replaceCards(byId('recentGrid'),apps,'recent');byId('recentSection').hidden=!apps.length;
  }
  function renderCategories(){
    const groups=Core.groupByCategory(state.apps,state.config.categories,state.config.orders,true);const tabs=byId('categoryTabs');const sections=byId('categorySections');tabs.replaceChildren();sections.replaceChildren();
    groups.forEach(({category,apps},index)=>{
      const navItem=document.createElement('div');navItem.className=`category-nav-item ${category.className}`;navItem.dataset.categoryId=category.id;navItem.draggable=state.organizing;
      const anchor=document.createElement('a');anchor.href=`#category-${category.id}`;anchor.innerHTML='<i aria-hidden="true"></i><span></span><small></small>';anchor.querySelector('i').textContent=category.initial;anchor.querySelector('span').textContent=category.label;anchor.querySelector('small').textContent=apps.length;
      const controls=document.createElement('div');controls.className='category-order-controls';controls.hidden=!state.organizing;const up=document.createElement('button');up.type='button';up.textContent='↑';up.disabled=index===0;up.setAttribute('aria-label',`${category.label}を上へ`);up.addEventListener('click',()=>reorderCategory(category.id,-1));const down=document.createElement('button');down.type='button';down.textContent='↓';down.disabled=index===groups.length-1;down.setAttribute('aria-label',`${category.label}を下へ`);down.addEventListener('click',()=>reorderCategory(category.id,1));controls.append(up,down);navItem.append(anchor,controls);
      navItem.addEventListener('dragstart',event=>{if(!state.organizing)return;navItem.classList.add('is-dragging');event.dataTransfer.setData('application/x-step-category',category.id);event.dataTransfer.effectAllowed='move'});navItem.addEventListener('dragend',()=>navItem.classList.remove('is-dragging'));
      navItem.addEventListener('dragover',event=>{if(!state.organizing)return;event.preventDefault();navItem.classList.add('is-drop-target')});navItem.addEventListener('dragleave',()=>navItem.classList.remove('is-drop-target'));navItem.addEventListener('drop',event=>{if(!state.organizing)return;event.preventDefault();navItem.classList.remove('is-drop-target');const draggedCategory=event.dataTransfer.getData('application/x-step-category');if(draggedCategory){const after=event.clientY>navItem.getBoundingClientRect().top+navItem.offsetHeight/2;moveCategory(draggedCategory,category.id,after)}else moveApp(event.dataTransfer.getData('text/plain'),category.id)});tabs.append(navItem);
      const section=document.createElement('section');section.id=`category-${category.id}`;section.className=`category-block ${category.className}`;
      const header=document.createElement('div');header.className='category-header';header.innerHTML=`<i class="category-dot" aria-hidden="true"></i><h3></h3><span></span>`;header.querySelector('h3').textContent=category.label;header.querySelector('span').textContent=`${apps.length}件`;
      const grid=document.createElement('div');grid.className='app-grid';grid.dataset.categoryId=category.id;replaceCards(grid,apps,'category');if(!apps.length){grid.classList.add('is-empty-category');const empty=document.createElement('p');empty.textContent=state.organizing?'ここへカードを移動できます':'カードはまだありません';grid.append(empty)}grid.addEventListener('dragover',event=>{if(!state.organizing)return;event.preventDefault();grid.classList.add('is-drop-target')});grid.addEventListener('dragleave',()=>grid.classList.remove('is-drop-target'));grid.addEventListener('drop',event=>{event.preventDefault();grid.classList.remove('is-drop-target');moveApp(event.dataTransfer.getData('text/plain'),category.id)});section.append(header,grid);sections.append(section);
    });
  }
  function renderSearch(){
    const query=byId('searchInput').value;const active=Core.normalize(query)!=='';byId('searchSection').hidden=!active;byId('defaultSections').hidden=active;
    if(!active)return;const apps=Core.filterApps(state.apps,query);replaceCards(byId('searchGrid'),apps,'search');byId('searchCount').textContent=`${apps.length}件`;byId('searchEmpty').hidden=apps.length>0;
  }
  function setDevice(id,device){commitConfig(config=>{config.devices[id]=device})}
  function moveApp(id,categoryId){if(!id||!state.config.categories.some(category=>category.id===categoryId))return;const current=state.apps.find(app=>app.id===id)?.categoryId;const targetIds=Core.groupByCategory(state.apps,state.config.categories,state.config.orders,true).find(group=>group.category.id===categoryId)?.apps.map(app=>app.id).filter(value=>value!==id)||[];commitConfig(config=>{config.assignments[id]=categoryId;if(current&&config.orders[current])config.orders[current]=config.orders[current].filter(value=>value!==id);config.orders[categoryId]=[...targetIds,id]})}
  function reorderApp(id,direction){const app=state.apps.find(value=>value.id===id);if(!app)return;const ids=Core.groupByCategory(state.apps,state.config.categories,state.config.orders,true).find(group=>group.category.id===app.categoryId)?.apps.map(value=>value.id)||[];const index=ids.indexOf(id);const target=index+direction;if(index<0||target<0||target>=ids.length)return;[ids[index],ids[target]]=[ids[target],ids[index]];commitConfig(config=>{config.orders[app.categoryId]=ids})}
  function reorderCategory(id,direction){const index=state.config.categories.findIndex(category=>category.id===id);const target=index+direction;if(index<0||target<0||target>=state.config.categories.length)return;commitConfig(config=>{[config.categories[index],config.categories[target]]=[config.categories[target],config.categories[index]]})}
  function moveCategory(id,targetId,after){if(!id||id===targetId)return;commitConfig(config=>{const index=config.categories.findIndex(category=>category.id===id);if(index<0)return;const [category]=config.categories.splice(index,1);const target=config.categories.findIndex(item=>item.id===targetId);config.categories.splice(target+(after?1:0),0,category)})}
  function archiveApp(id){commitConfig(config=>{if(!config.archived.includes(id))config.archived.push(id)});renderArchiveList()}
  function toggleOrganizing(){state.organizing=!state.organizing;byId('organizeButton').classList.toggle('is-active',state.organizing);byId('organizeButton').textContent=state.organizing?'移動を完了':'カード・項目を移動';byId('organizeHelp').hidden=!state.organizing;renderCategories()}
  function renderCategoryEditor(){const root=byId('categoryEditor');root.replaceChildren(...state.config.categories.map(category=>{const row=document.createElement('div');const definition=Core.categoryDefinition(category.id,state.config.categories);row.className=`category-edit-row ${definition.className}`;row.innerHTML='<i aria-hidden="true"></i><label><span class="sr-only">項目名</span><input maxlength="24" aria-label="項目名"></label><button class="delete-category-button" type="button" aria-label="項目を削除">×</button>';row.querySelector('i').textContent=definition.initial;const input=row.querySelector('input');input.value=category.label;input.addEventListener('change',()=>{const value=input.value.trim();if(!value){input.value=category.label;return}commitConfig(config=>{config.categories.find(item=>item.id===category.id).label=value});renderCategoryEditor()});const remove=row.querySelector('.delete-category-button');remove.disabled=state.config.categories.length<=1;remove.addEventListener('click',()=>deleteCategory(category.id));return row}));}
  function openSettings(){renderCategoryEditor();byId('newCategoryName').value='';byId('settingsDialog').showModal()}
  function addCategory(){const input=byId('newCategoryName');const label=input.value.trim();if(!label)return;const id=`custom-${Date.now().toString(36)}`;commitConfig(config=>{config.categories.push({id,label})});input.value='';renderCategoryEditor()}
  function deleteCategory(categoryId){const category=state.config.categories.find(item=>item.id===categoryId);const target=state.config.categories.find(item=>item.id!==categoryId);if(!category||!target)return;const configuredApps=Core.applyWorkspaceConfig(state.allApps,state.config);const ids=configuredApps.filter(app=>app.categoryId===categoryId).map(app=>app.id);if(!confirm(`「${category.label}」を削除しますか？\n中のカード${ids.length}件は「${target.label}」へ移動します。`))return;const targetIds=Core.groupByCategory(configuredApps,state.config.categories,state.config.orders,true).find(group=>group.category.id===target.id)?.apps.map(app=>app.id)||[];commitConfig(config=>{config.categories=config.categories.filter(item=>item.id!==categoryId);if(Core.CATEGORIES.some(item=>item.id===categoryId)&&!config.removedCategories.includes(categoryId))config.removedCategories.push(categoryId);for(const id of ids)config.assignments[id]=target.id;config.orders[target.id]=[...new Set([...targetIds,...ids])];delete config.orders[categoryId]});renderCategoryEditor()}
  function resetLayout(){if(!confirm('項目名・カード配置・端末指定・追加カードを初期設定に戻しますか？'))return;state.history.past.push(clone(state.config));state.history.future=[];state.config=Core.defaultWorkspaceConfig();persistConfig();renderCategoryEditor()}
  function openAddCard(){const form=byId('addCardForm');form.reset();fillCategoryOptions(byId('cardCategory'),'student');byId('cardError').hidden=true;byId('addCardDialog').showModal()}
  function addCard(event){event.preventDefault();const name=byId('cardName').value.trim();const description=byId('cardDescription').value.trim();const url=byId('cardUrl').value.trim();const category=byId('cardCategory').value;const device=byId('cardDevice').value;const error=byId('cardError');if(!name||!Core.isUrl(url)){error.textContent='表示名と http または https のURLを入力してください。';error.hidden=false;return}const id=`custom-card-${Date.now().toString(36)}`;commitConfig(config=>{config.customApps.push({id,displayName:name,description:description||'追加した業務アプリ',category,productionUrl:url,parentSystem:'追加カード',keywords:[name,description].filter(Boolean),favorite:true,recent:true,status:'active'});config.assignments[id]=category;config.devices[id]=device});byId('addCardDialog').close()}
  function archivedApps(){const ids=new Set(state.config.archived);return Core.applyWorkspaceConfig(state.allApps.filter(app=>ids.has(app.id)),state.config)}
  function renderArchiveList(){const root=byId('archiveList');if(!root)return;const apps=archivedApps();byId('archiveEmpty').hidden=apps.length>0;root.replaceChildren(...apps.map(app=>{const row=document.createElement('div');row.className='archive-row';const copy=document.createElement('div');const name=document.createElement('strong');name.textContent=app.name;const description=document.createElement('small');description.textContent=app.description;copy.append(name,description);const actions=document.createElement('div');const restore=document.createElement('button');restore.type='button';restore.className='restore-button';restore.textContent='復元';restore.addEventListener('click',()=>restoreApp(app.id));const remove=document.createElement('button');remove.type='button';remove.className='permanent-delete-button';remove.textContent='×';remove.setAttribute('aria-label',`${app.name}を完全削除`);remove.addEventListener('click',()=>permanentlyDeleteApp(app.id));actions.append(restore,remove);row.append(copy,actions);return row}))}
  function openArchive(){renderArchiveList();byId('archiveDialog').showModal()}
  function restoreApp(id){commitConfig(config=>{config.archived=config.archived.filter(value=>value!==id)});renderArchiveList()}
  function permanentlyDeleteApp(id){const app=state.allApps.find(value=>value.id===id);if(!app||!confirm(`${app.name}を完全に削除しますか？この操作は戻せません。`))return;state.config.archived=state.config.archived.filter(value=>value!==id);state.config.customApps=state.config.customApps.filter(value=>value.id!==id);if(!state.config.deleted.includes(id))state.config.deleted.push(id);delete state.config.assignments[id];delete state.config.devices[id];for(const categoryId of Object.keys(state.config.orders))state.config.orders[categoryId]=state.config.orders[categoryId].filter(value=>value!==id);state.history={past:[],future:[]};persistConfig();renderArchiveList()}
  function toggleFavorite(id){
    state.favorites=state.favorites.includes(id)?state.favorites.filter(value=>value!==id):[...state.favorites,id];writeJson(FAVORITES_KEY,state.favorites);renderAll();
  }
  function recordRecent(id){
    state.recent=[{id,usedAt:new Date().toISOString()},...state.recent.filter(entry=>entry.id!==id)].slice(0,5);writeJson(RECENT_KEY,state.recent);
  }
  async function submitLogin(event){
    event.preventDefault();const code=byId('loginCode').value.trim();const password=byId('loginPassword').value;const button=byId('loginButton');button.disabled=true;byId('loginError').hidden=true;
    try{await loginWith(code,password)}catch(error){showLogin(error.message||'ログインできませんでした。')}finally{button.disabled=false}
  }
  async function logout(){
    const button=byId('logoutButton');button.disabled=true;
    try{await api('logoutSystemPortal')}catch(_){}
    localStorage.removeItem(AUTH_KEY);localStorage.removeItem(STAFF_CODE_KEY);localStorage.removeItem(STAFF_PASSWORD_KEY);state.auth=null;byId('loginCode').value='';byId('loginPassword').value='';button.disabled=false;showLogin('ログアウトしました。');
  }
  byId('loginForm').addEventListener('submit',submitLogin);byId('logoutButton').addEventListener('click',logout);byId('searchInput').addEventListener('input',renderSearch);byId('settingsButton').addEventListener('click',openSettings);byId('organizeButton').addEventListener('click',toggleOrganizing);byId('undoButton').addEventListener('click',undoConfig);byId('redoButton').addEventListener('click',redoConfig);byId('addCardButton').addEventListener('click',openAddCard);byId('archiveButton').addEventListener('click',openArchive);byId('addCardForm').addEventListener('submit',addCard);byId('closeAddCardButton').addEventListener('click',()=>byId('addCardDialog').close());byId('cancelAddCardButton').addEventListener('click',()=>byId('addCardDialog').close());byId('addCategoryButton').addEventListener('click',addCategory);byId('newCategoryName').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();addCategory()}});byId('resetLayoutButton').addEventListener('click',resetLayout);
  document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&document.activeElement!==byId('searchInput')){event.preventDefault();byId('searchInput').focus()}});
  init();
})();
