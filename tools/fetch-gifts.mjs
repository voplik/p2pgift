// Downloads Telegram collectible gifts (t.me/nft/<Slug>-<num>) into ./gifts:
// the Lottie animation (unpacked from .tgs), the backdrop pattern symbol, colours and attributes.
// Usage: node tools/fetch-gifts.mjs ResistanceDog-5 LolPop-1 ...
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const OUT = new URL('../gifts/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const indexFile = new URL('index.json', OUT);
const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : {};

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const pick = (re, s) => (s.match(re) || [])[1];
const attr = (name, s) => {
  const m = s.match(new RegExp(`<th>${name}</th><td>([\\s\\S]*?)</td>`));
  if (!m) return null;
  const rarity = pick(/<mark>([^<]+)<\/mark>/, m[1]);
  const value = decode(m[1].replace(/<mark>[\s\S]*?<\/mark>/, '').replace(/<[^>]+>/g, '').trim());
  return { value, rarity };
};
const get = async (url) => {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
};

for (const slug of process.argv.slice(2)) {
  const html = await (await get(`https://t.me/nft/${slug}`)).text();
  const title = decode(pick(/<meta property="og:title" content="([^"]+)"/, html) || '');
  const tgs = decode(pick(/srcset="(https:[^"]+sticker\.tgs[^"]*)"/, html) || '');
  if (!title || !tgs) { console.warn(`skip ${slug}: not a collectible page`); continue; }

  const [name, num] = [title.replace(/\s*#\d+$/, ''), pick(/#(\d+)$/, title)];
  const [center, edge] = [...html.matchAll(/stop-color="([^"]+)"/g)].map((m) => m[1]);
  const patternColor = pick(/flood-color="([^"]+)"/, html);
  const symbolUrl = decode(pick(/id="giftPattern"[^>]*xlink:href="([^"]+)"/, html) || '');
  const preview = decode(pick(/<meta property="og:image" content="([^"]+)"/, html) || '');

  // .tgs is gzipped Lottie JSON
  const lottie = gunzipSync(Buffer.from(await (await get(tgs)).arrayBuffer()));
  writeFileSync(new URL(`${slug}.json`, OUT), lottie);

  let symbol = null;
  if (symbolUrl) {
    const r = await get(symbolUrl);
    const type = r.headers.get('content-type') || '';
    const ext = type.includes('svg') ? 'svg' : type.includes('png') ? 'png' : 'webp';
    symbol = `${slug}-symbol.${ext}`;
    writeFileSync(new URL(symbol, OUT), Buffer.from(await r.arrayBuffer()));
  }
  if (preview) writeFileSync(new URL(`${slug}.jpg`, OUT), Buffer.from(await (await get(preview)).arrayBuffer()));

  index[slug] = {
    slug, name, num,
    model: attr('Model', html), backdrop: attr('Backdrop', html), symbol: attr('Symbol', html),
    quantity: attr('Quantity', html)?.value || null,
    colors: { center, edge, pattern: patternColor },
    files: { lottie: `${slug}.json`, symbol, preview: preview ? `${slug}.jpg` : null },
  };
  console.log(`✓ ${title} — ${index[slug].model?.value} / ${index[slug].backdrop?.value} / ${index[slug].symbol?.value}  (${(lottie.length / 1024).toFixed(0)} KB)`);
}
writeFileSync(indexFile, JSON.stringify(index, null, 2));
