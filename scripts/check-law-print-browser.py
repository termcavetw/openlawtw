import http.server,threading,functools,json,shutil,tempfile,sys
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
repo=Path(__file__).resolve().parent.parent
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(tempfile.mkdtemp(prefix='openlawtw-print-qa-'))
root.mkdir(parents=True,exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  if self.path.startswith("/laws/") and not Path(self.translate_path(self.path)).exists():self.path="/index.html"
  super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(repo/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
base='http://127.0.0.1:'+str(server.server_port)
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 for width in [1280,390,320]:
  context=browser.new_context(viewport={'width':width,'height':900},device_scale_factor=1,has_touch=width<500)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(base+'/laws/D0070115.html#a-116-3',wait_until='load')
  target=page.locator('.reader [data-article="第 116-3 條"]')
  target.wait_for(timeout=20000);target.scroll_into_view_if_needed()
  target.get_by_role('button',name='第 116-3 條操作',exact=True).click()
  menu=page.get_by_role('dialog',name='第 116-3 條操作',exact=True)
  assert menu.locator('.article-source-tools a').get_attribute('href').endswith('pcode=D0070115&flno=116-3')
  expect(menu.locator('.article-rulings-trigger')).to_be_enabled()
  menu.evaluate('(el)=>Promise.all(el.getAnimations().map(a=>a.finished))')
  # Measure the open menu, including inherited casebook/copy button styles.
  alignment=menu.evaluate("""el=>[...el.querySelectorAll('button,a')].map(row=>{
   const icon=row.querySelector(':scope > svg:first-child');
   const walker=document.createTreeWalker(row,NodeFilter.SHOW_TEXT);
   let node,label;while(node=walker.nextNode())if(node.textContent.trim()&&!node.parentElement.closest('svg')){const range=document.createRange();range.selectNodeContents(node);label=range.getBoundingClientRect().left;break;}
   const box=row.getBoundingClientRect();return {icon:icon?.getBoundingClientRect().left,label,height:box.height,left:box.left,right:box.right};
  })""")
  assert len(alignment)==6,alignment
  assert max(r['icon'] for r in alignment)-min(r['icon'] for r in alignment)<=1,alignment
  assert max(r['label'] for r in alignment)-min(r['label'] for r in alignment)<=1,alignment
  assert all(r['left']>=0 and r['right']<=width and r['height']>=(44 if width<500 else 38) for r in alignment),alignment
  page.screenshot(path=str(root/f'article-menu-{width}.png'))
  geometry=page.evaluate('''()=>({viewport:innerWidth,root:document.documentElement.scrollWidth,reader:document.querySelector('.reader').getBoundingClientRect().width})''')
  assert geometry['root']<=width,geometry
  page.keyboard.press('Escape')
  page.screenshot(path=str(root/f'reader-{width}.png'))
  target.get_by_role('button',name='第 116-3 條操作',exact=True).click()
  menu.get_by_role('button',name='列印第 116-3 條',exact=True).click()
  dialog=page.get_by_role('dialog',name='友善列印')
  assert dialog.get_by_label('列印範圍',exact=True).input_value()=='article'
  assert dialog.get_by_label('法條',exact=True).input_value()=='第 116-3 條'
  # Phone users need visible, tappable exits; Escape alone does not cover them.
  for name in ['關閉','返回條文']:
   dialog.evaluate('(el)=>Promise.all(el.getAnimations().map(a=>a.finished))')
   close=dialog.get_by_role('button',name=name,exact=True)
   box=close.bounding_box();assert box['width']>=(150 if name=='返回條文' else 44) and box['height']>=44,box
   if width<500:close.tap()
   else:close.click()
   dialog.wait_for(state='detached')
   expect(menu.get_by_role('button',name='列印第 116-3 條',exact=True)).to_be_focused()
   menu.get_by_role('button',name='列印第 116-3 條',exact=True).click()
   expect(dialog).to_be_visible()
  dialog.evaluate('(el)=>Promise.all(el.getAnimations().map(a=>a.finished))');page.screenshot(path=str(root/f'dialog-{width}.png'))
  with page.expect_popup() as info:dialog.get_by_role('button',name='開啟列印預覽').click()
  popup=info.value;popup.on('pageerror',lambda e:print('POPUP ERROR',str(e),flush=True));popup.wait_for_function('!document.querySelector("#print-law").disabled')
  assert popup.locator('.print-article').count()==1
  assert popup.locator('.print-article h2').inner_text()=='第 116-3 條'
  assert popup.evaluate('window.opener===null')
  assert popup.locator('table').count()>0
  assert popup.locator('.print-source').count()==2
  assert popup.evaluate('''()=>[...document.querySelectorAll('.print-table,.print-raw')].every(t=>t.getBoundingClientRect().right<=document.querySelector('main').getBoundingClientRect().right+1)''')
  popup.evaluate('()=>{window.printCount=0;window.print=()=>window.printCount++;}')
  popup.get_by_role('button',name='列印／儲存為 PDF').click();assert popup.evaluate('window.printCount')==1
  if width==1280:
   popup.pdf(path=str(root/'article-116-3.pdf'),prefer_css_page_size=True)
   popup.screenshot(path=str(root/'print-preview.png'),full_page=True)
  popup.close()
  page.keyboard.press('Escape');assert not dialog.is_visible()
  assert menu.get_by_role('button',name='列印第 116-3 條',exact=True).evaluate('(el)=>el===document.activeElement')
  page.keyboard.press('Escape')
  # Search must not trim the selected chapter's print output.
  page.get_by_placeholder('本法規內搜尋／條號').fill('安全維護')
  page.locator('.reader-actions').get_by_role('button',name='列印',exact=True).click()
  assert dialog.get_by_label('列印範圍',exact=True).input_value()=='chapter'
  with page.expect_popup() as info:dialog.get_by_role('button',name='開啟列印預覽').click()
  popup=info.value;popup.on('pageerror',lambda e:print('POPUP ERROR',str(e),flush=True));popup.wait_for_function('!document.querySelector("#print-law").disabled')
  chapter_count=popup.locator('.print-article').count();assert chapter_count>1
  popup.close()
  if width==1280:
   dialog.get_by_label('列印範圍',exact=True).select_option('law')
   dialog.get_by_label('紙張方向',exact=True).select_option('landscape')
   with page.expect_popup() as info:dialog.get_by_role('button',name='開啟列印預覽').click()
   popup=info.value;popup.on('pageerror',lambda e:print('POPUP ERROR',str(e),flush=True));popup.wait_for_function('!document.querySelector("#print-law").disabled')
   laws=json.loads((repo/'public/data/laws.json').read_text())
   assert popup.locator('.print-article').count()==len(laws['D0070115']['articles'])
   assert popup.evaluate('''()=>[...document.querySelectorAll('.print-table,.print-raw')].every(t=>t.getBoundingClientRect().right<=document.querySelector('main').getBoundingClientRect().right+1)''')
   popup.pdf(path=str(root/'full-law-landscape.pdf'),prefer_css_page_size=True)
   popup.close()
  page.keyboard.press('Escape')
  page.get_by_placeholder('本法規內搜尋／條號').fill('')
  # New previews use only already-loaded data, including when offline.
  page.locator('.reader-actions').get_by_role('button',name='列印',exact=True).click()
  context.set_offline(True)
  with page.expect_popup() as info:dialog.get_by_role('button',name='開啟列印預覽').click()
  popup=info.value;popup.wait_for_function('!document.querySelector("#print-law").disabled')
  assert popup.locator('.print-article').count()==chapter_count
  popup.close();context.set_offline(False)
  page.evaluate('()=>{window.originalOpen=window.open;window.open=()=>null;}')
  dialog.get_by_role('button',name='開啟列印預覽').click()
  assert dialog.get_by_role('alert').inner_text().startswith('預覽視窗未能開啟')
  page.evaluate('()=>{window.open=window.originalOpen;}')
  page.keyboard.press('Escape')
  page.get_by_role('button',name='更多法規操作').click()
  assert page.get_by_role('menuitem',name='複製連結').is_visible()
  page.keyboard.press('Escape')
  page.goto(base+'/laws/D0070115.html#a-116-1',wait_until='load')
  short=page.locator('.reader [data-article="第 116-1 條"]');short.wait_for()
  assert short.locator('.article-heading button').count()==1
  heading_height=short.locator('.article-heading').bounding_box()['height']
  assert heading_height<=40,heading_height
  if width==1280:
   short.get_by_role('button',name='第 116-1 條操作',exact=True).click()
   actions=page.get_by_role('dialog',name='第 116-1 條操作',exact=True)
   actions.get_by_role('button',name='將建築技術規則建築設計施工編 第 116-1 條加入案件',exact=True).click()
   capture=page.get_by_role('dialog',name='加入案件引用',exact=True)
   capture.get_by_role('textbox',name='引用註記',exact=True).fill('介面測試，未儲存')
   capture.get_by_role('button',name='關閉加入案件',exact=True).click();capture.wait_for(state='detached')
   if not actions.is_visible():short.get_by_role('button',name='第 116-1 條操作',exact=True).click()
   actions.get_by_role('button',name='分享或嵌入建築技術規則建築設計施工編 第 116-1 條',exact=True).click()
   share=page.get_by_role('dialog',name='讓每一份引用，都找得到依據',exact=True)
   share.wait_for();share.get_by_role('button',name='關閉',exact=True).click();share.wait_for(state='detached')
   if actions.is_visible():page.keyboard.press('Escape')
  short.scroll_into_view_if_needed()
  page.screenshot(path=str(root/f'compact-article-{width}.png'))
  missing=page.locator('.reader [data-article="第 116-2 條"]')
  figure=missing.locator('.official-article-figure img');figure.wait_for()
  assert figure.evaluate('(img)=>img.complete&&img.naturalWidth===1079&&img.naturalHeight===1651')
  missing.scroll_into_view_if_needed()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  if width<500:
   region=missing.locator('.official-figure-scroll')
   assert region.evaluate('(el)=>el.scrollWidth>el.clientWidth')
   region.evaluate('(el)=>el.scrollLeft=el.scrollWidth')
   assert region.evaluate('(el)=>el.scrollLeft>0')
   region.evaluate('(el)=>el.scrollLeft=0')
  page.screenshot(path=str(root/f'official-table-{width}.png'))
  missing.get_by_role('button',name='第 116-2 條操作',exact=True).click()
  actions=page.get_by_role('dialog',name='第 116-2 條操作',exact=True)
  actions.get_by_role('button',name='列印第 116-2 條',exact=True).click()
  dialog=page.get_by_role('dialog',name='友善列印')
  context.set_offline(True)
  with page.expect_popup() as info:dialog.get_by_role('button',name='開啟列印預覽').click()
  popup=info.value;popup.wait_for_function('!document.querySelector("#print-law").disabled')
  assert popup.locator('.print-official-figure img').evaluate('(img)=>img.complete&&img.naturalWidth===1079')
  if width==1280:popup.pdf(path=str(root/'article-116-2.pdf'),prefer_css_page_size=True)

  # The preview itself must provide an exit in standalone/PWA windows.
  with popup.expect_event('close'):popup.get_by_role('link',name='返回條文',exact=True).click()
  dialog.wait_for(state='detached');context.set_offline(False)
  if actions.is_visible():page.keyboard.press('Escape')
  missing.get_by_role('button',name='第 116-2 條操作',exact=True).click()
  actions.get_by_role('button',name='列印第 116-2 條',exact=True).click()
  with page.expect_popup() as info:dialog.get_by_role('button',name='開啟列印預覽').click()
  popup=info.value;popup.wait_for_function('!document.querySelector("#print-law").disabled')
  # Simulate a standalone browser refusing window.close().
  popup.evaluate('()=>{window.close=()=>{};}')
  return_url=page.url
  popup.get_by_role('link',name='返回條文',exact=True).click()
  popup.wait_for_url(return_url)
  popup.locator('.reader [data-article="第 116-2 條"]').wait_for(timeout=20000)
  dialog.wait_for(state='detached');popup.close()
  assert not errors,errors
  results.append({'width':width,'geometry':geometry,'menuAlignment':alignment,'chapterArticles':chapter_count,'errors':errors})
  print(json.dumps(results[-1],ensure_ascii=False),flush=True)
  context.close()
 # Unsupported source shows its official full-page fallback explicitly.
 context=browser.new_context(viewport={'width':390,'height':900})
 page=context.new_page()
 page.goto(base+'/laws/臺北市-FL038035.html#a-3',wait_until='load')
 target=page.locator('.reader [data-article="第 3 條"]');target.wait_for(timeout=20000)
 target.get_by_role('button',name='第 3 條操作',exact=True).click()
 menu=page.get_by_role('dialog',name='第 3 條操作',exact=True)
 assert menu.locator('.article-source-tools a').inner_text()=='官方全文'
 assert menu.locator('.article-source-tools a').get_attribute('href')=='https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL038035'
 page.goto(base+'/laws/內政部-GL000734.html',wait_until='load')
 page.locator('.reader-actions').get_by_role('button',name='列印',exact=True).click(timeout=20000)
 dialog=page.get_by_role('dialog',name='友善列印')
 assert dialog.get_by_role('link',name='開啟官方原檔').is_visible()
 assert dialog.get_by_role('combobox').count()==0
 context.close()
 browser.close()
server.shutdown()
print('Browser artifacts:',root)
(root/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
