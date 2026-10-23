const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {parseHTML}=require('linkedom');
const root=require('path').resolve(__dirname,'..');
require('fs').mkdirSync(require('path').join(__dirname,'scratch'),{recursive:true});
const tick=()=>new Promise(r=>setImmediate(r));
async function wait(fn){for(let i=0;i<100;i++){if(fn())return;await tick();}throw Error('DOM state did not settle');}
function page(file,script,api){
 const {window,document}=parseHTML(fs.readFileSync(root+'/'+file,'utf8'));
 let hash='',scroll=0;const location={pathname:'/'+file,search:'',get hash(){return hash},set hash(v){hash=v.startsWith('#')?v:'#'+v;window.dispatchEvent(new window.Event('hashchange'))}};
 const history={replaceState(_,__,value){hash=value.includes('#')?value.slice(value.indexOf('#')):''}};
 window.P135_API=api;window.APP_CONFIG={ACCOUNT_CENTER_URL:'https://bagilu.github.io/P130/'};window.scrollTo=(_,y)=>{scroll=y};Object.defineProperty(window,'scrollY',{get:()=>scroll,configurable:true});
 window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.scrollIntoView=function(){};
 const alerts=[];
 for(const d of document.querySelectorAll('dialog')){d.showModal=function(){this.open=true;this.hidden=false};d.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'))};}
 for(const form of document.querySelectorAll('form'))form.reportValidity=()=>true;
 const context={window,document,location,history,URL,console,setTimeout,queueMicrotask,requestAnimationFrame:fn=>fn(),alert:x=>alerts.push(x),confirm:()=>true};
 vm.runInNewContext(fs.readFileSync(root+'/'+script,'utf8'),context,{filename:script});document.dispatchEvent(new window.Event('DOMContentLoaded'));
 return {window,document,location,alerts,$:id=>document.getElementById(id),event:(id,name)=>document.getElementById(id).dispatchEvent(new window.Event(name,{bubbles:true,cancelable:true})),setScroll:y=>{scroll=y},getScroll:()=>scroll};
}
(async()=>{
 const checks=[];const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'});console.log('PASS',name)};
 const owner={id:'owner',email:'owner@example.invalid'},other={id:'other',email:'other@example.invalid'},id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 let user=null,authCallback,listCalls=0,detailCalls=0,allow=true,failLogin=false,signOutCalls=0;
 const article={id,title:'私人標題',published_date:'2026-10-23',source_media:'測試媒體',source_url:'javascript:alert(1)',original_content:'第一段\n\n<img class="injected" src=x> 私人原文',neutral_content:'中性分析',flipped_content:'對調分析',flipped_feeling:'感受',sentiment_data:{},fact_opinion_data:{facts:['陳述'],opinions:['觀點']},personal_notes:'PERSONAL NOTE MUST NOT RENDER'};
 const api={getUser:async()=>user,onAuthStateChange:cb=>{authCallback=cb},libraryAccess:async()=>allow&&user?.id==='owner',signIn:async(email)=>{if(failLogin)return {data:{user:null},error:{message:'密碼錯誤'}};user=email.startsWith('owner')?owner:other;return {data:{user},error:null}},signOut:async()=>{user=null;signOutCalls++;authCallback('SIGNED_OUT',null);return {error:null}},listLibrary:async()=>{listCalls++;return [{id,title:'私人標題',published_date:'2026-10-23'}]},libraryDetail:async()=>{detailCalls++;return article},libraryNeighbors:async()=>({previous:null,next:null})};
 const p=page('index.html','js/library.js',api);
 async function login(email='owner@example.invalid'){p.$('loginEmail').value=email;p.$('loginPassword').value='test-secret';p.event('loginForm','submit');await wait(()=>!p.$('btnSubmitLogin').disabled)}
 await check('anonymous page makes no article or access RPC and direct hash remains locked',async()=>{await tick();assert(!p.$('accessGate').hidden);assert(p.$('libraryView').hidden);assert.equal(listCalls,0);p.location.hash='article='+id;await tick();assert.equal(detailCalls,0)});
 await check('password reveal toggles without losing value; failed login clears password',async()=>{p.$('loginPassword').value='test-secret';p.event('btnTogglePassword','click');assert.equal(p.$('loginPassword').type,'text');assert.equal(p.$('loginPassword').value,'test-secret');failLogin=true;await login();assert(p.$('loginError').textContent.includes('密碼錯誤'));assert.equal(p.$('loginPassword').value,'');assert.equal(p.$('loginPassword').type,'password');failLogin=false});
 await check('another account cannot load any title, original or analysis',async()=>{await login('other@example.invalid');assert(p.$('accessStatus').textContent.includes('沒有 P135'));assert.equal(listCalls,0);assert.equal(detailCalls,0);assert(p.$('editorEntry').hidden)});
 await check('authorized login can open a direct private article link',async()=>{await login();await wait(()=>!p.$('readerBody').hidden);assert.equal(p.$('originalText').textContent,article.original_content);assert.equal(p.$('loginPassword').value,'');assert(!p.$('editorEntry').hidden)});
 await check('stored original is rendered as plain text and private notes stay out of reading page',async()=>{assert.equal(p.document.querySelectorAll('img.injected').length,0);assert(!p.document.body.textContent.includes('PERSONAL NOTE MUST NOT RENDER'));assert(p.$('sourceLink').hidden);assert.equal(p.$('neutralText').textContent,'中性分析')});
 await check('logout clears original, analysis, titles, links and lists immediately',async()=>{p.event('btnSignOut','click');assert.equal(p.$('originalText').textContent,'');assert.equal(p.$('neutralText').textContent,'');assert.equal(p.$('readerTitle').textContent,'');assert.equal(p.document.querySelectorAll('.article-tag').length,0);assert.equal(p.$('sourceLink').getAttribute('href'),null);await wait(()=>signOutCalls===1);assert(!p.$('accessGate').hidden)});
 await check('expired session clears an existing reader without waiting for another request',async()=>{await login();await wait(()=>!p.$('readerBody').hidden);user=null;authCallback('SIGNED_OUT',null);assert.equal(p.$('originalText').textContent,'');assert(p.$('readerView').hidden)});
 let resolveList,resolveDetail,resolveAccess;
 function pendingApi(which){return {getUser:async()=>owner,onAuthStateChange(){},libraryAccess:async()=>which==='access'?new Promise(r=>resolveAccess=r):true,signOut:async()=>({error:null}),listLibrary:async()=>which==='list'?new Promise(r=>resolveList=r):[{id,title:'等待中的標題'}],libraryDetail:async()=>new Promise(r=>resolveDetail=r),libraryNeighbors:async()=>({})}}
 await check('pending list response cannot restore titles after logout',async()=>{const q=page('index.html','js/library.js',pendingApi('list'));await wait(()=>resolveList);q.event('btnSignOut','click');resolveList([{id,title:'不應顯示'}]);await tick();assert.equal(q.document.querySelectorAll('.article-tag').length,0);assert(q.$('libraryView').hidden)});
 await check('pending full-text response cannot restore the reader after logout',async()=>{const q=page('index.html','js/library.js',pendingApi('detail'));await wait(()=>!q.$('libraryView').hidden);q.location.hash='article='+id;await wait(()=>resolveDetail);q.event('btnSignOut','click');resolveDetail(article);await tick();assert.equal(q.$('originalText').textContent,'');assert(q.$('readerView').hidden)});
 await check('pending authorization response cannot unlock a signed-out page',async()=>{const q=page('index.html','js/library.js',pendingApi('access'));await wait(()=>resolveAccess);q.event('btnSignOut','click');resolveAccess(true);await tick();assert(!q.$('accessGate').hidden);assert(q.$('libraryView').hidden)});
 await check('missing private migration fails closed before title or original requests',async()=>{let calls=0;const q=page('index.html','js/library.js',{getUser:async()=>owner,onAuthStateChange(){},libraryAccess:async()=>{throw Error('Could not find P135_GetLibraryAccess')},listLibrary:async()=>{calls++;return []}});await wait(()=>q.$('accessStatus').textContent.includes('30_P135_PrivateLibrary.sql'));assert.equal(calls,0);assert(q.$('libraryView').hidden)});
 await check('back-forward cache lifecycle clears original and revalidates before restore',async()=>{user=owner;await login();await wait(()=>!p.$('readerBody').hidden);p.window.dispatchEvent(new p.window.Event('pagehide'));assert.equal(p.$('originalText').textContent,'');const e=new p.window.Event('pageshow');e.persisted=true;p.window.dispatchEvent(e);await wait(()=>!p.$('readerBody').hidden);assert.equal(p.$('originalText').textContent,article.original_content)});
 await check('SDK stores auth in sessionStorage, discards old persistent key and uses private RPCs',async()=>{
  const calls=[],removed=[];let options;
  const storage={};const client={auth:{signOut:async()=>({error:null})},rpc:async(name,args)=>{calls.push({name,args});return {data:[],error:null}}};
  const window={APP_CONFIG:{SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'public-test-key'},localStorage:{removeItem:k=>removed.push(k)},sessionStorage:storage,supabase:{createClient:(url,key,opt)=>{options=opt;return client}}};
  vm.runInNewContext(fs.readFileSync(root+'/js/supabase-client.js','utf8'),{window,URL,console});
  assert.equal(options.auth.storage,storage);assert.equal(options.auth.storageKey,'P135-private-auth-v006');assert.deepEqual(removed,['P135-auth-token']);await window.P135_API.listLibrary();await window.P135_API.libraryDetail(id);await window.P135_API.libraryNeighbors(id);assert.deepEqual(calls.map(c=>c.name),['P135_ListLibraryArticles','P135_GetArticleDetail','P135_GetLibraryNeighbors']);assert.equal(calls[0].args.p_limit,100);
 });
 fs.writeFileSync(root+'/docs/UI_Test_Results.json',JSON.stringify({web_version:'V0.06',environment:'LinkeDOM actual HTML + Node VM; controlled Auth, RPC and deferred responses.',checks},null,2)+'\n');console.log('UI CHECKS:',checks.length);
})().catch(e=>{console.error(e);process.exit(1)});
