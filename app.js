(function(){
  'use strict';
  const Core=window.StepWorkspaceCore;
  const GAS='https://script.google.com/macros/s/AKfycbypkUc0MqZ07E7pZRglNPeRM56WbCcuWaLpRzi9bVFcPklHDxaaLC7GfzG6ozTGCbEX/exec';
  const AUTH_KEY='stepStaffAppAuth';
  const STAFF_CODE_KEY='stepStaffAppCode';
  const STAFF_PASSWORD_KEY='stepStaffAppPassword';
  const FAVORITES_KEY='stepWorkspaceFavoritesV1';
  const RECENT_KEY='stepWorkspaceRecentV1';
  const ALLOWED_PERMISSIONS=['2','3','4'];
  const state={apps:[],favorites:[],recent:[],auth:null};
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
    const result=await api('getSystemRegistry');
    if(!result.success)throw new Error(result.error||'アプリ一覧を取得できませんでした。');
    state.auth=readAuth();state.apps=Core.buildApps(result.systems);
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
  function createCard(app){
    const card=byId('appCardTemplate').content.firstElementChild.cloneNode(true);
    card.dataset.appId=app.id;card.classList.add(app.categoryClass);
    const favorite=card.querySelector('.favorite-button');const active=state.favorites.includes(app.id);
    favorite.classList.toggle('is-favorite',active);favorite.querySelector('span').textContent=active?'★':'☆';favorite.setAttribute('aria-label',active?`${app.name}をお気に入りから外す`:`${app.name}をお気に入りに追加`);
    favorite.addEventListener('click',()=>toggleFavorite(app.id));
    card.querySelector('.app-icon').textContent=app.initial;card.querySelector('.app-copy strong').textContent=app.name;card.querySelector('.app-copy small').textContent=app.description;
    const link=card.querySelector('.app-link');
    if(app.url){link.href=app.url;link.addEventListener('click',()=>recordRecent(app.id))}
    else{card.classList.add('is-unavailable');link.removeAttribute('href');link.setAttribute('aria-disabled','true');card.querySelector('.open-label').textContent='本番URL確認中'}
    return card;
  }
  function replaceCards(root,apps){root.replaceChildren(...apps.map(createCard))}
  function renderFavorites(){
    const apps=state.favorites.map(id=>state.apps.find(app=>app.id===id)).filter(Boolean);
    replaceCards(byId('favoriteGrid'),apps);
    byId('favoriteSection').hidden=!apps.length;
  }
  function renderRecent(){
    const apps=state.recent.map(entry=>state.apps.find(app=>app.id===entry.id)).filter(Boolean);
    replaceCards(byId('recentGrid'),apps);byId('recentSection').hidden=!apps.length;
  }
  function renderCategories(){
    const groups=Core.groupByCategory(state.apps);const tabs=byId('categoryTabs');const sections=byId('categorySections');tabs.replaceChildren();sections.replaceChildren();
    groups.forEach(({category,apps})=>{
      const anchor=document.createElement('a');anchor.href=`#category-${category.id}`;anchor.textContent=category.label;tabs.append(anchor);
      const section=document.createElement('section');section.id=`category-${category.id}`;section.className=`category-block ${category.className}`;
      const header=document.createElement('div');header.className='category-header';header.innerHTML=`<i class="category-dot" aria-hidden="true"></i><h3></h3><span></span>`;header.querySelector('h3').textContent=category.label;header.querySelector('span').textContent=`${apps.length}件`;
      const grid=document.createElement('div');grid.className='app-grid';replaceCards(grid,apps);section.append(header,grid);sections.append(section);
    });
  }
  function renderSearch(){
    const query=byId('searchInput').value;const active=Core.normalize(query)!=='';byId('searchSection').hidden=!active;byId('defaultSections').hidden=active;
    if(!active)return;const apps=Core.filterApps(state.apps,query);replaceCards(byId('searchGrid'),apps);byId('searchCount').textContent=`${apps.length}件`;byId('searchEmpty').hidden=apps.length>0;
  }
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
  byId('loginForm').addEventListener('submit',submitLogin);byId('logoutButton').addEventListener('click',logout);byId('searchInput').addEventListener('input',renderSearch);
  document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&document.activeElement!==byId('searchInput')){event.preventDefault();byId('searchInput').focus()}});
  init();
})();
