"""Fail closed on missing documents or suspicious article loss; write a reviewable diff."""
import json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads(Path(p).read_text())
def compare(before,after):
 errors=[];changes=[]
 for id,old in before.items():
  new=after.get(id)
  if not new:errors.append(old['name']+'：整部資料消失，須人工確認。');continue
  if old['coverage']=='full' and new['coverage']!='full':errors.append(old['name']+'：全文降為連結。')
  if len(old['articles'])>=5 and len(new['articles'])<len(old['articles'])*0.8:errors.append(old['name']+'：條文減少超過 20%。')
  old_text={a['no']:a['text'] for a in old['articles']};new_text={a['no']:a['text'] for a in new['articles']}
  changed=[no for no in dict.fromkeys([*old_text,*new_text]) if old_text.get(no)!=new_text.get(no)]
  if changed:changes.append(old['name']+'：'+ '、'.join(changed))
 for id,new in after.items():
  if id not in before:changes.append('新增 '+new['name']+'（'+new['coverage']+'）')
 return errors,changes
if __name__=='__main__':
 before=read(sys.argv[1]);after=read(ROOT/'public/data/laws.json');report=read(ROOT/'data/sync-report.json');errors,changes=compare(before,after)
 failures=report.get('localFailures',[])
 for f in failures:
  if any(k in f['reason'] for k in ['名稱不符','重複條號','未解析','無法識別','無可識別','無臺北']):errors.append(f['name']+'：解析失敗，保留舊資料並阻擋此次 PR。')
 text='本次同步只提出資料變更，合併前請核對官方原文。觀測日期不代表修法或生效日期。\n\n'
 text+='## 條文變動\n\n'+('\n'.join('- '+v for v in changes) or '- 未觀測到條文變動；可能僅更新來源與擷取資訊。')
 text+='\n\n## 未重新取得的來源\n\n'+('\n'.join('- '+f['name']+'：'+f['reason'] for f in failures) or '- 無。')
 text+='\n\n## 驗證\n\n'+('\n'.join('- '+e for e in errors) if errors else '- 未發現資料消失或大量條文減少；後續建置、全文與 PWA 驗證仍須全部通過。')
 (ROOT/'sync-pr.md').write_text(text+'\n')
 if errors:raise SystemExit('\n'.join(errors))
 print('Sync guard passed; '+str(len(changes))+' changed/new laws; '+str(len(failures))+' retained sources.')
