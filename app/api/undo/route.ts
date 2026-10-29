import {authorize,json,readJson,safely} from '../../../lib/records-service';
import {undoOperation} from '../../../lib/planner-service';
export const dynamic='force-dynamic';
export async function POST(request:Request){return safely(async()=>{const {user,db}=await authorize(request,true);const input=await readJson(request);return json(await undoOperation(db,user.userId,input.operationId));});}
