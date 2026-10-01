"""Lazy, exact-article supplementary diagrams and responsive dismissal regression."""
import functools, http.server, json, shutil, sys, tempfile, threading
from pathlib import Path
from urllib.parse import quote, urlsplit
from playwright.sync_api import sync_playwright, expect

repo = Path(__file__).resolve().parent.parent
output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(tempfile.mkdtemp(prefix='openlaw-supplements-'))
output.mkdir(parents=True, exist_ok=True)
catalog = json.loads((repo / 'data/documents/article-supplements/catalog.json').read_text())
records = {r['article']: r for r in catalog['records']}

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(repo / 'dist')))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = 'http://127.0.0.1:' + str(server.server_port)
reports = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), headless=True, args=['--no-sandbox'])
    for width in [1280, 390, 320]:
        context = browser.new_context(viewport={'width': width, 'height': 900}, has_touch=width < 500)
        page = context.new_page()
        errors, requests, metadata_requests = [], [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: metadata_requests.append(request.url) if '/data/article-supplements/' in request.url else None)
        page.on('request', lambda request: requests.append(request.url) if '/documents/article-supplements/' in request.url else None)
        page.goto(base + '/laws/D0070115.html#a-2', wait_until='load')
        trigger = page.get_by_role('button', name='第 2 條補充圖例', exact=True)
        expect(trigger).to_be_visible(timeout=20000)
        heading = trigger.locator('..')
        header_box = heading.bounding_box()
        assert header_box['height'] <= (78 if width >= 900 else 44), header_box
        child_boxes = heading.locator(':scope > h3, :scope > button').evaluate_all('(els)=>els.map(el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom}})')
        for i, a in enumerate(child_boxes):
            for b in child_boxes[i+1:]:
                assert min(a['right'], b['right']) - max(a['left'], b['left']) <= 1 or min(a['bottom'], b['bottom']) - max(a['top'], b['top']) <= 1, child_boxes
        assert not metadata_requests, 'No view metadata is downloaded before opening'
        assert not requests, 'No figure bytes are requested before opening a control'
        before_url = page.url
        trigger.click()
        dialog = page.get_by_role('dialog', name='第 2 條補充圖例', exact=True)
        expect(dialog).to_be_visible()
        image = dialog.locator('.supp-canvas img')
        expect(image).to_be_visible()
        page.wait_for_function("[...document.querySelectorAll('.supp-canvas img')].every(img=>img.complete&&img.naturalWidth>0)")
        assert len(requests) == 1, requests
        assert len(metadata_requests) == 1, metadata_requests
        assert image.get_attribute('src') == base + records['2']['pages'][0]['src']
        assert dialog.locator('.supp-page-source a').get_attribute('href') == records['2']['source'] + '#page=1'
        assert page.url == before_url, 'Opening a diagram does not change the article route'
        dialog.evaluate('(el)=>Promise.all(el.getAnimations().map(a=>a.finished))')
        geometry = dialog.evaluate('el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth})')
        assert geometry['left'] >= 0 and geometry['right'] <= width and geometry['top'] >= 0 and geometry['bottom'] <= 900, geometry
        assert geometry['scrollWidth'] <= geometry['clientWidth'], geometry
        assert page.evaluate('document.documentElement.scrollWidth') <= width
        page.screenshot(path=str(output / f'figure-{width}.png'))
        dialog.get_by_role('button', name='放大圖例', exact=True).click()
        canvas = dialog.locator('.supp-canvas')
        assert canvas.evaluate('el=>el.scrollWidth>el.clientWidth'), 'Zoom pans inside the figure only'
        canvas.evaluate('el=>{el.scrollLeft=200;el.scrollTop=120}')
        assert canvas.evaluate('el=>el.scrollLeft') > 0
        assert page.evaluate('document.documentElement.scrollWidth') <= width
        page.screenshot(path=str(output / f'zoom-{width}.png'))
        dialog.get_by_role('button', name='符合寬度', exact=True).click()
        assert canvas.evaluate('el=>el.scrollWidth<=el.clientWidth')
        dialog.locator('.supp-source summary').click()
        links = dialog.locator('.supp-source a').evaluate_all('(els)=>els.map(el=>el.href)')
        assert all(file['url'] in links for file in records['2']['alternatives'])
        assert dialog.locator('.supp-source').inner_text().find(records['2']['retrieved'][:10]) >= 0
        # Repeat open/close through Escape, the accessible X, and the visible return button.
        for close_name in [None, '關閉', '關閉圖例，返回條文']:
            # Visible includes the opening zoom animation; measure the final touch target.
            dialog.evaluate('(el)=>Promise.all(el.getAnimations().map(a=>a.finished))')
            if close_name is None: page.keyboard.press('Escape')
            else:
                close = dialog.get_by_role('button', name=close_name, exact=True)
                if width < 500:
                    close_box = close.bounding_box()
                    if close_box['height'] < 44:
                        page.screenshot(path=str(output / f'close-target-failure-{width}.png'))
                    assert close_box['height'] >= 44, {'button': close_name, 'box': close_box}
                    close.tap()
                else: close.click()
            dialog.wait_for(state='detached')
            expect(trigger).to_be_focused()
            assert page.url == before_url
            trigger.click()
            expect(dialog).to_be_visible()
        page.keyboard.press('Escape')
        # All reviewed mappings exist, none are inferred from neighbouring article numbers.
        page.get_by_label('選擇法規章節', exact=True).select_option('all')
        expect(page.locator('.reader .supp-trigger')).to_have_count(24)
        for article, record in records.items():
            section = page.locator('.reader [data-article="' + record['articleNo'] + '"]')
            assert section.locator('.supp-trigger').count() == 1
        for article in ['3', '116-2', '116-3']:
            assert page.locator('.reader [data-article="第 ' + article + ' 條"] .supp-trigger').count() == 0
        table = page.locator('.reader [data-article="第 116-2 條"] .official-article-figure img')
        assert table.count() == 1, 'The existing official legal table is retained'
        # Article 1 has multiple PDF pages and a separately attributed official JPG.
        first_trigger = page.get_by_role('button', name='第 1 條補充圖例', exact=True)
        first_trigger.click()
        first = page.get_by_role('dialog', name='第 1 條補充圖例', exact=True)
        total = len(records['1']['pages']) + len(records['1']['supplementalFiles'])
        for index in range(1, total): first.get_by_role('button', name='下一張圖例', exact=True).click()
        expect(first.locator('.supp-page-source')).to_contain_text('JPG')
        assert first.locator('.supp-canvas img').get_attribute('src') == base + records['1']['supplementalFiles'][0]['src']
        assert first.locator('.supp-page-source a').get_attribute('href') == records['1']['supplementalFiles'][0]['url']
        expect(first.get_by_role('button', name='下一張圖例', exact=True)).to_be_disabled()
        first.get_by_role('button', name='上一張圖例', exact=True).click()
        expect(first.locator('.supp-page-source')).to_contain_text('PDF 第')
        page.keyboard.press('Escape')
        first_trigger.click()
        expect(first.locator('.supp-controls')).to_contain_text('1 / ' + str(total))
        # New navigation while a dialog is open must not keep the old article's image/focus.
        page.evaluate("location.hash='#a-33'")
        first.wait_for(state='detached')
        expect(page.get_by_role('button', name='第 33 條補充圖例', exact=True)).to_be_visible()
        page.go_back()
        expect(page.get_by_role('dialog')).to_have_count(0)
        page.go_forward()
        expect(page.get_by_role('dialog')).to_have_count(0)
        # A failed image has a retry and a usable official source, then successfully recovers.
        page.route('**/documents/article-supplements/**', lambda route: route.abort())
        t33 = page.get_by_role('button', name='第 33 條補充圖例', exact=True)
        t33.click()
        d33 = page.get_by_role('dialog', name='第 33 條補充圖例', exact=True)
        expect(d33.get_by_role('alert')).to_be_visible()
        assert d33.locator('.supp-page-source a').get_attribute('href') == records['33']['source'] + '#page=1'
        page.unroute('**/documents/article-supplements/**')
        d33.get_by_role('button', name='重新載入圖例', exact=True).click()
        page.wait_for_function("[...document.querySelectorAll('.supp-canvas img')].some(img=>img.complete&&img.naturalWidth>0)")
        page.keyboard.press('Escape')
        expect(t33).to_be_focused()
        assert not errors, errors
        reports.append({'width': width, 'lazy': True, 'mapping': 24, 'focusAndClose': True, 'history': True, 'retry': True, 'overflow': geometry})
        context.close()
    # Metadata failure is separate from image failure, with original links and retry.
    context = browser.new_context(viewport={'width': 390, 'height': 900})
    page = context.new_page()
    page.route('**/data/article-supplements/**', lambda route: route.abort())
    page.goto(base + '/laws/D0070115.html#a-33', wait_until='load')
    trigger = page.get_by_role('button', name='第 33 條補充圖例', exact=True)
    trigger.click(timeout=20000)
    dialog = page.get_by_role('dialog', name='第 33 條補充圖例', exact=True)
    expect(dialog.get_by_role('alert')).to_be_visible()
    assert dialog.get_by_role('link', name='第 33 條補充圖例.PDF', exact=True).get_attribute('href') == records['33']['source']
    page.unroute('**/data/article-supplements/**')
    dialog.get_by_role('button', name='重新載入圖例', exact=True).click()
    page.wait_for_function("[...document.querySelectorAll('.supp-canvas img')].some(img=>img.complete&&img.naturalWidth>0)")
    page.keyboard.press('Escape')
    expect(trigger).to_be_focused()
    reports.append({'metadataFailureAndRetry': True})
    context.close()
    # Standalone HTML uses embedded metadata; only optional image bytes need the hosted origin.
    context = browser.new_context(viewport={'width': 390, 'height': 900})
    page = context.new_page()
    metadata_requests = []
    page.on('request', lambda request: metadata_requests.append(request.url) if '/data/article-supplements/' in request.url else None)
    page.route('**/data/article-supplements/**', lambda route: route.abort())
    page.route('https://openlawtw.vercel.app/documents/article-supplements/**', lambda route: route.fulfill(path=str(repo / 'public' / urlsplit(route.request.url).path.lstrip('/'))))
    page.goto((repo / 'openlawtw.html').as_uri() + '#law=D0070115&article=' + quote('第 2 條'), wait_until='load', timeout=120000)
    page.get_by_role('button', name='第 2 條補充圖例', exact=True).click(timeout=120000)
    page.wait_for_function("[...document.querySelectorAll('.supp-canvas img')].some(img=>img.complete&&img.naturalWidth>0)")
    assert not metadata_requests, metadata_requests
    expect(page.locator('.supp-online')).to_be_visible()
    page.screenshot(path=str(output / 'portable-390.png'))
    reports.append({'portableEmbeddedMetadata': True, 'portableImageOrigin': 'https://openlawtw.vercel.app'})
    context.close()
    browser.close()
server.shutdown()
(output / 'report.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2))
print(json.dumps(reports, ensure_ascii=False))
