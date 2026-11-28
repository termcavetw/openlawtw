// 常用大表的結構化資料 (data/structured-tables/<id>.json, hand-checked against the official text) → public/data/tables/.
// Each table records the hash of the article text or attachment it was taken from; when the current source no longer
// matches, the published copy and manifest.tables say stale: true so readers fall back to the official text.
import {readFile,writeFile,mkdir,rm,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from './paths.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');

async function currentHash(root, laws, table, source) {
  if (source.kind === 'article') {
    const law = laws[table.law];
    const art = law && law.articles.find(a => a.no.replace(/\s/g, '') === source.article.replace(/\s/g, ''));
    return art ? sha(art.text) : null;
  }
  if (source.kind === 'attachment') {
    try {
      const d = JSON.parse(await readFile(join(root, 'public/data/attachments', table.law + '.json'), 'utf8'));
      const a = d.attachments.find(x => x.url === source.url);
      return a ? a.sha256 : null;
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  return null;
}

export async function structuredTables(root, laws) {
  let files;
  try { files = (await readdir(join(root, 'data/structured-tables'))).filter(f => f.endsWith('.json')).sort(); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const out = join(root, 'public/data/tables');
  await rm(out, {recursive: true, force: true});
  await mkdir(out, {recursive: true});
  const tables = {};
  for (const file of files) {
    const t = JSON.parse(await readFile(join(root, 'data/structured-tables', file), 'utf8'));
    const sources = [t.source, t.source.table].filter(Boolean);
    const checks = [];
    for (const s of sources) {
      const now = await currentHash(root, laws, t, s);
      checks.push({kind: s.kind, article: s.article, url: s.url, recorded: s.sha256, current: now, matches: now === s.sha256});
    }
    const stale = checks.some(c => !c.matches);
    const law = laws[t.law] || {};
    const published = {...t, stale, sourceCheck: checks, lawModifiedNow: law.modified || null};
    const body = JSON.stringify(published) + '\n';
    await writeFile(join(out, file), body);
    tables[t.id] = {title: t.title, law: t.law, lawName: t.lawName, url: '/data/tables/' + encodeURIComponent(file), sha256: sha(body),
      bytes: Buffer.byteLength(body), rows: t.rows.length, stale, source: t.source.kind === 'article' ? t.source.article : t.source.title};
  }
  const index = {schemaVersion: 1, tables};
  await writeFile(join(out, 'index.json'), JSON.stringify(index, null, 1) + '\n');
  return {schemaVersion: 1, index: '/data/tables/index.json', tables};
}
