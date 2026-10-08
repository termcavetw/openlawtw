# Offline fixture-based integration: no visitor data is sent to Vercel.
import json,mimetypes,shutil
from pathlib import Path
from urllib.parse import urlsplit,unquote
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
stub="""(()=>{let filter=e=>e;window.__analytics=[];function view(){let e=filter({type:'pageview',url:location.href});if(e){window.__analytics.push(e);fetch('/_vercel/insights/view',{method:'POST',body:JSON.stringify(e)})}};for(const [k,v] of window.vaq||[])if(k==='beforeSend')filter=v;window.va=(k,v)=>{if(k==='beforeSend')filter=v;};const push=history.pushState.bind(history);history.pushState=(...args)=>{push(...args);view()};window.addEventListener('popstate',view);view()})();"""
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 for origin,portable,online in [('https://openlawtw.vercel.app',False,True),('https://openlawtw-preview.vercel.app',False,True),('http://localhost:4173',False,True),('https://openlawtw.vercel.app',True,True),('https://openlawtw.vercel.app',False,False)]:
  ctx=b.new_context(service_workers='block');page=ctx.new_page();requests=[];errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  if portable:ctx.add_init_script('window.OPENLAWTW_OFFLINE={};')
  if not online:ctx.add_init_script('Object.defineProperty(navigator,"onLine",{configurable:true,get:()=>false});')
  def route(r):
   u=urlsplit(r.request.url)
   if '/_vercel/' in u.path:
    requests.append({'path':u.path,'headers':r.request.all_headers(),'body':r.request.post_data})
    if u.path.endswith('script.js'):r.fulfill(status=200,content_type='text/javascript',body=stub)
    else:r.fulfill(status=200,content_type='application/json',body='{}')
    return
   path=root/'dist'/unquote(u.path.lstrip('/') or 'index.html')
   if path.is_file():r.fulfill(status=200,content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream',body=path.read_bytes())
   else:r.fulfill(status=404,body='not found')
  ctx.route('**/*',route)
  page.goto(origin+'/laws/D0070109.html?q=PRIVATE_SEARCH#view=search&q=PRIVATE_HASH',wait_until='load');page.wait_for_timeout(1600)
  if origin=='https://openlawtw.vercel.app' and not portable and online:
   assert sum(x['path'].endswith('script.js') for x in requests)==1,requests
   assert all('referer' not in x['headers'] for x in requests),requests
   assert page.evaluate('window.__analytics').pop()['url']==origin+'/laws/D0070109.html'
   page.evaluate("history.pushState(null,'','/laws/D0070115.html?case=PRIVATE_CASE#q=PRIVATE_HASH')")
   page.wait_for_timeout(100)
   assert page.evaluate('window.__analytics').pop()['url']==origin+'/laws/D0070115.html'
   assert all('PRIVATE' not in (x['body'] or '') for x in requests)
  else:assert not requests,(origin,portable,online,requests)
  assert not errors,errors
  print(json.dumps({'origin':origin,'portable':portable,'online':online,'analyticsRequests':len(requests),'errors':errors}))
  ctx.close()
 b.close()
print('Browser integration passed with mocked collector; production collection requires deployed endpoint/dashboard verification.')
