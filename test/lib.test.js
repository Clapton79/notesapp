const test = require('node:test');
const assert = require('node:assert');
const MD = require('../src/lib/markdown.js');
const Store = require('../src/lib/store.js');

test('markdown renders basics and escapes html', () => {
  const h = MD.render('# Hi\n\n**b** *i* `c` <script>x</script>\n\n- a\n- b');
  assert.match(h, /<h1>Hi<\/h1>/);
  assert.match(h, /<strong>b<\/strong>/);
  assert.match(h, /<code>c<\/code>/);
  assert.match(h, /&lt;script&gt;/);
  assert.match(h, /<ul><li>a<\/li><li>b<\/li><\/ul>/);
});

test('hyperlinks: only safe schemes, wikilinks and autolinks', () => {
  assert.match(MD.render('[x](https://e.com)'), /<a href="https:\/\/e.com" class="external">x<\/a>/);
  assert.doesNotMatch(MD.render('[x](javascript:alert(1))'), /<a /);
  assert.match(MD.render('[[Other note]]'), /data-note="Other note"/);
  assert.match(MD.render('see https://e.com now'), /class="external">https:\/\/e.com/);
});

test('store: sections, notes, link graph and map', () => {
  const d = { sections: [] };
  const s = Store.addSection(d, 'S');
  const a = Store.addNote(s, 'A');
  const b = Store.addNote(s, 'B');
  a.content = 'links [[B]] and [[Missing]]';
  const g = Store.buildLinkGraph(d);
  assert.strictEqual(g.nodes.length, 3);
  assert.strictEqual(g.edges.length, 2);
  assert.ok(g.nodes.find((n) => n.ghost && n.label === 'Missing'));
  const n1 = Store.addMapNode(b, 'x', 0, 0);
  const n2 = Store.addMapNode(b, 'y', 1, 1);
  assert.ok(Store.addMapEdge(b, n1.id, n2.id));
  assert.strictEqual(Store.addMapEdge(b, n2.id, n1.id), null);
  Store.deleteMapNode(b, n1.id);
  assert.strictEqual(b.map.edges.length, 0);
  assert.strictEqual(Store.search(d, 'missing').length, 1);
});
