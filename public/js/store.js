import {canonical} from './backup-data.js';
export class DataStore extends EventTarget{
  records=[];environment='unknown';loading=true;busy=false;refreshing=false;error='';stateKey='';spaceId='';revision='';lastSynced=null;lastChecked=null;undo=null;remotePending=false;generation=0;unconfirmed=new Map();lastMutationReplayed=false;
  constructor({fetcher=(...args)=>fetch(...args),isOnline=()=>typeof navigator==='undefined'||navigator.onLine!==false,timeoutMs=20000}={}){super();this.fetcher=fetcher;this.isOnline=isOnline;this.timeoutMs=timeoutMs;}
  emit(){this.dispatchEvent(new Event('change'));}
  list(type){return this.records.filter(r=>r.type===type);}
  get(id){return this.records.find(r=>r.id===id);}
  invalidate(message='登录已变化，请重新读取当前账户的数据。'){
    this.generation++;this.records=[];this.undo=null;this.spaceId='';this.revision='';this.stateKey='';this.lastSynced=null;this.lastChecked=null;this.remotePending=false;this.unconfirmed.clear();this.error=message;this.dispatchEvent(new Event('spacechange'));this.emit();
  }
  handleError(error){if(error.status===401||error.code==='SPACE_CHANGED'){this.invalidate(error.message);}else{this.error=error.message;}}
  apply(data){
    if(!data.spaceId||!Array.isArray(data.snapshot||data.records))throw Object.assign(new Error('服务响应缺少数据空间或完整记录，请重新加载。'),{code:'UNAVAILABLE',status:502});
    if(this.spaceId&&this.spaceId!==data.spaceId)this.invalidate('登录账户已切换，旧表单和缓存已清除。');
    this.spaceId=data.spaceId;this.records=data.snapshot||data.records;this.stateKey=data.stateKey;this.revision=data.revision;this.undo=data.undo||null;this.environment=data.environment||this.environment;this.lastSynced=new Date(data.serverTime);this.lastChecked=this.lastSynced;this.remotePending=false;this.error='';
  }
  async request(path,method='GET',body){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try{
      const headers=body?{'Content-Type':'application/json','X-LifeHub-Space':this.spaceId}:{};
      const response=await this.fetcher(path,{method,credentials:'same-origin',cache:'no-store',headers,body:body?JSON.stringify(body):undefined,signal:controller.signal});
      if(response.redirected)throw Object.assign(new Error('登录已失效，请重新登录。'),{status:401,code:'AUTH_REQUIRED'});
      let data;try{data=await response.json();}catch{throw Object.assign(new Error('服务响应不完整，结果尚未确认，请刷新核对。'),{status:502,code:'UNAVAILABLE'});}
      if(!response.ok)throw Object.assign(new Error(data.message||'请求未成功'),{status:response.status,code:data.code||'REQUEST'});return data;
    }catch(error){if(error.name==='AbortError')throw Object.assign(new Error('请求超时，保存结果尚未确认。请保留表单重试同一次提交，或刷新核对回执。'),{status:0,code:'NETWORK'});if(error instanceof TypeError)throw Object.assign(new Error('网络连接中断。未收到保存确认，请保留原表单，联网后重试同一次提交或刷新核对。'),{status:0,code:'NETWORK'});throw error;}finally{clearTimeout(timer);}
  }
  networkChanged(){if(!this.isOnline()){this.error='当前离线，显示上次成功读取的数据。保存请求不会离线排队。';this.emit();}}
  assertWritable(){if(!this.isOnline())throw Object.assign(new Error('当前离线，尚未发送保存请求。联网后请手动重试。'),{code:'OFFLINE'});if(!this.spaceId)throw new Error('请先成功读取并确认当前账户的数据空间。');if(this.busy)throw new Error('正在保存或导入，请稍候。');}
  context(){return {generation:this.generation,spaceId:this.spaceId};}
  checkContext(context){if(context.generation!==this.generation||context.spaceId!==this.spaceId)throw Object.assign(new Error('登录或数据空间已变化，旧请求响应已丢弃。请重新读取当前账户。'),{status:409,code:'STALE_RESPONSE'});}
  async refresh({silent=false}={}){
    if(this.busy)return;if(this.refreshing)return this.refreshPromise;const generation=this.generation;this.refreshing=true;
    if(!silent){this.busy=true;this.emit();}
    this.refreshPromise=(async()=>{try{const data=await this.request('/api/records');if(generation!==this.generation)return;const changed=this.stateKey!==data.stateKey||this.spaceId!==data.spaceId||this.error||this.remotePending;this.apply(data);await this.reconcile();if(changed||!silent)this.emit();}
      catch(error){if(generation!==this.generation)return;this.handleError(error);this.emit();throw error;}finally{const wasLoading=this.loading;this.loading=false;this.refreshing=false;if(!silent)this.busy=false;if(!silent||wasLoading)this.emit();}})();return this.refreshPromise;
  }
  async checkRemote({defer=false}={}){
    if(!this.isOnline()){this.networkChanged();return;}
    const context=this.context();try{if(!this.lastSynced)return await this.refresh({silent:true});const data=await this.request('/api/sync');this.checkContext(context);this.lastChecked=new Date(data.serverTime);
      if(this.spaceId!==data.spaceId){this.invalidate('登录账户已变化，旧数据与表单已清除。');return await this.refresh({silent:true});}
      if(data.revision!==this.revision){if(defer||this.busy){if(!this.remotePending){this.remotePending=true;this.emit();}return;}await this.refresh({silent:true});}
      else{const changed=!!this.error;this.error='';await this.reconcile();if(changed)this.emit();}
    }catch(error){if(error.code==='STALE_RESPONSE'||context.generation!==this.generation||context.spaceId!==this.spaceId)return;this.handleError(error);this.emit();throw error;}
  }
  async reconcile(){if(!this.unconfirmed.size||!this.spaceId)return;let changed=false;for(const [key,pending]of this.unconfirmed){const status=await this.request('/api/operations/status','POST',{operationId:pending.payload.operationId});if(status.known){this.unconfirmed.delete(key);changed=true;}}if(changed)this.emit();}
  async mutate(method,type,data,record,operationId){
    this.assertWritable();const base={type,...(data?{data}:{}),...(record?{id:record.id,version:record.version}:{})},key=canonical({method,...base}),pending=this.unconfirmed.get(key);
    const payload={...base,operationId:pending?.payload.operationId||operationId||crypto.randomUUID()};
    this.busy=true;this.generation++;const context=this.context();this.error='';this.emit();
    try{const result=await this.request('/api/records',method,payload);this.checkContext(context);this.apply(result);this.lastMutationReplayed=!!result.replayed;this.unconfirmed.delete(key);return result.record;}
    catch(error){this.checkContext(context);if(error.code==='NETWORK'||error.status>=500){this.unconfirmed.set(key,{payload,method});}else if(error.status>=400&&error.status<500)this.unconfirmed.delete(key);this.handleError(error);throw error;}finally{this.busy=false;this.emit();}
  }
  async retryLast(){const pending=[...this.unconfirmed.values()].at(-1);if(!pending)throw new Error('没有结果待确认的提交。');const {type,data,id,version,operationId}=pending.payload;return this.mutate(pending.method,type,data,id?{id,version}:null,operationId);}
  async undoLast(){this.assertWritable();if(!this.undo)throw new Error('没有可撤销的操作');const id=this.undo.id;this.busy=true;this.generation++;const context=this.context();this.emit();try{const result=await this.request('/api/undo','POST',{operationId:id});this.checkContext(context);this.apply(result);}catch(error){this.checkContext(context);this.handleError(error);throw error;}finally{this.busy=false;this.emit();}}
  async previewRestore(backup,mode){this.assertWritable();this.busy=true;const context=this.context();this.emit();try{const result=await this.request('/api/backup/preview','POST',{backup,mode});this.checkContext(context);return result;}catch(error){this.checkContext(context);this.handleError(error);throw error;}finally{this.busy=false;this.emit();}}
  async restore(backup,planId){this.assertWritable();this.busy=true;this.generation++;const context=this.context();this.emit();try{const result=await this.request('/api/restore','POST',{backup,planId,confirm:'RESTORE'});this.checkContext(context);this.apply(result);return result;}catch(error){this.checkContext(context);this.handleError(error);throw error;}finally{this.busy=false;this.emit();}}
  async download(path,body,fallback){
    this.assertWritable();const context=this.context(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try{const response=await this.fetcher(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-LifeHub-Space':this.spaceId},body:JSON.stringify(body),signal:controller.signal});
      if(response.redirected)throw Object.assign(new Error('登录已失效，请重新登录。'),{status:401});
      if(!response.ok){const data=await response.json();throw Object.assign(new Error(data.message||'导出失败'),{status:response.status,code:data.code});}
      const disposition=response.headers.get('content-disposition');if(!disposition?.startsWith('attachment;'))throw new Error('导出响应无效，请重新登录后重试。');
      const blob=await response.blob();this.checkContext(context);const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=disposition.match(/filename="([a-zA-Z0-9._-]+)"/)?.[1]||fallback;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);return Number(response.headers.get('X-Record-Count')||0);
    }catch(error){this.checkContext(context);if(error.name==='AbortError')error=new Error('导出超时，没有确认下载完成，请重试。');this.handleError(error);this.emit();throw error;}finally{clearTimeout(timer);}
  }
  exportBackup(scope){return this.download('/api/backup/export',{scope},`lifehub-backup-${scope}.json`);}
  exportFinance(state,format){const {month,currency,from,to,category,direction,paymentMethod,search}=state;return this.download('/api/finance/export',{month,currency,format,...(format==='ledger-csv'?{from,to,category,direction,paymentMethod,search}:{})},`lifehub-${format}-${month}-${currency}.${format==='month-json'?'json':'csv'}`);}
  exportBookmarks(state,format){const {search,category,tag}=state;return this.download('/api/bookmarks/export',{search,category,tag,format},`lifehub-bookmarks.${format}`);}
}
