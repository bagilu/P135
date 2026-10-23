import {serve} from "https://deno.land/std@0.168.0/http/server.ts";
import {DOMParser} from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import {authorizeEditor,readJson,respond,failure,corsHeaders,HttpError} from "../_shared/p135-auth.ts";
const sites=[['ltn.com.tw','自由時報'],['udn.com','聯合報'],['chinatimes.com','中國時報'],['setn.com','三立新聞網']];
function allowed(raw:string){
  let url:URL;try{url=new URL(raw);}catch{throw new HttpError(400,'新聞網址格式無效。');}
  const site=sites.find(([host])=>url.hostname===host||url.hostname.endsWith('.'+host));
  if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||!site)throw new HttpError(400,'目前支援自由、聯合、中時、三立的 HTTPS 新聞網址。');
  return {url,site};
}
serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  try{
    await authorizeEditor(req);
    const input=await readJson(req);if(typeof input.url!=='string'||input.url.length>4000)throw new HttpError(400,'請提供有效新聞網址。');
    let target=allowed(input.url.trim()),response:Response|undefined;
    for(let hops=0;hops<4;hops++){
      response=await fetch(target.url.href,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}});
      if(response.status>=300&&response.status<400){const location=response.headers.get('location');await response.body?.cancel();if(!location||hops===3)throw new HttpError(422,'新聞重新導向過多或無效。');target=allowed(new URL(location,target.url).href);continue;}break;
    }
    if(!response?.ok)throw new HttpError(422,`無法取得新聞（HTTP ${response?.status||0}）。請改為手動貼入。`);
    const reader=response.body?.getReader();if(!reader)throw new HttpError(422,'新聞回應沒有內容。');const chunks:Uint8Array[]=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>3000000){await reader.cancel();throw new HttpError(413,'網頁過大，請改為手動貼入。');}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const doc=new DOMParser().parseFromString(new TextDecoder().decode(bytes),'text/html');if(!doc)throw new HttpError(422,'網頁解析失敗。');
    const host=target.site[0],media=target.site[1];
    const selectors=host==='udn.com'?['.article-content__title','.article-content__time','section.article-content__editor p']:host==='chinatimes.com'?['.article-title','time','.article-body p']:host==='setn.com'?['h1.news-title-3','.time','#Content1 p, article p']:['h1','.time','.text p:not(.appE)'];
    const title=doc.querySelector(selectors[0])?.textContent?.trim()||doc.querySelector('h1')?.textContent?.trim()||doc.querySelector('meta[property="og:title"]')?.getAttribute('content')||'';
    const time=doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content')||doc.querySelector(selectors[1])?.getAttribute('datetime')||doc.querySelector(selectors[1])?.textContent||'';
    const date=time.match(/\d{4}[-/]\d{2}[-/]\d{2}/)?.[0].replaceAll('/','-')||'';
    const content=Array.from(doc.querySelectorAll(selectors[2])).map(p=>p.textContent?.trim()||'').filter(t=>t&&!t.includes('點我下載APP')&&!t.includes('不用抽')&&!t.includes('更多三立新聞網報導')&&!t.includes('★ 三立新聞網提醒您')).join('\n\n');
    if(!title||!content)throw new HttpError(422,'未能擷取標題或正文，網站版型可能已變動；請手動貼入。');
    if(content.length>100000)throw new HttpError(413,'擷取內容超過分析上限，請手動整理。');
    return respond({success:true,media,title,date,author:doc.querySelector('.article-content__author, .author')?.textContent?.trim()||'',content});
  }catch(error){return failure(error);}
});
