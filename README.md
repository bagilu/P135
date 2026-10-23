# P135 翻轉新聞 FlipNews — V0.06 私人知識庫

## 既有網站更新：只執行 30，不執行 10

**必須在 Supabase SQL Editor 執行整份 `database/30_P135_PrivateLibrary.sql`，原有公開讀取入口才會真正關閉。只更新 GitHub 不會撤銷正式資料庫權限。**

1. 在原本使用的 Supabase 專案執行 `database/30_P135_PrivateLibrary.sql`。不需填 UID，不更換帳號，不刪文章、筆記或人物事蹟，不搬移 schema。可以安全重跑。
2. 結果 `private_library_installed`、`anonymous_reading_disabled`、`former_public_paths_disabled`、`editor_configured` 應全部為 true；`saved_article_count` 是保留下來的文章數。
3. 更新 GitHub 前端，保留原有 `config.js`。重新整理，右上版本為 V0.06，登入自己原有的指定帳號。其他共用 Auth 帳號即使登入也不能閱讀。
4. 使用無痕視窗確認首頁及單篇連結都只顯示登入頁；登入後才可看文章庫、全文與分析。登出後立即清除畫面，原文章連結重新打開仍需登入。

**本次不必重新部署 Edge Functions、不更改 AI_MODELS 或 AI_API_KEY。不要執行 10 初始化，也不要使用舊版 90 權限修復檔。**

目前套件只完成本地驗證，沒有替老師執行正式 Supabase SQL。更新 GitHub 的登入頁不能代替上述資料庫更新。

## 使用方式

- 首頁是私人登入入口。指定擁有者透過 Email 與密碼登入，後端再檢查原有 editor_user_id。
- 所有收藏文章都可閱讀，包括原先的草稿；移除「公開／取消公開」操作，儲存統一為私人收藏。
- 單篇依序顯示標題、日期、媒體與來源連結、資料庫保存的新聞全文，再顯示原有四項分析。全文以純文字呈現，保留換行，不執行原文 HTML。
- 分析中的事實與觀點維持綠色／紅色圓角區塊；分類仍不等於外部查證。
- 保留彩色兩行文章標籤、日期雙向排序、全庫標題／媒體搜尋、每批 100 篇捲動載入、上一篇／下一篇與返回捲動位置。
- 帳號維護仍導向 P130；前端不新增註冊或密碼維護系統。
- 登入狀態改存 sessionStorage，不再沿用舊 localStorage 的 P135 登入紀錄。同一分頁可在閱讀頁與編輯頁切換；一般情況關閉分頁後需重新登入，瀏覽器工作階段還原可能保留 sessionStorage。需要明確結束使用時請按登出。
- 一個分頁登出會通知同來源其他 P135 分頁登出（瀏覽器支援 BroadcastChannel 時）。登出、認證失效、瀏覽器頁面離開時均清除私人 DOM；返回快取頁時重新確認帳號權限。

## 資料與權限變更

- 新增三個 SECURITY INVOKER RPC：P135_GetLibraryAccess、P135_ListLibraryArticles、P135_GetLibraryNeighbors，均只授權 authenticated；列表及相鄰文章另檢查唯一擁有者。
- 全文使用既有 P135_GetArticleDetail，其原有擁有者檢查、user_id 篩選與 RLS 保留。文章列表只回傳標題、日期、媒體、UUID，不回傳全文或筆記。
- 三個舊公開 RPC 對 PUBLIC、anon、authenticated、service_role 全數撤銷 EXECUTE；anon 對 p135_data 的 USAGE 也撤銷。
- 舊 TblP135_Publications 快照資料保留作歷史資料，撤除所有上述角色的表格權限，並以 USING(false) 封鎖舊讀取 policy。保留筆數不代表仍公開。
- P135_SaveArticle 忽略任何傳入的 is_published=true，固定私人儲存，不再產生或更新公開快照。原文章與歷史 metadata 不批次重寫。
- 新版 90 權限修復與 80 暫停檔都維持私人模式，不會恢復公開授權；全新環境使用的 10 也在同一交易中完成私人模式。
- 資料仍保留在未暴露的 p135_data。不要將此 schema 加入 Data API Exposed Schemas；本次沒有更改共用 API、Auth、其他 P 專案或全域 default privileges。

## 驗證

本次 57 項檢查通過（資料庫 19、UI 13、分批載入 8、Chromium 17），使用合成資料、本地 PostgreSQL/PGlite 與 Chromium 驗證私人化前後的資料完整性、拒絕匿名與其他帳號、強制私人儲存、登入及全文閱讀、登出清除、競態回應、跨分頁登出、頁面快取返回與 100 篇分批載入。個別結果見 docs/*_Test_Results.json。

Edge Functions 與 V0.05.1 完全相同；Edge_Test_Results.json 保留 V0.04.2 的既有報告，本次未重新計數。未使用老師的真實帳號、原文、token 或付費 AI，也沒有連線正式 Supabase 執行 SQL。

## 檔案

- `database/30_P135_PrivateLibrary.sql`：既有環境唯一需要執行的更新。
- `database/99_P135_HealthCheck.sql`：唯讀健康檢查。
- `database/90_P135_Permissions.sql`：V0.06 私人模式精確權限修復。
- `database/10_P135_FreshInstall.sql`：只供尚未建立 p135_data 的全新環境，既有環境勿執行。
- `supabase/`、`docs/dashboard-single-file/`：原本已部署的 Edge 程式，本次不需重新部署。
- `tests/fixtures/`：歷史版本與合成資料的隔離測試起點，不能部署。
- `config-sample.js`：公開連線設定範例。套件不包含真實 config.js、新聞資料、Auth UID 或秘密。
