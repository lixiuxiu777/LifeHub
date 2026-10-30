import {authorize,json,safely} from '../../../lib/auth-service';
export const dynamic='force-dynamic';
export async function GET(request:Request){return safely(async()=>{const {user,db,spaceId}=await authorize(request);const row=await db.prepare('SELECT revision FROM lifehub_revisions WHERE owner_id=?').bind(user.userId).first<{revision:number}>();return json({spaceId,revision:String(row?.revision??0),serverTime:new Date().toISOString()});});}
