document.addEventListener("DOMContentLoaded", async () => {
  let currentAnalysis = null;
  let currentArticleId = null;

  const statusEl = document.getElementById("userStatusText");
  const authBtn = document.getElementById("authBtn");

  // 1. 更新登入狀態 UI
  function updateAuthUI(user) {
    if (user) {
      statusEl.textContent = `已認證：${user.email}`;
      authBtn.textContent = "登出";
      authBtn.onclick = async () => {
        if (confirm("確定要登出嗎？")) {
          await window.P135_API.signOut();
          location.reload();
        }
      };
    } else {
      statusEl.textContent = "未登入";
      authBtn.textContent = "登入 / 註冊";
      authBtn.onclick = handleAuthClick;
    }
  }

  // 處理登入/註冊動作
  async function handleAuthClick() {
    const email = prompt("請輸入您的登入 Email：");
    if (!email) return;
    const password = prompt("請輸入密碼：");
    if (!password) return;

    try {
      // 先嘗試登入
      const { data, error } = await window.P135_API.signIn(email, password);
      if (error) {
        // 若帳號不存在或密碼不符，詢問是否要直接註冊
        if (confirm(`登入未成功（${error.message}）。是否以此帳號進行註冊？`)) {
          const signUpRes = await window.P135_API.signUp(email, password);
          if (signUpRes.error) {
            alert("註冊失敗：" + signUpRes.error.message);
          } else {
            alert("註冊成功！若 Supabase 後台有開啟信箱驗證，請至信箱點擊確認信後登入。");
            location.reload();
          }
        }
      } else {
        alert("登入成功！");
        updateAuthUI(data.user);
      }
    } catch (err) {
      alert("操作發生異常：" + err.message);
    }
  }

  // 初始化取得當前使用者
  try {
    const user = await window.P135_API.getUser();
    updateAuthUI(user);
  } catch (e) {
    console.error("無法取得使用者狀態", e);
    updateAuthUI(null);
  }

  // 監聽認證狀態變動
  window.P135_API.onAuthStateChange((_event, session) => {
    updateAuthUI(session?.user || null);
  });

  // 2. 標籤頁切換
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  // 3. 渲染解讀結果
  function renderAnalysisUI(analysis) {
    if (!analysis) return;
    currentAnalysis = analysis;

    document.getElementById("neutralContentBox").innerHTML = 
      `<p>${analysis.neutral_rewriting || "無資料"}</p>`;
    
    document.getElementById("flippedContentBox").innerHTML = 
      `<h4>改寫結果：</h4><p>${analysis.flipped_perspective?.summary || "無資料"}</p>
       <h4>心理感受分析：</h4><p>${analysis.flipped_perspective?.reading_feeling || "無"}</p>`;

    const words = analysis.sentiment_analysis?.loaded_words || [];
    const wordsHtml = words.map(w => `<li><strong>${w.word_or_phrase}</strong> [${w.category}]: ${w.explanation}</li>`).join("");
    document.getElementById("sentimentAnalysisBox").innerHTML = 
      `<h4>基調：${analysis.sentiment_analysis?.overall_tone || "未標註"} (煽動指數: ${analysis.sentiment_analysis?.bias_rating || "-"}/5)</h4>
       <ul>${wordsHtml || "<li>無特殊情緒字眼</li>"}</ul>`;

    const facts = analysis.fact_vs_opinion?.facts || [];
    const opinions = analysis.fact_vs_opinion?.opinions || [];
    document.getElementById("factsList").innerHTML = facts.length ? facts.map(f => `<li>${f}</li>`).join("") : "<li>無明確事實紀錄</li>";
    document.getElementById("opinionsList").innerHTML = opinions.length ? opinions.map(o => `<li>${o}</li>`).join("") : "<li>無顯著主觀觀點</li>";
  }

  // 4. AI 多維解讀
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

  // 7. 歷史文章庫抽屜
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

  async function loadArticleDetail(articleId) {
    try {
      const art = await window.P135_API.getArticleDetail(articleId);
      currentArticleId = art.id;

      document.getElementById("newsTitle").value = art.title || "";
      document.getElementById("newsMedia").value = art.source_media || "";
      document.getElementById("newsDate").value = art.published_date || "";
      document.getElementById("newsUrl").value = art.source_url || "";
      document.getElementById("newsContent").value = art.original_content || "";
      document.getElementById("personalNotes").value = art.personal_notes || "";

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
document.getElementById("btnFetchUrl").addEventListener("click", async () => {
  const url = document.getElementById("autoNewsUrl").value.trim();
  if (!url) {
    alert("請先輸入新聞網址！");
    return;
  }

  const btn = document.getElementById("btnFetchUrl");
  btn.disabled = true;
  btn.textContent = "擷取中...";

  try {
    const data = await window.P135_API.scrapeNewsUrl(url);

    // 自動填入工作台左欄
    document.getElementById("newsTitle").value = data.title || "";
    document.getElementById("newsMedia").value = data.media || "";
    document.getElementById("newsDate").value = data.date || "";
    document.getElementById("newsUrl").value = url;
    document.getElementById("newsContent").value = data.content || "";

    alert(`成功擷取【${data.media}】報導！請檢查內容無誤後，即可點擊開始解讀。`);
  } catch (err) {
    alert("自動擷取失敗：" + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "抓取新聞";
  }
});
