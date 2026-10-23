import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
export const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
export class HttpError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
export async function authorizeEditor(req:Request){
  if(req.method!=="POST")throw new HttpError(405,"僅接受 POST。");
  const authorization=req.headers.get("Authorization");
  if(!authorization?.startsWith("Bearer "))throw new HttpError(401,"請先登入編輯帳號。");
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY");
  if(!url||!key)throw new HttpError(500,"後端連線尚未設定。");
  const client=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user)throw new HttpError(401,"登入已失效，請重新登入。");
  const result=await client.rpc("P135_GetEditorStatus");
  if(result.error)throw new HttpError(503,"無法確認編輯資格，請檢查 V0.03 資料庫設定。");
  if(result.data!==true)throw new HttpError(403,"此帳號沒有 P135 編輯權限。");
  return user;
}
export async function readJson(req:Request){
  if(Number(req.headers.get('content-length')||0)>600000)throw new HttpError(413,"輸入資料過大。");
  const reader=req.body?.getReader();if(!reader)throw new HttpError(400,"缺少輸入資料。");
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>600000){await reader.cancel();throw new HttpError(413,"輸入資料過大。");}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{throw new HttpError(400,"輸入必須是有效 JSON object。");}
}
export function respond(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});}
export function failure(error:unknown){return respond({error:error instanceof HttpError?error.message:"伺服器處理失敗，請稍後重試。"},error instanceof HttpError?error.status:500);}
