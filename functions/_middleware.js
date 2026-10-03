// foopack.tiremanager-foo.com で、新しい会社HPの f.o.oパック紹介ページをそのまま見せる中継（向畑 2026/10/3「新HPを公表する前に f.o.oパックのページを公表したい」）
//
// ・中身は新HP（Cloudflare Pages の foo-hp）の /foopack/ をその場で取ってくる＝新HPを `node deploy.mjs` で出せば、ここも同じになる（ここは直さなくてよい）
// ・ページの中の「会社情報」「お知らせ」などのリンクは、新HPの公表までは今の会社HP（さくらの旧HP）へ向け直す（準備中の新HPを見せない）
// ・専用の住所では検索に載せる（正規の住所＝ https://foopack.tiremanager-foo.com/ ）
// ・新HPに切り替えたら SWITCHED を true にして push する → どのアドレスも tiremanager-foo.com/foopack/ へ 301 で移る（配ったリンク・QRはそのまま使える）
const SWITCHED = false;

const SELF = 'https://foopack.tiremanager-foo.com';
const OLD_HP = 'https://tiremanager-foo.com';
const NEW_HP = 'https://foo-hp.pages.dev';                        // 新HPの本番
const NEW_HP_DRAFT = 'https://foopack-draft.foo-hp.pages.dev';    // 新HPの確認用（この中継の確認用の住所 *.foo-pack.pages.dev ではこちらを見せる）

// 新HPから中継してよいもの（ページの部品・プライバシーポリシー・利用規約）。これ以外は今の会社HPへ移す
const PASS = [
  /^\/foopack\/.+/, /^\/style\.css$/, /^\/script\.js$/, /^\/img\//, /^\/logos\//,
  /^\/favicon-(16|32)\.png$/, /^\/apple-touch-icon\.png$/, /^\/icon-(192|512)\.png$/, /^\/manifest\.json$/,
  /^\/og-image\.(jpg|png)$/, /^\/privacy\/?$/, /^\/terms\/?$/,
];
// ページの中のリンクの向け先（新HPの公表まで）
const LINKS = {
  '/': OLD_HP + '/',
  '/#pillars': OLD_HP + '/',
  '/#locations': OLD_HP + '/company.php',
  '/company/': OLD_HP + '/company.php',
  '/news/': OLD_HP + '/',                    // 旧HPのお知らせ（新着情報）はトップにある
  '/#contact': SELF + '/#contact',           // お問い合わせは f.o.oパックのページのフォームへ
  'https://tiremanager-foo.com/foopack/': SELF + '/',
};

function originFor(host) {
  return (host === 'foopack.tiremanager-foo.com' || host === 'foo-pack.pages.dev') ? NEW_HP : NEW_HP_DRAFT;
}

class Href {
  element(el) {
    const h = el.getAttribute('href');
    if (h == null) return;
    if (Object.prototype.hasOwnProperty.call(LINKS, h)) { el.setAttribute('href', LINKS[h]); return; }
    // 中継しない新HPのページへのリンク（/recruit/ など今後増えたもの）は今の会社HPのトップへ
    if (h.startsWith('/') && !h.startsWith('//') && !PASS.some(re => re.test(h.split(/[?#]/)[0]))) el.setAttribute('href', OLD_HP + '/');
  }
}
class Attr {
  constructor(name, value) { this.name = name; this.value = value; }
  element(el) { el.setAttribute(this.name, this.value); }
}
// 構造化データ（JSON-LD）の中の住所を書き換える（文字が細切れで届くので、ためてから1回で入れ直す）
class JsonLd {
  constructor() { this.buf = ''; }
  text(t) {
    this.buf += t.text;
    t.remove();
    if (t.lastInTextNode) {
      t.after(this.buf.split('https://tiremanager-foo.com/foopack/').join(SELF + '/'), { html: true });
      this.buf = '';
    }
  }
}

async function fetchOrigin(origin, path, request, conditional = true) {
  const headers = { 'Accept': request.headers.get('Accept') || '*/*' };
  // 紹介動画（/foopack/video/）は「途中から読む」要求（Range）で読まれる＝そのまま渡し、206 もそのまま返す（iPhone の Safari は 206 が無いと再生しない）
  // 書き換えて出すもの（ページ本体・manifest）には conditional=false＝「前と同じなら送らない」(304) を渡さない
  for (const k of conditional ? ['Range', 'If-Range', 'If-None-Match', 'If-Modified-Since'] : []) { const v = request.headers.get(k); if (v) headers[k] = v; }
  return fetch(origin + path, {
    method: request.method === 'HEAD' ? 'HEAD' : 'GET',
    headers,
    redirect: 'manual',
  });
}

function rewritePage(res, isFoopack) {
  let rw = new HTMLRewriter().on('a[href]', new Href());
  if (isFoopack) {
    rw = rw
      .on('link[rel="canonical"]', new Attr('href', SELF + '/'))
      .on('meta[property="og:url"]', new Attr('content', SELF + '/'))
      .on('meta[property="og:image"]', new Attr('content', SELF + '/og-image.jpg'))
      .on('meta[name="twitter:image"]', new Attr('content', SELF + '/og-image.jpg'))
      .on('script[type="application/ld+json"]', new JsonLd());
  }
  const h = new Headers(res.headers);
  h.delete('content-length'); h.delete('x-robots-tag'); h.delete('etag'); h.delete('last-modified');   // 書き換えた中身なので、元の目印は付けない
  h.set('cache-control', 'public, max-age=0, must-revalidate');
  return rw.transform(new Response(res.body, { status: res.status, headers: h }));
}

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (SWITCHED) {
    const to = (path === '/' || path.startsWith('/foopack')) ? '/foopack/' : path;
    return Response.redirect(OLD_HP + to + url.search + url.hash, 301);
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 });

  const origin = originFor(url.hostname);

  // 住所は1つに（/foopack/ で来たら / へ）
  if (path === '/foopack' || path === '/foopack/' || path === '/foopack/index.html' || path === '/index.html') {
    return Response.redirect(url.origin + '/' + url.search, 301);
  }
  if (path === '/robots.txt') {
    return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${SELF}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  if (path === '/sitemap.xml') {
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SELF}/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>\n</urlset>\n`, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
  }
  // f.o.oパックのページ本体
  if (path === '/') {
    const res = await fetchOrigin(origin, '/foopack/' + url.search, request, false);
    if (res.status !== 200) return new Response('ただいま表示できません。時間をおいてもう一度お試しください。', { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    return rewritePage(res, true);
  }
  // ホーム画面に追加したときの設定は、この住所の / を開くように
  if (path === '/foopack/manifest.json') {
    const res = await fetchOrigin(origin, path, request, false);
    if (res.status !== 200) return res;
    const j = await res.json();
    j.id = '/'; j.start_url = '/'; j.scope = '/';
    return new Response(JSON.stringify(j, null, 2), { headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' } });
  }
  if (PASS.some(re => re.test(path))) {
    const res = await fetchOrigin(origin, path + url.search, request);
    if (res.status >= 300 && res.status < 400) {
      // 新HP側の転送（/privacy → /privacy/ など）はこの住所のまま
      const loc = res.headers.get('location') || '/';
      const u = new URL(loc, origin);
      return Response.redirect(url.origin + u.pathname + u.search, res.status === 301 || res.status === 308 ? 301 : 302);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/html')) return rewritePage(res, false);
    const h = new Headers(res.headers); h.delete('x-robots-tag');
    return new Response(res.body, { status: res.status, headers: h });
  }
  // それ以外（新HPのトップ・会社情報など）は、新HPの公表まで今の会社HPへ
  return Response.redirect(OLD_HP + '/', 302);
}
