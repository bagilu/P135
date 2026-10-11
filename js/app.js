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
    statusEl.textContent = "未登入 (唯讀/測試模式)";
    authBtn.onclick = async () => {
      const email = prompt("請輸入 Email：");
      const password = prompt("請輸入密碼：");
      if (email && password) {
        const { error } = await window.P135_API.signIn(email, password);
        if (error) {
          // 若無帳號嘗試註冊
          await window.P135_API.signUp(email, password);
          alert("已發送驗證信或完成註冊，請重新登入！");
        } else {
          location.reload();
        }
      }
    };
  }

  // 2. 標籤切換邏輯
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  // 3. AI 多維解讀觸發
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
      currentAnalysis = await window.P135_API.analyzeNews({ title, content });
      
      // 填入中性版
      document.getElementById("neutralContentBox").innerHTML = 
        `<p>${currentAnalysis.neutral_rewriting || "無"}</p>`;
      
      // 填入立場對調版
      document.getElementById("flippedContentBox").innerHTML = 
        `<h4>改寫結果：</h4><p>${currentAnalysis.flipped_perspective?.summary || "無"}</p>
         <h4>心理感受分析：</h4><p>${currentAnalysis.flipped_perspective?.reading_feeling || "無"}</p>`;

      // 填入情緒詞句分析
      const words = currentAnalysis.sentiment_analysis?.loaded_words || [];
      const wordsHtml = words.map(w => `<li><strong>${w.word_or_phrase}</strong> [${w.category}]: ${w.explanation}</li>`).join("");
      document.getElementById("sentimentAnalysisBox").innerHTML = 
        `<h4>基調：${currentAnalysis.sentiment_analysis?.overall_tone} (煽動指數: ${currentAnalysis.sentiment_analysis?.bias_rating}/5)</h4>
         <ul>${wordsHtml}</ul>`;

      // 填入事實與觀點清單
      const facts = currentAnalysis.fact_vs_opinion?.facts || [];
      const opinions = currentAnalysis.fact_vs_opinion?.opinions || [];
      document.getElementById("factsList").innerHTML = facts.map(f => `<li>${f}</li>`).join("");
      document.getElementById("opinionsList").innerHTML = opinions.map(o => `<li>${o}</li>`).join("");

      alert("解讀完成！");
    } catch (err) {
      alert("解讀失敗：" + err.message);
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = "⚡ 開始 AI 多維解讀";
    }
  });

  // 4. 存入事蹟懶人包
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

  // 5. 儲存整篇新聞與解讀
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
});
