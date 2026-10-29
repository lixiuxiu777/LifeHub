import {z} from 'zod';
import {authorize,readJson,safely,snapshot} from '../../../../lib/records-service';
import {financeExport,paymentMethods} from '../../../../public/js/finance-data.js';
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return !isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v;});
const query=z.object({month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),currency:z.enum(['CNY','USD','EUR','JPY','KWD']),format:z.enum(['ledger-csv','budget-csv','month-json']),from:day.or(z.literal('')).default(''),to:day.or(z.literal('')).default(''),category:z.string().max(60).default(''),direction:z.enum(['','expense','income']).default(''),paymentMethod:z.string().refine(v=>!v||paymentMethods.includes(v)).default(''),search:z.string().max(200).default('')}).strict().refine(v=>!v.from||!v.to||v.from<=v.to,'开始日期不能晚于结束日期');
export const dynamic='force-dynamic';
export async function POST(request:Request){return safely(async()=>{
  const {user,db}=await authorize(request,true);const input=query.parse(await readJson(request));
  const output=financeExport(await snapshot(db,user.userId),input,input.format);
  return new Response(output.body,{headers:{'Content-Type':output.mime,'Content-Disposition':`attachment; filename="lifehub-${input.format}-${input.month}-${input.currency}.${output.extension}"`,'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','X-Record-Count':String(output.count)}});
});}
