"""Temporary read-only connectivity probe. No retries, credentials or TLS changes."""
import json, os, platform, subprocess, sys, time, urllib.error, urllib.request
URLS = [
 'https://law.tycg.gov.tw/LawContent.aspx?id=GL001431',
 'https://law01.tainan.gov.tw/glrsnewsout/LawContent.aspx?id=GL000154',
 'https://hclaw.hsinchu.gov.tw/law/LawContent.aspx?id=FL026964',
]
if len(sys.argv)>1:
 url=sys.argv[1];start=time.monotonic()
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'OpenLawTW/official-source-snapshot'}),timeout=12) as r:
   sample=r.read(2048)
   result={'url':url,'status':r.status,'finalUrl':r.url,'contentType':r.headers.get('Content-Type'),'sampleBytes':len(sample),'result':'reachable'}
 except urllib.error.HTTPError as e:
  result={'url':url,'status':e.code,'result':'http-denial' if e.code in (401,403) else 'http-error','error':str(e)}
 except Exception as e:
  result={'url':url,'result':'tls-error' if 'CERTIFICATE_VERIFY_FAILED' in str(e) else 'connection-error','error':type(e).__name__+': '+str(e)}
 result['elapsedSeconds']=round(time.monotonic()-start,2);print(json.dumps(result));sys.exit()
results=[]
for url in URLS:
 try:
  r=subprocess.run([sys.executable,__file__,url],capture_output=True,text=True,timeout=20)
  result=json.loads(r.stdout) if r.returncode==0 else {'url':url,'result':'probe-error','error':r.stderr[-500:]}
 except subprocess.TimeoutExpired:
  result={'url':url,'result':'wall-timeout','elapsedSeconds':20}
 results.append(result);print(json.dumps(result),flush=True)
report={'os':platform.system(),'runner':os.environ.get('RUNNER_OS'),'sha':os.environ.get('GITHUB_SHA'),'results':results,'security':'Default TLS verification, unchanged standard user-agent, no retries or credentials.'}
with open('connectivity-report.json','w',encoding='utf-8') as f:json.dump(report,f,indent=2)
