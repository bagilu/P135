import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("缺少授權標頭 (Missing Auth)");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("未經認證的請求 (Unauthorized)");

    const { title, content } = await req.json();
    if (!content) throw new Error("新聞內文不能為空");

    const geminiApiKey = Deno.env.get("AI_API_KEY");
    if (!geminiApiKey) throw new Error("Supabase 後台未設定 AI_API_KEY 密鑰");

    const promptText = `
你是一位嚴謹的政治傳播與文本解讀專家。請針對以下新聞進行客觀剖析，回傳純 JSON 格式（嚴禁包含 markdown 代碼塊標記如 \`\`\`json）：
{
  "sentiment_analysis": {
    "overall_tone": "偏激 / 煽動 / 輕微偏頗 / 客觀中立",
    "bias_rating": 1到5的數字 (1=最中立, 5=最煽動),
    "loaded_words": [{"word_or_phrase": "詞句", "category": "褒揚/貶抑/揣測", "explanation": "分析"}]
  },
  "neutral_rewriting": "移除情緒修飾與主觀評論後的中性客觀報導版本",
  "flipped_perspective": {
    "summary": "將政黨/立場角色對調後的改寫版本",
    "reading_feeling": "對調立場後閱讀時產生的荒謬感或心理感受分析"
  },
  "fact_vs_opinion": {
    "facts": ["客觀事實、數據、發言原句"],
    "opinions": ["推測、名嘴主觀定性、傳聞"]
  }
}

新聞標題：${title || "無標題"}
新聞內文：
${content}
`;

    // 定義主模型與備援模型候選清單 (依序自動降級)
    const candidateModels = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-3.5-flash"];
    let resultText = "";
    let lastErrorMessage = "";

    for (const model of candidateModels) {
      try {
        console.log(`嘗試調用模型: ${model}`);
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2
            },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
          })
        });

        const geminiData = await geminiRes.json();

        // 若遇到 High Demand、過載或限流，記錄錯誤並切換下一台備援模型
        if (geminiData.error) {
          console.warn(`模型 ${model} 回報錯誤:`, geminiData.error.message);
          lastErrorMessage = geminiData.error.message;
          continue; // 嘗試下一個備援模型
        }

        if (geminiData.candidates && geminiData.candidates.length > 0) {
          resultText = geminiData.candidates[0]?.content?.parts?.[0]?.text || "";
          if (resultText) {
            console.log(`模型 ${model} 呼叫成功！`);
            break; // 成功取得內容，跳出備援迴圈
          }
        }
      } catch (callErr) {
        console.warn(`調用 ${model} 時發生網路異常:`, callErr.message);
        lastErrorMessage = callErr.message;
      }
    }

    if (!resultText) {
      throw new Error(`所有備援模型皆處於繁忙狀態，請稍候 10 秒重試。最後錯誤: ${lastErrorMessage}`);
    }

    // 清理 markdown 語法外框
    resultText = resultText.trim();
    if (resultText.startsWith("```json")) {
      resultText = resultText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (resultText.startsWith("```")) {
      resultText = resultText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    return new Response(resultText, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
