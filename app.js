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
  const state={baseApps:[],apps:[],favorites:[],recent:[],auth:null,config:Core.defaultWorkspaceConfig(),organizing:false};
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
    state.auth=readAuth();state.baseApps=Core.buildApps(source);state.config=Core.normalizeWorkspaceConfig(readJson(WORKSPACE_CONFIG_KEY,Core.defaultWorkspaceConfig()));state.apps=Core.applyWorkspaceConfig(state.baseApps,state.config);
    if(!state.apps.length)throw new Error('利用できるアプリが登録されていません。');
    state.favorites=readJson(FAVORITES_KEY,null);
    if(!Array.isArray(state.favorites)){state.favorites=Core.defaultFavoriteIds(state.apps);writeJson(FAVORITES_KEY,state.favorites)}
    state.favorites=state.favorites.filter(id=>state.apps.some(app=>app.id===id));
    state.recent=(readJson(RECENT_KEY,[])||[]).filter(entry=>state.apps.some(app=>app.id===entry.id)).slice(0,5);
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
  }
  function renderAppIcon(icon,app){
    icon.textContent='';const initial=document.createElement('span');initial.className='category-initial';initial.textContent=app.initial;icon.append(initial);
    if(app.iconType!=='google-sheet')return;
    icon.classList.add('google-sheet-icon');
    icon.insertAdjacentHTML('beforeend','<svg viewBox="0 0 24 24" role="img" aria-label="Google スプレッドシート"><path class="sheet-page" d="M6.5 2h7l4 4v16h-11a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path class="sheet-fold" d="M13.5 2v4h4"/><path class="sheet-grid" d="M8 10.5h6.5M8 14h6.5M8 17.5h6.5M10.2 10.5v7"/></svg>');
  }
  function fillCategoryOptions(select,selected){select.replaceChildren(...state.config.categories.map(category=>{const option=document.createElement('option');option.value=category.id;option.textContent=category.label;option.selected=category.id===selected;return option}))}
  function createCard(app,context){
    const card=byId('appCardTemplate').content.firstElementChild.cloneNode(true);
    card.dataset.appId=app.id;card.dataset.device=app.device;card.classList.add(app.categoryClass);
    const favorite=card.querySelector('.favorite-button');const active=state.favorites.includes(app.id);
    favorite.hidden=!app.favoriteEnabled;favorite.classList.toggle('is-favorite',active);favorite.querySelector('span').textContent=active?'★':'☆';favorite.setAttribute('aria-label',active?`${app.name}をお気に入りから外す`:`${app.name}をお気に入りに追加`);
    if(app.favoriteEnabled)favorite.addEventListener('click',()=>toggleFavorite(app.id));
    const device=card.querySelector('.device-control select');device.value=app.device;device.addEventListener('change',event=>setDevice(app.id,event.target.value));
    const move=card.querySelector('.move-control');move.hidden=!(state.organizing&&context==='category');fillCategoryOptions(move.querySelector('select'),app.categoryId);move.querySelector('select').addEventListener('change',event=>moveApp(app.id,event.target.value));
    if(state.organizing&&context==='category'){card.draggable=true;card.classList.add('is-organizing');card.addEventListener('dragstart',event=>{card.classList.add('is-dragging');event.dataTransfer.setData('text/plain',app.id);event.dataTransfer.effectAllowed='move'});card.addEventListener('dragend',()=>card.classList.remove('is-dragging'))}
    renderAppIcon(card.querySelector('.app-icon'),app);card.querySelector('.app-copy strong').textContent=app.name;card.querySelector('.app-copy small').textContent=app.description;
    const link=card.querySelector('.app-link');
    if(app.url){link.href=app.url;if(app.recentEnabled)link.addEventListener('click',()=>recordRecent(app.id))}
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
    const groups=Core.groupByCategory(state.apps,state.config.categories,state.config.orders,state.organizing);const tabs=byId('categoryTabs');const sections=byId('categorySections');tabs.replaceChildren();sections.replaceChildren();
    groups.forEach(({category,apps})=>{
      const anchor=document.createElement('a');anchor.href=`#category-${category.id}`;anchor.textContent=category.label;tabs.append(anchor);
      const section=document.createElement('section');section.id=`category-${category.id}`;section.className=`category-block ${category.className}`;
      const header=document.createElement('div');header.className='category-header';header.innerHTML=`<i class="category-dot" aria-hidden="true"></i><h3></h3><span></span>`;header.querySelector('h3').textContent=category.label;header.querySelector('span').textContent=`${apps.length}件`;
      const grid=document.createElement('div');grid.className='app-grid';grid.dataset.categoryId=category.id;replaceCards(grid,apps,'category');grid.addEventListener('dragover',event=>{if(!state.organizing)return;event.preventDefault();grid.classList.add('is-drop-target')});grid.addEventListener('dragleave',()=>grid.classList.remove('is-drop-target'));grid.addEventListener('drop',event=>{event.preventDefault();grid.classList.remove('is-drop-target');moveApp(event.dataTransfer.getData('text/plain'),category.id)});section.append(header,grid);sections.append(section);
    });
  }
  function renderSearch(){
    const query=byId('searchInput').value;const active=Core.normalize(query)!=='';byId('searchSection').hidden=!active;byId('defaultSections').hidden=active;
    if(!active)return;const apps=Core.filterApps(state.apps,query);replaceCards(byId('searchGrid'),apps,'search');byId('searchCount').textContent=`${apps.length}件`;byId('searchEmpty').hidden=apps.length>0;
  }
  function saveWorkspaceConfig(){state.config=Core.normalizeWorkspaceConfig(state.config);writeJson(WORKSPACE_CONFIG_KEY,state.config);state.apps=Core.applyWorkspaceConfig(state.baseApps,state.config);renderAll()}
  function setDevice(id,device){state.config.devices[id]=device;saveWorkspaceConfig()}
  function moveApp(id,categoryId){if(!id||!state.config.categories.some(category=>category.id===categoryId))return;const current=state.apps.find(app=>app.id===id)?.categoryId;state.config.assignments[id]=categoryId;if(current&&state.config.orders[current])state.config.orders[current]=state.config.orders[current].filter(value=>value!==id);state.config.orders[categoryId]=[...(state.config.orders[categoryId]||[]).filter(value=>value!==id),id];saveWorkspaceConfig()}
  function toggleOrganizing(){state.organizing=!state.organizing;byId('organizeButton').classList.toggle('is-active',state.organizing);byId('organizeButton').textContent=state.organizing?'移動を完了':'カードを移動';byId('organizeHelp').hidden=!state.organizing;renderCategories()}
  function renderCategoryEditor(){const root=byId('categoryEditor');root.replaceChildren(...state.config.categories.map(category=>{const row=document.createElement('label');const definition=Core.categoryDefinition(category.id,state.config.categories);row.className=`category-edit-row ${definition.className}`;row.innerHTML='<i aria-hidden="true"></i><input maxlength="24" aria-label="項目名">';row.querySelector('i').textContent=definition.initial;const input=row.querySelector('input');input.value=category.label;input.addEventListener('change',()=>{const value=input.value.trim();if(!value){input.value=category.label;return}category.label=value;saveWorkspaceConfig();renderCategoryEditor()});return row}));}
  function openSettings(){renderCategoryEditor();byId('newCategoryName').value='';byId('settingsDialog').showModal()}
  function addCategory(){const input=byId('newCategoryName');const label=input.value.trim();if(!label)return;const id=`custom-${Date.now().toString(36)}`;state.config.categories.push({id,label});input.value='';saveWorkspaceConfig();renderCategoryEditor()}
  function resetLayout(){if(!confirm('項目名・カード配置・端末指定を初期設定に戻しますか？'))return;state.config=Core.defaultWorkspaceConfig();saveWorkspaceConfig();renderCategoryEditor()}
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
  byId('loginForm').addEventListener('submit',submitLogin);byId('logoutButton').addEventListener('click',logout);byId('searchInput').addEventListener('input',renderSearch);byId('settingsButton').addEventListener('click',openSettings);byId('organizeButton').addEventListener('click',toggleOrganizing);byId('addCategoryButton').addEventListener('click',addCategory);byId('newCategoryName').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();addCategory()}});byId('resetLayoutButton').addEventListener('click',resetLayout);
  document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&document.activeElement!==byId('searchInput')){event.preventDefault();byId('searchInput').focus()}});
  init();
})();
