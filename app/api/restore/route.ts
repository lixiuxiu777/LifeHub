import { restore,safely } from '../../../lib/records-service';
export const dynamic='force-dynamic';
export async function POST(request:Request){return safely(()=>restore(request));}
