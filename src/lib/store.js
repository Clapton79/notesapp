(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./markdown.js'));
  else root.Store = factory(root.MD);
})(typeof self !== 'undefined' ? self : this, function (MD) {
  let counter = 0;
  function uid() {
    return Date.now().toString(36) + (counter++).toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function newNote(title) {
    return { id: uid(), title: title || 'Untitled', content: '', canvas: { cards: [] }, map: { nodes: [], edges: [] } };
  }

  function createData() {
    const note = newNote('Welcome');
    note.content = '# Welcome\n\nWrite **markdown**, add [hyperlinks](https://example.com) or link notes with [[Wikilinks]].\n\n- Use the *Canvas* tab for free-form cards\n- Use the *Map* tab for association diagrams\n';
    return { sections: [{ id: uid(), name: 'General', notes: [note] }] };
  }

  function addSection(data, name) {
    const s = { id: uid(), name: name || 'New section', notes: [] };
    data.sections.push(s);
    return s;
  }

  function addNote(section, title) {
    const n = newNote(title);
    section.notes.push(n);
    return n;
  }

  function deleteNote(section, id) {
    section.notes = section.notes.filter((n) => n.id !== id);
  }

  function deleteSection(data, id) {
    data.sections = data.sections.filter((s) => s.id !== id);
  }

  function allNotes(data) {
    return data.sections.flatMap((s) => s.notes);
  }

  function findNoteByTitle(data, title) {
    const t = title.trim().toLowerCase();
    return allNotes(data).find((n) => n.title.trim().toLowerCase() === t) || null;
  }

  function addMapNode(note, label, x, y) {
    const node = { id: uid(), label: label || 'Topic', x: x || 0, y: y || 0 };
    note.map.nodes.push(node);
    return node;
  }

  function addMapEdge(note, from, to) {
    if (from === to) return null;
    const exists = note.map.edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from));
    if (exists) return null;
    const e = { from, to };
    note.map.edges.push(e);
    return e;
  }

  function deleteMapNode(note, id) {
    note.map.nodes = note.map.nodes.filter((n) => n.id !== id);
    note.map.edges = note.map.edges.filter((e) => e.from !== id && e.to !== id);
  }

  // Graph of notes connected through [[wikilinks]]; unresolved links become ghost nodes.
  function buildLinkGraph(data) {
    const nodes = [];
    const edges = [];
    const byTitle = new Map();
    for (const n of allNotes(data)) {
      nodes.push({ id: n.id, label: n.title, ghost: false });
      byTitle.set(n.title.trim().toLowerCase(), n.id);
    }
    for (const n of allNotes(data)) {
      for (const t of MD.extractWikiLinks(n.content)) {
        const key = t.toLowerCase();
        let target = byTitle.get(key);
        if (!target) {
          target = 'ghost:' + key;
          byTitle.set(key, target);
          nodes.push({ id: target, label: t, ghost: true });
        }
        if (target !== n.id) edges.push({ from: n.id, to: target });
      }
    }
    return { nodes, edges };
  }

  function search(data, q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    return allNotes(data).filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  }

  return { uid, createData, addSection, addNote, deleteNote, deleteSection, allNotes, findNoteByTitle,
    addMapNode, addMapEdge, deleteMapNode, buildLinkGraph, search };
});
