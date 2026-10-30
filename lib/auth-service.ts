import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {getChatGPTUser} from '../app/chatgpt-auth';
import {ApiError} from './api-error';
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'}});
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');}
export const spaceFor=(owner:string)=>digest('LifeHub:appgprj_6ae2c732d5248191b59f80e856446929:'+owner);
export async function authorize(request:Request,write=false){
  const user=await getChatGPTUser();if(!user)throw new ApiError(401,'登录已失效，请重新登录后读取个人记录。','AUTH_REQUIRED');
  const spaceId=await spaceFor(user.userId);
  if(write){
    if(request.headers.get('origin')!==new URL(request.url).origin)throw new ApiError(403,'请求来源无效，请从本站操作。','ORIGIN');
    if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new ApiError(415,'需要 JSON 请求。','CONTENT_TYPE');
    const expected=request.headers.get('X-LifeHub-Space');
    if(!expected)throw new ApiError(428,'请重新加载页面，确认当前登录账户后再操作。','CLIENT_REFRESH');
    if(expected!==spaceId)throw new ApiError(409,'登录账户已变化，旧页面的数据未写入。请刷新后操作。','SPACE_CHANGED');
  }
  if(!env.DB)throw new ApiError(503,'数据库暂不可用，请稍后重试。','UNAVAILABLE');
  return {user,db:env.DB,spaceId};
}
export async function readJson(request:Request){
  const limit=2_000_000;if(Number(request.headers.get('content-length')||0)>limit)throw new ApiError(413,'数据超过 2 MB 限制。');
  const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let size=0;
  if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new ApiError(413,'数据超过 2 MB 限制。');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new ApiError(400,'JSON 格式或 UTF-8 编码无效。','VALIDATION');}
}
export async function safely(action:()=>Promise<Response>){
  try{return await action();}catch(error){
    if(error instanceof ApiError)return json({message:error.message,code:error.code||(error.status===409?'CONFLICT':'REQUEST')},error.status);
    if(error instanceof z.ZodError)return json({message:error.issues.map(v=>v.message).slice(0,3).join('；'),code:'VALIDATION'},400);
    if(/UNIQUE|FOREIGN KEY|CHECK constraint/i.test(error instanceof Error?error.message:''))return json({message:'记录或预览已变化，此次操作未生效。请刷新核对；同一次提交可安全重试。',code:'CONFLICT'},409);
    return json({message:'服务暂时不可用，保存结果尚未确认。请保留当前表单，联网后重试同一次操作或刷新核对。',code:'UNAVAILABLE'},503);
  }
}
