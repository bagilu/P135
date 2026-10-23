const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ts=require('typescript'),{DOMParser}=require('linkedom');
const root=require('path').resolve(__dirname,'..');
require('fs').mkdirSync(require('path').join(__dirname,'scratch'),{recursive:true});
let authorized=true,hasUser=true,handler,upstream=async()=>{throw Error('Unexpected external fetch')};let calls=0;
const env={SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'mock-public-key',AI_API_KEY:'mock-ai-key',AI_MODELS:'test-model-1,test-model-2'};
const modules={};
function load(file){
 if(modules[file])return modules[file];const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert(!(output.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error),'TypeScript syntax diagnostics');
 const exports={};modules[file]=exports;
 function requireMock(spec){if(spec.includes('http/server.ts'))return {serve:fn=>{handler=fn}};if(spec.includes('deno_dom'))return {DOMParser};if(spec.includes('supabase-js'))return {createClient:()=>({auth:{getUser:async()=>({data:{user:hasUser?{id:'mock-user'}:null},error:hasUser?null:{message:'unauthorized'}})},rpc:async name=>{assert.equal(name,'P135_GetEditorStatus');return {data:authorized,error:null}}})};return load(path.resolve(path.dirname(file),spec));}
 vm.runInNewContext(output.outputText,{exports,require:requireMock,Deno:{env:{get:k=>env[k]}},fetch:async(...args)=>{calls++;return upstream(...args)},Request,Response,Headers,URL,TextDecoder,Uint8Array,AbortSignal,console:{log(){},warn(){}},Error,JSON},{filename:file});return exports;
}
function req(body,auth=true){return new Request('https://edge.invalid/',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer mock-token'}:{})},body:JSON.stringify(body)})}
(async()=>{
 const checks=[];const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'});console.log('PASS',name)};
 load(root+'/supabase/functions/P135-scrape-news/index.ts');const scrape=handler;
 await check('scraper rejects absent or invalid identity before fetching',async()=>{calls=0;assert.equal((await scrape(req({url:'https://udn.com/test'},false))).status,401);hasUser=false;assert.equal((await scrape(req({url:'https://udn.com/test'}))).status,401);hasUser=true;assert.equal(calls,0);});
 await check('scraper rejects logged-in non-editor before fetching',async()=>{authorized=false;calls=0;assert.equal((await scrape(req({url:'https://udn.com/test'}))).status,403);assert.equal(calls,0);authorized=true;});
 await check('scraper blocks spoofed hosts, private hosts and HTTP',async()=>{for(const url of ['https://udn.com.evil.invalid/news','https://evil.invalid/?url=udn.com','http://udn.com/news','https://127.0.0.1/news'])assert.equal((await scrape(req({url}))).status,400);});
 await check('scraper rejects unsafe redirect without following it',async()=>{calls=0;upstream=async()=>new Response(null,{status:302,headers:{location:'https://evil.invalid/news'}});assert.equal((await scrape(req({url:'https://udn.com/news'}))).status,400);assert.equal(calls,1);});
 await check('scraper extracts title/date/content from actual DOM parser',async()=>{upstream=async()=>new Response('<html><meta property="article:published_time" content="2026-10-23T12:00:00+08:00"><h1 class="article-content__title">測試新聞</h1><section class="article-content__editor"><p>第一段內文。</p><p>第二段內文。</p></section></html>');const response=await scrape(req({url:'https://udn.com/news'}));assert.equal(response.status,200);const data=await response.json();assert.equal(data.title,'測試新聞');assert.equal(data.date,'2026-10-23');assert.equal(data.content,'第一段內文。\n\n第二段內文。');});
 await check('scraper does not report empty extraction as success',async()=>{upstream=async()=>new Response('<html>no article</html>');assert.equal((await scrape(req({url:'https://udn.com/news'}))).status,422);});
 await check('scraper enforces response size cap',async()=>{upstream=async()=>new Response('x'.repeat(3000001));assert.equal((await scrape(req({url:'https://udn.com/news'}))).status,413);});
 load(root+'/supabase/functions/P135-analyze-news/index.ts');const analyze=handler;
 const analysis={neutral_rewriting:'中性改寫',flipped_perspective:{summary:'假設對調',reading_feeling:'閱讀感受'},sentiment_analysis:{overall_tone:'中性',bias_rating:1,loaded_words:[]},fact_vs_opinion:{facts:['陳述'],opinions:['觀點']}};
 const payload={title:'新聞',content:'待分析新聞內文'};
 await check('AI endpoint rejects non-editor and missing title/content',async()=>{authorized=false;calls=0;assert.equal((await analyze(req(payload))).status,403);assert.equal(calls,0);authorized=true;assert.equal((await analyze(req({title:'新聞',content:''}))).status,400);});
 await check('AI fallback returns validated JSON; key absent from URL',async()=>{calls=0;upstream=async(url,options)=>{assert(!url.includes('mock-ai-key'));assert.equal(options.headers['x-goog-api-key'],'mock-ai-key');if(calls===1)return new Response('{}',{status:404});return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(analysis)}]}}]}));};const response=await analyze(req(payload));assert.equal(response.status,200);assert.equal(calls,2);assert.deepEqual(await response.json(),analysis);});
 await check('AI rejects malformed analysis instead of returning status 200',async()=>{upstream=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"unexpected":"value"}'}]}}]}));assert.equal((await analyze(req(payload))).status,502);});
 await check('AI permission error is not mislabeled as model busy',async()=>{upstream=async()=>new Response('{}',{status:403});const response=await analyze(req(payload));assert.equal(response.status,503);assert((await response.json()).error.includes('權限'));});
 await check('Dashboard single-file variants contain working owner gates',async()=>{for(const name of ['P135-analyze-news','P135-scrape-news']){load(root+'/docs/dashboard-single-file/'+name+'.ts');assert.equal((await handler(req({},false))).status,401);}});
 fs.writeFileSync(root+'/docs/Edge_Test_Results.json',JSON.stringify({environment:'TypeScript transpile + isolated Node VM; actual DOM parser, mocked Supabase Auth/RPC and mocked upstream HTTP. No paid API or live Supabase calls.',checks},null,2)+'\n');console.log('EDGE CHECKS:',checks.length);
})().catch(e=>{console.error(e);process.exit(1)});
