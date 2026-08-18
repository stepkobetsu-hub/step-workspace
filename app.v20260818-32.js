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
  const REGISTRY_CACHE_KEY='stepWorkspaceRegistryCacheV1';
  const ALLOWED_PERMISSIONS=['2','3','4'];
  const REQUIRED_REFERRAL_APP={id:'referral-card-reader',displayName:'お友達紹介カード読み取り',description:'紹介カードをAIで読み取り、原本画像・取込日時・紹介者／入塾者情報・3つの特典処理状況を保存',category:'custom-management',productionUrl:'https://stepkobetsu-hub.github.io/seiseki-kanri/referral_card_import.html',parentSystem:'スタッフ用アプリ',keywords:['お友達紹介','紹介カード','AI読取','図書カード','初回学費','割引','済'],favorite:true,recent:true,status:'active'};

  const state={baseApps:[],allApps:[],apps:[],favorites:[],recent:[],auth:null,config:Core.defaultWorkspaceConfig(),organizing:false,adminMode:false,history:{past:[],future:[]},sharedReady:false,sharedVersion:0,sharedLoading:false,sharedApplying:false,sharedPublishing:false,sharedSaveTimer:null,sharedSavePromise:Promise.resolve()};
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
    if(!loadRegistryCache()&&!await loadBundledCatalog())throw new Error('利用できるアプリが登録されていません。');
    refreshInBackground();return true;
  }
  function showRegistrySource(source){
    if(!Array.isArray(source)||!source.length)return false;
    state.auth=readAuth();state.baseApps=Core.buildApps(source);state.config=Core.normalizeWorkspaceConfig(readJson(WORKSPACE_CONFIG_KEY,Core.defaultWorkspaceConfig()));rebuildApps();
    if(!state.apps.length)return false;
    state.favorites=readJson(FAVORITES_KEY,null);
    if(!Array.isArray(state.favorites)){state.favorites=Core.defaultFavoriteIds(state.apps);writeJson(FAVORITES_KEY,state.favorites)}
    state.favorites=state.favorites.filter(id=>state.allApps.some(app=>app.id===id));
    state.recent=(readJson(RECENT_KEY,[])||[]).filter(entry=>state.allApps.some(app=>app.id===entry.id)).slice(0,5);
    renderAll();setScreen('home');requestSharedConfig();return true;
  }
  function loadRegistryCache(){const cached=readJson(REGISTRY_CACHE_KEY,null);return showRegistrySource(cached?.source)}
  function saveRegistryCache(source){writeJson(REGISTRY_CACHE_KEY,{source,savedAt:new Date().toISOString()})}
  async function loadBundledCatalog(){
    const catalog=await fetch(APP_CATALOG).then(response=>response.ok?response.json():null);
    const source=Array.isArray(catalog?.apps)?catalog.apps:[];
    if(!showRegistrySource(source))return false;
    saveRegistryCache(source);return true;
  }
  async function loadRegistry(){
    const [result,registryExport,catalogExport]=await Promise.all([api('getSystemRegistry'),fetch(REGISTRY_EXPORT).then(response=>response.ok?response.json():null).catch(()=>null),fetch(APP_CATALOG).then(response=>response.ok?response.json():null).catch(()=>null)]);
    if(!result.success)throw new Error(result.error||'アプリ一覧を取得できませんでした。');
    const registered=Array.isArray(registryExport?.apps)?registryExport.apps:[];const systems=registered.length?Core.mergeRegistrySources(result.systems,registered):result.systems;const source=Core.mergeCatalogSources(systems,catalogExport?.apps);
    if(!showRegistrySource(source))throw new Error('利用できるアプリが登録されていません。');saveRegistryCache(source);
  }
  async function refreshInBackground(){
    try{await loadRegistry()}catch(_){}
  }
  async function init(){
    setScreen('checking');
    const auth=readAuth();
    if(auth&&ALLOWED_PERMISSIONS.includes(String(auth.permissionLevel))){
      if(loadRegistryCache()){refreshInBackground();return}
      try{if(await loadBundledCatalog()){refreshInBackground();return}}catch(_){}
      try{await loadRegistry();return}catch(_){}
    }
    const code=localStorage.getItem(STAFF_CODE_KEY)||'';const password=localStorage.getItem(STAFF_PASSWORD_KEY)||'';
    if(code&&password){try{await loginWith(code,password);return}catch(error){if(loadRegistryCache()){refreshInBackground();return}showLogin(error.message);return}}
    showLogin();
  }
  function renderAll(){
    const name=state.auth?.name?String(state.auth.name).trim():'';byId('userName').textContent=name;
    byId('appCount').textContent=`${state.apps.length}件のアプリ`;
    renderFavorites();renderRecent();renderCategories();renderSearch();
    updateHistoryButtons();
  }
  const clone=value=>JSON.parse(JSON.stringify(value));
  function ensureRequiredReferralApp(config){
    const value=Core.normalizeWorkspaceConfig(config);
    if(!value.categories.some(category=>category.id==='custom-management'))value.categories.splice(Math.min(3,value.categories.length),0,{id:'custom-management',label:'管理・運営',icon:'grid',color:'#276EE4'});
    value.customApps=value.customApps.filter(app=>app.id!==REQUIRED_REFERRAL_APP.id&&app.productionUrl!==REQUIRED_REFERRAL_APP.productionUrl);
    value.customApps.push(Object.assign({},REQUIRED_REFERRAL_APP));
    value.assignments[REQUIRED_REFERRAL_APP.id]='custom-management';
    value.devices[REQUIRED_REFERRAL_APP.id]='both';
    value.orders['custom-management']=Array.isArray(value.orders['custom-management'])?value.orders['custom-management'].filter(id=>id!==REQUIRED_REFERRAL_APP.id):[];
    value.orders['custom-management'].push(REQUIRED_REFERRAL_APP.id);
    value.archived=value.archived.filter(id=>id!==REQUIRED_REFERRAL_APP.id);
    value.deleted=value.deleted.filter(id=>id!==REQUIRED_REFERRAL_APP.id);
    return value;
  }
  function rebuildApps(){
    state.config=ensureRequiredReferralApp(state.config);
    const custom=Core.buildApps(state.config.customApps,{allowDuplicateUrls:true});const catalog=state.config.replaceCatalog?[]:state.baseApps;const seen=new Set();state.allApps=[...custom,...catalog].filter(app=>{if(seen.has(app.id)||state.config.deleted.includes(app.id))return false;seen.add(app.id);return true});
    state.apps=Core.applyWorkspaceConfig(state.allApps.filter(app=>!state.config.archived.includes(app.id)),state.config);
  }
  function sharedPayload(){return {schemaVersion:1,workspaceConfig:clone(state.config),favorites:[...state.favorites]}}
  function setSyncStatus(message,status){const root=byId('syncStatus');if(!root)return;root.textContent=message;root.dataset.status=status||''}
  function applySharedPayload(payload,version){
    if(!payload?.workspaceConfig)return false;
    state.sharedApplying=true;state.config=Core.normalizeWorkspaceConfig(payload.workspaceConfig);writeJson(WORKSPACE_CONFIG_KEY,state.config);rebuildApps();
    if(Array.isArray(payload.favorites)){state.favorites=payload.favorites.filter(id=>state.allApps.some(app=>app.id===id));writeJson(FAVORITES_KEY,state.favorites)}
    state.sharedVersion=Math.max(0,Number(version||0));state.sharedReady=true;state.sharedApplying=false;renderAll();setSyncStatus('全パソコンで共有中','ready');return true;
  }
  async function refreshSharedConfig(){
    if(!readAuth()||state.sharedLoading||state.sharedPublishing||state.sharedSaveTimer)return;state.sharedLoading=true;
    try{const result=await api('getWorkspaceConfig');if(!result.success)throw new Error(result.error||'共有設定を取得できませんでした。');if(result.sharedState){if(Number(result.version||0)>state.sharedVersion||!state.sharedReady)applySharedPayload(result.sharedState,result.version)}else setSyncStatus('この端末の設定はまだ共有されていません','local')}
    catch(_){setSyncStatus(state.sharedReady?'共有設定を再確認できませんでした':'現在はこの端末の設定を表示しています','error')}
    finally{state.sharedLoading=false}
  }
  function requestSharedConfig(){if(state.sharedReady||state.sharedLoading)return;queueMicrotask(refreshSharedConfig)}
  async function ensureSharedReady(){
    if(state.sharedReady)return true;
    try{const result=await api('getWorkspaceConfig');if(!result.success)throw new Error(result.error||'共有設定を取得できませんでした。');if(result.sharedState)applySharedPayload(result.sharedState,result.version);else{state.sharedVersion=Math.max(0,Number(result.version||0));state.sharedReady=true}return true}
    catch(error){setSyncStatus(error.message||'共有設定を確認できないため保存を中止しました','error');return false}
  }
  async function saveSharedConfig(){
    if(!await ensureSharedReady())return false;
    setSyncStatus('全パソコンへ保存中…','saving');
    try{const result=await api('saveWorkspaceConfig',{sharedState:sharedPayload(),expectedVersion:state.sharedVersion});if(!result.success){if(result.code==='WORKSPACE_VERSION_CONFLICT'){if(result.sharedState)applySharedPayload(result.sharedState,result.version);else state.sharedVersion=Math.max(0,Number(result.version||0));setSyncStatus(result.error||'別の端末の最新版を読み込みました。変更をもう一度行ってください。','conflict');return false}throw new Error(result.error||'共有設定を保存できませんでした。')}state.sharedReady=true;state.sharedVersion=Number(result.version||state.sharedVersion+1);setSyncStatus(`全パソコンへ保存しました（版 ${state.sharedVersion}）`,'ready');return true}
    catch(error){setSyncStatus(error.message||'共有設定を保存できませんでした','error');return false}
  }
  function scheduleSharedSave(){if(!state.sharedReady||state.sharedApplying)return;clearTimeout(state.sharedSaveTimer);state.sharedSaveTimer=setTimeout(()=>{state.sharedSaveTimer=null;state.sharedSavePromise=state.sharedSavePromise.then(saveSharedConfig)},650)}
  async function publishSharedConfig(){const button=byId('publishConfigButton');state.sharedPublishing=true;button.disabled=true;try{const saved=await saveSharedConfig();if(saved)button.textContent='この配置を全端末へ再反映'}finally{button.disabled=false;state.sharedPublishing=false}}
  function persistConfig(){state.config=Core.normalizeWorkspaceConfig(state.config);writeJson(WORKSPACE_CONFIG_KEY,state.config);rebuildApps();renderAll();scheduleSharedSave()}
  function commitConfig(change){state.history.past.push(clone(state.config));state.history.past=state.history.past.slice(-40);state.history.future=[];change(state.config);persistConfig()}
  function undoConfig(){const previous=state.history.past.pop();if(!previous)return;state.history.future.push(clone(state.config));state.config=previous;persistConfig()}
  function redoConfig(){const next=state.history.future.pop();if(!next)return;state.history.past.push(clone(state.config));state.config=next;persistConfig()}
  function updateHistoryButtons(){byId('undoButton').disabled=!state.history.past.length;byId('redoButton').disabled=!state.history.future.length}
  function renderAppIcon(group,app){
    group.querySelector('.app-icon').innerHTML=appIconSvg(app);const sheet=group.querySelector('.sheet-app-icon');sheet.hidden=app.iconType!=='google-sheet';
    if(app.iconType==='google-sheet')sheet.innerHTML='<svg viewBox="0 0 24 24" role="img" aria-label="Google スプレッドシート"><path class="sheet-page" d="M6.5 2h7l4 4v16h-11a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path class="sheet-fold" d="M13.5 2v4h4"/><path class="sheet-grid" d="M8 10.5h6.5M8 14h6.5M8 17.5h6.5M10.2 10.5v7"/></svg>';
  }
  const ICON_PATHS={grid:'<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',user:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-7 6-7s6 3 6 7M17 8h4M19 6v4"/>',chat:'<path d="M4 5h16v11H9l-5 4Z"/><path d="M8 9h8M8 12h5"/>',wallet:'<path d="M4 7h16v12H4z"/><path d="M4 10h16M15 15h2"/>',teacher:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-7 6-7s6 3 6 7M17 5h4v8h-4z"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',chart:'<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',calendar:'<path d="M4 5h16v16H4zM8 3v4M16 3v4M4 10h16"/>',file:'<path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 17h5"/>',mail:'<path d="M3 5h18v14H3zM3 7l9 7 9-7"/>',qr:'<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-6v-2"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',book:'<path d="M4 5c3-1 6 0 8 2v14c-2-2-5-3-8-2zM20 5c-3-1-6 0-8 2v14c2-2 5-3 8-2z"/>',school:'<path d="M3 10 12 4l9 6M5 10v10h14V10M9 20v-6h6v6"/>',calculator:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h1M12 12h1M16 12h1M8 16h1M12 16h1M16 16h1"/>',clipboard:'<path d="M7 5H5v16h14V5h-2M9 3h6v4H9zM9 12h6M9 16h5"/>',star:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',database:'<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',phone:'<path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM10 17h4"/>',shield:'<path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6Z"/><path d="m9 12 2 2 4-5"/>'};
  function iconSvg(icon){return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[icon]||ICON_PATHS.grid}</svg>`}
  function appIconSvg(app){return iconSvg(app.categoryIcon)}
  function categoryIconSvg(icon){return iconSvg(icon)}
  function applyCategoryStyle(element,category){element.style.setProperty('--accent',category.color||category.categoryColor||'#276EE4');element.style.setProperty('--accent-soft',category.softColor||category.categorySoftColor||'#276EE418')}
  function fillCategoryOptions(select,selected){select.replaceChildren(...state.config.categories.map(category=>{const option=document.createElement('option');option.value=category.id;option.textContent=category.label;option.selected=category.id===selected;return option}))}
  function createCard(app,context){
    const card=byId('appCardTemplate').content.firstElementChild.cloneNode(true);
    card.dataset.appId=app.id;card.dataset.device=app.device;card.classList.add(app.categoryClass);applyCategoryStyle(card,app);
    const favorite=card.querySelector('.favorite-button');const active=state.favorites.includes(app.id);
    favorite.hidden=!app.favoriteEnabled;favorite.classList.toggle('is-favorite',active);favorite.querySelector('span').textContent=active?'♥':'♡';favorite.setAttribute('aria-label',active?`${app.name}をお気に入りから外す`:`${app.name}をお気に入りに追加`);
    if(app.favoriteEnabled)favorite.addEventListener('click',()=>toggleFavorite(app.id));
    const device=card.querySelector('.device-control select');device.value=app.device;device.addEventListener('change',event=>setDevice(app.id,event.target.value));
    const edit=card.querySelector('.edit-card-button');edit.setAttribute('aria-label',`${app.name}を編集`);edit.addEventListener('click',()=>openEditCard(app.id));
    card.querySelector('.archive-card-button').addEventListener('click',()=>archiveApp(app.id));
    const move=card.querySelector('.move-control');move.hidden=!(state.organizing&&context==='category');fillCategoryOptions(move.querySelector('select'),app.categoryId);move.querySelector('select').addEventListener('change',event=>moveApp(app.id,event.target.value));move.querySelector('.move-up').addEventListener('click',()=>reorderApp(app.id,-1));move.querySelector('.move-down').addEventListener('click',()=>reorderApp(app.id,1));
    if(state.organizing&&context==='category'){
      card.draggable=true;card.classList.add('is-organizing');card.title='ドラッグしてカードを並べ替え・別の項目へ移動';
      card.addEventListener('dragstart',event=>{card.classList.add('is-dragging');event.dataTransfer.setData('application/x-step-app',app.id);event.dataTransfer.setData('text/plain',app.id);event.dataTransfer.effectAllowed='move'});
      card.addEventListener('dragend',()=>{card.classList.remove('is-dragging');document.querySelectorAll('.app-card.is-drop-before,.app-card.is-drop-after').forEach(item=>item.classList.remove('is-drop-before','is-drop-after'))});
      card.addEventListener('dragover',event=>{const dragged=event.dataTransfer.getData('application/x-step-app')||event.dataTransfer.getData('text/plain');if(dragged===app.id)return;event.preventDefault();event.stopPropagation();const after=event.clientX>card.getBoundingClientRect().left+card.offsetWidth/2;card.classList.toggle('is-drop-before',!after);card.classList.toggle('is-drop-after',after);event.dataTransfer.dropEffect='move'});
      card.addEventListener('dragleave',event=>{if(!card.contains(event.relatedTarget))card.classList.remove('is-drop-before','is-drop-after')});
      card.addEventListener('drop',event=>{event.preventDefault();event.stopPropagation();const dragged=event.dataTransfer.getData('application/x-step-app')||event.dataTransfer.getData('text/plain');const after=card.classList.contains('is-drop-after');card.classList.remove('is-drop-before','is-drop-after');moveAppRelative(dragged,app.id,after)});
    }
    renderAppIcon(card.querySelector('.app-icons'),app);card.querySelector('.app-copy strong').textContent=app.name;const description=card.querySelector('.app-copy small');description.textContent=app.description;description.title=app.description;card.querySelector('.app-category-tag').textContent=app.categoryLabel;
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
    tabs.ondragover=event=>{if(!state.organizing)return;const rect=tabs.getBoundingClientRect();if(event.clientY<rect.top+42)tabs.scrollTop-=18;else if(event.clientY>rect.bottom-42)tabs.scrollTop+=18};
    groups.forEach(({category,apps},index)=>{
      const navItem=document.createElement('div');navItem.className=`category-nav-item ${category.className}`;navItem.dataset.categoryId=category.id;navItem.dataset.search=Core.normalize([category.label,...apps.map(app=>app.name)].join(' '));applyCategoryStyle(navItem,category);
      const anchor=document.createElement('a');anchor.href=`#category-${category.id}`;anchor.draggable=false;anchor.innerHTML='<i aria-hidden="true"></i><span></span><small></small>';anchor.querySelector('i').innerHTML=categoryIconSvg(category.icon);anchor.querySelector('span').textContent=category.label;anchor.querySelector('small').textContent=apps.length;anchor.addEventListener('click',()=>{tabs.querySelectorAll('.category-nav-item').forEach(item=>item.classList.remove('is-active'));navItem.classList.add('is-active');closeMobileMenu()});if(index===0)navItem.classList.add('is-active');
      const controls=document.createElement('div');controls.className='category-order-controls';controls.hidden=!state.organizing;const handle=document.createElement('button');handle.type='button';handle.className='category-drag-handle';handle.textContent='⠿';handle.draggable=true;handle.title='項目をドラッグして移動';handle.setAttribute('aria-label',`${category.label}をドラッグして移動`);const up=document.createElement('button');up.type='button';up.textContent='↑';up.disabled=index===0;up.setAttribute('aria-label',`${category.label}を上へ`);up.addEventListener('click',()=>reorderCategory(category.id,-1));const down=document.createElement('button');down.type='button';down.textContent='↓';down.disabled=index===groups.length-1;down.setAttribute('aria-label',`${category.label}を下へ`);down.addEventListener('click',()=>reorderCategory(category.id,1));controls.append(handle,up,down);navItem.append(anchor,controls);
      navItem.draggable=state.organizing;navItem.classList.toggle('is-organizing',state.organizing);navItem.title=state.organizing?'ドラッグして項目を上下に移動':'';
      navItem.addEventListener('dragstart',event=>{if(!state.organizing)return;navItem.classList.add('is-dragging');event.dataTransfer.setData('application/x-step-category',category.id);event.dataTransfer.effectAllowed='move'});navItem.addEventListener('dragend',()=>navItem.classList.remove('is-dragging'));
      navItem.addEventListener('dragover',event=>{if(!state.organizing)return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';navItem.classList.add('is-drop-target')});navItem.addEventListener('dragleave',event=>{if(!navItem.contains(event.relatedTarget))navItem.classList.remove('is-drop-target')});navItem.addEventListener('drop',event=>{if(!state.organizing)return;event.preventDefault();event.stopPropagation();navItem.classList.remove('is-drop-target');const draggedCategory=event.dataTransfer.getData('application/x-step-category');if(draggedCategory){const after=event.clientY>navItem.getBoundingClientRect().top+navItem.offsetHeight/2;moveCategory(draggedCategory,category.id,after)}else moveApp(event.dataTransfer.getData('application/x-step-app')||event.dataTransfer.getData('text/plain'),category.id)});tabs.append(navItem);
      const section=document.createElement('section');section.id=`category-${category.id}`;section.className=`category-block ${category.className}`;applyCategoryStyle(section,category);
      const header=document.createElement('div');header.className='category-header';header.innerHTML='<i class="category-dot" aria-hidden="true"></i><div><h3></h3><p></p></div><span></span>';header.querySelector('.category-dot').innerHTML=categoryIconSvg(category.icon);header.querySelector('h3').textContent=category.label;const categoryDescriptionElement=header.querySelector('p');categoryDescriptionElement.textContent=categoryDescription(category.id,apps.length);categoryDescriptionElement.title=categoryDescriptionElement.textContent;header.querySelector('span').textContent=`${apps.length}件`;
      const grid=document.createElement('div');grid.className='app-grid';grid.dataset.categoryId=category.id;replaceCards(grid,apps,'category');if(!apps.length){grid.classList.add('is-empty-category');const empty=document.createElement('p');empty.textContent=state.organizing?'ここへカードを移動できます':'カードはまだありません';grid.append(empty)}grid.addEventListener('dragover',event=>{if(!state.organizing)return;event.preventDefault();grid.classList.add('is-drop-target')});grid.addEventListener('dragleave',()=>grid.classList.remove('is-drop-target'));grid.addEventListener('drop',event=>{event.preventDefault();grid.classList.remove('is-drop-target');moveApp(event.dataTransfer.getData('text/plain'),category.id)});section.append(header,grid);sections.append(section);
    });filterCategoryNavigation();
  }
  function categoryDescription(id,count){const descriptions={student:'生徒情報・成績・面談・学習支援',contact:'配信・受付・連絡・QR関連',billing:'請求・入金・帳票・会計処理',teacher:'講師管理・授業報告・給与関連',admin:'マスター・設定・データ管理'};return descriptions[id]||`${count}件の業務アプリをまとめています`}
  function filterCategoryNavigation(){const query=Core.normalize(byId('categorySearch').value);let visible=0;byId('categoryTabs').querySelectorAll('.category-nav-item').forEach(item=>{const match=!query||item.dataset.search.includes(query);item.hidden=!match;if(match)visible++});byId('categoryNavEmpty').hidden=visible>0}
  function syncSearch(source){const value=source.value;byId('searchInput').value=value;byId('categorySearch').value=value;filterCategoryNavigation();renderSearch()}
  function renderSearch(){
    const query=byId('searchInput').value;const active=Core.normalize(query)!=='';byId('searchSection').hidden=!active;
    if(!active)return;const apps=Core.filterApps(state.apps,query).slice(0,8);replaceCards(byId('searchGrid'),apps,'search');byId('searchCount').textContent=`${apps.length}件`;byId('searchEmpty').hidden=apps.length>0;
  }
  function setDevice(id,device){commitConfig(config=>{config.devices[id]=device})}
  function moveApp(id,categoryId){if(!id||!state.config.categories.some(category=>category.id===categoryId))return;const current=state.apps.find(app=>app.id===id)?.categoryId;const targetIds=Core.groupByCategory(state.apps,state.config.categories,state.config.orders,true).find(group=>group.category.id===categoryId)?.apps.map(app=>app.id).filter(value=>value!==id)||[];commitConfig(config=>{config.assignments[id]=categoryId;if(current&&config.orders[current])config.orders[current]=config.orders[current].filter(value=>value!==id);config.orders[categoryId]=[...targetIds,id]})}
  function moveAppRelative(id,targetId,after){const source=state.apps.find(app=>app.id===id);const target=state.apps.find(app=>app.id===targetId);if(!source||!target||id===targetId)return;const targetIds=Core.groupByCategory(state.apps,state.config.categories,state.config.orders,true).find(group=>group.category.id===target.categoryId)?.apps.map(app=>app.id).filter(value=>value!==id)||[];const targetIndex=targetIds.indexOf(targetId);targetIds.splice(Math.max(0,targetIndex+(after?1:0)),0,id);commitConfig(config=>{config.assignments[id]=target.categoryId;if(config.orders[source.categoryId])config.orders[source.categoryId]=config.orders[source.categoryId].filter(value=>value!==id);config.orders[target.categoryId]=targetIds})}
  function reorderApp(id,direction){const app=state.apps.find(value=>value.id===id);if(!app)return;const ids=Core.groupByCategory(state.apps,state.config.categories,state.config.orders,true).find(group=>group.category.id===app.categoryId)?.apps.map(value=>value.id)||[];const index=ids.indexOf(id);const target=index+direction;if(index<0||target<0||target>=ids.length)return;[ids[index],ids[target]]=[ids[target],ids[index]];commitConfig(config=>{config.orders[app.categoryId]=ids})}
  function reorderCategory(id,direction){const index=state.config.categories.findIndex(category=>category.id===id);const target=index+direction;if(index<0||target<0||target>=state.config.categories.length)return;commitConfig(config=>{[config.categories[index],config.categories[target]]=[config.categories[target],config.categories[index]]})}
  function moveCategory(id,targetId,after){if(!id||id===targetId)return;commitConfig(config=>{const index=config.categories.findIndex(category=>category.id===id);if(index<0)return;const [category]=config.categories.splice(index,1);const target=config.categories.findIndex(item=>item.id===targetId);config.categories.splice(target+(after?1:0),0,category)})}
  function archiveApp(id){commitConfig(config=>{if(!config.archived.includes(id))config.archived.push(id)});renderArchiveList()}
  function toggleOrganizing(){state.organizing=!state.organizing;byId('organizeButton').classList.toggle('is-active',state.organizing);byId('organizeButton').textContent=state.organizing?'移動を完了':'並べ替え';byId('organizeHelp').hidden=!state.organizing;renderCategories()}
  function setManagementMode(active){state.adminMode=active;byId('appShell').classList.toggle('is-admin-mode',active);byId('managementPanel').hidden=!active;if(!active&&state.organizing){state.organizing=false;byId('organizeButton').classList.remove('is-active');byId('organizeButton').textContent='並べ替え';byId('organizeHelp').hidden=true;renderCategories()}if(!active)closeMobileMenu()}

  function clearSearch(){byId('searchInput').value='';byId('categorySearch').value='';filterCategoryNavigation();renderSearch()}
  function toggleMobileMenu(){byId('appShell').classList.toggle('is-sidebar-open')}
  function closeMobileMenu(){byId('appShell').classList.remove('is-sidebar-open')}
  function renderCategoryEditor(){
    const iconLabels={grid:'一覧',user:'生徒',chat:'連絡',wallet:'会計',teacher:'講師',gear:'設定',chart:'分析',calendar:'予定',file:'書類',mail:'メール',qr:'QR',clock:'時間',book:'学習',school:'校舎',calculator:'計算',clipboard:'記録',star:'ポイント',database:'データ',phone:'スマホ',shield:'管理'};
    const root=byId('categoryEditor');root.replaceChildren(...state.config.categories.map(category=>{
      const definition=Core.categoryDefinition(category.id,state.config.categories);const row=document.createElement('section');row.className=`category-edit-row ${definition.className}`;applyCategoryStyle(row,definition);
      row.innerHTML='<div class="category-edit-main"><i class="category-edit-preview" aria-hidden="true"></i><label><span class="sr-only">項目名</span><input maxlength="24" aria-label="項目名"></label><button class="delete-category-button" type="button" aria-label="項目を削除">×</button></div><fieldset class="visual-picker icon-picker"><legend>アイコン</legend><div></div></fieldset><fieldset class="visual-picker color-picker"><legend>色</legend><div></div></fieldset>';
      row.querySelector('.category-edit-preview').innerHTML=categoryIconSvg(definition.icon);const input=row.querySelector('input');input.value=category.label;input.addEventListener('change',()=>{const value=input.value.trim();if(!value){input.value=category.label;return}commitConfig(config=>{config.categories.find(item=>item.id===category.id).label=value});renderCategoryEditor()});
      const iconRoot=row.querySelector('.icon-picker div');for(const icon of Core.CATEGORY_ICON_IDS){const button=document.createElement('button');button.type='button';button.className='icon-choice';button.classList.toggle('is-selected',icon===definition.icon);button.innerHTML=categoryIconSvg(icon);button.title=iconLabels[icon];button.setAttribute('aria-label',`${iconLabels[icon]}アイコン`);button.addEventListener('click',()=>{commitConfig(config=>{config.categories.find(item=>item.id===category.id).icon=icon});renderCategoryEditor()});iconRoot.append(button)}
      const colorRoot=row.querySelector('.color-picker div');for(const color of Core.CATEGORY_COLORS){const button=document.createElement('button');button.type='button';button.className='color-choice';button.style.background=color;button.classList.toggle('is-selected',color===definition.color);button.title=color;button.setAttribute('aria-label',`色 ${color}`);button.addEventListener('click',()=>{commitConfig(config=>{config.categories.find(item=>item.id===category.id).color=color});renderCategoryEditor()});colorRoot.append(button)}
      const remove=row.querySelector('.delete-category-button');remove.disabled=state.config.categories.length<=1;remove.addEventListener('click',()=>deleteCategory(category.id));return row
    }));
  }
  function openSettings(){renderCategoryEditor();byId('newCategoryName').value='';byId('settingsDialog').showModal()}
  function addCategory(){const input=byId('newCategoryName');const label=input.value.trim();if(!label)return;const id=`custom-${Date.now().toString(36)}`;commitConfig(config=>{config.categories.push({id,label,icon:'grid',color:Core.CATEGORY_COLORS[0]})});input.value='';renderCategoryEditor()}
  function deleteCategory(categoryId){const category=state.config.categories.find(item=>item.id===categoryId);const target=state.config.categories.find(item=>item.id!==categoryId);if(!category||!target)return;const configuredApps=Core.applyWorkspaceConfig(state.allApps,state.config);const ids=configuredApps.filter(app=>app.categoryId===categoryId).map(app=>app.id);if(!confirm(`「${category.label}」を削除しますか？\n中のカード${ids.length}件は「${target.label}」へ移動します。`))return;const targetIds=Core.groupByCategory(configuredApps,state.config.categories,state.config.orders,true).find(group=>group.category.id===target.id)?.apps.map(app=>app.id)||[];commitConfig(config=>{config.categories=config.categories.filter(item=>item.id!==categoryId);if(Core.CATEGORIES.some(item=>item.id===categoryId)&&!config.removedCategories.includes(categoryId))config.removedCategories.push(categoryId);for(const id of ids)config.assignments[id]=target.id;config.orders[target.id]=[...new Set([...targetIds,...ids])];delete config.orders[categoryId]});renderCategoryEditor()}
  function resetLayout(){if(!confirm('項目名・カード配置・端末指定・追加カードを初期設定に戻しますか？'))return;state.history.past.push(clone(state.config));state.history.future=[];state.config=Core.defaultWorkspaceConfig();persistConfig();renderCategoryEditor()}
  function openAddCard(){const form=byId('addCardForm');form.reset();byId('editingCardId').value='';byId('cardDialogTitle').textContent='カードを追加';byId('saveCardButton').textContent='追加';fillCategoryOptions(byId('cardCategory'),'student');byId('cardDevice').value='both';byId('cardGoogleSheet').checked=false;byId('cardError').hidden=true;byId('addCardDialog').showModal()}
  function openEditCard(id){const app=state.apps.find(item=>item.id===id)||Core.applyWorkspaceConfig(state.allApps,state.config).find(item=>item.id===id);if(!app)return;byId('addCardForm').reset();byId('editingCardId').value=id;byId('cardDialogTitle').textContent='カードを編集';byId('saveCardButton').textContent='保存';byId('cardName').value=app.name;byId('cardDescription').value=app.description;byId('cardUrl').value=app.url;fillCategoryOptions(byId('cardCategory'),app.categoryId);byId('cardDevice').value=app.device;byId('cardGoogleSheet').checked=app.iconType==='google-sheet';byId('cardError').hidden=true;byId('addCardDialog').showModal()}
  function addCard(event){event.preventDefault();const editId=byId('editingCardId').value;const name=byId('cardName').value.trim();const description=byId('cardDescription').value.trim();const url=byId('cardUrl').value.trim();const category=byId('cardCategory').value;const device=byId('cardDevice').value;const googleSheet=byId('cardGoogleSheet').checked;const error=byId('cardError');if(!name||!Core.isUrl(url)){error.textContent='表示名と http または https のURLを入力してください。';error.hidden=false;return}if(editId){commitConfig(config=>{config.cardOverrides[editId]={name,description:description||'業務アプリを開く',url,googleSheet};config.assignments[editId]=category;config.devices[editId]=device})}else{const id=`custom-card-${Date.now().toString(36)}`;commitConfig(config=>{config.customApps.push({id,displayName:name,description:description||'追加した業務アプリ',category,productionUrl:url,parentSystem:'追加カード',keywords:[name,description].filter(Boolean),favorite:true,recent:true,status:'active'});config.cardOverrides[id]={name,description:description||'追加した業務アプリ',url,googleSheet};config.assignments[id]=category;config.devices[id]=device})}byId('addCardDialog').close()}
  function archivedApps(){const ids=new Set(state.config.archived);return Core.applyWorkspaceConfig(state.allApps.filter(app=>ids.has(app.id)),state.config)}
  function renderArchiveList(){const root=byId('archiveList');if(!root)return;const apps=archivedApps();byId('archiveEmpty').hidden=apps.length>0;root.replaceChildren(...apps.map(app=>{const row=document.createElement('div');row.className='archive-row';const copy=document.createElement('div');const name=document.createElement('strong');name.textContent=app.name;const description=document.createElement('small');description.textContent=app.description;copy.append(name,description);const actions=document.createElement('div');const restore=document.createElement('button');restore.type='button';restore.className='restore-button';restore.textContent='復元';restore.addEventListener('click',()=>restoreApp(app.id));const remove=document.createElement('button');remove.type='button';remove.className='permanent-delete-button';remove.textContent='×';remove.setAttribute('aria-label',`${app.name}を完全削除`);remove.addEventListener('click',()=>permanentlyDeleteApp(app.id));actions.append(restore,remove);row.append(copy,actions);return row}))}
  function openArchive(){renderArchiveList();byId('archiveDialog').showModal()}
  function restoreApp(id){commitConfig(config=>{config.archived=config.archived.filter(value=>value!==id)});renderArchiveList()}
  function permanentlyDeleteApp(id){const app=state.allApps.find(value=>value.id===id);if(!app||!confirm(`${app.name}を完全に削除しますか？この操作は戻せません。`))return;state.config.archived=state.config.archived.filter(value=>value!==id);state.config.customApps=state.config.customApps.filter(value=>value.id!==id);if(!state.config.deleted.includes(id))state.config.deleted.push(id);delete state.config.assignments[id];delete state.config.devices[id];delete state.config.cardOverrides[id];for(const categoryId of Object.keys(state.config.orders))state.config.orders[categoryId]=state.config.orders[categoryId].filter(value=>value!==id);state.history={past:[],future:[]};persistConfig();renderArchiveList()}
  function toggleFavorite(id){
    state.favorites=state.favorites.includes(id)?state.favorites.filter(value=>value!==id):[...state.favorites,id];writeJson(FAVORITES_KEY,state.favorites);renderAll();scheduleSharedSave();
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
  byId('loginForm').addEventListener('submit',submitLogin);byId('logoutButton').addEventListener('click',logout);byId('searchInput').addEventListener('input',event=>syncSearch(event.target));byId('categorySearch').addEventListener('input',event=>syncSearch(event.target));byId('settingsButton').addEventListener('click',openSettings);byId('headerSettingsButton').addEventListener('click',()=>setManagementMode(true));byId('managementButton').addEventListener('click',()=>setManagementMode(!state.adminMode));byId('finishManagementButton').addEventListener('click',()=>setManagementMode(false));byId('mobileMenuButton').addEventListener('click',toggleMobileMenu);byId('sidebarBackdrop').addEventListener('click',closeMobileMenu);byId('organizeButton').addEventListener('click',toggleOrganizing);byId('undoButton').addEventListener('click',undoConfig);byId('redoButton').addEventListener('click',redoConfig);byId('addCardButton').addEventListener('click',openAddCard);byId('archiveButton').addEventListener('click',openArchive);byId('publishConfigButton').addEventListener('click',publishSharedConfig);byId('addCardForm').addEventListener('submit',addCard);byId('closeAddCardButton').addEventListener('click',()=>byId('addCardDialog').close());byId('cancelAddCardButton').addEventListener('click',()=>byId('addCardDialog').close());byId('addCategoryButton').addEventListener('click',addCategory);byId('newCategoryName').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();addCategory()}});byId('resetLayoutButton').addEventListener('click',resetLayout);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!byId('searchSection').hidden){clearSearch();byId('searchInput').blur();return}if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&document.activeElement!==byId('searchInput')){event.preventDefault();byId('searchInput').focus()}});
  setInterval(()=>{if(state.sharedReady)refreshSharedConfig()},60000);init();
})();
