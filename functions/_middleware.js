// foopack.tiremanager-foo.com で、新しい会社HPの f.o.oパック紹介ページをそのまま見せる中継（向畑 2026/10/3「新HPを公表する前に f.o.oパックのページを公表したい」）
//
// ・中身は新HP（Cloudflare Pages の foo-hp）の /foopack/ をその場で取ってくる＝新HPを `node deploy.mjs` で出せば、ここも同じになる（ここは直さなくてよい）
// ・新HPの公表までは、f.o.oパックのページだけで完結させる＝上のメニューはページの中の欄へ、ほかのページへは飛ばさない（下の LINKS・pageNav）
// ・専用の住所では検索に載せる（正規の住所＝ https://foopack.tiremanager-foo.com/ ）
// ・新HPに切り替えたら SWITCHED を true にして push する → どのアドレスも tiremanager-foo.com/foopack/ へ 301 で移る（配ったリンク・QRはそのまま使える）
const SWITCHED = true;   // 2026/10/8 新HPを本番に切り替え（向畑「www で切り替えて」）

const SELF = 'https://foopack.tiremanager-foo.com';
const OLD_HP = 'https://www.tiremanager-foo.com';   // 切り替え後の会社HP（www 付き・2026/10/8）。転送の行き先
const NEW_HP = 'https://foo-hp.pages.dev';                        // 新HPの本番
const NEW_HP_DRAFT = 'https://foopack-draft.foo-hp.pages.dev';    // 新HPの確認用（この中継の確認用の住所 *.foo-pack.pages.dev ではこちらを見せる）
const NEW_HP_PUBLIC = 'https://preview.tiremanager-foo.com';      // 新HPの本番を会社の住所で（見た目・スクリプト・画像・動画はここから直接読ませる）
// 2026/10/3 向畑さんの画面で style.css が効かず崩れて見えた（再現せず＝中継が取り損ねた一瞬と見ている）。
// 中継を通すのはページ本体だけにして、部品はブラウザが新HPから直接読むようにした。取り損ねたら1回取り直し、だめなら新HPへ回す

// 新HPから中継してよいもの（ページの部品・プライバシーポリシー・利用規約）。これ以外は今の会社HPへ移す
const PASS = [
  /^\/foopack\/.+/, /^\/style\.css$/, /^\/script\.js$/, /^\/img\//, /^\/logos\//,
  /^\/favicon-(16|32)\.png$/, /^\/apple-touch-icon\.png$/, /^\/icon-(192|512)\.png$/, /^\/manifest\.json$/,
  /^\/og-image\.(jpg|png)$/, /^\/privacy\/?$/, /^\/terms\/?$/,
];
// ほかのページへ飛ばない（向畑 2026/10/3「旧HPとのバランスが悪すぎるから、fooパック紹介ページだけにしよう。ほかのページに飛ばないように。まだ新HPは出来そうにない」）
// ＝上のメニューはページの中の各欄へ移るだけ。ロゴ・パンくずも外へ出さない。プライバシーポリシー・利用規約（問い合わせに要る）だけは同じデザインで出し、メニューは「戻る」だけ
// （その前は 会社情報・お知らせ などを旧HPへ向けていた）
const LINKS = {
  '/': '/',
  '/#pillars': '/#mechanism',
  '/#locations': '/#contact',
  '/company/': '/',
  '/news/': '/',
  '/#contact': '/#contact',                  // お問い合わせは f.o.oパックのページのフォームへ
  'https://tiremanager-foo.com/foopack/': '/',
};
// f.o.oパックのページの上のメニュー（ページの中の欄へ）。お客様の声はページにあるときだけ出す
function pageNav(hasVoice) {
  const items = [['#mechanism', 'しくみ'], ['#included', '月額に含まれるもの'], ...(hasVoice ? [['#voice', 'お客様の声']] : []), ['#simulator', 'かんたん見積もり'], ['#faq', 'よくあるご質問'], ['#contact', 'お問い合わせ']];
  return items.map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join('');
}
const BACK_NAV = '<li><a href="/">f.o.oパックのページへ戻る</a></li><li><a href="/#contact">お問い合わせ</a></li>';
class SetInner {
  constructor(html) { this.html = html; }
  element(el) { el.setInnerContent(this.html, { html: true }); }
}
class Remove { element(el) { el.remove(); } }

function assetBaseFor(origin) { return origin === NEW_HP ? NEW_HP_PUBLIC : NEW_HP_DRAFT; }
function originFor(host) {
  return (host === 'foopack.tiremanager-foo.com' || host === 'foo-pack.pages.dev') ? NEW_HP : NEW_HP_DRAFT;
}

class Href {
  element(el) {
    const h = el.getAttribute('href');
    if (h == null) return;
    if (Object.prototype.hasOwnProperty.call(LINKS, h)) { el.setAttribute('href', LINKS[h]); return; }
    // 中継しない新HPのページへのリンク（今後増えたもの）は、f.o.oパックのページへ（ほかのページへ飛ばさない）
    if (h.startsWith('/') && !h.startsWith('//') && !PASS.some(re => re.test(h.split(/[?#]/)[0]))) el.setAttribute('href', '/');
  }
}
class Attr {
  constructor(name, value) { this.name = name; this.value = value; }
  element(el) { el.setAttribute(this.name, this.value); }
}
// 部品（見た目・スクリプト・画像・動画）は新HPから直接読ませる。
// 新HPでは /foopack/ に置かれたページなので、相対の書き方（例: 紹介動画の video/poster.jpg）は /foopack/ の下を指す（2026/10/3）
class Asset {
  constructor(name, base) { this.name = name; this.base = base; }
  element(el) {
    let v = el.getAttribute(this.name);
    if (!v || /^(#|\/\/|[a-z][a-z0-9+.-]*:)/i.test(v)) return;
    if (!v.startsWith('/')) v = '/foopack/' + v;
    el.setAttribute(this.name, this.base + v);
  }
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
  const go = () => fetch(origin + path, {
    method: request.method === 'HEAD' ? 'HEAD' : 'GET',
    headers,
    redirect: 'manual',
  });
  try { return await go(); } catch (e) { return await go(); }   // 取り損ねたら1回だけ取り直す（だめなら onRequest が新HPへ回す）
}

function rewritePage(res, isFoopack, base, hasVoice = false) {
  let rw = new HTMLRewriter().on('a[href]', new Href())
    // ほかのページへ飛ばない: 上のメニューを差し替える（f.o.oパックのページ＝ページの中の欄へ／プライバシーポリシー等＝戻るだけ）
    .on('header nav ul', new SetInner(isFoopack ? pageNav(hasVoice) : BACK_NAV))
    .on(isFoopack ? '.crumbs' : 'x-none', new Remove())
    .on('link[rel="stylesheet"]', new Asset('href', base))
    .on('link[rel="icon"]', new Asset('href', base))
    .on('link[rel="apple-touch-icon"]', new Asset('href', base))
    .on('script[src]', new Asset('src', base))
    .on('img[src]', new Asset('src', base))
    .on('source[src]', new Asset('src', base))
    .on('video[src]', new Asset('src', base))
    .on('video[poster]', new Asset('poster', base));
  if (isFoopack) {
    rw = rw
      .on('link[rel="canonical"]', new Attr('href', SELF + '/'))
      .on('meta[property="og:url"]', new Attr('content', SELF + '/'))
      .on('meta[property="og:image"]', new Attr('content', SELF + '/og-image.jpg'))
      .on('meta[name="twitter:image"]', new Attr('content', SELF + '/og-image.jpg'))
      .on('script[type="application/ld+json"]', new JsonLd());
  }
  const h = new Headers(res.headers);
  h.delete('content-length'); h.delete('content-encoding'); h.delete('x-robots-tag'); h.delete('etag'); h.delete('last-modified');   // 書き換えた中身なので、元の目印は付けない
  h.set('cache-control', 'public, max-age=0, must-revalidate');
  return rw.transform(new Response(res.body, { status: res.status, headers: h }));
}

// 中継が新HPから取り損ねても、お客様には新HPの同じページ・部品を見せる（崩れた画面やエラーを出さない）
export async function onRequest(ctx) {
  try {
    return await handle(ctx);
  } catch (e) {
    const url = new URL(ctx.request.url);
    const base = assetBaseFor(originFor(url.hostname));
    const to = url.pathname === '/' ? '/foopack/' : url.pathname.startsWith('/video/') ? '/foopack' + url.pathname : url.pathname;
    return Response.redirect(base + to + url.search, 302);
  }
}

async function handle({ request }) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (SWITCHED) {
    const to = (path === '/' || path.startsWith('/foopack')) ? '/foopack/' : path;
    return Response.redirect(OLD_HP + to + url.search + url.hash, 301);
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 });

  const origin = originFor(url.hostname);
  const base = assetBaseFor(origin);

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
    if (res.status !== 200) return Response.redirect(base + '/foopack/' + url.search, 302);   // 取れなかったら新HPの同じページへ
    const html = await res.text();
    return rewritePage(new Response(html, { status: 200, headers: res.headers }), true, base, html.includes('id="voice"'));
  }
  // ホーム画面に追加したときの設定は、この住所の / を開くように
  if (path === '/foopack/manifest.json') {
    const res = await fetchOrigin(origin, path, request, false);
    if (res.status !== 200) return res;
    const j = await res.json();
    j.id = '/'; j.start_url = '/'; j.scope = '/';
    return new Response(JSON.stringify(j, null, 2), { headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' } });
  }
  // 相対の書き方で /video/… を聞かれたとき（スクリプトが組み立てた場合など）も /foopack/video/… から返す
  if (path.startsWith('/video/')) {
    const res = await fetchOrigin(origin, '/foopack' + path + url.search, request);
    const h = new Headers(res.headers); h.delete('x-robots-tag');
    return new Response(res.body, { status: res.status, headers: h });
  }
  // ブラウザが自動で読みに行くアイコン。新HPには favicon.ico が無いので png を返す（旧HPのトップへ転送すると画像として読めず止められる）
  if (path === '/favicon.ico') {
    const res = await fetchOrigin(origin, '/favicon-32.png', request, false);
    if (res.status !== 200) return new Response(null, { status: 404 });
    return new Response(res.body, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' } });
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
    if (ct.includes('text/html')) return rewritePage(res, false, base);
    if (res.status >= 500) return Response.redirect(base + path + url.search, 302);   // 新HP側の一時的なエラーは新HPへ回す
    const h = new Headers(res.headers); h.delete('x-robots-tag');
    return new Response(res.body, { status: res.status, headers: h });
  }
  // それ以外（新HPのトップ・会社情報など）は、新HPの公表まで f.o.oパックのページへ（ほかのページへ飛ばさない）
  return Response.redirect(url.origin + '/', 302);
}
