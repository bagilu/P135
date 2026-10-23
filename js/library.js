document.addEventListener('DOMContentLoaded',()=>{
  'use strict';
  const $=id=>document.getElementById(id),api=window.P135_API;
  const PAGE_SIZE=100,seen=new Set();
  let canRead=false,authEpoch=0,currentUserId=null;
  const state={query:'',ascending:false,offset:0,hasMore:false,loading:false,failed:false,listToken:0,readerToken:0,scroll:0};
  const dateText=d=>d?String(d).slice(0,10).replaceAll('-',' / '):'日期未提供';
  const safeText=v=>typeof v==='string'?v:'';
  function status(message,error=false){$('libraryStatus').textContent=message;$('libraryStatus').hidden=!message;$('libraryStatus').classList.toggle('error',error);}
  function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
  function fillList(id,items,empty){const el=$(id);el.replaceChildren();for(const item of Array.isArray(items)&&items.length?items:[empty]){const li=document.createElement('li');li.textContent=safeText(item);el.append(li);}}
  function addTag(a){
    if(seen.has(a.id))return;seen.add(a.id);
    const li=document.createElement('li'),link=document.createElement('a'),content=document.createElement('span'),title=document.createElement('span'),date=document.createElement('time');
    const text=a.title||'無標題';
    li.style.setProperty('--tag-width',`${Math.max(220,Math.min(410,Array.from(text).length*7.5+120))}px`);
    // Decorative, stable colors; they do not classify political viewpoints or sources.
    let hash=0;for(const ch of String(a.id))hash=(hash*31+ch.charCodeAt(0))>>>0;
    link.className=`article-tag tag-color-${hash%5}`;link.href=`#article=${encodeURIComponent(a.id)}`;link.title=text;
    content.className='tag-content';title.className='tag-title';title.textContent=text;
    date.textContent=a.published_date?String(a.published_date).slice(0,10).replaceAll('-','/'):'日期未提供';if(a.published_date)date.dateTime=a.published_date;
    link.setAttribute('aria-label',`${text}，${date.textContent}`);
    content.append(date,document.createTextNode(' '),title);link.append(content);li.append(link);$('articleTags').append(li);
  }
  function watchMore(){
    if(!observer)return;
    observer.unobserve($('loadSentinel'));
    if(canRead&&state.hasMore&&!state.failed&&!state.loading&&!$('libraryView').hidden)observer.observe($('loadSentinel'));
  }
  const observer='IntersectionObserver' in window?new window.IntersectionObserver(entries=>{
    if(canRead&&entries.some(e=>e.isIntersecting)&&state.hasMore&&!state.loading&&!state.failed&&!$('libraryView').hidden)loadList();
  },{rootMargin:'0px 0px 200px 0px'}):null;
  async function loadList(reset=false){
    if(!canRead||(state.loading&&!reset))return;
    const token=++state.listToken;
    if(reset){state.offset=0;state.hasMore=false;seen.clear();$('articleTags').replaceChildren();$('listCount').textContent='';}
    state.loading=true;state.failed=false;watchMore();$('articleTags').setAttribute('aria-busy','true');
    $('btnLoadMore').hidden=true;$('btnRetry').hidden=true;
    status(state.offset?'':'正在載入文章…');$('listProgress').hidden=!state.offset;$('listProgress').textContent='正在載入更多文章…';
    try{
      if(!api)throw new Error('尚未設定網站連線。請由管理者保留原有 config.js，並確認 P135 資料庫已完成設定。');
      const rows=await api.listLibrary({limit:PAGE_SIZE,offset:state.offset,ascending:state.ascending,query:state.query});
      if(token!==state.listToken)return;
      if(!Array.isArray(rows))throw new Error('文章列表格式不正確，請重新載入。');
      rows.forEach(addTag);state.offset+=rows.length;state.hasMore=rows.length===PAGE_SIZE;
      $('listCount').textContent=`已載入 ${seen.size} 篇`;
      status(state.offset?'':'目前沒有符合條件的收藏文章。');$('btnLoadMore').hidden=!state.hasMore;
      $('listProgress').hidden=!state.offset;$('listProgress').textContent=state.hasMore?'向下捲動，自動載入更多文章。':'已顯示所有符合條件的文章。';
    }catch(e){if(token===state.listToken){state.failed=true;const message=`無法載入文章：${e.message}`;status(state.offset?'':message,true);$('listProgress').textContent=message;$('listProgress').hidden=!state.offset;$('btnRetry').hidden=false;}}
    finally{if(token===state.listToken){state.loading=false;$('articleTags').setAttribute('aria-busy','false');watchMore();}}
  }
  function renderReader(a){
    $('readerTitle').textContent=a.title||'無標題';$('readerDate').textContent=dateText(a.published_date);$('readerDate').dateTime=a.published_date||'';$('readerMedia').textContent=a.source_media||'';
    const url=safeUrl(a.source_url);$('sourceLink').hidden=!url;if(url)$('sourceLink').href=url;else $('sourceLink').removeAttribute('href');
    $('originalText').textContent=a.original_content||'此篇沒有保存新聞全文。';
    $('neutralText').textContent=a.neutral_content||'尚無中性改寫。';$('flippedText').textContent=a.flipped_content||'尚無立場對調分析。';
    $('feelingBlock').hidden=!a.flipped_feeling;$('feelingText').textContent=a.flipped_feeling||'';
    const sentiment=a.sentiment_data&&typeof a.sentiment_data==='object'?a.sentiment_data:{};
    const score=Number(sentiment.bias_rating);$('toneText').textContent=`基調：${safeText(sentiment.overall_tone)||'未標註'}${Number.isFinite(score)&&score>=1&&score<=5?` · 用詞偏向評分 ${score} / 5`:''}`;
    const words=Array.isArray(sentiment.loaded_words)?sentiment.loaded_words:[];
    fillList('loadedWords',words.map(w=>`${safeText(w?.word_or_phrase)}${w?.category?`［${safeText(w.category)}］`:''}：${safeText(w?.explanation)}`),'未標示特殊情緒用詞。');
    fillList('factsList',a.fact_opinion_data?.facts,'未列出可查證陳述。');fillList('opinionsList',a.fact_opinion_data?.opinions,'未列出觀點或評論。');
  }
  async function openArticle(id){
    if(!canRead)return;
    const token=++state.readerToken;
    if(!$('libraryView').hidden)state.scroll=window.scrollY;
    $('libraryView').hidden=true;$('readerView').hidden=false;$('readerBody').hidden=true;$('readerStatus').hidden=false;$('readerStatus').textContent='正在載入分析…';window.scrollTo(0,0);
    try{
      if(!api)throw new Error('尚未設定網站連線。');
      const [article,neighbors]=await Promise.all([api.libraryDetail(id),api.libraryNeighbors(id,{ascending:state.ascending,query:state.query})]);
      if(token!==state.readerToken)return;
      if(!article)throw new Error('找不到這篇收藏文章，或目前帳號沒有讀取權限。');
      renderReader(article);$('readerStatus').textContent='';$('readerStatus').hidden=true;$('readerBody').hidden=false;
      for(const [which,key] of [['Previous','previous'],['Next','next']]){
        const btn=$(`btn${which}`),neighbor=neighbors?.[key];btn.disabled=!neighbor?.id;$(`${key}Title`).textContent=neighbor?.title||`沒有${key==='previous'?'上':'下'}一篇`;
        btn.onclick=neighbor?.id?()=>{location.hash=`article=${encodeURIComponent(neighbor.id)}`;}:null;
      }
      $('readerTitle').focus({preventScroll:true});
    }catch(e){if(token===state.readerToken){$('readerStatus').textContent=`無法顯示文章：${e.message}`;$('readerStatus').classList.add('error');}}
  }
  function route(){if(!canRead)return;const match=location.hash.match(/^#article=([0-9a-f-]{36})$/i);if(match){$('readerStatus').classList.remove('error');openArticle(match[1]);}else{state.readerToken++;$('readerView').hidden=true;$('libraryView').hidden=false;requestAnimationFrame(()=>{window.scrollTo(0,state.scroll);watchMore();});}}
  $('filterForm').addEventListener('submit',e=>{e.preventDefault();state.query=$('searchInput').value.trim();state.scroll=0;loadList(true);});
  $('sortOrder').addEventListener('change',()=>{state.ascending=$('sortOrder').value==='asc';state.scroll=0;loadList(true);});
  $('btnLoadMore').addEventListener('click',()=>loadList());$('btnRetry').addEventListener('click',()=>loadList(state.offset===0));
  $('btnBack').addEventListener('click',()=>{history.replaceState(null,'',location.pathname+location.search);route();});
  $('sectionNav').addEventListener('click',e=>{const section=e.target.closest('button[data-section]')?.dataset.section;if(section)$(section).scrollIntoView({behavior:'smooth',block:'start'});});
  function mask(){const p=$('loginPassword');p.type='password';$('btnTogglePassword').textContent='顯示密碼';$('btnTogglePassword').setAttribute('aria-pressed','false');}
  function lock(message='請輸入帳號與密碼。'){
    canRead=false;currentUserId=null;state.listToken++;state.readerToken++;state.offset=0;state.scroll=0;state.hasMore=false;state.loading=false;state.failed=false;seen.clear();watchMore();
    $('libraryView').hidden=true;$('readerView').hidden=true;$('readerBody').hidden=true;$('accessGate').hidden=false;$('editorEntry').hidden=true;
    $('articleTags').replaceChildren();$('articleTags').setAttribute('aria-busy','false');
    for(const id of ['readerTitle','readerDate','readerMedia','originalText','neutralText','flippedText','feelingText','toneText','loadedWords','factsList','opinionsList','listCount','readerStatus','listProgress','accountLabel'])$(id).textContent='';
    for(const id of ['btnPrevious','btnNext']){$(id).onclick=null;$(id).disabled=true;}
    $('sourceLink').removeAttribute('href');$('sourceLink').hidden=true;$('accessStatus').textContent=message;$('loginPassword').value='';mask();
  }
  async function applyUser(user){
    if(user?.id===currentUserId&&canRead)return;
    const epoch=++authEpoch;lock(user?'正在確認私人知識庫使用資格…':'請輸入帳號與密碼。');$('btnSignOut').hidden=!user;
    if(!user)return;
    try{
      const allowed=await api.libraryAccess();if(epoch!==authEpoch)return;
      if(!allowed){$('accessStatus').textContent='此帳號沒有 P135 私人知識庫使用權限。';return;}
      currentUserId=user.id;canRead=true;$('accessGate').hidden=true;$('editorEntry').hidden=false;$('accountLabel').textContent='私人知識庫';
      loadList(true);route();
    }catch(e){if(epoch===authEpoch)$('accessStatus').textContent=`無法確認私人知識庫權限：${e.message}。請確認已執行 V0.06 的 30_P135_PrivateLibrary.sql。`;}
  }
  $('btnTogglePassword').addEventListener('click',()=>{const show=$('loginPassword').type==='password';$('loginPassword').type=show?'text':'password';$('btnTogglePassword').textContent=show?'隱藏密碼':'顯示密碼';$('btnTogglePassword').setAttribute('aria-pressed',String(show));});
  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();const btn=$('btnSubmitLogin');if(btn.disabled)return;btn.disabled=true;$('loginError').textContent='';
    try{if(!api)throw new Error('尚未設定網站連線。');const {data,error}=await api.signIn($('loginEmail').value.trim(),$('loginPassword').value);if(error)throw error;if(!data?.user)throw new Error('登入未完成。');await applyUser(data.user);}
    catch(e){$('loginError').textContent=e.message||'登入失敗。';}finally{$('loginPassword').value='';mask();btn.disabled=false;}
  });
  $('btnSignOut').addEventListener('click',async()=>{
    authEpoch++;lock('已登出。');$('btnSignOut').hidden=true;$('loginError').textContent='';
    try{const {error}=await api.signOut();if(error)throw error;}catch(e){$('accessStatus').textContent=`畫面已鎖定，登出未完成：${e.message}`;}
  });
  try{const base=new URL(window.APP_CONFIG?.ACCOUNT_CENTER_URL||'https://bagilu.github.io/P130/');if(base.protocol==='https:'){if(!base.pathname.endsWith('/'))base.pathname+='/';$('linkForgotPassword').href=new URL('forgot-password.html',base).href;}}catch{}
  window.addEventListener('hashchange',route);
  // Clear private DOM before BFCache captures it; restored pages revalidate the user and role.
  window.addEventListener('pagehide',()=>{authEpoch++;lock();});
  window.addEventListener('pageshow',e=>{if(e.persisted&&api)api.getUser().then(applyUser).catch(()=>lock('登入狀態已失效，請重新登入。'));});
  if(!api){lock('找不到連線設定，請保留原有 config.js。');return;}
  api.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){authEpoch++;lock('已登出，請重新登入。');$('btnSignOut').hidden=true;}else if(event==='SIGNED_IN'&&session?.user){const epoch=authEpoch;setTimeout(()=>{if(epoch===authEpoch)applyUser(session.user);},0);}});
  api.getUser().then(applyUser).catch(()=>lock('無法確認登入狀態，請重新登入。'));
});
