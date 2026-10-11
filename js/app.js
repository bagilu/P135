document.addEventListener("DOMContentLoaded", async () => {
  let currentAnalysis = null;
  let currentArticleId = null;
  let cachedArticles = []; // 用於歷史抽屜前端過濾的文章列表快取
  let selectedMediaFilter = "ALL";

  // 1. 同步顯示最新版本號於首頁右上角
  const versionEl = document.getElementById("appVersionTag");
  if (versionEl && window.APP_CONFIG?.APP_VERSION) {
    versionEl.textContent = window.APP_CONFIG.APP_VERSION;
  }

  const statusEl = document.getElementById("userStatusText");
  const authBtn = document.getElementById("authBtn");

  if (!window.P135_API) {
    statusEl.textContent = "API 初始化失敗";
    alert("API 初始化失敗，請檢查 config.js 與 supabase-client.js！");
    return;
  }

  // 2. 認證 UI 更新邏輯
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

  async function handleAuthClick() {
    const email = prompt("請輸入您的登入 Email：");
    if (!email) return;
    const password = prompt("請輸入密碼：");
    if (!password) return;

    try {
      const { data, error } = await window.P135_API.signIn(email, password);
      if (error) {
        if (confirm(`登入未成功（${error.message}）。是否以此帳號進行註冊？`)) {
          const signUpRes = await window.P135_API.signUp(email, password);
          if (signUpRes.error) {
            alert("註冊失敗：" + signUpRes.error.message);
          } else {
            alert("註冊成功！若有啟用信箱驗證，請至信箱收取確認信。");
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

  try {
    const user = await window.P135_API.getUser();
    updateAuthUI(user);
  } catch (e) {
    console.error("無法取得使用者狀態", e);
    updateAuthUI(null);
  }

  window.P135_API.onAuthStateChange((_event, session) => {
    updateAuthUI(session?.user || null);
  });

  // 3. 標籤頁切換
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  // 4. 渲染解讀結果到中欄
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

  // 5. 步驟 (1)：開啟新解讀
  document.getElementById("btnNewArticle").addEventListener("click", () => {
    if (confirm("是否清空目前內容，開啟一篇全新新聞解讀？")) {
      currentArticleId = null;
      currentAnalysis = null;
      document.getElementById("newsTitle").value = "";
      document.getElementById("newsMedia").value = "";
      document.getElementById("newsDate").value = "";
      document.getElementById("newsUrl").value = "";
      document.getElementById("autoNewsUrl").value = "";
      document.getElementById("newsContent").value = "";
      document.getElementById("personalNotes").value = "";
      document.getElementById("neutralContentBox").innerHTML = '<p class="placeholder-text">完成步驟 (3) 解讀後，此處產生客觀中性版本...</p>';
      document.getElementById("flippedContentBox").innerHTML = '<p class="placeholder-text">立場對調版本將在此呈現...</p>';
      document.getElementById("sentimentAnalysisBox").innerHTML = '<p class="placeholder-text">煽動指數與情緒修飾字眼分析...</p>';
      document.getElementById("factsList").innerHTML = '';
      document.getElementById("opinionsList").innerHTML = '';
    }
  });

  // 6. 步驟 (2)：貼入網址自動抓取填入
  document.getElementById("btnFetchUrl").addEventListener("click", async () => {
    const url = document.getElementById("autoNewsUrl").value.trim();
    if (!url) {
      alert("請先輸入新聞網址！");
      return;
    }

    const btn = document.getElementById("btnFetchUrl");
    btn.disabled = true;
    btn.textContent = "抓取中...";

    try {
      const data = await window.P135_API.scrapeNewsUrl(url);

      currentArticleId = null; // 抓取新網址時視為全新文章
      document.getElementById("newsTitle").value = data.title || "";
      document.getElementById("newsMedia").value = data.media || "";
      document.getElementById("newsDate").value = data.date || "";
      document.getElementById("newsUrl").value = url;
      document.getElementById("newsContent").value = data.content || "";

      alert(`成功擷取【${data.media}】報導！請檢查內容無誤後，即可點擊步驟 (3) 開始解讀。`);
    } catch (err) {
      alert("自動擷取失敗：" + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "抓取填入";
    }
  });

  // 7. 步驟 (3)：進行 AI 多維解讀
  document.getElementById("btnStartAnalyze").addEventListener("click", async () => {
    currentArticleId = null; // 分析新內容強制視為新存檔，避免覆蓋舊文

    const title = document.getElementById("newsTitle").value;
    const content = document.getElementById("newsContent").value;

    if (!content) {
      alert("請先貼入新聞內文或透過步驟 (2) 自動抓取！");
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
      analyzeBtn.textContent = "⚡ (3) 進行 AI 多維解讀";
    }
  });

  // 8. 存入事蹟懶人包
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

  // 9. 步驟 (4)：儲存本篇完整解讀
  document.getElementById("btnSaveAll").addEventListener("click", async () => {
    const title = document.getElementById("newsTitle").value;
    const originalContent = document.getElementById("newsContent").value;

    if (!title || !originalContent) {
      alert("標題與內文不得為空！");
      return;
    }

    try {
      const isNew = !currentArticleId;
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
      alert(isNew ? "已成功新增並儲存解讀文章！" : "文章已更新完成！");
    } catch (err) {
      alert("存檔失敗：" + err.message);
    }
  });

  // 10. 歷史文章庫抽屜控制、過濾與搜尋邏輯
  const drawer = document.getElementById("historyDrawer");
  const overlay = document.getElementById("drawerOverlay");
  const searchInput = document.getElementById("historySearchInput");
  const countTag = document.getElementById("historyCountTag");

  function toggleDrawer(open) {
    if (open) {
      drawer.classList.add("open");
      overlay.classList.add("open");
      if (searchInput) searchInput.value = "";
      selectedMediaFilter = "ALL";
      updateMediaChipsUI();
      loadHistoryList();
    } else {
      drawer.classList.remove("open");
      overlay.classList.remove("open");
    }
  }

  document.getElementById("btnOpenHistory").addEventListener("click", () => toggleDrawer(true));
  document.getElementById("btnCloseDrawer").addEventListener("click", () => toggleDrawer(false));
  overlay.addEventListener("click", () => toggleDrawer(false));

  // 媒體 Filter Chips 點選切換
  document.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      selectedMediaFilter = chip.dataset.media;
      updateMediaChipsUI();
      renderFilteredHistory();
    });
  });

  function updateMediaChipsUI() {
    document.querySelectorAll(".filter-chip").forEach(chip => {
      if (chip.dataset.media === selectedMediaFilter) {
        chip.classList.add("active");
      } else {
        chip.classList.remove("active");
      }
    });
  }

  // 關鍵字搜尋即時觸發
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderFilteredHistory();
    });
  }

  // 從 Supabase 取得文章並存入前端快取
  async function loadHistoryList() {
    const listEl = document.getElementById("historyList");
    listEl.innerHTML = '<li class="loading-text">載入歷史紀錄中...</li>';

    try {
      // 一次最多載入 100 筆
      const articles = await window.P135_API.getArticles(100, 0);
      cachedArticles = articles || [];
      renderFilteredHistory();
    } catch (err) {
      listEl.innerHTML = `<li style="color:#ef4444; padding:12px;">載入失敗: ${err.message}</li>`;
      if (countTag) countTag.textContent = "0";
    }
  }

  // 依搜尋字詞與媒體標籤進行前端即時篩選與渲染
  function renderFilteredHistory() {
    const listEl = document.getElementById("historyList");
    const keyword = (searchInput ? searchInput.value : "").trim().toLowerCase();

    const filtered = cachedArticles.filter(art => {
      const matchMedia = (selectedMediaFilter === "ALL") || 
        (art.source_media && art.source_media.includes(selectedMediaFilter));
      
      const titleMatch = (art.title || "").toLowerCase().includes(keyword);
      const mediaMatch = (art.source_media || "").toLowerCase().includes(keyword);
      const matchKeyword = !keyword || titleMatch || mediaMatch;

      return matchMedia && matchKeyword;
    });

    if (countTag) countTag.textContent = filtered.length;

    if (filtered.length === 0) {
      listEl.innerHTML = '<li class="placeholder-text" style="padding:16px; text-align:center;">無符合條件的歷史文章</li>';
      return;
    }

    listEl.innerHTML = filtered.map(art => `
      <li class="history-item" data-id="${art.id}">
        <div class="history-item-title">${art.title || "無標題文章"}</div>
        <div class="history-item-meta">
          <span class="media-tag-small">${art.source_media || "未知媒體"}</span>
          <span>${art.published_date || new Date(art.created_at).toLocaleDateString()}</span>
        </div>
      </li>
    `).join("");

    // 綁定點選載入事件
    listEl.querySelectorAll(".history-item").forEach(item => {
      item.addEventListener("click", async () => {
        const id = item.dataset.id;
        await loadArticleDetail(id);
        toggleDrawer(false);
      });
    });
  }

  // 載入單篇完整內容回填
  async function loadArticleDetail(articleId) {
    try {
      const art = await window.P135_API.getArticleDetail(articleId);
      currentArticleId = art.id;

      document.getElementById("newsTitle").value = art.title || "";
      document.getElementById("newsMedia").value = art.source_media || "";
      document.getElementById("newsDate").value = art.published_date || "";
      document.getElementById("newsUrl").value = art.source_url || "";
      document.getElementById("autoNewsUrl").value = art.source_url || "";
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
