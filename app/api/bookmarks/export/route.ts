import {z} from 'zod';
import {authorize,readJson,safely,snapshot} from '../../../../lib/records-service';
import {bookmarkExport} from '../../../../public/js/life-data.js';
const query=z.object({format:z.enum(['csv','json']),search:z.string().max(200).default(''),category:z.string().max(60).default(''),tag:z.string().max(200).default('')}).strict();
export const dynamic='force-dynamic';
export async function POST(request:Request){return safely(async()=>{const {user,db}=await authorize(request,true),{format,...filters}=query.parse(await readJson(request));const output=bookmarkExport(await snapshot(db,user.userId),filters,format);return new Response(output.body,{headers:{'Content-Type':output.mime,'Content-Disposition':`attachment; filename="lifehub-bookmarks-${new Date().toISOString().slice(0,10)}.${format}"`,'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','X-Record-Count':String(output.count)}});});}
