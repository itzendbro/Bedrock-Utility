/* =====================================================================
   Bedrock Utility — UI smoke test
   ---------------------------------------------------------------------
   Boots index.html + script.js inside the mini DOM from minidom.mjs and
   drives the real UI: create a project, add an entity, toggle
   components, switch tabs, and export a .mcaddon.

   Usage:  node test/ui.smoke.mjs
   ===================================================================== */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createDocument } from './minidom.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// --- browser globals the app expects -------------------------------
const store = new Map();
const downloads = [];

globalThis.JSZip = createRequire(import.meta.url)(path.join(ROOT, 'vendor', 'jszip.min.js'));

const document = createDocument(html);

const window = globalThis;
globalThis.window = globalThis;
globalThis.document = document;
Object.defineProperty(globalThis, 'navigator', {
  value: { clipboard: { writeText: () => Promise.resolve() }, userAgent: 'node' },
  configurable: true, writable: true
});
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};
globalThis.history = { replaceState: (a, b, url) => { globalThis.location.hash = String(url).replace(/^#/, ''); } };
globalThis.location = { hash: '' };
globalThis.scrollTo = () => {};
globalThis.FileReader = class {
  readAsText() {}
  readAsDataURL() {}
};
globalThis.URL = globalThis.URL || {};
globalThis.URL.createObjectURL = (blob) => {
  downloads.push(blob);
  return 'blob:mock-' + downloads.length;
};
globalThis.URL.revokeObjectURL = () => {};
const require = createRequire(import.meta.url);
const BU = require(path.join(ROOT, 'script.js'));

/* ------------------------------ helpers ------------------------------ */

const log = [];
let failures = 0;
const tick = () => new Promise((r) => setTimeout(r, 0));

async function step(name, fn) {
  try { await fn(); log.push('  ✓ ' + name); }
  catch (err) { failures += 1; log.push('  ✗ ' + name + '\n      ' + err.message + '\n' + (err.stack || '').split('\n').slice(1, 4).join('\n')); }
}
function id(x) { return document.getElementById(x); }
function click(x) { const n = id(x); assert.ok(n, 'missing #' + x); n.click(); }
function q(sel, root) { return (root || document).querySelector(sel); }
function qa(sel) { return document.querySelectorAll(sel); }
function tab(label) {
  const t = qa('#ed-tabs .ed-tab').filter((x) => x.textContent.indexOf(label) === 0)[0];
  assert.ok(t, 'no tab starting with ' + label);
  t.click();
  return t;
}
function fill(sel, value) {
  const n = q(sel);
  assert.ok(n, 'missing ' + sel);
  n.value = value;
  n.input();
  return n;
}

/* ------------------------------- run -------------------------------- */

console.log('\nUI smoke test\n');

await step('boots and hides the loading screen', async () => {
  assert.equal(id('app').hidden, false);
  assert.equal(id('boot'), null);
  assert.equal(id('view-home').hidden, false);
});

await step('home page renders the feature grid and file legend', async () => {
  assert.ok(id('feature-grid').children.length >= 4);
  assert.ok(id('tree-legend').children.length >= 4);
  assert.equal(id('recent-panel').hidden, true);
});

await step('sidebar shows the empty state', async () => {
  assert.ok(id('side-project').textContent.includes('No project'));
  assert.equal(id('btn-build').disabled, true);
});

/* ---- create a project through the real modal ---- */
await step('"Create New Addon" opens the wizard', async () => {
  click('btn-create-new');
  assert.ok(q('.modal'), 'modal not rendered');
  assert.equal(qa('[data-i]').length, 6);
});

await step('filling the wizard creates the project', async () => {
  fill('[data-i="0"]', 'Void Wolves');
  fill('[data-i="1"]', 'Arena Tester');
  fill('[data-i="2"]', 'A test addon built by the smoke test.');
  fill('[data-i="3"]', 'voidpack');
  q('[data-i="4"]').value = '1.21.20';
  fill('[data-i="5"]', '1.2.0');
  q('[data-yes]').click();
  await tick();
  assert.equal(id('view-dashboard').hidden, false, 'not on the dashboard');
  assert.equal(BU.state.meta.name, 'Void Wolves');
  assert.equal(BU.state.meta.formatVersion, '1.21.20');
  assert.deepEqual(BU.state.meta.version, [1, 2, 0]);
});

await step('dashboard shows stats, cards and validation', async () => {
  assert.ok(id('dash-stats').children.length === 5);
  assert.equal(id('card-grid').children.length, 4);
  assert.ok(id('validation').children.length >= 1);
  assert.ok(id('filetree').children.length > 0, 'file tree empty');
});

/* ---- add an entity ---- */
await step('"New entity" opens the editor on the identity tab', async () => {
  q('[data-add="entity"]').click();
  assert.equal(id('view-editor').hidden, false);
  assert.equal(BU.state.entities.length, 1);
  assert.equal(qa('#ed-tabs .ed-tab').length, 7);
  assert.equal(id('ed-title').textContent, 'My Mob');
});

await step('editing the name updates the identifier and title', async () => {
  fill('#id-grid [data-f="name"]', 'Void Wolf');
  assert.equal(BU.state.entities[0].name, 'Void Wolf');
  assert.equal(BU.entryId(BU.state.entities[0]), 'voidpack:void_wolf');
});

await step('toggling minecraft:health writes real JSON', async () => {
  tab('Components');
  const node = qa('.comp').filter((n) => n.getAttribute('data-comp') === 'minecraft:health')[0];
  assert.ok(node, 'health component row missing');
  const toggle = q('[data-toggle]', node);
  assert.ok(toggle, 'toggle missing');
  toggle.checked = true;
  toggle.change();
  assert.ok(BU.state.entities[0].components['minecraft:health'], 'component not stored');
  const bp = BU.buildEntityBehavior(BU.state.entities[0]);
  assert.equal(bp['minecraft:entity'].components['minecraft:health'].value, 20);
});

await step('component fields are editable and re-render the preview', async () => {
  const node = qa('.comp').filter((n) => n.getAttribute('data-comp') === 'minecraft:health')[0];
  const input = q('[data-f="value"]', node);
  input.value = '42';
  input.input();
  const bp = BU.buildEntityBehavior(BU.state.entities[0]);
  assert.equal(bp['minecraft:entity'].components['minecraft:health'].value, 42);
  assert.ok(id('ed-preview').innerHTML.includes('42'), 'preview not updated');
});

await step('search filters the component list', async () => {
  const search = id('comp-search');
  search.value = 'navigation';
  search.input();
  const shown = qa('#comp-list .comp');
  assert.ok(shown.length >= 1 && shown.length < 45, 'search did not filter: ' + shown.length);
  search.value = 'zzzz-no-match';
  search.input();
  assert.ok(id('ed-body').querySelector('.empty'), 'no "no match" state');
  assert.equal(id('ed-body').children.length, 1, 'component tab was rendered twice');
});

await step('group chips filter the list without duplicating the panel', async () => {
  const search = id('comp-search');
  search.value = '';
  search.input();
  const chip = qa('[data-chip]').filter((c) => c.textContent === 'Combat')[0];
  assert.ok(chip, 'no Combat chip');
  chip.click();
  const panels = id('ed-body').children.filter((c) => c.attrs.class === 'panel');
  assert.equal(panels.length, 1, 'panel duplicated: ' + panels.length);
  const comps = qa('#comp-list .comp');
  assert.ok(comps.length >= 1 && comps.length < 45, 'chip did not filter');
  assert.ok(comps.every((n) => ['minecraft:attack', 'minecraft:damage_sensor', 'minecraft:angry', 'minecraft:loot', 'minecraft:behavior.melee_attack', 'minecraft:behavior.nearest_attackable_target', 'minecraft:behavior.hurt_by_target', 'minecraft:behavior.owner_hurt_by_target', 'minecraft:behavior.owner_hurt_target'].indexOf(n.getAttribute('data-comp')) >= 0), 'unexpected component outside the group');
});

await step('switching tabs renders every editor section', async () => {
  qa('#ed-tabs .ed-tab').forEach((t) => {
    t.click();
    assert.ok(id('ed-body').children.length >= 1, 'empty body for tab ' + t.textContent);
  });
});

await step('component groups and events can be created', async () => {
  tab('Groups');
  id('add-group').click();
  fill('[data-i="0"]', 'angry');
  q('[data-yes]').click();
  await tick();
  assert.ok(BU.state.entities[0].groups.angry, 'group not created');

  tab('Events');
  id('add-event').click();
  q('[data-yes]').click();
  await tick();
  assert.ok(BU.state.entities[0].events['minecraft:entity_spawned'], 'event not created');
});

await step('spawn rules toggle generates a spawn_rules file', async () => {
  tab('Spawning');
  const sw = q('#spawn-grid [data-f="enabled"]');
  sw.checked = true;
  sw.change();
  const paths = BU.buildFileTree().map((f) => f.path);
  assert.ok(paths.some((p) => p.indexOf('spawn_rules/') >= 0), 'no spawn rules generated');
});

await step('custom JSON components are merged', async () => {
  tab('Custom');
  id('add-custom').click();
  fill('[data-i="0"]', 'minecraft:interact');
  fill('[data-i="1"]', '{"interactions":[]}');
  q('[data-yes]').click();
  await tick();
  const bp = BU.buildEntityBehavior(BU.state.entities[0]);
  assert.deepEqual(bp['minecraft:entity'].components['minecraft:interact'], { interactions: [] });
});

/* ---- item + block + sound through the UI ---- */
await step('adding an item works end to end', async () => {
  q('[data-add="item"]').click();
  assert.equal(BU.state.items.length, 1);
  fill('#id-grid [data-f="name"]', 'Void Blade');
  tab('Components');
  const node = qa('.comp').filter((n) => n.getAttribute('data-comp') === 'minecraft:damage')[0];
  assert.ok(node, 'damage component row missing');
  const t = q('[data-toggle]', node);
  t.checked = true;
  t.change();
  const fresh = qa('.comp').filter((n) => n.getAttribute('data-comp') === 'minecraft:damage')[0];
  const inp = q('[data-f="value"]', fresh);
  inp.value = '9'; inp.input();
  const bp = BU.buildItemBehavior(BU.state.items[0]);
  assert.equal(bp['minecraft:item'].components['minecraft:damage'].value, 9);
});

await step('adding a block works end to end', async () => {
  q('[data-add="block"]').click();
  assert.equal(BU.state.blocks.length, 1);
  fill('#id-grid [data-f="name"]', 'Void Stone');
  const bp = BU.buildBlockBehavior(BU.state.blocks[0]);
  assert.equal(bp['minecraft:block'].components['minecraft:geometry'], 'minecraft:full_block');
  assert.ok(bp['minecraft:block'].components['minecraft:material_instances']);
});

await step('adding a sound works end to end', async () => {
  q('[data-add="sound"]').click();
  assert.equal(BU.state.sounds.length, 1);
  fill('#id-grid [data-f="name"]', 'howl');
  fill('#id-grid [data-f="event"]', 'voidpack.howl');
  // the audio upload goes through FileReader, which the mini DOM does not
  // implement, so simulate the stored file entry
  BU.state.sounds[0].files = [{ name: 'howl.ogg', data: 'data:audio/ogg;base64,T2dnUwAC', ext: '.ogg' }];
  const defs = BU.buildSoundDefinitions(true);
  assert.ok(defs.sound_definitions['voidpack.howl'], 'sound event missing');
  assert.equal(defs.sound_definitions['voidpack.howl'].sounds[0].name, 'sounds/howl');
});

/* ---- dashboard + export ---- */
await step('dashboard reflects all four content types', async () => {
  id('btn-ed-back').click();
  assert.equal(id('view-dashboard').hidden, false);
  const stats = id('dash-stats').textContent;
  assert.ok(stats.includes('1'), 'stats missing counts');
  const errors = BU.validate().filter((i) => i.level === 'error');
  assert.equal(errors.length, 0, errors.map((e) => e.msg).join(' | '));
});

await step('"Build Addon" opens the export dialog with a real tree', async () => {
  click('btn-build-2');
  assert.ok(q('.modal.wide'), 'build modal missing');
  assert.ok(q('.modal.wide .filetree'), 'file tree missing');
  assert.ok(qa('.modal.wide .filetree .row').length > 10, 'tree looks empty');
});

await step('exporting produces a .mcaddon blob', async () => {
  const before = downloads.length;
  await BU.exportMcaddon();
  assert.equal(downloads.length, before + 1, 'no download produced');
  const blob = downloads[downloads.length - 1];
  assert.ok(blob.size > 200, 'zip too small: ' + blob.size);
  const buf = await blob.arrayBuffer();
  const zip = await globalThis.JSZip.loadAsync(buf);
  const roots = new Set(Object.keys(zip.files).map((n) => n.split('/')[0]));
  assert.deepEqual([...roots].sort(), ['Void Wolves BP', 'Void Wolves RP']);
});

await step('exporting a single .mcpack strips the folder', async () => {
  await BU.exportMcpack('rp');
  const blob = downloads[downloads.length - 1];
  const zip = await globalThis.JSZip.loadAsync(await blob.arrayBuffer());
  assert.ok(zip.file('manifest.json'), 'manifest not at root');
  assert.ok(!Object.keys(zip.files).some((n) => n.indexOf('Void Wolves RP/') === 0));
});

await step('state survives a reload (localStorage)', async () => {
  assert.ok(store.has('bedrock-utility.project.v1'), 'nothing persisted');
  const saved = JSON.parse(store.get('bedrock-utility.project.v1'));
  assert.equal(saved.entities.length, 1);
  assert.equal(saved.meta.name, 'Void Wolves');
});

console.log(log.join('\n'));
console.log('\n' + (failures ? 'FAILED: ' + failures + ' step(s)' : 'PASSED: ' + log.length + ' steps') + '\n');
process.exit(failures ? 1 : 0);
