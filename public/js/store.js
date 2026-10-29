export class DataStore extends EventTarget{
  records=[];environment='unknown';loading=true;busy=false;error='';stateKey='';lastSynced=null;undo=null;
  async request(path,method='GET',body){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:controller.signal});
      if(response.redirected)throw new Error('登录状态已失效，请重新登录。');
      let data;try{data=await response.json();}catch{throw new Error('服务响应无效，请刷新或重新登录。');}
      if(!response.ok){const error=new Error(data.message||'请求未成功');error.status=response.status;throw error;}return data;
    }catch(error){if(error.name==='AbortError')throw new Error('请求超时，保存结果尚未确认。请刷新核对后重试。');throw error;}finally{clearTimeout(timer);}
  }
  list(type){return this.records.filter(r=>r.type===type);}
  get(id){return this.records.find(r=>r.id===id);}
  emit(){this.dispatchEvent(new Event('change'));}
  async refresh(){
    if(this.busy)return;this.busy=true;this.error='';this.emit();
    try{const data=await this.request('/api/records');this.records=data.records;this.environment=data.environment;this.stateKey=data.stateKey;this.undo=data.undo||null;this.lastSynced=new Date();}
    catch(error){this.error=error.message;throw error;}
    finally{this.loading=false;this.busy=false;this.emit();}
  }
  async mutate(method,type,data,record,operationId){
    if(this.busy)throw new Error('正在保存或刷新，请稍候。');this.busy=true;this.error='';this.emit();
    try{
      const payload={type,...(data?{data}:{}),...(record?{id:record.id,version:record.version}:{})};
      if(type!=='DashboardPreference')payload.operationId=operationId||crypto.randomUUID();
      const result=await this.request('/api/records',method,payload);
      if(result.snapshot)this.records=result.snapshot;
      else if(result.record){this.records=this.records.filter(r=>r.id!==result.record.id).concat(result.record);}else if(result.deleted){this.records=this.records.filter(r=>r.id!==result.deleted);}
      if('undo'in result)this.undo=result.undo;
      this.stateKey=this.records.map(r=>`${r.id}:${r.version}`).sort().join('|');this.lastSynced=new Date();return result.record;
    }catch(error){this.error=error.message;throw error;}finally{this.busy=false;this.emit();}
  }
  async undoLast(){
    if(this.busy||!this.undo)throw new Error('当前没有可撤销的操作');const id=this.undo.id;this.busy=true;this.error='';this.emit();
    try{const result=await this.request('/api/undo','POST',{operationId:id});this.records=result.snapshot;this.undo=result.undo;this.stateKey=this.records.map(r=>`${r.id}:${r.version}`).sort().join('|');this.lastSynced=new Date();}
    catch(error){this.error=error.message;throw error;}finally{this.busy=false;this.emit();}
  }
  async restore(backup,expectedState){
    if(this.busy)throw new Error('正在保存或刷新，请稍候。');this.busy=true;this.emit();
    try{await this.request('/api/restore','POST',{backup,expectedState,confirm:'RESTORE'});}finally{this.busy=false;this.emit();}
    await this.refresh();
  }
  backup(){return {format:'lifehub-backup',version:2,exportedAt:new Date().toISOString(),records:this.records};}
  async exportFinance(state,format){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{
      const {month,currency,from,to,category,direction,paymentMethod,search}=state;
      const response=await fetch('/api/finance/export',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({month,currency,format,...(format==='ledger-csv'?{from,to,category,direction,paymentMethod,search}:{})}),signal:controller.signal});
      if(response.redirected)throw new Error('登录状态已失效，请重新登录。');
      if(!response.ok){const data=await response.json();throw new Error(data.message||'导出失败');}
      if(!response.headers.get('content-disposition')?.startsWith('attachment;'))throw new Error('服务返回无效，请重新登录后重试');
      const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`lifehub-${format}-${month}-${currency}.${format==='month-json'?'json':'csv'}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
    }catch(error){if(error.name==='AbortError')throw new Error('导出超时，请稍后重试');throw error;}finally{clearTimeout(timer);}
  }
  async exportBookmarks(state,format){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{const {search,category,tag}=state,response=await fetch('/api/bookmarks/export',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({search,category,tag,format}),signal:controller.signal});
      if(response.redirected)throw new Error('登录状态已失效，请重新登录。');if(!response.ok){const data=await response.json();throw new Error(data.message||'导出失败');}if(!response.headers.get('content-disposition')?.startsWith('attachment;'))throw new Error('服务响应无效，请重新登录后重试');
      const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`lifehub-bookmarks-${new Date().toISOString().slice(0,10)}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
    }catch(error){if(error.name==='AbortError')throw new Error('导出超时，请稍后重试');throw error;}finally{clearTimeout(timer);}
  }
}
