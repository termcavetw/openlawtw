import {articleRange,lawPathRanges} from '../lib/law-chapters.ts';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ALL_CHAPTERS,chapterForArticle,initialLawChapter,lawChapters,visibleLawArticles} from '../lib/law-chapters.ts';
import {lawHistoryEntries} from '../lib/law-history.ts';

const root=new URL('../',import.meta.url),json=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const manifest=await json('data/runtime-manifest.json');
const laws=await Promise.all(Object.values(manifest.laws).map(file=>json('public'+file.url)));
const building=laws.find(law=>law.id==='D0070109'),design=laws.find(law=>law.id==='D0070115');
const buildingChapters=lawChapters(building.articles),designChapters=lawChapters(design.articles);
assert.equal(buildingChapters.length,9);
assert.equal(designChapters.length,18,'Subsections stay inside their chapter; inserted chapter remains distinct.');
const useChapter=chapterForArticle(buildingChapters,'第73條');
assert.match(useChapter.title,/使用管理/);
assert.equal(initialLawChapter(buildingChapters,'第73條','第1條'),useChapter.id,'An explicit deep link wins over the saved reading position.');
assert.equal(initialLawChapter(buildingChapters,'','第73條'),useChapter.id,'Reopening a law resumes the saved article’s chapter.');
assert.equal(initialLawChapter(buildingChapters,'','不存在'),buildingChapters[0].id);
assert(visibleLawArticles(building.articles,buildingChapters,useChapter.id,'').every(article=>useChapter.articles.includes(article)));
assert.deepEqual(visibleLawArticles(building.articles,buildingChapters,ALL_CHAPTERS,''),building.articles);
const target=building.articles.find(article=>article.no==='第 73 條');
assert(visibleLawArticles(building.articles,buildingChapters,buildingChapters[0].id,'第73條').includes(target),'Searching another chapter still finds an explicit article number.');
const descendants=design.articles.filter(article=>article.path[0]===designChapters[1].path[0]);
assert.deepEqual(designChapters[1].articles,descendants);
const ancestry=[{no:'第 1 條',text:'甲',path:['第一編 甲','第一章 通則','第一節 甲']},{no:'第 2 條',text:'乙',path:['第一編 甲','第一章 通則','第二節 乙']},{no:'第 3 條',text:'丙',path:['第二編 乙','第一章 通則']}];
const ancestralChapters=lawChapters(ancestry);
assert.equal(ancestralChapters.length,2,'Same chapter names in different parts do not merge.');
assert.equal(ancestralChapters[0].articles.length,2);

let chapterCount=0,articleCount=0,historyCount=0;
for(const law of laws){
 const chapters=lawChapters(law.articles);
 assert.deepEqual(chapters.flatMap(chapter=>chapter.articles),law.articles,law.id+' chapter partition preserves all original articles and order');
 assert.equal(new Set(chapters.map(chapter=>chapter.id)).size,chapters.length);
 for(const chapter of chapters){
  assert.equal(chapterForArticle(chapters,chapter.articles[0].no)?.id,chapter.id,law.id+' first-article deep link');
  assert.equal(chapterForArticle(chapters,chapter.articles.at(-1).no)?.id,chapter.id,law.id+' last-article deep link');
 }
 if(law.history){
  const entries=lawHistoryEntries(law.history);
  assert.equal(entries.map(entry=>entry.source).join(''),law.history,law.id+' raw history preserved byte-for-byte');
  assert.equal(entries.map(entry=>entry.text).join('').replace(/\s/g,''),law.history.replace(/\s/g,''),law.id+' history reflow never changes numbers, dates, punctuation or wording');
  historyCount++;
 }
 chapterCount+=chapters.length;articleCount+=law.articles.length;
}
const history=laws.find(law=>law.id==='D0070202').history,entries=lawHistoryEntries(history);
assert.equal(entries.length,5,'The reported law has five separate historical records.');
assert(entries[1].text.includes('條條文；並自發布日施行'),'Official hard-wrapped words reflow into a single sentence.');
assert.deepEqual(lawHistoryEntries(''),[]);
assert.equal(lawHistoryEntries('地方政府公告\n第一段\n  1. 附註').length,1,'An indented numbered subitem is not a new history record.');
console.log(JSON.stringify({laws:laws.length,chapters:chapterCount,originalArticles:articleCount,historyTextPreservation:historyCount,deepLinks:'passed',crossChapterSearch:'passed',readingResume:'passed'}));

const numbered=(nos,path=[])=>nos.map(no=>({no,text:'',path}));
assert.equal(articleRange(numbered(['第 7 條','第 8 條','第 14 條'])),'第7–14條');
assert.equal(articleRange(numbered(['第 7-1 條','第 14 條'])),'第7-1條–第14條');
assert.equal(articleRange(numbered(['第 7 條'])),'第7條');assert.equal(articleRange([]),'');
assert.equal(articleRange(numbered(['第 七 點','第 十四 點'])),'第七–十四點');
const nested=[...numbered(['第 7 條','第 7-1 條'],['第二章','第一節']),...numbered(['第 14 條'],['第二章','第二節']),...numbered(['第 15 條'],['第三章','第一節'])];
nested[2].text='（刪除）';const ranges=lawPathRanges(nested);
assert.equal(ranges.get(JSON.stringify(['第二章'])),'第7–14條');assert.equal(ranges.get(JSON.stringify(['第二章','第一節'])),'第7條–第7-1條');assert.equal(ranges.get(JSON.stringify(['第三章','第一節'])),'第15條');
