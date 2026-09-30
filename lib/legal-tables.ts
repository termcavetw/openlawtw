/** Lossless splitting and conservative geometric parsing of official plain-text tables.
 * Source offsets are UTF-16 offsets, matching String.slice and the search renderer.
 * No missing borders or legal values are repaired or inferred.
 */
export interface LegalTextFragment { text: string; start: number; end: number }
export interface LegalTableCell {
  text: string; row: number; column: number; rowSpan: number; colSpan: number;
  fragments: LegalTextFragment[];
}
export interface ParsedLegalTable {
  rows: LegalTableCell[][]; columnCount: number; columnWidths: number[];
}
export type LegalTextBlock = LegalTextFragment & (
  { kind: 'text' } | { kind: 'table'; table: ParsedLegalTable | null }
);
const BOX = /[\u2500-\u257f]/u;
const directions: Record<string, string> = {
  '─': 'LR', '│': 'UD', '┌': 'RD', '┐': 'LD', '└': 'RU', '┘': 'LU',
  '├': 'URD', '┤': 'ULD', '┬': 'LRD', '┴': 'LRU', '┼': 'LRUD',
};
/** Official tables use full-width box glyphs, CJK and ambiguous punctuation. */
export function legalCharacterWidth(character: string): number {
  const point = character.codePointAt(0) ?? 0;
  if (point === 9) return 4;
  if (point < 0x7f || point === 0xa0) return 1;
  if (/\p{Mark}/u.test(character)) return 0;
  return 2;
}
interface Glyph { char: string; x: number; width: number; start: number; end: number }
interface Line { text: string; start: number; end: number; glyphs: Glyph[] }
function sourceLines(text: string, offset = 0): Line[] {
  const result: Line[] = [];
  const expression = /[^\r\n]*(?:\r\n|\r|\n|$)/g;
  for (const match of text.matchAll(expression)) {
    if (!match[0]) continue;
    const content = match[0].replace(/[\r\n]+$/, '');
    let x = 0, index = offset + match.index!;
    const glyphs: Glyph[] = [];
    for (const char of content) {
      const width = legalCharacterWidth(char);
      glyphs.push({ char, x, width, start: index, end: index + char.length });
      index += char.length; x += width;
    }
    result.push({ text: content, start: offset + match.index!, end: offset + match.index! + match[0].length, glyphs });
  }
  return result;
}
function parseTable(text: string, offset: number): ParsedLegalTable | null {
  const lines = sourceLines(text, offset).filter(line => line.text.trim());
  if (lines.length < 3 || lines.some(line => /\t/.test(line.text))) return null;
  if (lines.some(line => line.glyphs.some(g => BOX.test(g.char) && !directions[g.char]))) return null;
  const at = lines.map(line => new Map(line.glyphs.map(g => [g.x, g.char])));
  const xs = [...new Set(lines.flatMap(line => line.glyphs.filter(g => /[UD]/.test(directions[g.char] ?? '')).map(g => g.x)))].sort((a,b) => a-b);
  const ys = lines.flatMap((line, y) => line.glyphs.some(g => g.char === '─') ? [y] : []);
  if (xs.length < 2 || ys.length < 2 || ys[0] !== 0 || ys.at(-1) !== lines.length - 1) return null;
  const left = xs[0], right = xs.at(-1)!;
  if (lines.some(line => line.glyphs.some(g => (g.x < left || g.x > right) && g.char.trim()))) return null;
  const has = (y: number, x: number, direction: string) => (directions[at[y].get(x) ?? ''] ?? '').includes(direction);
  // 1: complete border, 0: no border, -1: damaged/ambiguous border.
  function horizontal(y: number, a: number, b: number): number {
    const interior = lines[y].glyphs.filter(g => g.x > a && g.x < b);
    const border = has(y,a,'R') && has(y,b,'L') && interior.length > 0 &&
      interior.every(g => has(y,g.x,'L') && has(y,g.x,'R')) &&
      interior[0].x === a+2 && interior.at(-1)!.x+2 === b;
    if (border) return 1;
    if (has(y,a,'R') || has(y,b,'L') || interior.some(g => BOX.test(g.char))) return -1;
    return 0;
  }
  function vertical(x: number, a: number, b: number): number {
    if (b-a < 2) return -1;
    const values = Array.from({length:b-a-1}, (_,i) => at[a+i+1].get(x));
    if (has(a,x,'D') && has(b,x,'U') && values.every(c => c === '│')) return 1;
    if (has(a,x,'D') || has(b,x,'U') || values.some(c => c && BOX.test(c))) return -1;
    return 0;
  }
  const columns = xs.length-1, rows = ys.length-1;
  if (columns*rows > 20000) return null;
  const parents = Array.from({length:columns*rows}, (_,i) => i);
  const find = (n: number): number => { while (parents[n] !== n) { parents[n] = parents[parents[n]]; n=parents[n]; } return n; };
  const union = (a: number,b: number) => { parents[find(b)] = find(a); };
  for (let r=0;r<=rows;r++) for (let c=0;c<columns;c++) {
    const wall = horizontal(ys[r],xs[c],xs[c+1]);
    if (wall < 0 || ((r===0 || r===rows) && wall!==1)) return null;
    if (!wall) union((r-1)*columns+c,r*columns+c);
  }
  for (let r=0;r<rows;r++) for (let c=0;c<=columns;c++) {
    const wall = vertical(xs[c],ys[r],ys[r+1]);
    if (wall < 0 || ((c===0 || c===columns) && wall!==1)) return null;
    if (!wall) union(r*columns+c-1,r*columns+c);
  }
  const groups = new Map<number, number[]>();
  for (let n=0;n<parents.length;n++) { const root=find(n); const group=groups.get(root) ?? []; group.push(n); groups.set(root,group); }
  const output: LegalTableCell[][] = Array.from({length:rows}, () => []);
  for (const group of groups.values()) {
    const rs=group.map(n => Math.floor(n/columns)), cs=group.map(n => n%columns);
    const r=Math.min(...rs), c=Math.min(...cs), bottom=Math.max(...rs)+1, end=Math.max(...cs)+1;
    if (group.length !== (bottom-r)*(end-c)) return null;
    const fragments: LegalTextFragment[]=[];
    for (let y=ys[r]+1;y<ys[bottom];y++) {
      const glyphs=lines[y].glyphs.filter(g => g.x >= xs[c]+2 && g.x < xs[end]);
      if (glyphs.some(g => BOX.test(g.char) || g.x+g.width>xs[end])) return null;
      if (glyphs.length) {
        const start=glyphs[0].start, finish=glyphs.at(-1)!.end;
        fragments.push({text:text.slice(start-offset,finish-offset),start,end:finish});
      }
    }
    output[r].push({text:fragments.map(f=>f.text).join('\n'),row:r,column:c,rowSpan:bottom-r,colSpan:end-c,fragments});
  }
  output.forEach(row => row.sort((a,b)=>a.column-b.column));
  return {rows:output,columnCount:columns,columnWidths:xs.slice(1).map((x,i)=>x-xs[i])};
}
/** Every block is an exact contiguous source slice, including original line endings. */
export function splitLegalText(text: string): LegalTextBlock[] {
  if (!text) return [];
  if (!BOX.test(text)) return [{kind:'text',start:0,end:text.length,text}];
  const lines=sourceLines(text), blocks: LegalTextBlock[]=[];
  let cursor=0;
  for (let i=0;i<lines.length;i++) {
    if (!BOX.test(lines[i].text)) continue;
    // Formula numerators/denominators and diagram labels may have no box glyphs.
    // Keep adjacent indented notation together, but stop at prose/definitions.
    const diagram = !/^\s*┌/.test(lines[i].text);
    const notation = (line: Line) => /^\s+\S/.test(line.text) &&
      line.text.trim().length <= 80 && !/[。；：，、:;]/u.test(line.text);
    let first=i;
    if (diagram) while (first>0 && lines[first-1].start>=cursor && notation(lines[first-1])) first--;
    let last=i;
    while (i+1<lines.length) {
      // A complete bottom border ends this table, even if another follows directly.
      if (/^\s*└[─┴]+┘\s*$/.test(lines[i].text)) break;
      if (BOX.test(lines[i+1].text) || (diagram && notation(lines[i+1]))) { i++; last=i; continue; }
      if (!lines[i+1].text.trim() && lines.slice(i+1).find(line=>line.text.trim())?.text.match(BOX)) { i++; continue; }
      break;
    }
    i=last;
    const start=lines[first].start, end=lines[last].end;
    if (start>cursor) blocks.push({kind:'text',start:cursor,end:start,text:text.slice(cursor,start)});
    const raw=text.slice(start,end);
    blocks.push({kind:'table',start,end,text:raw,table:parseTable(raw,start)});
    cursor=end;
  }
  if (cursor<text.length) blocks.push({kind:'text',start:cursor,end:text.length,text:text.slice(cursor)});
  return blocks;
}
