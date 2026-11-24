// Reading layout of minutes / 土管 pages: paragraphs re-joined, markers, tables, footers, binding marks.
import assert from 'node:assert/strict';
import {layoutPage,markerLevel} from '../lib/ocr-layout.ts';
const b=layoutPage('桃園市政府建築管理處\nOffice of Building Administration, Taoyuan\n壹、主席致詞\n一、說明：\n1. 依桃園市建築管理自治條例第28條：本法第五十六條規定「建築工\n程」中必須勘驗部分。\n主旨：檢送「加速建照案審查修正意見相關事宜暨疑義會議\n(67)」會議記錄1份，請查照。\n裝\n項 | 建蔽率 | 容積率\n住一 | 60% | 200%\n第1頁，共40頁');
assert.deepEqual(b.map((x)=>x.kind),['p','p','p','p','p','table','meta']);
assert.equal((b[3]).text,'1. 依桃園市建築管理自治條例第28條：本法第五十六條規定「建築工程」中必須勘驗部分。');
assert.equal((b[4]).text,'主旨：檢送「加速建照案審查修正意見相關事宜暨疑義會議(67)」會議記錄1份，請查照。');
assert.deepEqual((b[5]).rows,[['項','建蔽率','容積率'],['住一','60%','200%']]);
assert.equal(markerLevel('(67)」會議'),-1);assert.equal(markerLevel('（一）基地'),2);
console.log('ocr-layout ok');
// A zone name wrapped over two lines with its figures between: merged back into the first column.
const zone=layoutPage('土地使 | 建蔽率 | 容積率\n備註(開發方式)\n用分區 | (%) | (%)\n第一種\n50 | 120 | 依本要點第五點規定辦理\n住宅區\n第二種\n60 | 230 | 市地重劃\n住宅區\n商業區 | 80 | 380 | 市地重劃');
assert.equal(zone.length,1);assert.equal(zone[0].kind,'table');assert.equal(zone[0].warn,true);assert.equal(zone[0].merged,2);
assert.deepEqual(zone[0].rows,[['土地使用分區','建蔽率(%)','容積率(%)','備註(開發方式)'],['第一種住宅區','50','120','依本要點第五點規定辦理'],['第二種住宅區','60','230','市地重劃'],['商業區','80','380','市地重劃']]);
// Rows that still cannot be aligned are shown as raw lines, never as a shifted table.
const loose=layoutPage('項 | 建蔽率 | 容積率\n住一 | 60% | 200%\n50 | 120\n商業區 | 80% | 320%');
assert.equal(loose[0].kind,'raw');assert.deepEqual(loose[0].lines,['項 | 建蔽率 | 容積率','住一 | 60% | 200%','50 | 120','商業區 | 80% | 320%']);
assert.equal(b[5].warn,false);
console.log('table alignment ok');
