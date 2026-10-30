export class SyncController{
  constructor(store,{canRefresh=()=>!document.querySelector('dialog[open]'),visible=()=>document.visibilityState==='visible',schedule=setTimeout,cancel=clearTimeout}={}){this.store=store;this.canRefresh=canRefresh;this.visible=visible;this.schedule=schedule;this.cancel=cancel;this.failures=0;this.timer=null;this.running=false;this.active=false;this.wake=()=>this.tick();}
  start(){if(this.active)return;this.active=true;for(const event of ['focus','online','offline'])window.addEventListener(event,this.wake);document.addEventListener('visibilitychange',this.wake);this.timer=this.schedule(this.wake,15000);}
  stop(){this.active=false;this.cancel(this.timer);for(const event of ['focus','online','offline'])window.removeEventListener(event,this.wake);document.removeEventListener('visibilitychange',this.wake);}
  async tick(){
    if(!this.active||this.running)return;this.cancel(this.timer);this.running=true;
    try{if(!this.store.isOnline()){this.store.networkChanged();return;}if(!this.visible())return;await this.store.checkRemote({defer:!this.canRefresh()||this.store.busy});this.failures=0;}
    catch{this.failures++;}finally{this.running=false;if(this.active)this.timer=this.schedule(this.wake,Math.min(60000,15000*2**Math.min(this.failures,2)));}
  }
  flush(){if(this.active&&this.store.remotePending&&!this.store.busy&&this.canRefresh())this.tick();}
}
