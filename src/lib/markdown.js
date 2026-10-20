(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MD = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function safeUrl(u) {
    return /^(https?:\/\/|mailto:)/i.test(u) ? u : null;
  }

  // Input is already HTML-escaped.
  function inline(s) {
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = s.replace(/\[\[([^\]]+)\]\]/g, (_, t) => {
      const title = t.split('|')[0].trim();
      const label = (t.split('|')[1] || title).trim();
      return '<a href="#" class="wikilink" data-note="' + title + '">' + label + '</a>';
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
      const u = safeUrl(url.replace(/&amp;/g, '&'));
      return u ? '<a href="' + esc(u) + '" class="external">' + text + '</a>' : m;
    });
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, pre, url) =>
      pre + '<a href="' + url + '" class="external">' + url + '</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + codes[i] + '</code>');
  }

  function render(src) {
    const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      let m;
      if (/^```/.test(line)) {
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
      } else if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
        out.push('<h' + m[1].length + '>' + inline(esc(m[2])) + '</h' + m[1].length + '>');
        i++;
      } else if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
        out.push('<hr>');
        i++;
      } else if (/^>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
        out.push('<blockquote>' + inline(esc(buf.join(' '))) + '</blockquote>');
      } else if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
        const ordered = /^\s*\d+\./.test(line);
        const items = [];
        while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
          let t = lines[i++].replace(/^\s*([-*+]|\d+\.)\s+/, '');
          let box = '';
          const c = /^\[( |x|X)\]\s+(.*)$/.exec(t);
          if (c) { box = '<input type="checkbox" disabled' + (c[1] === ' ' ? '' : ' checked') + '> '; t = c[2]; }
          items.push('<li>' + box + inline(esc(t)) + '</li>');
        }
        const tag = ordered ? 'ol' : 'ul';
        out.push('<' + tag + '>' + items.join('') + '</' + tag + '>');
      } else if (line.trim() === '') {
        i++;
      } else {
        const buf = [];
        while (i < lines.length && lines[i].trim() !== '' &&
          !/^(```|#{1,6}\s|>|\s*([-*+]|\d+\.)\s+)/.test(lines[i])) buf.push(lines[i++]);
        out.push('<p>' + inline(esc(buf.join('\n'))).replace(/\n/g, '<br>') + '</p>');
      }
    }
    return out.join('\n');
  }

  function extractWikiLinks(src) {
    const res = [];
    const re = /\[\[([^\]]+)\]\]/g;
    let m;
    while ((m = re.exec(src || ''))) {
      const t = m[1].split('|')[0].trim();
      if (t && !res.includes(t)) res.push(t);
    }
    return res;
  }

  return { render, extractWikiLinks, esc };
});
