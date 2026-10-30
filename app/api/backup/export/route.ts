import {safely} from '../../../../lib/auth-service';
import {exportBackup} from '../../../../lib/backup-service';
export const dynamic='force-dynamic';
export async function POST(request:Request){return safely(()=>exportBackup(request));}
