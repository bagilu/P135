document.addEventListener('DOMContentLoaded',()=>{
  'use strict';
  const $=id=>document.getElementById(id),api=window.P135_API;
  const state={query:'',ascending:false,offset:0,hasMore:false,loading:false,listToken:0,readerToken:0,scroll:0};
  const dateText=d=>d?String(d).slice(0,10).replaceAll('-',' / '):'日期未提供';
  const safeText=v=>typeof v==='string'?v:'';
  function status(message,error=false){$('libraryStatus').textContent=message;$('libraryStatus').hidden=!message;$('libraryStatus').classList.toggle('error',error);}
  function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
  function fillList(id,items,empty){const el=$(id);el.replaceChildren();for(const item of Array.isArray(items)&&items.length?items:[empty]){const li=document.createElement('li');li.textContent=safeText(item);el.append(li);}}
  function addTag(a){
    const li=document.createElement('li'),link=document.createElement('a'),title=document.createElement('span'),date=document.createElement('time');
    li.style.setProperty('--tag-width',`${Math.max(188,Math.min(450,Array.from(a.title||'').length*15+42))}px`);
    link.className='article-tag';link.href=`#article=${encodeURIComponent(a.id)}`;link.title=a.title||'無標題';
    title.className='tag-title';title.textContent=a.title||'無標題';date.textContent=dateText(a.published_date);if(a.published_date)date.dateTime=a.published_date;
    link.append(title,date);li.append(link);$('articleTags').append(li);
  }
  async function loadList(reset=false){
    if(state.loading&&!reset)return;
    const token=++state.listToken;
    if(reset){state.offset=0;$('articleTags').replaceChildren();}
    state.loading=true;$('btnLoadMore').hidden=true;$('btnRetry').hidden=true;status('正在載入文章…');
    try{
      if(!api)throw new Error('尚未設定網站連線。請由管理者保留原有 config.js，並確認 V0.04 資料庫已部署。');
      const rows=await api.listPublic({offset:state.offset,ascending:state.ascending,query:state.query});
      if(token!==state.listToken)return;
      const list=Array.isArray(rows)?rows:[];list.forEach(addTag);state.offset+=list.length;state.hasMore=list.length===40;
      $('listCount').textContent=`已載入 ${state.offset} 篇`;
      status(state.offset?'':'目前沒有符合條件的公開文章。');$('btnLoadMore').hidden=!state.hasMore;
    }catch(e){if(token===state.listToken){status(`無法載入文章：${e.message}`,true);$('btnRetry').hidden=false;}}
    finally{if(token===state.listToken)state.loading=false;}
  }
  function renderReader(a){
    $('readerTitle').textContent=a.title||'無標題';$('readerDate').textContent=dateText(a.published_date);$('readerDate').dateTime=a.published_date||'';$('readerMedia').textContent=a.source_media||'';
    const url=safeUrl(a.source_url);$('sourceLink').hidden=!url;if(url)$('sourceLink').href=url;else $('sourceLink').removeAttribute('href');
    $('neutralText').textContent=a.neutral_content||'尚無中性改寫。';$('flippedText').textContent=a.flipped_content||'尚無立場對調分析。';
    $('feelingBlock').hidden=!a.flipped_feeling;$('feelingText').textContent=a.flipped_feeling||'';
    const sentiment=a.sentiment_data&&typeof a.sentiment_data==='object'?a.sentiment_data:{};
    const score=Number(sentiment.bias_rating);$('toneText').textContent=`基調：${safeText(sentiment.overall_tone)||'未標註'}${Number.isFinite(score)&&score>=1&&score<=5?` · 用詞偏向評分 ${score} / 5`:''}`;
    const words=Array.isArray(sentiment.loaded_words)?sentiment.loaded_words:[];
    fillList('loadedWords',words.map(w=>`${safeText(w?.word_or_phrase)}${w?.category?`［${safeText(w.category)}］`:''}：${safeText(w?.explanation)}`),'未標示特殊情緒用詞。');
    fillList('factsList',a.fact_opinion_data?.facts,'未列出可查證陳述。');fillList('opinionsList',a.fact_opinion_data?.opinions,'未列出觀點或評論。');
  }
  async function openArticle(id){
    const token=++state.readerToken;
    if(!$('libraryView').hidden)state.scroll=window.scrollY;
    $('libraryView').hidden=true;$('readerView').hidden=false;$('readerBody').hidden=true;$('readerStatus').hidden=false;$('readerStatus').textContent='正在載入分析…';window.scrollTo(0,0);
    try{
      if(!api)throw new Error('尚未設定網站連線。');
      const [article,neighbors]=await Promise.all([api.publicDetail(id),api.publicNeighbors(id,{ascending:state.ascending,query:state.query})]);
      if(token!==state.readerToken)return;
      if(!article)throw new Error('這篇文章尚未公開或已取消公開。');
      renderReader(article);$('readerStatus').textContent='';$('readerStatus').hidden=true;$('readerBody').hidden=false;
      for(const [which,key] of [['Previous','previous'],['Next','next']]){
        const btn=$(`btn${which}`),neighbor=neighbors?.[key];btn.disabled=!neighbor?.id;$(`${key}Title`).textContent=neighbor?.title||`沒有${key==='previous'?'上':'下'}一篇`;
        btn.onclick=neighbor?.id?()=>{location.hash=`article=${encodeURIComponent(neighbor.id)}`;}:null;
      }
      $('readerTitle').focus({preventScroll:true});
    }catch(e){if(token===state.readerToken){$('readerStatus').textContent=`無法顯示文章：${e.message}`;$('readerStatus').classList.add('error');}}
  }
  function route(){const match=location.hash.match(/^#article=([0-9a-f-]{36})$/i);if(match){$('readerStatus').classList.remove('error');openArticle(match[1]);}else{state.readerToken++;$('readerView').hidden=true;$('libraryView').hidden=false;requestAnimationFrame(()=>window.scrollTo(0,state.scroll));}}
  $('filterForm').addEventListener('submit',e=>{e.preventDefault();state.query=$('searchInput').value.trim();state.scroll=0;loadList(true);});
  $('sortOrder').addEventListener('change',()=>{state.ascending=$('sortOrder').value==='asc';state.scroll=0;loadList(true);});
  $('btnLoadMore').addEventListener('click',()=>loadList());$('btnRetry').addEventListener('click',()=>loadList(true));
  $('btnBack').addEventListener('click',()=>{history.replaceState(null,'',location.pathname+location.search);route();});
  $('sectionNav').addEventListener('click',e=>{const section=e.target.closest('button[data-section]')?.dataset.section;if(section)$(section).scrollIntoView({behavior:'smooth',block:'start'});});
  window.addEventListener('hashchange',route);loadList(true);route();
});
