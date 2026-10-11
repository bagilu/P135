// RPC: 取得文章列表
    async getArticles(limit = 30, offset = 0) {
      const { data, error } = await supabase.rpc("P135_GetArticles", {
        p_limit: limit,
        p_offset: offset
      });
      if (error) throw error;
      return data;
    },

    // RPC: 取得單篇完整文章與解讀
    async getArticleDetail(articleId) {
      const { data, error } = await supabase.rpc("P135_GetArticleDetail", {
        p_article_id: articleId
      });
      if (error) throw error;
      return data;
    },
