(function(){
  'use strict';
  const config=window.APP_CONFIG;
  if(!config?.SUPABASE_URL||!config?.SUPABASE_ANON_KEY||!window.supabase)return;
  // Do not reuse the former public-site persistent login. Keep this project's session in this tab only.
  try{window.localStorage.removeItem('P135-auth-token');}catch{}
  const client=window.supabase.createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY,{auth:{persistSession:true,storage:window.sessionStorage,storageKey:'P135-private-auth-v006',autoRefreshToken:true}});
  const authChannel='BroadcastChannel' in window?new window.BroadcastChannel('P135-private-auth'):null;
  if(authChannel)authChannel.onmessage=e=>{if(e.data?.type==='SIGN_OUT')client.auth.signOut({scope:'local'});};
  async function rpc(name,args={}){const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
  async function edge(name,payload){
    const {data:{session},error}=await client.auth.getSession();
    if(error)throw error;
    if(!session?.access_token)throw new Error('請先登入編輯帳號。');
    const res=await fetch(`${config.SUPABASE_URL}/functions/v1/${name}`,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.SUPABASE_ANON_KEY,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(payload)});
    const data=await res.json().catch(()=>null);
    if(!res.ok)throw new Error(data?.error||`請求失敗（HTTP ${res.status}）`);
    if(!data)throw new Error('後端未回傳有效 JSON。');
    return data;
  }
  window.P135_API={
    async getUser(){const {data,error}=await client.auth.getUser();if(error&&error.name!=='AuthSessionMissingError')throw error;return data?.user||null;},
    signIn:(email,password)=>client.auth.signInWithPassword({email,password}),
    async signOut(){const result=await client.auth.signOut({scope:'local'});if(!result.error)authChannel?.postMessage({type:'SIGN_OUT'});return result;},
    onAuthStateChange:cb=>client.auth.onAuthStateChange(cb),
    editorStatus:()=>rpc('P135_GetEditorStatus'),
    libraryAccess:()=>rpc('P135_GetLibraryAccess'),
    listLibrary:({limit=100,offset=0,ascending=false,query=''}={})=>rpc('P135_ListLibraryArticles',{p_limit:limit,p_offset:offset,p_ascending:ascending,p_query:query}),
    libraryDetail:id=>rpc('P135_GetArticleDetail',{p_article_id:id}),
    libraryNeighbors:(id,{ascending=false,query=''}={})=>rpc('P135_GetLibraryNeighbors',{p_article_id:id,p_ascending:ascending,p_query:query}),
    getArticles:(limit=100,offset=0)=>rpc('P135_ListEditorArticles',{p_limit:limit,p_offset:offset}),
    getArticleDetail:id=>rpc('P135_GetArticleDetail',{p_article_id:id}),
    saveArticle:article=>rpc('P135_SaveArticle',{p_article:article}),
    addEntityEvent:e=>rpc('P135_AddEntityEvent',{p_entity_name:e.name,p_entity_type:e.type,p_event_date:e.date,p_event_type:e.eventType,p_title:e.title,p_description:e.description,p_article_id:e.articleId||null,p_evidence_quote:e.evidenceQuote||null}),
    scrapeNewsUrl:url=>edge('P135-scrape-news',{url}),
    analyzeNews:article=>edge('P135-analyze-news',article)
  };
})();
