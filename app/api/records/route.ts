import { authorize,json,mutate,safely } from '../../../lib/records-service';
import {readState} from '../../../lib/state-service';
export const dynamic='force-dynamic';
export async function GET(request:Request){return safely(async()=>{const {user,db}=await authorize(request);return json({...await readState(db,user.userId),environment:import.meta.env.DEV?'local':'cloud'});});}
export async function POST(request:Request){return safely(()=>mutate(request,'POST'));}
export async function PATCH(request:Request){return safely(()=>mutate(request,'PATCH'));}
export async function DELETE(request:Request){return safely(()=>mutate(request,'DELETE'));}
