document.addEventListener('DOMContentLoaded',()=>{
  'use strict';
  const $=id=>document.getElementById(id),api=window.P135_API;
  let canEdit=false,authEpoch=0,currentId=null,analysis=null,previouslyPublished=false,dirty=false,revision=0,documentToken=0,changeCounter=0,historyRows=[],historyOffset=0,historyMore=false,historyBusy=false,media='ALL';
  $('appVersionTag').textContent='V0.05';
  const text=(id,value)=>{$(id).textContent=typeof value==='string'?value:'';};
  const list=(id,rows,empty)=>{const el=$(id);el.replaceChildren();for(const row of Array.isArray(rows)&&rows.length?rows:[empty]){const li=document.createElement('li');li.textContent=typeof row==='string'?row:'';el.append(li);}};
  function assertEditor(){if(!canEdit)throw new Error('請使用已授權的編輯帳號登入。');}
  function clearAnalysis(){analysis=null;text('neutralContentBox','尚未解讀。');text('flippedContentBox','尚未解讀。');text('sentimentAnalysisBox','尚未解讀。');$('factsList').replaceChildren();$('opinionsList').replaceChildren();}
  function reset(){documentToken++;currentId=null;previouslyPublished=false;revision++;for(const id of ['newsTitle','newsMedia','newsDate','newsUrl','autoNewsUrl','newsContent','personalNotes','entityName','eventTitle'])$(id).value='';$('publishArticle').checked=false;clearAnalysis();dirty=false;text('saveStatus','');saveLabel();}
  function saveLabel(){$('btnSaveAll').textContent=$('publishArticle').checked?'💾 (4) 儲存並公開':'💾 (4) 儲存草稿';}
  function renderAnalysis(a){
    analysis=a;text('neutralContentBox',a.neutral_rewriting||'無資料');
    text('flippedContentBox',`${a.flipped_perspective?.summary||'無資料'}${a.flipped_perspective?.reading_feeling?`\n\n閱讀感受分析：\n${a.flipped_perspective.reading_feeling}`:''}`);
    const s=a.sentiment_analysis||{};text('sentimentAnalysisBox',`基調：${s.overall_tone||'未標註'} · 用詞偏向評分：${s.bias_rating??'-'} / 5\n\n${(Array.isArray(s.loaded_words)?s.loaded_words:[]).map(w=>`${w.word_or_phrase||''}［${w.category||''}］：${w.explanation||''}`).join('\n\n')}`);
    $('flippedContentBox').style.whiteSpace='pre-wrap';$('neutralContentBox').style.whiteSpace='pre-wrap';$('sentimentAnalysisBox').style.whiteSpace='pre-wrap';
    list('factsList',a.fact_vs_opinion?.facts,'未列出可查證陳述（此分類不代表完成查證）。');list('opinionsList',a.fact_vs_opinion?.opinions,'未列出主觀觀點。');
  }
  async function busy(id,label,fn){
    const btn=$(id);if(btn.disabled)return;const original=btn.textContent,epoch=authEpoch;
    try{assertEditor();btn.disabled=true;btn.textContent=label;await fn(()=>{assertEditor();if(epoch!==authEpoch)throw new Error('登入狀態已變更，已停止回填。');});}
    catch(e){alert(e.message||'操作失敗。');}
    finally{btn.disabled=false;if(id==='btnSaveAll')saveLabel();else btn.textContent=original;}
  }
  function drawer(open){$('historyDrawer').classList.toggle('open',open);$('drawerOverlay').classList.toggle('open',open);}
  async function applyUser(user){
    const epoch=++authEpoch;canEdit=false;$('accessMessage').hidden=false;$('editorWorkspace').hidden=true;reset();historyRows=[];$('historyList').replaceChildren();drawer(false);
    $('authBtn').textContent=user?'登出':'登入';text('userStatusText',user?`已登入：${user.email||''}`:'未登入');
    if(!user){text('accessMessage','編輯工作台僅供授權帳號使用，請按右上角「登入」。一般讀者請返回公開文章庫。');return;}
    text('accessMessage','正在確認 P135 編輯資格…');
    try{const allowed=await api.editorStatus();if(epoch!==authEpoch)return;if(!allowed){text('accessMessage','此帳號沒有 P135 編輯權限。若您是擁有者，請依部署說明完成唯一編輯帳號設定。');return;}canEdit=true;$('accessMessage').hidden=true;$('editorWorkspace').hidden=false;}
    catch(e){if(epoch===authEpoch)text('accessMessage',`無法確認編輯資格：${e.message}\n請確認 P135 資料庫與編輯者設定已完成。`);}
  }
  const dialog=$('loginDialog'),password=$('loginPassword'),toggle=$('btnTogglePassword');
  function mask(){password.type='password';toggle.textContent='顯示密碼';toggle.setAttribute('aria-pressed','false');}
  toggle.addEventListener('click',()=>{const show=password.type==='password';password.type=show?'text':'password';toggle.textContent=show?'隱藏密碼':'顯示密碼';toggle.setAttribute('aria-pressed',String(show));});
  dialog.addEventListener('close',()=>{password.value='';mask();});$('btnCloseLogin').addEventListener('click',()=>dialog.close());
  $('authBtn').addEventListener('click',async()=>{
    if(!api){text('accessMessage','未找到設定，請保留原有 config.js。');return;}
    if($('authBtn').textContent==='登出'){if(dirty&&!confirm('有尚未儲存的內容，確定登出？'))return;const {error}=await api.signOut();if(error){alert(error.message);return;}$('accessMessage').hidden=false;await applyUser(null);return;}
    mask();text('loginError','');dialog.showModal();
  });
  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();const btn=$('btnSubmitLogin');if(btn.disabled||!$('loginForm').reportValidity())return;btn.disabled=true;btn.textContent='登入中…';text('loginError','');
    try{const {data,error}=await api.signIn($('loginEmail').value.trim(),password.value);if(error)throw error;if(!data?.user)throw new Error('登入未完成。');dialog.close();$('accessMessage').hidden=false;await applyUser(data.user);}
    catch(err){text('loginError',err.message||'登入失敗。');}finally{password.value='';mask();btn.disabled=false;btn.textContent='登入';}
  });
  try{const base=new URL(window.APP_CONFIG?.ACCOUNT_CENTER_URL||'https://bagilu.github.io/P130/');if(base.protocol!=='https:')throw new Error();if(!base.pathname.endsWith('/'))base.pathname+='/';$('linkRegister').href=base.href;$('linkAccountCenter').href=base.href;$('linkForgotPassword').href=new URL('forgot-password.html',base).href;}catch{/* HTML 中保留已確認的 P130 預設連結。 */}
  document.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b===btn));document.querySelectorAll('.tab-content').forEach(p=>p.classList.toggle('active',p.id===btn.dataset.tab));}));
  document.querySelectorAll('#editorWorkspace input,#editorWorkspace textarea,#editorWorkspace select').forEach(el=>el.addEventListener('input',()=>{changeCounter++;dirty=true;text('saveStatus','有尚未儲存的變更。');}));
  for(const id of ['newsContent','newsTitle'])$(id).addEventListener('input',()=>{revision++;clearAnalysis();$('publishArticle').checked=false;saveLabel();});
  $('publishArticle').addEventListener('change',saveLabel);
  $('btnNewArticle').addEventListener('click',()=>{if(!canEdit)return;if(!dirty||confirm('清空目前內容，開啟新文章？未儲存內容將捨棄。'))reset();});
  $('btnFetchUrl').addEventListener('click',()=>busy('btnFetchUrl','抓取中…',async valid=>{
    const url=$('autoNewsUrl').value.trim();if(!url)throw new Error('請先輸入新聞網址。');if(dirty&&($('newsTitle').value||$('newsContent').value||$('personalNotes').value)&&!confirm('抓取新文章將清空目前未儲存內容，是否繼續？'))return;
    const changed=changeCounter,token=documentToken;const data=await api.scrapeNewsUrl(url);valid();if(changed!==changeCounter||token!==documentToken)throw new Error('抓取期間內容已變動，未覆蓋目前文章。');reset();$('autoNewsUrl').value=url;$('newsUrl').value=url;$('newsTitle').value=data.title||'';$('newsMedia').value=data.media||'';$('newsDate').value=data.date||'';$('newsContent').value=data.content||'';dirty=true;text('saveStatus','已抓取。請確認報導日期及內容，再進行分析。');
  }));
  $('btnStartAnalyze').addEventListener('click',()=>busy('btnStartAnalyze','AI 解讀中…',async valid=>{
    const title=$('newsTitle').value.trim(),content=$('newsContent').value.trim(),version=revision;if(!title||!content)throw new Error('請先填寫標題與新聞內文。');
    const result=await api.analyzeNews({title,content});valid();if(version!==revision)throw new Error('文章內容已變動，請重新分析。');renderAnalysis(result);dirty=true;text('saveStatus','分析完成，尚未儲存。');
  }));
  $('btnSaveAll').addEventListener('click',()=>busy('btnSaveAll','儲存中…',async valid=>{
    if(!$('newsTitle').value.trim()||!$('newsContent').value.trim())throw new Error('標題與內文不得為空。');
    const publish=$('publishArticle').checked;if(publish&&!analysis)throw new Error('公開前請先完成 AI 分析。');
    if(publish&&!previouslyPublished&&!confirm('確認公開標題、來源連結與分析？原新聞全文、私人筆記與事蹟不會公開。'))return;
    const savedToken=documentToken,savedChanges=changeCounter;
    const id=await api.saveArticle({id:currentId,title:$('newsTitle').value.trim(),source_media:$('newsMedia').value.trim(),source_url:$('newsUrl').value.trim()||null,published_date:$('newsDate').value||null,original_content:$('newsContent').value,neutral_content:analysis?.neutral_rewriting||null,flipped_content:analysis?.flipped_perspective?.summary||null,flipped_feeling:analysis?.flipped_perspective?.reading_feeling||null,sentiment_data:analysis?.sentiment_analysis||{},fact_opinion_data:analysis?.fact_vs_opinion||{},personal_notes:$('personalNotes').value,is_published:publish});
    valid();if(savedToken!==documentToken)return;currentId=id;previouslyPublished=publish;dirty=savedChanges!==changeCounter;text('saveStatus',dirty?'送出時的內容已儲存，目前仍有新的未儲存變更。':publish?'已儲存並公開，讀者可在文章庫閱讀。':'已儲存草稿，目前不對外公開。');
  }));
  $('btnAddEvent').addEventListener('click',()=>busy('btnAddEvent','儲存中…',async valid=>{
    if(!currentId)throw new Error('請先儲存文章，再將事蹟連結到這篇文章。');if(!$('entityName').value.trim()||!$('eventTitle').value.trim())throw new Error('請填寫人物／組織名稱與事蹟簡述。');
    await api.addEntityEvent({name:$('entityName').value.trim(),type:$('entityType').value,date:$('newsDate').value||null,eventType:$('eventType').value,title:$('eventTitle').value.trim(),description:$('eventTitle').value.trim(),articleId:currentId});valid();$('eventTitle').value='';alert('已存入私人事蹟庫，不會公開。');
  }));
  function renderHistory(){
    const keyword=$('historySearchInput').value.trim().toLowerCase(),rows=historyRows.filter(a=>(media==='ALL'||(a.source_media||'').includes(media))&&(!keyword||`${a.title||''} ${a.source_media||''}`.toLowerCase().includes(keyword)));
    $('historyList').replaceChildren();$('historyCountTag').textContent=String(rows.length);
    if(!rows.length){const li=document.createElement('li');li.textContent='沒有符合條件的已載入文章。';$('historyList').append(li);}
    for(const a of rows){const li=document.createElement('li'),btn=document.createElement('button'),title=document.createElement('div'),meta=document.createElement('div');btn.className='history-item';btn.type='button';title.className='history-item-title';title.textContent=a.title;meta.className='history-item-meta';meta.textContent=`${a.is_published?'已公開':'草稿'} · ${a.source_media||'未標示媒體'} · ${a.published_date||'日期未提供'}`;btn.append(title,meta);btn.addEventListener('click',()=>loadArticle(a.id));li.append(btn);$('historyList').append(li);}
    $('historyLoadMore').hidden=!historyMore;
  }
  async function loadHistory(resetList){
    if(historyBusy)return;historyBusy=true;const epoch=authEpoch;
    try{assertEditor();if(resetList){historyRows=[];historyOffset=0;}$('historyLoadMore').disabled=true;const rows=await api.getArticles(100,historyOffset);if(!canEdit||epoch!==authEpoch)return;historyRows.push(...rows);historyOffset+=rows.length;historyMore=rows.length===100;renderHistory();}
    catch(e){text('historyList',`載入失敗：${e.message}`);}finally{historyBusy=false;$('historyLoadMore').disabled=false;}
  }
  async function loadArticle(id){
    if(dirty&&!confirm('載入其他文章將捨棄尚未儲存的變更，是否繼續？'))return;const epoch=authEpoch;
    try{assertEditor();const a=await api.getArticleDetail(id);if(!canEdit||epoch!==authEpoch)return;reset();currentId=a.id;previouslyPublished=a.is_published;$('newsTitle').value=a.title||'';$('newsMedia').value=a.source_media||'';$('newsDate').value=a.published_date||'';$('newsUrl').value=a.source_url||'';$('autoNewsUrl').value=a.source_url||'';$('newsContent').value=a.original_content||'';$('personalNotes').value=a.personal_notes||'';$('publishArticle').checked=a.is_published;renderAnalysis({neutral_rewriting:a.neutral_content,flipped_perspective:{summary:a.flipped_content,reading_feeling:a.flipped_feeling},sentiment_analysis:a.sentiment_data||{},fact_vs_opinion:a.fact_opinion_data||{}});saveLabel();dirty=false;text('saveStatus',a.is_published?'目前已公開。':'目前為私人草稿。');drawer(false);}
    catch(e){alert(`無法載入：${e.message}`);}
  }
  $('btnOpenHistory').addEventListener('click',()=>{if(!canEdit){alert('請先以編輯帳號登入。');return;}drawer(true);loadHistory(true);});$('btnCloseDrawer').addEventListener('click',()=>drawer(false));$('drawerOverlay').addEventListener('click',()=>drawer(false));$('historyLoadMore').addEventListener('click',()=>loadHistory(false));$('historySearchInput').addEventListener('input',renderHistory);
  document.querySelectorAll('.filter-chip').forEach(chip=>chip.addEventListener('click',()=>{media=chip.dataset.media;document.querySelectorAll('.filter-chip').forEach(c=>c.classList.toggle('active',c===chip));renderHistory();}));
  window.addEventListener('beforeunload',e=>{if(dirty&&canEdit){e.preventDefault();e.returnValue='';}});
  if(!api){text('accessMessage','找不到連線設定。更新時請保留原有 config.js；新環境請依 README 建立。');return;}
  api.getUser().then(applyUser).catch(e=>text('accessMessage',`無法取得登入狀態：${e.message}`));
  api.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){canEdit=false;$('accessMessage').hidden=false;applyUser(null);}else if(event==='SIGNED_IN'&&session?.user){setTimeout(()=>{if(!canEdit){$('accessMessage').hidden=false;applyUser(session.user);}},0);}});
});
