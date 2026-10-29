import { authorize,json,mutate,safely,snapshot,stateKey } from '../../../lib/records-service';
export const dynamic='force-dynamic';
export async function GET(request:Request){return safely(async()=>{const {user,db}=await authorize(request);const records=await snapshot(db,user.userId);return json({records,stateKey:stateKey(records),environment:import.meta.env.DEV?'local':'cloud'});});}
export async function POST(request:Request){return safely(()=>mutate(request,'POST'));}
export async function PATCH(request:Request){return safely(()=>mutate(request,'PATCH'));}
export async function DELETE(request:Request){return safely(()=>mutate(request,'DELETE'));}
