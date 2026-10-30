import {z} from 'zod';
import {authorize,json,readJson,safely} from '../../../../lib/auth-service';
export const dynamic='force-dynamic';
export async function POST(request:Request){return safely(async()=>{const {user,db}=await authorize(request,true);const {operationId}=z.object({operationId:z.string().uuid()}).strict().parse(await readJson(request));
  const receipt=await db.prepare('SELECT id FROM lifehub_operations WHERE id=? AND owner_id=? UNION ALL SELECT id FROM lifehub_finance_receipts WHERE id=? AND owner_id=? UNION ALL SELECT id FROM lifehub_life_receipts WHERE id=? AND owner_id=? LIMIT 1').bind(operationId,user.userId,operationId,user.userId,operationId,user.userId).first();return json({known:!!receipt});
});}
