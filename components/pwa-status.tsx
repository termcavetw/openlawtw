import {useEffect,useRef,useState} from 'react';
import {Download,Check,WifiOff,RefreshCw,MonitorDown,BookOpen} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {isPortable} from '@/lib/portable';
import {data as catalog} from '@/lib/catalog';
import {OfflinePacks} from '@/components/offline-packs';
const fullCount=catalog.laws.filter(l=>l.coverage==='full').length;
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};

export function PwaStatus({region}:{region:string}){
 const [open,setOpen]=useState(false),[online,setOnline]=useState(navigator.onLine),[ready,setReady]=useState(false),[failed,setFailed]=useState(false),[progress,setProgress]=useState(0),[install,setInstall]=useState<InstallEvent|null>(null),[updating,setUpdating]=useState(false),[installed,setInstalled]=useState(matchMedia('(display-mode: standalone)').matches),[attempt,setAttempt]=useState(0),[checking,setChecking]=useState(false),[checkMessage,setCheckMessage]=useState(''),[cacheVersion,setCacheVersion]=useState('');
 const manualCheck=useRef<()=>Promise<void>>(async()=>{});
 const portable=isPortable(),supported=!portable&&'serviceWorker' in navigator&&window.isSecureContext;
 useEffect(()=>{
  const state=()=>setOnline(navigator.onLine);window.addEventListener('online',state);window.addEventListener('offline',state);
  const capture=(e:Event)=>{e.preventDefault();setInstall(e as InstallEvent);};const done=()=>{setInstalled(true);setInstall(null);};
  window.addEventListener('beforeinstallprompt',capture);window.addEventListener('appinstalled',done);
  return()=>{window.removeEventListener('online',state);window.removeEventListener('offline',state);window.removeEventListener('beforeinstallprompt',capture);window.removeEventListener('appinstalled',done);};
 },[]);
 useEffect(()=>{
  if(!supported)return;
  let live=true,hasController=!!navigator.serviceWorker.controller,reloading=false,lastCheck=0,busy=false;
  let reg:ServiceWorkerRegistration|undefined;const cleanup:Array<()=>void>=[];
  setFailed(false);
  const msg=(e:MessageEvent)=>{
   if(e.data?.type==='PRECACHE_PROGRESS'){setProgress(e.data.done/e.data.total);setUpdating(hasController);setFailed(false);}
   if(e.data?.type==='PACK_PROGRESS'&&e.data.packId==='update'){setUpdating(hasController);setCheckMessage('正在更新已選離線資料，完成後會自動切換。');}
   if(e.data?.type==='OFFLINE_READY'){setReady(true);setCacheVersion(e.data.version||'');if(!reg?.installing){setProgress(1);setUpdating(false);}}
   if(e.data?.type==='UPDATE_FAILED'){setFailed(true);setUpdating(false);setCheckMessage('下載未完成，已保留原有版本。請稍後重試。');}
  };
  const changed=()=>{
   if(reloading)return;
   if(hasController){reloading=true;window.dispatchEvent(new Event('openlawtw:before-update'));location.reload();return;}
   hasController=true;navigator.serviceWorker.controller?.postMessage({type:'STATUS'});
  };
  const check=async(manual=false)=>{
   if(!reg||busy||!navigator.onLine)return;
   if(!manual&&Date.now()-lastCheck<60000)return;
   busy=true;lastCheck=Date.now();setChecking(true);if(manual)setCheckMessage('');
   try{await reg.update();if(!live)return;
    if(reg.waiting){setUpdating(true);reg.waiting.postMessage({type:'SKIP_WAITING'});}
    if(manual)setCheckMessage(reg.installing||reg.waiting?'正在下載新版本，完成後會自動切換。':'已完成檢查，目前沒有新版本。');
   }catch{if(live&&manual)setCheckMessage('目前無法連線檢查，請稍後再試。');}
   finally{busy=false;if(live)setChecking(false);}
  };
  manualCheck.current=()=>check(true);
  const resume=()=>{if(document.visibilityState==='visible')void check();};
  const reconnect=()=>{lastCheck=0;void check();};
  navigator.serviceWorker.addEventListener('message',msg);navigator.serviceWorker.addEventListener('controllerchange',changed);
  document.addEventListener('visibilitychange',resume);window.addEventListener('online',reconnect);
  const timer=window.setInterval(resume,10*60*1000);
  navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(result=>{
   if(!live)return;reg=result;
   if(reg.active)reg.active.postMessage({type:'STATUS'});
   if(reg.waiting){setUpdating(true);reg.waiting.postMessage({type:'SKIP_WAITING'});}
   const watch=()=>{const worker=reg?.installing;if(!worker)return;setProgress(0);setUpdating(hasController);setFailed(false);
    const state=()=>{if(!live)return;if(worker.state==='installed'&&hasController)worker.postMessage({type:'SKIP_WAITING'});if(worker.state==='redundant'){setUpdating(false);setFailed(true);}};
    worker.addEventListener('statechange',state);cleanup.push(()=>worker.removeEventListener('statechange',state));
   };
   reg.addEventListener('updatefound',watch);cleanup.push(()=>reg?.removeEventListener('updatefound',watch));watch();void check();
  }).catch(()=>{if(live)setFailed(true);});
  return()=>{live=false;manualCheck.current=async()=>{};cleanup.forEach(fn=>fn());window.clearInterval(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',reconnect);navigator.serviceWorker.removeEventListener('message',msg);navigator.serviceWorker.removeEventListener('controllerchange',changed);};
 },[attempt,supported]);
 const label=portable?'離線檔案':updating?'新版下載中':!online?'離線模式':failed?'更新未完成':ready?'離線資料管理':'安裝／離線';
 const Icon=portable?BookOpen:updating?RefreshCw:!online?WifiOff:ready?Check:MonitorDown;
 async function doInstall(){if(!install)return;await install.prompt();await install.userChoice;setInstall(null);}
 return <><button className={'pwa-button '+(failed?'error':'')+(updating?' updating':'')} onClick={()=>setOpen(true)} aria-label={label}><Icon size={16}/><span className="pwa-label">{label}</span><span className="pwa-mobile-label" aria-hidden="true">{updating?'更新中':failed?'重試':'離線'}</span></button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="docdialog pwa-dialog"><DialogTitle>把法規，帶在身邊。</DialogTitle><DialogDescription>openlawtw · v{catalog.version} · 安裝與離線閱讀</DialogDescription><div className="pwa-detail">
 <h3><Icon size={19}/>{portable?'全文已內嵌在這份 HTML':updating?'正在下載新版本':ready?'網站介面已保存':failed?'離線資料尚未下載完成':supported?'正在準備離線資料':'部署後即可安裝'}</h3>
 <p>{portable?`這份檔案可離線搜尋與閱讀目前收錄的 ${fullCount} 部法規與 ${catalog.rulingStats.count.toLocaleString()} 筆函釋原文。要安裝到手機主畫面，請開啟部署後的 PWA 網站。`:updating?'下載完成後會自動更新一次，收藏會保留。現在仍可繼續查閱。':ready?'網站介面可離線開啟。閱讀過的資料會保留；需要完整離線查找時，請選擇下方資料包。':supported?'首次只準備網站介面。法規按需載入，也可選擇要帶走的縣市與函釋。':'PWA 安裝與離線快取需要 HTTPS 網址，或本機 localhost。請使用完整部署包發布網站，再從網站安裝。'}</p>
 {supported&&(!ready||updating)&&!failed&&<><div className="pwa-progress" role="progressbar" aria-label="離線資料下載進度" aria-valuenow={Math.round(progress*100)} aria-valuemin={0} aria-valuemax={100}><span style={{width:Math.round(progress*100)+'%'}}/></div><p>{Math.round(progress*100)}% · 正在準備網站介面</p></>}
 {supported&&<OfflinePacks region={region} ready={ready&&!updating} online={online}/>}
 {supported&&<><div className="pwa-divider"/><h3>版本更新</h3><p>開啟或回到網站時會檢查更新，介面與已選資料包更新成功後自動切換，不需開無痕視窗。</p><div className="pwa-update-actions"><button className="install-button" disabled={!online||checking||updating} onClick={()=>failed?setAttempt(n=>n+1):void manualCheck.current()}><RefreshCw size={16}/>{checking?'正在檢查…':failed?'重試更新':'檢查更新'}</button><a href="/update.html">更新疑難排解<ArrowUpdate/></a></div><p role="status" className="pwa-check-message">{!online?'恢復連線後即可檢查。':checkMessage}</p>{cacheVersion&&<small className="pwa-version">離線版本 {cacheVersion}</small>}</>}
 <div className="pwa-divider"/><h3>{installed?'已安裝到這台裝置':'加入手機或電腦'}</h3>
 {install?<button className="install-button" onClick={doInstall}><Download size={16}/>安裝 openlawtw</button>:!installed&&<p>iPhone／iPad：以 Safari 開啟網站，點「分享」→「加入主畫面」。Android 或電腦：從瀏覽器選單選擇「安裝應用程式」或「加入主畫面」。</p>}
 <p>離線範圍為本版已收錄的文字快照；官方網站、PDF、圖表與外部附件仍需連線。清除瀏覽器資料或裝置自動釋放空間後，需重新下載。資料版本請見「資料與開源」。</p>
 </div></DialogContent></Dialog></>;
}
function ArrowUpdate(){return <span aria-hidden="true">↗</span>;}
