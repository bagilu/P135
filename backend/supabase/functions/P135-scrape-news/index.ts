import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) throw new Error("請提供新聞網址 URL");

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!res.ok) throw new Error(`無法存取該新聞網址 (HTTP ${res.status})`);
    const html = await res.text();

    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) throw new Error("網頁解析失敗");

    let media = "";
    let title = "";
    let date = "";
    let author = "";
    let content = "";

    // 1. 自由時報
    if (url.includes("ltn.com.tw")) {
      media = "自由時報";
      title = doc.querySelector("h1")?.textContent?.trim() || "";
      const timeStr = doc.querySelector(".time")?.textContent?.trim() || "";
      date = timeStr.match(/\d{4}[-\/]\d{2}[-\/]\d{2}/)?.[0] || "";

      const paragraphs = Array.from(doc.querySelectorAll(".text p:not(.appE)"))
        .map(p => p.textContent?.trim())
        .filter(t => t && !t.includes("不用抽") && !t.includes("點我下載APP"));
      content = paragraphs.join("\n\n");

    // 2. 聯合報
    } else if (url.includes("udn.com")) {
      media = "聯合報";
      title = doc.querySelector(".article-content__title")?.textContent?.trim() || "";
      const timeStr = doc.querySelector(".article-content__time")?.textContent?.trim() || "";
      date = timeStr.match(/\d{4}[-\/]\d{2}[-\/]\d{2}/)?.[0] || "";
      author = doc.querySelector(".article-content__author")?.textContent?.trim() || "";

      const paragraphs = Array.from(doc.querySelectorAll("section.article-content__editor p"))
        .map(p => p.textContent?.trim())
        .filter(t => t);
      content = paragraphs.join("\n\n");

    // 3. 中國時報
    } else if (url.includes("chinatimes.com")) {
      media = "中國時報";
      title = doc.querySelector(".article-title")?.textContent?.trim() || "";
      const timeStr = doc.querySelector("time")?.getAttribute("datetime") || doc.querySelector(".date")?.textContent?.trim() || "";
      date = timeStr.match(/\d{4}[-\/]\d{2}[-\/]\d{2}/)?.[0] || "";
      author = doc.querySelector(".author")?.textContent?.trim() || "";

      const paragraphs = Array.from(doc.querySelectorAll(".article-body p"))
        .map(p => p.textContent?.trim())
        .filter(t => t);
      content = paragraphs.join("\n\n");

    // 4. 三立新聞網 (新增)
    } else if (url.includes("setn.com")) {
      media = "三立新聞網";
      title = doc.querySelector("h1.news-title-3")?.textContent?.trim() || doc.querySelector("h1")?.textContent?.trim() || "";
      const timeStr = doc.querySelector(".time")?.textContent?.trim() || "";
      date = timeStr.match(/\d{4}[-\/]\d{2}[-\/]\d{2}/)?.[0] || "";

      const paragraphs = Array.from(doc.querySelectorAll("#Content1 p, article p"))
        .map(p => p.textContent?.trim())
        .filter(t => t && !t.includes("★ 三立新聞網提醒您") && !t.includes("更多三立新聞網報導"));
      content = paragraphs.join("\n\n");

    // 5. 通用兜底
    } else {
      title = doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || doc.querySelector("title")?.textContent?.trim() || "";
      media = doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content") || "網路媒體";
      date = new Date().toISOString().split("T")[0];
      const pList = Array.from(doc.querySelectorAll("article p, main p, .content p")).map(p => p.textContent?.trim()).filter(Boolean);
      content = pList.join("\n\n");
    }

    return new Response(JSON.stringify({
      success: true,
      media,
      title,
      date: date.replace(/\//g, "-"),
      author,
      content
    }), {
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
