/* Cross-check: every element id referenced by script.js must exist in index.html */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const js = readFileSync(path.join(ROOT, 'script.js'), 'utf8');
const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const referenced = new Set();
for (const m of js.matchAll(/el\('([^']+)'\)/g)) referenced.add(m[1]);
for (const m of js.matchAll(/getElementById\('([^']+)'\)/g)) referenced.add(m[1]);

const htmlIds = new Set();
for (const m of html.matchAll(/id="([^"]+)"/g)) htmlIds.add(m[1]);

// ids that are created dynamically by the templates in script.js
const dynamic = new Set([
  'id-grid', 'opt-grid', 'asset-grid', 'spawn-grid', 'comp-search', 'comp-chips', 'comp-list',
  'add-custom-comp', 'group-list', 'add-group', 'event-list', 'add-event', 'custom-list', 'add-custom',
  'entries', 'list-add', 'gl-', 'side-project', 'side-nav', 'save-label', 'save-dot', 'crumbs',
  'engine-chip', 'btn-build', 'btn-build-2', 'dash-title', 'dash-meta', 'dash-stats', 'card-grid',
  'validation', 'validation-badge', 'filetree', 'tree-count', 'feature-grid', 'tree-legend',
  'recent-panel', 'recent-list', 'home-hint', 'ed-title', 'ed-sub', 'ed-tabs', 'ed-body',
  'preview-toggle', 'ed-preview', 'modal-root', 'toast-root', 'hidden-file', 'boot', 'app'
]);

let bad = 0;
for (const id of [...referenced].sort()) {
  if (!htmlIds.has(id) && !dynamic.has(id)) {
    console.log('  MISSING id in index.html: #' + id);
    bad += 1;
  }
}

// functions referenced by the HTML inline handlers (there are none) and public API sanity
const mustExist = ['buildFileTree', 'validate', 'mount', 'render', 'navigate', 'exportMcaddon', 'doBuild'];
for (const fn of mustExist) {
  if (!new RegExp('function\\s+' + fn + '\\b').test(js) && !new RegExp(fn + '\\s*[:=]').test(js)) {
    console.log('  MISSING function: ' + fn);
    bad += 1;
  }
}

console.log(bad === 0
  ? 'OK: all ' + referenced.size + ' referenced ids resolve (' + htmlIds.size + ' static ids in index.html)'
  : 'FAILED: ' + bad + ' problem(s)');
process.exit(bad === 0 ? 0 : 1);
