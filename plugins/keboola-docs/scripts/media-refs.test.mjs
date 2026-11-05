// media-refs.test.mjs: node --test <plugin>/scripts/media-refs.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { extractRefs, extractHtmlRefs, resolveRef, slugOf, pageRefs } from './lib/media-refs.mjs';

const raws = (text) => extractRefs(text).map((r) => r.raw);

test('markdown images: inline, titled, angle-bracketed, reference-style', () => {
  const t = [
    '![a](/x/a.png)',
    '![b](imgs/b.png "Title")',
    '![c](<with space.png>)',
    '![d][dref]',
    '![e][]',
    '',
    '[dref]: ./d.png',
    '[e]: ../e.png',
  ].join('\n');
  assert.deepEqual(raws(t), ['/x/a.png', 'imgs/b.png', 'with space.png', './d.png', '../e.png']);
});

test('tags: img, video src and poster, source, srcset, component src with a media extension', () => {
  const t = [
    '<img src="raw.png" alt="Raw">',
    '<video autoplay poster="/v/p.png" aria-label="A clip"><source src="/v/c.mp4" type="video/mp4" /></video>',
    '<img srcset="one.png 1x, two.png 2x" src="one.png">',
    '<Figure src="/fig/f.webp" />',
    '<Card href="/not-media/" src="/script.js" />',
  ].join('\n');
  const r = extractRefs(t);
  assert.deepEqual(r.map((x) => x.raw), ['raw.png', '/v/p.png', '/v/c.mp4', 'one.png', 'one.png', 'two.png', '/fig/f.webp']);
  assert.equal(r.find((x) => x.raw === '/v/p.png').kind, 'poster');
  assert.equal(r.find((x) => x.raw === '/v/c.mp4').kind, 'video');
  assert.equal(r[0].alt, 'Raw');
});

test('fenced code, HTML comments and MDX comments are not references; line numbers survive', () => {
  const t = ['```md', '![no](/in/fence.png)', '```', '<!-- ![no](/in/comment.png) -->', '{/* <img src="/in/mdx.png"> */}', '~~~', '<img src="/in/tilde.png">', '~~~', '![yes](/real.png)'].join('\n');
  const r = extractRefs(t);
  assert.deepEqual(r.map((x) => x.raw), ['/real.png']);
  assert.equal(r[0].line, 9);
});

test('frontmatter image, poster and cover; query and hash are dropped', () => {
  const t = "---\ntitle: T\nimage: /og/t.png\nposter: '/og/p.png'\n---\n![q](/q.png?v=2#x)\n";
  assert.deepEqual(raws(t).sort(), ['/og/p.png', '/og/t.png', '/q.png']);
});

test('built HTML: src, href, poster, srcset, data-src', () => {
  const h = '<img src="/_astro/a.webp" srcset="/a1.png 1x, /a2.png 2x"><a href="x.png">x</a><video poster="p.png"></video><!-- <img src="/gone.png"> --><i data-src="/lazy.png"></i>';
  assert.deepEqual(extractHtmlRefs(h).map((r) => r.raw), ['/_astro/a.webp', '/a1.png', '/a2.png', 'x.png', 'p.png', '/lazy.png']);
});

test('resolution: absolute → public; relative → next to the page first, then the page URL under public; else missing', () => {
  const root = '/r';
  const present = new Set(['/r/public/abs.png', '/r/src/content/docs/guide/near.png', '/r/public/guide/page/far.png']);
  const ctx = { root, exists: (p) => present.has(p), pageFile: '/r/src/content/docs/guide/page.md', slug: 'guide/page' };
  assert.deepEqual(resolveRef('/abs.png', ctx), { resolved: 'public/abs.png', via: 'public' });
  assert.deepEqual(resolveRef('near.png', ctx), { resolved: 'src/content/docs/guide/near.png', via: 'colocated' });
  assert.deepEqual(resolveRef('./far.png', ctx), { resolved: 'public/guide/page/far.png', via: 'public' });
  assert.deepEqual(resolveRef('nope.png', ctx), { resolved: 'public/guide/page/nope.png', via: 'missing' });
  assert.equal(resolveRef('https://x.org/a.png', ctx), null);
  assert.equal(resolveRef('data:image/png;base64,AA', ctx), null);
  assert.equal(resolveRef('#anchor', ctx), null);
});

test('slug: frontmatter wins, else the path without index; pageRefs ties them together', () => {
  const docs = '/r/src/content/docs';
  assert.equal(slugOf(`${docs}/a/b.md`, "---\nslug: 'custom/slug'\n---\n", docs), 'custom/slug');
  assert.equal(slugOf(`${docs}/a/index.mdx`, '# x', docs), 'a');
  const { slug, refs } = pageRefs(`${docs}/a/index.mdx`, '<img src="pic.png">', { root: '/r', exists: (p) => p === '/r/public/a/pic.png', docsDir: docs });
  assert.equal(slug, 'a');
  assert.deepEqual(refs.map((r) => [r.resolved, r.via]), [['public/a/pic.png', 'public']]);
  assert.ok(path.isAbsolute(docs));
});

test('a raw <img> never resolves next to the page; a markdown image prefers the public copy the twin uses', () => {
  const root = '/r', docs = '/r/src/content/docs';
  const present = new Set(['/r/src/content/docs/n8n/01.png', '/r/public/n8n/01.png', '/r/src/content/docs/dbt/imgs/a.png', '/r/public/dbt/imgs/a.png', '/r/src/content/docs/only/b.png']);
  const ctx = { root, exists: (p) => present.has(p), docsDir: docs };
  const via = (file, text) => pageRefs(file, text, ctx).refs.map((r) => [r.raw, r.via, r.resolved]);
  assert.deepEqual(via(`${docs}/n8n/index.md`, '<img src="./01.png">'), [['./01.png', 'public', 'public/n8n/01.png']]);
  assert.deepEqual(via(`${docs}/dbt/index.md`, '![](imgs/a.png)'), [['imgs/a.png', 'public', 'public/dbt/imgs/a.png']]);
  assert.deepEqual(via(`${docs}/only/index.md`, '![](b.png)'), [['b.png', 'colocated', 'src/content/docs/only/b.png']]);
  assert.deepEqual(via(`${docs}/only/index.md`, '<img src="b.png">'), [['b.png', 'missing', 'public/only/b.png']]);
});
