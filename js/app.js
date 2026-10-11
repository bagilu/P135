document.addEventListener("DOMContentLoaded", async () => {
  let currentAnalysis = null;
  let currentArticleId = null;

  // 1. 檢查使用者登入狀態
  const user = await window.P135_API.getUser();
  const statusEl = document.getElementById("userStatusText");
  const authBtn = document.getElementById("authBtn");

  if (user) {
    statusEl.textContent = `已認證：${user.email}`;
    authBtn.textContent = "已登入";
  } else {
    statusEl.textContent = "未登入";
    authBtn.onclick = async () => {
      const email = prompt("請輸入 Email：");
      const password = prompt("請輸入密碼：");
      if (email && password) {
        const { error } = await window.P135_API.signIn(email, password);
        if (error) {
          await window.P135_API.signUp(email, password);
          alert("已發送驗證信或完成註冊，請重新登入！");
        } else {
          location.reload();
        }
      }
    };
  }

  // 2. 標籤頁切換
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  // 3. 渲染解讀結果到畫面上 (抽成共用函式)
  function renderAnalysisUI(analysis) {
    if (!analysis) return;
    currentAnalysis = analysis;

    // 中性版
    document.getElementById("neutralContentBox").innerHTML = 
      `<p>${analysis.neutral_rewriting || "無資料"}</p>`;
    
    // 立場對調版
    document.getElementById("flippedContentBox").innerHTML = 
      `<h4>改寫結果：</h4><p>${analysis.flipped_perspective?.summary || "無資料"}</p>
       <h4>心理感受分析：</h4><p>${analysis.flipped_perspective?.reading_feeling || "無"}</p>`;

    // 情緒詞句
    const words = analysis.sentiment_analysis?.loaded_words || [];
    const wordsHtml = words.map(w => `<li><strong>${w.word_or_phrase}</strong> [${w.category}]: ${w.explanation}</li>`).join("");
    document.getElementById("sentimentAnalysisBox").innerHTML = 
      `<h4>基調：${analysis.sentiment_analysis?.overall_tone || "未標註"} (煽動指數: ${analysis.sentiment_analysis?.bias_rating || "-"}/5)</h4>
       <ul>${wordsHtml || "<li>無特殊情緒字眼</li>"}</ul>`;

    // 事實與觀點清單
    const facts = analysis.fact_vs_opinion?.facts || [];
    const opinions = analysis.fact_vs_opinion?.opinions || [];
    document.getElementById("factsList").innerHTML = facts.length ? facts.map(f => `<li>${f}</li>`).join("") : "<li>無明確事實紀錄</li>";
    document.getElementById("opinionsList").innerHTML = opinions.length ? opinions.map(o => `<li>${o}</li>`).join("") : "<li>無顯著主觀觀點</li>";
  }

  // 4. AI 多維解讀按鈕
  document.getElementById("btnStartAnalyze").addEventListener("click", async () => {
    const title = document.getElementById("newsTitle").value;
    const content = document.getElementById("newsContent").value;

    if (!content) {
      alert("請先貼入新聞內文！");
      return;
    }

    const analyzeBtn = document.getElementById("btnStartAnalyze");
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "AI 透視解讀中...";

    try {
      const result = await window.P135_API.analyzeNews({ title, content });
      renderAnalysisUI(result);
      alert("解讀完成！");
    } catch (err) {
      alert("解讀失敗：" + err.message);
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = "⚡ 開始 AI 多維解讀";
    }
  });

  // 5. 存入事蹟懶人包
  document.getElementById("btnAddEvent").addEventListener("click", async () => {
    const name = document.getElementById("entityName").value;
    const title = document.getElementById("eventTitle").value;
    const type = document.getElementById("entityType").value;
    const eventType = document.getElementById("eventType").value;

    if (!name || !title) {
      alert("請填寫實體名稱與事蹟簡述！");
      return;
    }

    try {
      await window.P135_API.addEntityEvent({
        name,
        type,
        date: document.getElementById("newsDate").value || new Date().toISOString().split("T")[0],
        eventType,
        title,
        description: title,
        articleId: currentArticleId
      });
      alert(`已將事蹟存入【${name}】的履歷庫！`);
      document.getElementById("eventTitle").value = "";
    } catch (err) {
      alert("儲存失敗：" + err.message);
    }
  });

  // 6. 儲存整篇新聞與解讀
  document.getElementById("btnSaveAll").addEventListener("click", async () => {
    const title = document.getElementById("newsTitle").value;
    const originalContent = document.getElementById("newsContent").value;

    if (!title || !originalContent) {
      alert("標題與內文不得為空！");
      return;
    }

    try {
      const id = await window.P135_API.upsertArticle({
        id: currentArticleId,
        title,
        sourceMedia: document.getElementById("newsMedia").value,
        sourceUrl: document.getElementById("newsUrl").value,
        publishedDate: document.getElementById("newsDate").value || new Date().toISOString().split("T")[0],
        originalContent,
        neutralContent: currentAnalysis?.neutral_rewriting,
        flippedContent: currentAnalysis?.flipped_perspective?.summary,
        sentimentData: currentAnalysis?.sentiment_analysis || {},
        factOpinionData: currentAnalysis?.fact_vs_opinion || {},
        personalNotes: document.getElementById("personalNotes").value
      });
      currentArticleId = id;
      alert("完整解讀已存入資料庫！");
    } catch (err) {
      alert("存檔失敗：" + err.message);
    }
  });

  // 7. 歷史文章庫抽屜控制與點選載入
  const drawer = document.getElementById("historyDrawer");
  const overlay = document.getElementById("drawerOverlay");

  function toggleDrawer(open) {
    if (open) {
      drawer.classList.add("open");
      overlay.classList.add("open");
      loadHistoryList();
    } else {
      drawer.classList.remove("open");
      overlay.classList.remove("open");
    }
  }

  document.getElementById("btnOpenHistory").addEventListener("click", () => toggleDrawer(true));
  document.getElementById("btnCloseDrawer").addEventListener("click", () => toggleDrawer(false));
  overlay.addEventListener("click", () => toggleDrawer(false));

  // 開新文章按鈕
  document.getElementById("btnNewArticle").addEventListener("click", () => {
    if (confirm("是否清空目前內容，開啟一篇全新新聞解讀？")) {
      currentArticleId = null;
      currentAnalysis = null;
      document.getElementById("newsTitle").value = "";
      document.getElementById("newsMedia").value = "";
      document.getElementById("newsDate").value = "";
      document.getElementById("newsUrl").value = "";
      document.getElementById("newsContent").value = "";
      document.getElementById("personalNotes").value = "";
      document.getElementById("neutralContentBox").innerHTML = '<p class="placeholder-text">點擊「開始解讀」後產生客觀中性版本...</p>';
      document.getElementById("flippedContentBox").innerHTML = '<p class="placeholder-text">立場對調版本將在此呈現...</p>';
      document.getElementById("sentimentAnalysisBox").innerHTML = '<p class="placeholder-text">煽動指數與情緒修飾字眼分析...</p>';
      document.getElementById("factsList").innerHTML = '';
      document.getElementById("opinionsList").innerHTML = '';
    }
  });

  // 載入歷史文章清單
  async function loadHistoryList() {
    const listEl = document.getElementById("historyList");
    listEl.innerHTML = '<li class="loading-text">載入歷史紀錄中...</li>';

    try {
      const articles = await window.P135_API.getArticles(50, 0);
      if (!articles || articles.length === 0) {
        listEl.innerHTML = '<li class="placeholder-text" style="padding:12px;">尚無任何存檔文章</li>';
        return;
      }

      listEl.innerHTML = articles.map(art => `
        <li class="history-item" data-id="${art.id}">
          <div class="history-item-title">${art.title || "無標題文章"}</div>
          <div class="history-item-meta">
            <span>${art.source_media || "未知媒體"}</span>
            <span>${art.published_date || new Date(art.created_at).toLocaleDateString()}</span>
          </div>
        </li>
      `).join("");

      // 綁定點選載入事件
      document.querySelectorAll(".history-item").forEach(item => {
        item.addEventListener("click", async () => {
          const id = item.dataset.id;
          await loadArticleDetail(id);
          toggleDrawer(false);
        });
      });
    } catch (err) {
      listEl.innerHTML = `<li style="color:#ef4444; padding:12px;">載入失敗: ${err.message}</li>`;
    }
  }

  // 點選後載入單篇完整內容回填到工作台
  async function loadArticleDetail(articleId) {
    try {
      const art = await window.P135_API.getArticleDetail(articleId);
      currentArticleId = art.id;

      // 回填左欄原文
      document.getElementById("newsTitle").value = art.title || "";
      document.getElementById("newsMedia").value = art.source_media || "";
      document.getElementById("newsDate").value = art.published_date || "";
      document.getElementById("newsUrl").value = art.source_url || "";
      document.getElementById("newsContent").value = art.original_content || "";

      // 回填右欄筆記
      document.getElementById("personalNotes").value = art.personal_notes || "";

      // 回填中欄分析結果
      renderAnalysisUI({
        neutral_rewriting: art.neutral_content,
        flipped_perspective: { summary: art.flipped_content, reading_feeling: "" },
        sentiment_analysis: art.sentiment_data || {},
        fact_vs_opinion: art.fact_opinion_data || { facts: [], opinions: [] }
      });

      alert(`已載入文章：【${art.title}】`);
    } catch (err) {
      alert("載入文章失敗：" + err.message);
    }
  }
});
