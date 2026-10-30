import {authorize,json,readJson,safely} from '../../../lib/records-service';
import {undoOperation} from '../../../lib/planner-service';
import {mutationState} from '../../../lib/state-service';
export const dynamic='force-dynamic';
export async function POST(request:Request){return safely(async()=>{const {user,db}=await authorize(request,true);const input=await readJson(request);return json(await mutationState(db,user.userId,await undoOperation(db,user.userId,input.operationId)));});}
