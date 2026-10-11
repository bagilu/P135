(function() {
  if (!window.APP_CONFIG) {
    console.error("找不到 APP_CONFIG，請先確認 config.js 是否載入！");
    return;
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      storageKey: "P135-auth-token",
      autoRefreshToken: true
    }
  });

  window.P135_API = {
    // 取得當前使用者
    async getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },

    // 登入
    async signIn(email, password) {
      return await supabase.auth.signInWithPassword({ email, password });
    },

    // 註冊
    async signUp(email, password) {
      return await supabase.auth.signUp({ email, password });
    },

    // 登出
    async signOut() {
      return await supabase.auth.signOut();
    },

    // 監聽登入狀態改變
    onAuthStateChange(callback) {
      return supabase.auth.onAuthStateChange(callback);
    },

    // 透過 Edge Function 分析新聞
    async analyzeNews(payload) {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      const response = await fetch(`${SUPABASE_URL}/functions/v1/P135-analyze-news`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "AI 分析請求失敗");
      }
      return await response.json();
    },

    // RPC: 儲存文章
    async upsertArticle(articleData) {
      const { data, error } = await supabase.rpc("P135_UpsertArticle", {
        p_article_id: articleData.id || null,
        p_title: articleData.title,
        p_source_media: articleData.sourceMedia,
        p_source_url: articleData.sourceUrl,
        p_published_date: articleData.publishedDate,
        p_original_content: articleData.originalContent,
        p_neutral_content: articleData.neutralContent,
        p_flipped_content: articleData.flippedContent,
        p_sentiment_data: articleData.sentimentData,
        p_fact_opinion_data: articleData.factOpinionData,
        p_personal_notes: articleData.personalNotes,
        p_tags: articleData.tags || []
      });
      if (error) throw error;
      return data;
    },

    // RPC: 取得文章列表
    async getArticles(limit = 50, offset = 0) {
      const { data, error } = await supabase.rpc("P135_GetArticles", {
        p_limit: limit,
        p_offset: offset
      });
      if (error) throw error;
      return data;
    },

    // RPC: 取得單篇完整內容
    async getArticleDetail(articleId) {
      const { data, error } = await supabase.rpc("P135_GetArticleDetail", {
        p_article_id: articleId
      });
      if (error) throw error;
      return data;
    },

    // RPC: 新增事蹟紀錄
    async addEntityEvent(eventData) {
      const { data, error } = await supabase.rpc("P135_AddEntityEvent", {
        p_entity_name: eventData.name,
        p_entity_type: eventData.type,
        p_event_date: eventData.date,
        p_event_type: eventData.eventType,
        p_title: eventData.title,
        p_description: eventData.description,
        p_article_id: eventData.articleId || null,
        p_evidence_quote: eventData.evidenceQuote || null
      });
      if (error) throw error;
      return data;
    }
  };
})();
