(function() {
  if (!window.APP_CONFIG) {
    console.error("找不到 APP_CONFIG，請先確認 config.js 是否載入！");
    return;
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      storageKey: "P135-auth-token"
    }
  });

  window.P135_API = {
    async getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },

    async signIn(email, password) {
      return await supabase.auth.signInWithPassword({ email, password });
    },

    async signUp(email, password) {
      return await supabase.auth.signUp({ email, password });
    },

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
