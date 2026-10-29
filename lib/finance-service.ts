import {ApiError} from './api-error';
import {parseData,type Entity,type EntityType} from './domain';
import {snapshot} from './record-utils';
type Input={id?:string;type:EntityType;version?:number;data?:unknown;operationId?:string};
export async function financeMutation(db:D1Database,owner:string,input:Input,method:string){
  const data=method==='DELETE'?undefined:parseData(input.type,input.data);
  const operationId=input.operationId??crypto.randomUUID();
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({method,type:input.type,id:input.id,version:input.version,data}))))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const receipt=await db.prepare('SELECT digest,result_id FROM lifehub_finance_receipts WHERE id=? AND owner_id=?').bind(operationId,owner).first<any>();
  async function result(id:string,replayed=false){const records=await snapshot(db,owner);return {snapshot:records,record:records.find(r=>r.id===id),deleted:method==='DELETE'?id:undefined,replayed};}
  if(receipt){if(receipt.digest!==digest)throw new ApiError(409,'操作编号已使用，请关闭表单后重新操作');return result(receipt.result_id,true);}
  const revision=(await db.prepare('SELECT revision FROM lifehub_revisions WHERE owner_id=?').bind(owner).first<{revision:number}>())?.revision??0;
  const current=await snapshot(db,owner),previous=current.find(r=>r.id===input.id&&r.type===input.type);
  if(method==='POST'){if(input.id||input.version)throw new ApiError(400,'新增记录由服务器分配 ID');}
  else{if(!input.id||!input.version)throw new ApiError(400,'缺少记录 ID 或版本');if(!previous)throw new ApiError(404,'记录不存在或无法访问');if(previous.version!==input.version)throw new ApiError(409,'记录已在其他位置修改，请刷新后重试');}
  if(input.type==='Budget'&&method!=='DELETE'){
    const b=data as any;if(current.some(r=>r.type==='Budget'&&r.id!==input.id&&(r.data as any).month===b.month&&(r.data as any).currency===b.currency&&(r.data as any).category===b.category))throw new ApiError(409,'该月份、币种及范围已有预算，请编辑原预算');
  }
  const now=new Date(Math.max(Date.now(),Date.parse(previous?.createdAt||'')||0)).toISOString();
  const record={id:previous?.id??crypto.randomUUID(),type:input.type,data,createdAt:previous?.createdAt??now,updatedAt:now,version:Math.max(Date.now(),(previous?.version||0)+1)} as Entity;
  const write=method==='POST'?db.prepare('INSERT INTO lifehub_records (id,owner_id,type,data,parent_id,created_at,updated_at,version) VALUES (?,?,?,?,NULL,?,?,?)').bind(record.id,owner,record.type,JSON.stringify(data),record.createdAt,now,record.version):method==='PATCH'?db.prepare('UPDATE lifehub_records SET data=?,updated_at=?,version=? WHERE id=? AND owner_id=? AND version=?').bind(JSON.stringify(data),now,record.version,record.id,owner,input.version):db.prepare('DELETE FROM lifehub_records WHERE id=? AND owner_id=? AND version=?').bind(record.id,owner,input.version);
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO lifehub_revisions (owner_id,revision) VALUES (?,0)').bind(owner),
    db.prepare('INSERT INTO lifehub_restore_guard (owner_id,valid) SELECT ?,CASE WHEN revision=? THEN 1 ELSE 0 END FROM lifehub_revisions WHERE owner_id=?').bind(owner,revision,owner),write,
    db.prepare('INSERT INTO lifehub_finance_receipts (id,owner_id,digest,result_id,created_at) VALUES (?,?,?,?,?)').bind(operationId,owner,digest,record.id,now),
    db.prepare('DELETE FROM lifehub_restore_guard WHERE owner_id=?').bind(owner),
  ]);
  return result(record.id);
}
