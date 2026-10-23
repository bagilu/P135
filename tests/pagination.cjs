const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const {parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),checks=[];
const tick=()=>new Promise(r=>setImmediate(r));
async function wait(fn){for(let i=0;i<150;i++){if(fn())return;await tick()}throw Error('Pagination did not settle')}
const rows=Array.from({length:243},(_,i)=>({id:`aaaaaaaa-aaaa-4aaa-8aaa-${String(i+1).padStart(12,'0')}`,title:`測試新聞 ${i}`,published_date:'2026-10-23'}));
function page(api){
 const {document,window}=parseHTML(fs.readFileSync(root+'/index.html','utf8'));let observer,hash='';
 window.P135_API=api;window.scrollTo=()=>{};window.scrollY=0;
 window.IntersectionObserver=class{constructor(cb){this.cb=cb;observer=this}observe(){}unobserve(){}fire(){this.cb([{isIntersecting:true}])}};
 const location={pathname:'/',search:'',get hash(){return hash},set hash(v){hash=v;window.dispatchEvent(new window.Event('hashchange'))}};
 vm.runInNewContext(fs.readFileSync(root+'/js/library.js','utf8'),{window,document,location,history:{replaceState(){hash=''}},requestAnimationFrame:fn=>fn(),URL,console});
 document.dispatchEvent(new window.Event('DOMContentLoaded'));
 return {document,$:id=>document.getElementById(id),fire:()=>observer.fire(),event:(id,type)=>document.getElementById(id).dispatchEvent(new window.Event(type,{bubbles:true,cancelable:true})),location,count:()=>document.querySelectorAll('.article-tag').length};
}
async function check(name,fn){await fn();checks.push({name,status:'PASS'});console.log('PASS',name)}
(async()=>{
 let fail=false,release=null,calls=[];
 const p=page({listPublic:async args=>{calls.push({...args});if(args.offset===100&&fail)throw Error('模擬斷線');if(args.offset===100&&release===null)await new Promise(r=>release=r);return rows.slice(args.offset,args.offset+args.limit)}});
 await check('first request explicitly asks the existing RPC for 100 rows',async()=>{await wait(()=>p.count()===100);assert.equal(calls.length,1);assert.equal(calls[0].limit,100)});
 await check('concurrent sentinel callbacks do not duplicate the pending page',async()=>{p.fire();p.fire();await wait(()=>release);assert.equal(calls.length,2);assert.equal(p.$('articleTags').getAttribute('aria-busy'),'true');release();await wait(()=>p.count()===200)});
 await check('final partial page stops automatic fetching and displays completion',async()=>{p.fire();await wait(()=>p.count()===243);const n=calls.length;p.fire();await tick();assert.equal(calls.length,n);assert(p.$('btnLoadMore').hidden);assert(p.$('listProgress').textContent.includes('所有'))});
 let failedCalls=[];
 const e=page({listPublic:async a=>{failedCalls.push(a);if(a.offset===100&&fail)throw Error('模擬斷線');return rows.slice(a.offset,a.offset+a.limit)}});
 await check('failed append preserves existing tags and stops automatic retries',async()=>{await wait(()=>e.count()===100);fail=true;e.fire();await wait(()=>!e.$('btnRetry').hidden);assert.equal(e.count(),100);const n=failedCalls.length;e.fire();e.fire();await tick();assert.equal(failedCalls.length,n);assert(e.$('listProgress').textContent.includes('模擬斷線'))});
 await check('manual retry resumes the failed offset without clearing loaded tags',async()=>{fail=false;e.event('btnRetry','click');await wait(()=>e.count()===200);assert.equal(failedCalls.at(-1).offset,100);assert.equal(new Set([...e.document.querySelectorAll('.article-tag')].map(a=>a.href)).size,200)});
 let resolveOld;const raceCalls=[];
 const race=page({listPublic:async a=>{raceCalls.push(a);if(!a.query)return new Promise(r=>resolveOld=r);return [{...rows[0],title:'新搜尋結果'}]}});
 await check('search reset ignores an earlier pending response and resets offset',async()=>{race.$('searchInput').value='新搜尋';race.event('filterForm','submit');await wait(()=>race.count()===1);resolveOld(rows.slice(0,100));await tick();assert.equal(race.count(),1);assert(race.document.querySelector('.tag-title').textContent.includes('新搜尋'));assert.equal(raceCalls[1].offset,0);assert.equal(raceCalls[1].query,'新搜尋')});
 let hiddenCalls=0;const hidden=page({listPublic:async a=>{hiddenCalls++;return rows.slice(a.offset,a.offset+a.limit)}});
 await check('sentinel cannot fetch background pages while the reading view is open',async()=>{await wait(()=>hidden.count()===100);hidden.$('libraryView').hidden=true;hidden.fire();await tick();assert.equal(hiddenCalls,1)});
 const exactCalls=[];const exact=page({listPublic:async a=>{exactCalls.push(a);return a.offset===0?rows.slice(0,100):[]}});
 await check('an exact multiple performs one empty end check then stops',async()=>{await wait(()=>exact.count()===100);exact.fire();await wait(()=>exact.$('btnLoadMore').hidden&&exact.$('articleTags').getAttribute('aria-busy')==='false');exact.fire();await tick();assert.equal(exactCalls.length,2);assert.equal(exact.count(),100)});
 fs.writeFileSync(root+'/docs/Pagination_Test_Results.json',JSON.stringify({environment:'LinkeDOM + Node VM + controlled IntersectionObserver and RPC promises; synthetic articles only.',checks},null,2)+'\n');
 console.log('PAGINATION CHECKS:',checks.length);
})().catch(e=>{console.error(e);process.exit(1)});
