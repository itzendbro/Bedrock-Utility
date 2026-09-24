/* =====================================================================
   A very small DOM implementation — just enough to run index.html +
   script.js in Node so the UI pipeline can be smoke tested without a
   browser. Supports the selectors and APIs the app actually uses.
   ===================================================================== */

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function parseAttrs(src) {
  const out = {};
  if (!src) return out;
  const re = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>`]+)))?/g;
  let m;
  while ((m = re.exec(src))) {
    out[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
  }
  return out;
}

function escapeText(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function serialize(node) {
  if (node.tag === '#text') return escapeText(node.text);
  let s = '<' + node.tag;
  for (const k of Object.keys(node.attrs)) {
    s += ' ' + k + '="' + String(node.attrs[k]).replace(/"/g, '&quot;') + '"';
  }
  s += '>';
  if (VOID.has(node.tag)) return s;
  s += node.children.map(serialize).join('');
  return s + '</' + node.tag + '>';
}

function parseHTML(html) {
  const root = makeEl('#root', {}, null);
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!\[[\s\S]*?\]>|<!doctype[^>]*>|<\/([a-zA-Z0-9-]+)\s*>|<([a-zA-Z0-9-]+)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>`]+))?)*)\s*(\/?)>/gi;
  let last = 0;
  let m;
  while ((m = re.exec(html))) {
    const text = html.slice(last, m.index);
    if (text.trim()) stack[stack.length - 1].children.push({ tag: '#text', text: text, parent: stack[stack.length - 1] });
    last = re.lastIndex;
    if (m[0].charCodeAt(1) === 33) continue;
    if (m[1]) {
      const close = m[1].toLowerCase();
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tag === close) { stack.length = i; break; }
      }
    } else {
      const tag = m[2].toLowerCase();
      const node = makeEl(tag, parseAttrs(m[3]), stack[stack.length - 1]);
      stack[stack.length - 1].children.push(node);
      if (!m[4] && !VOID.has(tag)) stack.push(node);
    }
  }
  const tail = html.slice(last);
  if (tail.trim()) stack[stack.length - 1].children.push({ tag: '#text', text: tail, parent: stack[stack.length - 1] });
  return root;
}

function makeEl(tag, attrs, parent) {
  const e = Object.create(ElProto);
  e.tag = tag;
  e.attrs = attrs || {};
  e.children = [];
  e.parent = parent || null;
  e.listeners = {};
  e.style = {};
  e._value = e.attrs.value !== undefined ? e.attrs.value : '';
  e._checked = 'checked' in e.attrs;
  e._html = null;
  return e;
}

const ElProto = {
  get tagName() { return this.tag.toUpperCase(); },
  get parentNode() { return this.parent; },
  get firstChild() { return this.children[0] || null; },
  get nextSibling() {
    if (!this.parent) return null;
    const i = this.parent.children.indexOf(this);
    return this.parent.children[i + 1] || null;
  },
  get id() { return this.attrs.id || ''; },
  set id(v) { this.attrs.id = v; },
  get className() { return this.attrs.class || ''; },
  set className(v) { this.attrs.class = v; },
  get classList() {
    const self = this;
    const list = () => String(self.attrs.class || '').split(/\s+/).filter(Boolean);
    return {
      add: function () {
        const l = list();
        for (const c of arguments) if (l.indexOf(c) < 0) l.push(c);
        self.attrs.class = l.join(' ');
      },
      remove: function () {
        const drop = new Set(arguments);
        self.attrs.class = list().filter((c) => !drop.has(c)).join(' ');
      },
      toggle: function (c, force) {
        const has = list().indexOf(c) >= 0;
        const want = force === undefined ? !has : !!force;
        if (want) this.add(c); else this.remove(c);
        return want;
      },
      contains: function (c) { return list().indexOf(c) >= 0; }
    };
  },
  get hidden() { return 'hidden' in this.attrs; },
  set hidden(v) { if (v) this.attrs.hidden = ''; else delete this.attrs.hidden; },
  get disabled() { return 'disabled' in this.attrs; },
  set disabled(v) { if (v) this.attrs.disabled = ''; else delete this.attrs.disabled; },
  get value() {
    if (this.tag === 'select') {
      const options = this.children.filter((c) => c.tag === 'option');
      const sel = options.filter((c) => 'selected' in c.attrs)[0];
      if (sel) return sel.attrs.value;
      return options.length ? options[0].attrs.value : (this._value || '');
    }
    return this._value;
  },
  set value(v) {
    this._value = String(v);
    if (this.tag === 'select') {
      const wanted = String(v);
      let found = false;
      this.children.forEach((c) => {
        if (c.tag !== 'option') return;
        if (!found && c.attrs.value === wanted) { c.attrs.selected = ''; found = true; }
        else delete c.attrs.selected;
      });
    }
  },
  get checked() { return this._checked; },
  set checked(v) { this._checked = !!v; },
  get textContent() {
    if (this.tag === '#text') return this.text;
    return this.children.map((c) => (c.tag === '#text' ? c.text : (c.textContent || ''))).join('');
  },
  set textContent(v) { this.children = [{ tag: '#text', text: String(v), parent: this }]; },
  get innerHTML() {
    return this.children.map(serialize).join('');
  },
  set innerHTML(v) {
    this._html = String(v);
    const parsed = parseHTML(String(v));
    this.children = parsed.children.map((c) => { c.parent = this; return c; });
  },
  get outerHTML() { return serialize(this); },
  setAttribute(k, v) { this.attrs[k] = String(v); },
  getAttribute(k) { return this.attrs[k] !== undefined ? this.attrs[k] : null; },
  hasAttribute(k) { return k in this.attrs; },
  removeAttribute(k) { delete this.attrs[k]; },
  appendChild(node) { node.parent = this; this.children.push(node); return node; },
  removeChild(node) { this.children = this.children.filter((c) => c !== node); return node; },
  insertAdjacentHTML(pos, html) {
    const parsed = parseHTML(html);
    const nodes = parsed.children.map((c) => { c.parent = this; return c; });
    if (pos === 'afterbegin') this.children = nodes.concat(this.children);
    else this.children = this.children.concat(nodes);
  },
  remove() { if (this.parent) this.parent.removeChild(this); },
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
  },
  dispatchEvent(evt) {
    evt = evt || {};
    if (!evt.target) evt.target = this;
    if (!evt.preventDefault) evt.preventDefault = function () {};
    if (!evt.stopPropagation) evt.stopPropagation = function () {};
    if (!evt.stopImmediatePropagation) evt.stopImmediatePropagation = function () {};
    (this.listeners[evt.type] || []).slice().forEach((fn) => fn.call(this, evt));
    return true;
  },
  click() { return this.dispatchEvent({ type: 'click' }); },
  input() { return this.dispatchEvent({ type: 'input' }); },
  change() { return this.dispatchEvent({ type: 'change' }); },
  focus() {}, blur() {}, select() {},
  closest(sel) {
    let node = this;
    while (node) {
      if (node.tag && node.tag !== '#text' && matches(node, sel)) return node;
      node = node.parent;
    }
    return null;
  },
  querySelector(sel) { return queryAll(this, sel)[0] || null; },
  querySelectorAll(sel) { return queryAll(this, sel); },
  getElementsByTagName(tag) { return descendants(this).filter((n) => n.tag === tag.toLowerCase()); }
};

/** "a b": b must match the element itself, a must match an ancestor. */
function matchesDescendant(node, parts) {
  if (!matches(node, parts[parts.length - 1])) return false;
  return ancestorMatches(node.parent, parts.slice(0, -1));
}
function ancestorMatches(node, parts) {
  if (!parts.length) return true;
  if (!node || node.tag === '#text') return false;
  if (matches(node, parts[parts.length - 1]) && ancestorMatches(node.parent, parts.slice(0, -1))) return true;
  return ancestorMatches(node.parent, parts);
}

function matches(node, sel) {
  sel = String(sel).trim();
  if (!sel) return false;
  // descendant combinator first, so "#id .class" is not treated as an id
  if (sel.indexOf(' ') >= 0) {
    const parts = sel.split(/\s+/).filter(Boolean);
    return matchesDescendant(node, parts);
  }
  if (sel.startsWith('#')) return node.attrs.id === sel.slice(1);
  if (sel.startsWith('.')) {
    const classes = String(node.attrs.class || '').split(/\s+/);
    return sel.slice(1).split('.').every((c) => classes.indexOf(c) >= 0);
  }
  if (sel.indexOf('.') >= 0 && sel.indexOf('[') < 0) {
    const bits = sel.split('.');
    const tag = bits.shift();
    const cls = String(node.attrs.class || '').split(/\s+/);
    if (tag && node.tag !== tag.toLowerCase()) return false;
    return bits.every((c) => cls.indexOf(c) >= 0);
  }
  const am = /^\[([^\]=]+)(?:="([^"]*)")?\]$/.exec(sel);
  if (am) return node.attrs[am[1]] !== undefined && (am[2] === undefined || node.attrs[am[1]] === am[2]);
  return node.tag === sel.toLowerCase();
}

function descendants(node, out) {
  out = out || [];
  (node.children || []).forEach((c) => {
    if (c.tag === '#text') return;
    out.push(c);
    descendants(c, out);
  });
  return out;
}

function queryAll(root, selector) {
  const sels = selector.split(',').map((s) => s.trim()).filter(Boolean);
  return descendants(root).filter((n) => sels.some((s) => matches(n, s)));
}

/* ------------------------------ document ------------------------------ */

function createDocument(html) {
  const root = parseHTML(html);
  const body = makeEl('body', {}, null);
  root.appendChild(body);

  const doc = {
    readyState: 'complete',
    body: body,
    documentElement: makeEl('html', {}, null),
    createElement(tag) { return makeEl(tag.toLowerCase(), {}, null); },
    createDocumentFragment() { return makeEl('#fragment', {}, null); },
    createTextNode(t) { return { tag: '#text', text: String(t), parent: null }; },
    getElementById(id) { return descendants(root).filter((n) => n.attrs.id === id)[0] || null; },
    querySelector(sel) { return queryAll(root, sel)[0] || null; },
    querySelectorAll(sel) { return queryAll(root, sel); },
    addEventListener(type, fn) { (doc.listeners[type] = doc.listeners[type] || []).push(fn); },
    removeEventListener() {},
    dispatchEvent(evt) { (doc.listeners[evt.type] || []).forEach((fn) => fn(evt)); },
    listeners: {},
    execCommand() { return true; }
  };
  return doc;
}

export { createDocument, ElProto, makeEl, parseHTML, descendants };
