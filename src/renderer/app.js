/* global MD, Store */
const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
let data;
let section;
let note;
let view = 'text';
let selNode = null;
let saveTimer;

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => window.api.save(data), 300);
}

function el(tag, attrs, parent, ns) {
  const e = ns ? document.createElementNS(NS, tag) : document.createElement(tag);
  for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function drag(target, onMove) {
  target.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    let lx = ev.clientX;
    let ly = ev.clientY;
    let moved = false;
    const mv = (e) => { moved = true; onMove(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); if (moved) save(); };
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
  });
}

function renderSections() {
  const ul = $('sections');
  ul.innerHTML = '';
  data.sections.forEach((s) => {
    const li = el('li', { class: s === section ? 'active' : '' }, ul);
    li.textContent = s.name;
    li.onclick = () => { section = s; note = s.notes[0] || null; renderAll(); };
    li.ondblclick = () => renameInline(li, s.name, (v) => { s.name = v; save(); renderSections(); });
  });
}

function renameInline(li, value, done) {
  li.textContent = '';
  const inp = el('input', {}, li);
  inp.value = value;
  inp.focus();
  inp.select();
  const fin = () => done(inp.value.trim() || value);
  inp.onblur = fin;
  inp.onkeydown = (e) => { if (e.key === 'Enter') inp.blur(); };
  inp.onclick = (e) => e.stopPropagation();
}

function renderNotes() {
  const ul = $('notes');
  ul.innerHTML = '';
  const q = $('search').value;
  const list = q ? Store.search(data, q) : (section ? section.notes : []);
  list.forEach((n) => {
    const li = el('li', { class: n === note ? 'active' : '' }, ul);
    li.textContent = n.title || 'Untitled';
    li.onclick = () => openNote(n);
  });
}

function openNote(n) {
  const s = data.sections.find((x) => x.notes.includes(n));
  if (s) section = s;
  note = n;
  renderAll();
}

function renderAll() {
  renderSections();
  renderNotes();
  renderView();
}

function renderView() {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  ['text', 'canvas', 'map', 'graph'].forEach((v) => $('view-' + v).classList.toggle('hidden', v !== view));
  $('toolbar').classList.toggle('hidden', view !== 'canvas' && view !== 'map');
  $('title').value = note ? note.title : '';
  $('title').disabled = !note;
  if (!note && view !== 'graph') return;
  if (view === 'text') renderText();
  else if (view === 'canvas') renderCanvas();
  else if (view === 'map') renderMap();
  else renderGraph();
}

function renderText() {
  $('editor').value = note.content;
  $('preview').innerHTML = MD.render(note.content);
}

$('editor').addEventListener('input', () => {
  note.content = $('editor').value;
  $('preview').innerHTML = MD.render(note.content);
  save();
});

$('preview').addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a) return;
  e.preventDefault();
  if (a.classList.contains('wikilink')) {
    let target = Store.findNoteByTitle(data, a.dataset.note);
    if (!target) target = Store.addNote(section, a.dataset.note);
    save();
    openNote(target);
  } else if (a.classList.contains('external')) {
    window.api.openExternal(a.getAttribute('href'));
  }
});

// ---- Canvas ----
function setToolbar(buttons) {
  const tb = $('toolbar');
  tb.innerHTML = '';
  const left = el('div', {}, tb);
  buttons.forEach((b) => {
    if (b.input) { const i = el('input', { placeholder: b.input, id: 'tb-input' }, left); i.onkeydown = (e) => { if (e.key === 'Enter' && buttons[0].fn) buttons[0].fn(); }; return; }
    const btn = el('button', {}, left);
    btn.textContent = b.label;
    btn.onclick = b.fn;
  });
}

function renderCanvas() {
  setToolbar([{ label: 'Add card', fn: () => {
    note.canvas.cards.push({ id: Store.uid(), x: 40 + note.canvas.cards.length * 20, y: 40 + note.canvas.cards.length * 20, text: '' });
    save();
    renderCanvas();
  } }]);
  const c = $('canvas');
  c.innerHTML = '';
  note.canvas.cards.forEach((card) => {
    const d = el('div', { class: 'card' }, c);
    d.style.left = card.x + 'px';
    d.style.top = card.y + 'px';
    const h = el('div', { class: 'handle' }, d);
    const x = el('span', {}, h);
    x.textContent = '✕';
    x.onmousedown = (e) => e.stopPropagation();
    x.onclick = () => { note.canvas.cards = note.canvas.cards.filter((k) => k !== card); save(); renderCanvas(); };
    const t = el('textarea', { placeholder: 'Free text…' }, d);
    t.value = card.text;
    t.oninput = () => { card.text = t.value; save(); };
    drag(h, (dx, dy) => {
      card.x = Math.max(0, card.x + dx);
      card.y = Math.max(0, card.y + dy);
      d.style.left = card.x + 'px';
      d.style.top = card.y + 'px';
    });
  });
}

// ---- Association map ----
function drawGraph(svg, g, opts) {
  svg.innerHTML = '';
  const pos = new Map(g.nodes.map((n) => [n.id, n]));
  const lines = g.edges.map((e) => {
    const l = el('line', {}, svg, true);
    return { e, l };
  });
  const place = () => lines.forEach(({ e, l }) => {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) return;
    l.setAttribute('x1', a.x); l.setAttribute('y1', a.y); l.setAttribute('x2', b.x); l.setAttribute('y2', b.y);
  });
  g.nodes.forEach((n) => {
    const grp = el('g', { class: 'node' + (n.ghost ? ' ghost' : '') + (n.id === selNode ? ' sel' : '') }, svg, true);
    const t = el('text', { dy: 4 }, grp, true);
    t.textContent = n.label;
    const w = Math.max(30, n.label.length * 4 + 24);
    el('circle', { r: w }, grp, true).setAttribute('r', w);
    grp.insertBefore(grp.lastChild, t);
    const move = () => { grp.setAttribute('transform', `translate(${n.x},${n.y})`); place(); };
    move();
    drag(grp, (dx, dy) => { n.x += dx; n.y += dy; move(); });
    grp.addEventListener('click', (e) => opts.onClick(n, e));
  });
  place();
}

function renderMap() {
  const label = () => $('tb-input').value.trim();
  setToolbar([
    { label: 'Add topic', fn: () => {
      const r = $('map').getBoundingClientRect();
      const n = Store.addMapNode(note, label() || 'Topic', r.width / 2 + (Math.random() - 0.5) * 200, r.height / 2 + (Math.random() - 0.5) * 200);
      selNode = n.id;
      save();
      renderMap();
    } },
    { input: 'Topic or word…' },
    { label: 'Rename selected', fn: () => {
      const n = note.map.nodes.find((x) => x.id === selNode);
      if (n && label()) { n.label = label(); save(); renderMap(); }
    } },
    { label: 'Delete selected', fn: () => { if (selNode) { Store.deleteMapNode(note, selNode); selNode = null; save(); renderMap(); } } }
  ]);
  const hint = el('span', {}, $('toolbar'));
  hint.textContent = 'Click a topic to select it; shift+click another topic to connect or disconnect them.';
  drawGraph($('map'), note.map, { onClick: (n, e) => {
    if (e.shiftKey && selNode && selNode !== n.id) {
      if (!Store.addMapEdge(note, selNode, n.id)) {
        note.map.edges = note.map.edges.filter((x) => !((x.from === selNode && x.to === n.id) || (x.from === n.id && x.to === selNode)));
      }
      save();
    } else {
      selNode = n.id;
    }
    renderMap();
  } });
}

// ---- Link graph (Obsidian-style) ----
function renderGraph() {
  const g = Store.buildLinkGraph(data);
  const svg = $('graph');
  const r = svg.getBoundingClientRect();
  const cx = r.width / 2;
  const cy = r.height / 2;
  g.nodes.forEach((n, i) => {
    const a = (i / g.nodes.length) * Math.PI * 2;
    n.x = cx + Math.cos(a) * 150;
    n.y = cy + Math.sin(a) * 150;
  });
  const idx = new Map(g.nodes.map((n) => [n.id, n]));
  for (let it = 0; it < 200; it++) {
    for (const a of g.nodes) {
      for (const b of g.nodes) {
        if (a === b) continue;
        let dx = a.x - b.x; let dy = a.y - b.y;
        const d2 = Math.max(dx * dx + dy * dy, 25);
        const f = 8000 / d2;
        const d = Math.sqrt(d2);
        dx /= d; dy /= d;
        a.x += dx * f; a.y += dy * f;
      }
      a.x += (cx - a.x) * 0.01; a.y += (cy - a.y) * 0.01;
    }
    for (const e of g.edges) {
      const a = idx.get(e.from); const b = idx.get(e.to);
      const dx = b.x - a.x; const dy = b.y - a.y;
      a.x += dx * 0.03; a.y += dy * 0.03; b.x -= dx * 0.03; b.y -= dy * 0.03;
    }
  }
  drawGraph(svg, g, { onClick: (n) => {
    let target = Store.allNotes(data).find((x) => x.id === n.id);
    if (!target && n.ghost) { target = Store.addNote(section, n.label); save(); }
    if (target) { view = 'text'; openNote(target); }
  } });
}

// ---- wiring ----
$('title').addEventListener('input', () => { note.title = $('title').value; renderNotes(); save(); });
$('search').addEventListener('input', renderNotes);
document.querySelectorAll('.tab').forEach((b) => { b.onclick = () => { view = b.dataset.view; renderView(); }; });
$('add-section').onclick = () => { section = Store.addSection(data, 'New section'); note = null; save(); renderAll(); };
$('add-note').onclick = () => {
  if (!section) section = Store.addSection(data, 'General');
  note = Store.addNote(section, 'Untitled');
  save();
  renderAll();
};
$('delete-note').onclick = () => {
  if (!note) return;
  Store.deleteNote(section, note.id);
  note = section.notes[0] || null;
  save();
  renderAll();
};
document.addEventListener('keydown', (e) => {
  if (view === 'map' && e.key === 'Delete' && selNode && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
    Store.deleteMapNode(note, selNode); selNode = null; save(); renderMap();
  }
});

(async function init() {
  data = (await window.api.load()) || Store.createData();
  section = data.sections[0];
  note = section && section.notes[0];
  renderAll();
})();
