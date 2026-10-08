import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ANALYTICS_ORIGIN,analyticsEnabled,sanitizeAnalyticsEvent} from '../lib/analytics.ts';

const paths=new Set(['/','/index.html','/laws/index.html','/laws/D0070109.html','/laws/'+encodeURIComponent('內政部-GL000734')+'.html']);
for(const path of paths){
 const event={type:'pageview',url:ANALYTICS_ORIGIN+path+'?q=private-search&case=private-case#view=search&q=secret',extra:'private-note'};
 assert.deepEqual(sanitizeAnalyticsEvent(event,paths),{type:'pageview',url:ANALYTICS_ORIGIN+path});
}
for(const url of ['invalid','file:///private-case.html','https://example.com/','https://openlawtw.vercel.app/private-case','https://openlawtw.vercel.app/laws/private-case.html']){
 assert.equal(sanitizeAnalyticsEvent({type:'pageview',url},paths),null);
}
assert.equal(sanitizeAnalyticsEvent({type:'event',url:ANALYTICS_ORIGIN+'/',name:'search',data:{q:'secret'}},paths),null);
assert.equal(analyticsEnabled(ANALYTICS_ORIGIN,false,true),true);
for(const origin of ['null','http://localhost:5173','http://127.0.0.1:4173','https://openlawtw-preview.vercel.app','http://openlawtw.vercel.app'])assert.equal(analyticsEnabled(origin,false,true),false);
assert.equal(analyticsEnabled(ANALYTICS_ORIGIN,true,true),false);
assert.equal(analyticsEnabled(ANALYTICS_ORIGIN,false,false),false);
const main=await readFile(new URL('../main.tsx',import.meta.url),'utf8');
assert.equal((main.match(/<WebAnalytics\s*\//g)||[]).length,1);
const worker=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
const precache=JSON.parse(worker.match(/const PRECACHE=(\[.*?\]),MANIFEST=/s)[1]);
assert.ok(precache.every(f=>!f.url.includes('/_vercel/')),'Analytics endpoints are not offline assets');
assert.ok(precache.every(f=>!f.url.includes('/analytics-client-')),'Analytics SDK is not part of the offline shell');
for(const path of ['index.html','laws/D0070109.html']){
 const html=await readFile(new URL('../dist/'+path,import.meta.url),'utf8');
 assert.ok(html.includes('<meta name="referrer" content="no-referrer"'),'No query strings in HTTP Referer headers');
}
const embed=await readFile(new URL('../embed.tsx',import.meta.url),'utf8');
assert.ok(!embed.includes('WebAnalytics')&&!embed.includes('@vercel/analytics'),'Third-party embeds remain untracked');
console.log('Analytics: public path allowlist, URL redaction, event blocking, production/portable/offline guards and PWA exclusion passed.');
