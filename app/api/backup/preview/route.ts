import {safely} from '../../../../lib/auth-service';
import {previewBackup} from '../../../../lib/backup-service';
export const dynamic='force-dynamic';
export async function POST(request:Request){return safely(()=>previewBackup(request));}
