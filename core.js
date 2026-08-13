(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.StepWorkspaceCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const CATEGORY_ICON_IDS=['grid','user','chat','wallet','teacher','gear','chart','calendar','file','mail','qr','clock','book','school','calculator','clipboard','star','database','phone','shield'];
  const CATEGORY_COLORS=['#276EE4','#1D9550','#DD8700','#D54883','#6751C7','#0E8A92','#C2415D','#58708F','#7C5C20','#6D7785'];
  const CATEGORIES=[
    {id:'student',label:'生徒・授業',className:'category-student',initial:'生',icon:'user',color:'#DD8700'},
    {id:'contact',label:'連絡・受付',className:'category-contact',initial:'連',icon:'chat',color:'#276EE4'},
    {id:'billing',label:'請求・会計',className:'category-billing',initial:'請',icon:'wallet',color:'#1D9550'},
    {id:'teacher',label:'講師・給与',className:'category-teacher',initial:'講',icon:'teacher',color:'#D54883'},
    {id:'admin',label:'ポイント・その他',className:'category-admin',initial:'他',icon:'gear',color:'#6D7785'}
  ];
  const URL_FIELDS=['productionUrl','利用者向けURL','本番URL','アプリURL','WebアプリURL','Apps Script WebアプリURL','管理者向けURL','読み取りURL','入力フォームURL','Google Sheet URL','GitHub Pages URL'];
  const DESCRIPTION_RULES=[
    [/請求管理システムV?3\.1|学費計算/, '学費計算と請求データの作成・確認'],
    [/請求書PDF|invoice/i, '請求書PDFの作成・配信・入金管理'],
    [/配信|メッセージ/, '生徒・保護者へのお知らせ配信'],
    [/不達メール/, '届かなかったメールの確認と管理'],
    [/出退|QR作成・読取/, '入退室QRの作成と読み取り'],
    [/講師ポータル/, '講師向け情報と業務メニュー'],
    [/講師マスター|給与明細/, '講師情報と給与明細の管理'],
    [/講師予定|出勤登録/, '講師予定と出勤情報の登録'],
    [/学習進捗/, '生徒の学習状況と進捗を確認'],
    [/成績管理/, 'テスト成績・通知表・志望校を管理'],
    [/面談メモ/, '面談内容の記録と確認'],
    [/過去問/, '過去問題の登録・検索・閲覧'],
    [/生徒マスタ/, '生徒情報の確認と管理'],
    [/受付カード|エントリーシート/, '受付情報の読み取りと登録'],
    [/お問い合わせ/, 'お問い合わせ内容の確認と対応'],
    [/塾生アプリ/, '塾生向け機能をまとめた共通入口'],
    [/統合管理ポータル/, 'STEPの管理機能をまとめた入口'],
    [/資産管理/, 'システム情報の調査と保守']
  ];
  function text(value){return String(value==null?'':value).trim()}
  function normalize(value){return text(value).toLowerCase().normalize('NFKC').replace(/[\s　]+/g,'')}
  function isUrl(value){try{const u=new URL(text(value));return u.protocol==='https:'||u.protocol==='http:'}catch(_){return false}}
  function isGoogleSheetUrl(value){try{const u=new URL(text(value));return u.protocol==='https:'&&u.hostname==='docs.google.com'&&u.pathname.startsWith('/spreadsheets/')}catch(_){return false}}
  function urlKey(value){try{const u=new URL(text(value));u.hash='';u.searchParams.delete('v');return u.href.replace(/\/$/,'')}catch(_){return text(value)}}
  function firstUrl(item){for(const key of URL_FIELDS){const value=text(item[key]);if(isUrl(value))return value}return ''}
  function nameOf(item){return text(item.displayName||item['正式名称']||item['システム名']||item['名称']||item.name||'名称未設定')}
  function idOf(item){return text(item.ID||item.id)||normalize(nameOf(item)).replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff-]/g,'-')}
  function categoryId(item){
    const explicit=normalize(item.category||item.categoryId||item['分類']);const named=CATEGORIES.find(category=>explicit===normalize(category.id)||explicit===normalize(category.label));if(named)return named.id;
    const name=nameOf(item);const value=name+' '+text(item['分類']);
    if(/請求|会計|領収|学費|invoice/i.test(name))return 'billing';
    if(/出退くん|QR作成|QR読取|不達|配信|問い合わせ|受付/.test(name))return 'contact';
    if(/講師|先生|給与|出勤/.test(name))return 'teacher';
    if(/請求|会計|領収|学費|invoice/i.test(value))return 'billing';
    if(/配信|メッセージ|不達|出退|QR|受付|問い合わせ|連絡/.test(value))return 'contact';
    if(/生徒|塾生|成績|学習|授業|面談|過去問|エントリー/.test(value))return 'student';
    return 'admin';
  }
  function descriptionOf(item){
    const name=nameOf(item);
    const explicit=text(item.description);
    if(explicit)return explicit;
    const match=DESCRIPTION_RULES.find(([pattern])=>pattern.test(name));
    if(match)return match[1];
    const raw=text(item['業務ホーム説明']||item['概要']||item['説明']);
    if(raw&&raw.length<=74&&!/GitHub|Apps Script|Cloudflare|D1|R2|Supabase|デプロイ|リポジトリ/i.test(raw))return raw.replace(/[。.]$/,'');
    return '業務アプリを開く';
  }
  function keywordsOf(item,category){
    const keywordValue=item.keywords||item['検索キーワード']||item['キーワード'];const explicit=Array.isArray(keywordValue)?keywordValue.join(' '):text(keywordValue);
    const aliases=[];const name=nameOf(item);
    if(/請求/.test(name))aliases.push('せいきゅう 請求書 PDF 会計');
    if(/講師/.test(name))aliases.push('こうし 先生');
    if(/生徒|塾生/.test(name))aliases.push('せいと 学生');
    if(/配信|メッセージ/.test(name))aliases.push('はいしん 連絡 メール');
    return [name,descriptionOf(item),text(item.parentSystem),explicit,...aliases].join(' ');
  }
  function statusOf(item){const explicit=normalize(item.status);if(['active','hidden','legacy'].includes(explicit))return explicit;const value=normalize(item['状態']);if(/旧|廃止|終了|archive|legacy/.test(value))return 'legacy';if(/非表示|hidden/.test(value))return 'hidden';return 'active'}
  function toApp(item){
    const category=CATEGORIES.find(value=>value.id===categoryId(item))||CATEGORIES.at(-1);
    const url=firstUrl(item);
    return {id:idOf(item),name:nameOf(item),description:descriptionOf(item),url,productionUrl:url,parentSystem:text(item.parentSystem),status:statusOf(item),favoriteEnabled:item.favorite!==false,recentEnabled:item.recent!==false,iconType:isGoogleSheetUrl(url)?'google-sheet':'category',categoryId:category.id,categoryLabel:category.label,categoryClass:category.className,initial:category.initial,searchText:normalize(keywordsOf(item,category)),source:item};
  }
  function buildApps(items){const seenIds=new Set();const seenUrls=new Set();return (Array.isArray(items)?items:[]).map(toApp).filter(app=>{if(app.status!=='active')return false;const key=urlKey(app.url);if(seenIds.has(app.id)||(key&&seenUrls.has(key)))return false;seenIds.add(app.id);if(key)seenUrls.add(key);return true})}
  function plainMarkdown(value){return text(value).replace(/^\[([^\]]+)\]\([^\)]+\)$/,'$1').replace(/`/g,'')}
  function parseRegistryMarkdown(markdown){
    const lines=String(markdown||'').split(/\r?\n/);const start=lines.findIndex(line=>/^\|\s*正式名称\s*\|\s*状態\s*\|/.test(line));if(start<0)return [];
    const records=[];
    for(let index=start+2;index<lines.length;index+=1){const line=lines[index];if(!/^\s*\|/.test(line))break;const columns=line.replace(/^\s*\||\|\s*$/g,'').split('|').map(value=>value.trim());if(columns.length<3)continue;
      records.push({'正式名称':plainMarkdown(columns[0]),'状態':plainMarkdown(columns[1]),'利用者向けURL':plainMarkdown(columns[2])});
    }
    return records;
  }
  function mergeRegistrySources(apiItems,markdownItems){
    const details=(Array.isArray(apiItems)?apiItems:[]).map(item=>Object.assign({},item));const used=new Set();const merged=[];
    for(const registryItem of Array.isArray(markdownItems)?markdownItems:[]){
      const registryName=normalize(nameOf(registryItem));const registryUrl=firstUrl(registryItem);let bestIndex=-1;let bestScore=0;
      details.forEach((item,index)=>{if(used.has(index))return;const itemName=normalize(nameOf(item));const itemUrl=firstUrl(item);let score=0;if(registryName===itemName)score=100;else if(registryName&&itemName&&(registryName.includes(itemName)||itemName.includes(registryName)))score=60+Math.min(registryName.length,itemName.length);if(registryUrl&&itemUrl&&registryUrl===itemUrl)score+=50;if(score>bestScore){bestScore=score;bestIndex=index}});
      const base=bestIndex>=0?(used.add(bestIndex),details[bestIndex]):{};const item=Object.assign({},base,registryItem);
      if(!firstUrl(registryItem)&&firstUrl(base))item['利用者向けURL']=firstUrl(base);merged.push(item);
    }
    details.forEach((item,index)=>{if(!used.has(index))merged.push(item)});return merged;
  }
  function mergeCatalogSources(registryItems,catalogItems){
    const catalog=Array.isArray(catalogItems)?catalogItems:[];const replacements=new Set(catalog.flatMap(item=>Array.isArray(item.replaces)?item.replaces:[]).map(normalize));const catalogUrls=new Set(catalog.map(firstUrl).filter(Boolean).map(urlKey));
    const registry=(Array.isArray(registryItems)?registryItems:[]).filter(item=>{const url=urlKey(firstUrl(item));return !replacements.has(normalize(nameOf(item)))&&!(url&&catalogUrls.has(url))});
    return [...catalog,...registry];
  }
  function defaultWorkspaceConfig(){return {categories:CATEGORIES.map(category=>({id:category.id,label:category.label,icon:category.icon,color:category.color})),removedCategories:[],assignments:{},orders:{},devices:{},customApps:[],archived:[],deleted:[]}}
  function normalizeWorkspaceConfig(value){
    const source=value&&typeof value==='object'?value:{};const defaults=defaultWorkspaceConfig();const supplied=Array.isArray(source.categories)?source.categories:[];const removedCategories=[...new Set((Array.isArray(source.removedCategories)?source.removedCategories:[]).map(text).filter(id=>CATEGORIES.some(category=>category.id===id)))];const categories=[];const seen=new Set();
    for(const item of supplied){const id=text(item?.id);const base=CATEGORIES.find(category=>category.id===id);const label=text(item?.label);if(!id||seen.has(id)||removedCategories.includes(id)||(!base&&!/^custom-[a-z0-9-]+$/.test(id))||(!base&&!label))continue;const icon=CATEGORY_ICON_IDS.includes(text(item?.icon))?text(item.icon):(base?.icon||'grid');const color=CATEGORY_COLORS.includes(text(item?.color).toUpperCase())?text(item.color).toUpperCase():(base?.color||CATEGORY_COLORS[0]);categories.push({id,label:label||base.label,icon,color});seen.add(id)}
    for(const base of CATEGORIES){if(removedCategories.includes(base.id)||seen.has(base.id))continue;categories.push({id:base.id,label:base.label,icon:base.icon,color:base.color});seen.add(base.id)}
    const cleanMap=(input,allowed)=>Object.fromEntries(Object.entries(input&&typeof input==='object'?input:{}).filter(([key,val])=>key&&allowed(val)));
    if(!categories.length){categories.push({id:CATEGORIES[0].id,label:CATEGORIES[0].label,icon:CATEGORIES[0].icon,color:CATEGORIES[0].color});removedCategories.splice(removedCategories.indexOf(CATEGORIES[0].id),1)}const categoryIds=new Set(categories.map(category=>category.id));
    const assignments=cleanMap(source.assignments,value=>categoryIds.has(text(value)));
    const devices=cleanMap(source.devices,value=>['desktop','mobile','both'].includes(value));
    const orders={};for(const [categoryId,ids] of Object.entries(source.orders&&typeof source.orders==='object'?source.orders:{})){if(categoryIds.has(categoryId)&&Array.isArray(ids))orders[categoryId]=[...new Set(ids.map(text).filter(Boolean))]}
    const customApps=(Array.isArray(source.customApps)?source.customApps:[]).filter(item=>text(item?.id)&&text(item?.displayName)&&isUrl(item?.productionUrl)).map(item=>({id:text(item.id),displayName:text(item.displayName),description:text(item.description)||'追加した業務アプリ',category:categoryIds.has(text(item.category))?text(item.category):'admin',productionUrl:text(item.productionUrl),parentSystem:text(item.parentSystem)||'追加カード',keywords:Array.isArray(item.keywords)?item.keywords.map(text).filter(Boolean):[],favorite:item.favorite!==false,recent:item.recent!==false,status:'active'}));
    const archived=[...new Set((Array.isArray(source.archived)?source.archived:[]).map(text).filter(Boolean))];const deleted=[...new Set((Array.isArray(source.deleted)?source.deleted:[]).map(text).filter(Boolean))];
    return {categories,removedCategories,assignments,orders,devices,customApps,archived,deleted};
  }
  function categoryDefinition(id,categories){
    const list=Array.isArray(categories)?categories:CATEGORIES;const item=list.find(category=>category.id===id);if(Array.isArray(categories)&&!item&&list.length)return categoryDefinition(list[0].id,list);const base=CATEGORIES.find(category=>category.id===id);if(!item&&!base)return CATEGORIES.at(-1);
    const label=text(item?.label)||base?.label||'その他';const icon=CATEGORY_ICON_IDS.includes(text(item?.icon))?text(item.icon):(base?.icon||'grid');const color=CATEGORY_COLORS.includes(text(item?.color).toUpperCase())?text(item.color).toUpperCase():(base?.color||CATEGORY_COLORS[0]);return {id,label,className:base?.className||'category-custom',initial:(base?.initial||label.charAt(0)||'他'),icon,color,softColor:`${color}18`,custom:!base};
  }
  function applyWorkspaceConfig(apps,value){
    const config=normalizeWorkspaceConfig(value);return (Array.isArray(apps)?apps:[]).map(app=>{const category=categoryDefinition(config.assignments[app.id]||app.categoryId,config.categories);return Object.assign({},app,{categoryId:category.id,categoryLabel:category.label,categoryClass:category.className,initial:category.initial,categoryIcon:category.icon,categoryColor:category.color,categorySoftColor:category.softColor,device:config.devices[app.id]||'both'})});
  }
  function filterApps(apps,query){const q=normalize(query);return q?apps.filter(app=>app.searchText.includes(q)):apps.slice()}
  function defaultFavoriteIds(apps){const patterns=[/STEP配信/,/請求管理システムV?3\.1/,/請求書(?:PDF|作成)/,/成績管理/,/生徒マスタ/];const ids=[];for(const pattern of patterns){const app=apps.find(value=>value.favoriteEnabled&&pattern.test(value.name)&&!ids.includes(value.id));if(app)ids.push(app.id)}return ids.slice(0,5)}
  function groupByCategory(apps,categories,orders,includeEmpty){return (Array.isArray(categories)?categories:CATEGORIES).map(item=>{const category=categoryDefinition(item.id,categories);const order=Array.isArray(orders?.[category.id])?orders[category.id]:[];const rank=new Map(order.map((id,index)=>[id,index]));const grouped=apps.filter(app=>app.categoryId===category.id).sort((a,b)=>(rank.get(a.id)??Number.MAX_SAFE_INTEGER)-(rank.get(b.id)??Number.MAX_SAFE_INTEGER));return {category,apps:grouped}}).filter(group=>includeEmpty||group.apps.length)}
  return {CATEGORIES,CATEGORY_ICON_IDS,CATEGORY_COLORS,URL_FIELDS,normalize,isUrl,isGoogleSheetUrl,urlKey,firstUrl,nameOf,idOf,categoryId,descriptionOf,statusOf,toApp,buildApps,plainMarkdown,parseRegistryMarkdown,mergeRegistrySources,mergeCatalogSources,defaultWorkspaceConfig,normalizeWorkspaceConfig,categoryDefinition,applyWorkspaceConfig,filterApps,defaultFavoriteIds,groupByCategory};
});
