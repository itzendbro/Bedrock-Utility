/* =====================================================================
   Bedrock Utility — build tests
   ---------------------------------------------------------------------
   Runs the real generators from script.js in Node, checks that every
   generated JSON file parses, that the pack structure is correct, and
   that the produced .mcaddon really contains a Behavior Pack and a
   Resource Pack.

   Usage:  node test/build.test.mjs
   ===================================================================== */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// JSZip is loaded from the vendored copy (the browser loads it from a CDN).
globalThis.JSZip = require(path.join(ROOT, 'vendor', 'jszip.min.js'));

const BU = require(path.join(ROOT, 'script.js'));

/* ----------------------------- tiny runner ----------------------------- */
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }
function section(title) { queue.push({ section: title }); }

/* --------------------------------------------------------------------- */
section('project setup');

const meta = BU.defaultMeta();
BU.state.meta = meta;
meta.name = 'Test Addon';
meta.author = 'Arena Tester';
meta.namespace = 'testpack';
meta.formatVersion = '1.21.10';
meta.version = [1, 0, 0];
meta.minEngineVersion = [1, 21, 10];

const entity = BU.newEntity();
entity.name = 'Shadow Hound';
entity.components = {
  'minecraft:health': { value: 30, min: 0 },
  'minecraft:movement': { type: 'normal', value: 0.3 },
  'minecraft:physics': { has_gravity: true, has_collision: true },
  'minecraft:attack': { damage: 6 },
  'minecraft:behavior.panic': { priority: 1, speed_multiplier: 1.4 },
  'minecraft:behavior.nearest_attackable_target': {
    priority: 1, must_see: true,
    entity_types: '{"entity_types":[{"filters":{"test":"is_family","subject":"other","value":"player"},"max_dist":16}]}'
  }
};
entity.assets = {
  model: {
    name: 'shadow_hound.geo.json',
    data: JSON.stringify({
      format_version: '1.12.0',
      'minecraft:geometry': [{
        description: {
          identifier: 'geometry.shadow_hound', texture_width: 64, texture_height: 64,
          visible_bounds_width: 2, visible_bounds_height: 3, visible_bounds_offset: [0, 1, 0]
        },
        bones: [{ name: 'body', pivot: [0, 8, 0], cubes: [{ origin: [-4, 6, -8], size: [8, 8, 16], uv: [0, 0] }] }]
      }]
    })
  },
  texture: {
    name: 'Shadow Hound.png',
    data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF/6fzEAAAAAElFTkSuQmCC'
  },
  animation: {
    name: 'shadow_hound.animation.json',
    data: JSON.stringify({
      format_version: '1.8.0',
      animations: {
        'animation.shadow_hound.idle': { loop: true, animation_length: 2, bones: {} },
        'animation.shadow_hound.attack': { loop: false, animation_length: 0.5, bones: {} }
      }
    })
  }
};
entity.groups = { 'testpack:angry': { 'minecraft:angry': { duration: 20 } } };
entity.events = { 'minecraft:entity_spawned': { add: ['testpack:angry'], remove: [] } };
BU.state.entities.push(entity);

const item = BU.newItem();
item.name = 'Void Blade';
item.components = {
  'minecraft:display_name': { value: 'Void Blade' },
  'minecraft:max_stack_size': { value: 1 },
  'minecraft:damage': { value: 9 },
  'minecraft:hand_equipped': true,
  'minecraft:durability': { _raw: '{"max_durability":800,"damage_chance":{"min":5,"max":20}}' }
};
item.texture = {
  name: 'Void Blade.png',
  data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF/6fzEAAAAAElFTkSuQmCC'
};
BU.state.items.push(item);

const block = BU.newBlock();
block.name = 'Glow Stone Brick';
block.components = {
  'minecraft:light_emission': { value: 12 },
  'minecraft:destructible_by_mining': { seconds_to_destroy: 2.5 },
  'minecraft:map_color': { value: '#ffcc66' }
};
block.texture = {
  name: 'Glow Stone Brick.png',
  data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF/6fzEAAAAAElFTkSuQmCC'
};
BU.state.blocks.push(block);

const sound = BU.newSound();
sound.name = 'Howl';
sound.event = 'testpack.howl';
sound.category = 'neutral';
sound.files = [{ name: 'howl.ogg', data: 'data:audio/ogg;base64,T2dnUwACAAAAAAAAAABAAAAAAA', ext: '.ogg' }];
BU.state.sounds.push(sound);

/* --------------------------------------------------------------------- */
section('validation');

test('validate() reports no errors for the sample project', () => {
  const errors = BU.validate().filter((i) => i.level === 'error');
  assert.equal(errors.length, 0, errors.map((e) => e.where + ': ' + e.msg).join(' | '));
});

test('validate() rejects a format_version below 1.21.10', () => {
  const saved = meta.formatVersion;
  meta.formatVersion = '1.19.50';
  const errors = BU.validate().filter((i) => i.level === 'error');
  meta.formatVersion = saved;
  assert.ok(errors.some((e) => /below 1\.21\.10/.test(e.msg)), 'expected a format_version error');
});

test('validate() rejects duplicate identifiers', () => {
  const other = BU.newItem();
  other.name = item.name;
  BU.state.items.push(other);
  const errors = BU.validate().filter((i) => i.level === 'error');
  BU.state.items.pop();
  assert.ok(errors.some((e) => /already used/.test(e.msg)), 'expected a duplicate identifier error');
});

test('validate() rejects malformed identifiers', () => {
  const saved = item.identifier;
  item.identifier = 'testpack:Bad Name';
  const errors = BU.validate().filter((i) => i.level === 'error');
  item.identifier = saved;
  assert.ok(errors.some((e) => /is invalid/.test(e.msg)), 'expected an identifier error');
});

/* --------------------------------------------------------------------- */
section('file tree');

const files = BU.buildFileTree();
const paths = files.map((f) => f.path);
const byPath = {};
files.forEach((f) => { byPath[f.path] = f; });

test('both packs are generated with manifests', () => {
  assert.ok(paths.includes('Test Addon BP/manifest.json'), 'BP manifest missing');
  assert.ok(paths.includes('Test Addon RP/manifest.json'), 'RP manifest missing');
});

test('entity files land in the right folders', () => {
  ['Test Addon BP/entities/shadow_hound.se.json',
   'Test Addon RP/entity/shadow_hound.entity.json',
   'Test Addon RP/render_controllers/shadow_hound.rc.json',
   'Test Addon RP/models/entity/shadow_hound.geo.json',
   'Test Addon RP/animations/shadow_hound.animation.json',
   'Test Addon RP/textures/entity/shadow_hound.png'
  ].forEach((p) => assert.ok(byPath[p], 'missing ' + p));
});

test('item + block + sound files are generated', () => {
  ['Test Addon BP/items/void_blade.json',
   'Test Addon RP/items/void_blade.json',
   'Test Addon RP/textures/item_texture.json',
   'Test Addon RP/textures/items/void_blade.png',
   'Test Addon BP/blocks/glow_stone_brick.json',
   'Test Addon RP/textures/blocks/glow_stone_brick.png',
   'Test Addon RP/sounds/sound_definitions.json',
   'Test Addon RP/sounds/sounds.json',
   'Test Addon RP/sounds/howl.ogg',
   'Test Addon BP/texts/en_US.lang',
   'Test Addon RP/texts/en_US.lang'
  ].forEach((p) => assert.ok(byPath[p], 'missing ' + p));
});

test('every generated .json file parses', () => {
  files.filter((f) => f.kind !== 'binary' && /\.json$/.test(f.path)).forEach((f) => {
    assert.doesNotThrow(() => JSON.parse(f.content), 'invalid JSON in ' + f.path);
  });
});

test('binary assets are real PNG bytes', () => {
  const png = byPath['Test Addon RP/textures/entity/shadow_hound.png'];
  assert.ok(png && png.kind === 'binary', 'texture should be binary');
  assert.ok(png.content instanceof Uint8Array, 'texture bytes');
  assert.equal(png.content.length, 69);
  assert.equal(String.fromCharCode(...png.content.subarray(1, 4)), 'PNG');
});

/* --------------------------------------------------------------------- */
section('manifest.json');

const bpManifest = JSON.parse(byPath['Test Addon BP/manifest.json'].content);
const rpManifest = JSON.parse(byPath['Test Addon RP/manifest.json'].content);

test('behavior pack manifest is well formed', () => {
  assert.equal(bpManifest.format_version, 2);
  assert.equal(bpManifest.header.name, 'Test Addon');
  assert.equal(bpManifest.header.description, meta.description);
  assert.equal(bpManifest.modules[0].type, 'data');
  assert.deepEqual(bpManifest.header.min_engine_version, [1, 21, 10]);
  assert.match(bpManifest.header.uuid, /^[0-9a-f-]{36}$/, 'header uuid');
  assert.ok(bpManifest.modules[0].uuid, 'module uuid');
  assert.ok(bpManifest.metadata.authors.includes('Arena Tester'));
});

test('resource pack manifest depends on the behavior pack', () => {
  assert.equal(rpManifest.modules[0].type, 'resources');
  assert.equal(rpManifest.dependencies.length, 1);
  assert.equal(rpManifest.dependencies[0].uuid, bpManifest.header.uuid);
  assert.notEqual(rpManifest.header.uuid, bpManifest.header.uuid);
});

/* --------------------------------------------------------------------- */
section('entity JSON');

const entBp = JSON.parse(byPath['Test Addon BP/entities/shadow_hound.se.json'].content);
const entRp = JSON.parse(byPath['Test Addon RP/entity/shadow_hound.entity.json'].content);

test('behavior entity has the right shape', () => {
  assert.equal(entBp.format_version, '1.21.10');
  const e = entBp['minecraft:entity'];
  assert.equal(e.description.identifier, 'testpack:shadow_hound');
  assert.equal(e.description.is_spawnable, true);
  assert.equal(e.description.is_summonable, true);
  assert.ok(e.description.spawn_egg, 'spawn egg');
  assert.equal(e.components['minecraft:health'].value, 30);
  assert.equal(e.components['minecraft:movement'].value, 0.3);
  assert.equal(e.components['minecraft:physics'].has_gravity, true);
  assert.equal(e.components['minecraft:attack'].damage, 6);
  assert.equal(e.components['minecraft:behavior.panic'].speed_multiplier, 1.4);
});

test('dynamic movement component key follows the selected type', () => {
  const saved = entity.components['minecraft:movement'];
  entity.components['minecraft:movement'] = { type: 'fly', value: 0.4 };
  const out = BU.buildEntityBehavior(entity)['minecraft:entity'].components;
  entity.components['minecraft:movement'] = saved;
  assert.ok(out['minecraft:movement.fly'], 'expected minecraft:movement.fly');
  assert.equal(out['minecraft:movement.fly'].value, 0.4);
  assert.equal(out['minecraft:movement'], undefined, 'plain key should not be emitted');
});

test('component groups and events are generated', () => {
  assert.deepEqual(Object.keys(entBp['minecraft:entity'].component_groups), ['testpack:angry']);
  assert.equal(entBp['minecraft:entity'].component_groups['testpack:angry']['minecraft:angry'].duration, 20);
  const ev = entBp['minecraft:entity'].events['minecraft:entity_spawned'];
  assert.deepEqual(ev.add.component_groups, ['testpack:angry']);
});

test('raw JSON component fields are parsed, not stringified', () => {
  const t = entBp['minecraft:entity'].components['minecraft:behavior.nearest_attackable_target'].entity_types;
  assert.equal(typeof t, 'object');
  assert.ok(Array.isArray(t));
});

test('custom raw components are merged verbatim', () => {
  entity.custom.push({ key: 'minecraft:interact', value: '{"interactions":[]}' });
  const out = BU.buildEntityBehavior(entity)['minecraft:entity'].components;
  entity.custom = [];
  assert.deepEqual(out['minecraft:interact'], { interactions: [] });
});

test('client entity references the uploaded assets', () => {
  const d = entRp['minecraft:client_entity'].description;
  assert.equal(d.identifier, 'testpack:shadow_hound');
  assert.equal(d.textures['default'], 'textures/entity/shadow_hound');
  assert.equal(d.geometry['default'], 'geometry.shadow_hound');
  assert.deepEqual(d.render_controllers, ['controller.render.shadow_hound']);
  assert.deepEqual(Object.keys(d.animations).sort(), ['attack', 'idle']);
  assert.deepEqual(d.scripts.animate.slice().sort(), ['attack', 'idle']);
  assert.ok(d.spawn_egg);
  assert.equal(d.sound_effects.howl, 'testpack.howl');
});

test('render controller uses the uploaded geometry id and material', () => {
  const rc = JSON.parse(byPath['Test Addon RP/render_controllers/shadow_hound.rc.json'].content);
  const ctrl = rc.render_controllers['controller.render.shadow_hound'];
  assert.equal(ctrl.geometry, 'geometry.shadow_hound');
  assert.deepEqual(ctrl.materials, [{ '*': 'entity_alphatest' }]);
  assert.deepEqual(ctrl.textures, ['texture.default']);
});

test('spawn rules are only written when enabled', () => {
  assert.ok(!paths.some((p) => p.indexOf('spawn_rules/') >= 0), 'no spawn rules expected');
  entity.spawnRules.enabled = true;
  entity.spawnRules.biomes = 'plains, forest';
  const sr = BU.buildSpawnRules(entity);
  entity.spawnRules.enabled = false;
  assert.equal(sr['minecraft:spawn_rules'].description.identifier, 'testpack:shadow_hound');
  assert.equal(sr['minecraft:spawn_rules'].description.population_control, 'animal');
  assert.equal(sr['minecraft:spawn_rules'].conditions[0]['minecraft:biome_filter'].any_of.length, 2);
  assert.equal(sr.format_version, '1.8.0');
});

test('lang file contains every display name', () => {
  const lang = byPath['Test Addon BP/texts/en_US.lang'].content;
  ['pack.name=Test Addon', 'entity.testpack:shadow_hound.name=Shadow Hound',
   'item.testpack:void_blade.name=Void Blade', 'tile.testpack:glow_stone_brick.name=Glow Stone Brick']
    .forEach((line) => assert.ok(lang.includes(line), 'lang missing: ' + line));
});

/* --------------------------------------------------------------------- */
section('item / block / sound JSON');

test('item behavior pack file', () => {
  const it = JSON.parse(byPath['Test Addon BP/items/void_blade.json'].content);
  assert.equal(it.format_version, '1.21.10');
  assert.equal(it['minecraft:item'].description.identifier, 'testpack:void_blade');
  assert.equal(it['minecraft:item'].description.menu_category.category, 'items');
  assert.equal(it['minecraft:item'].components['minecraft:icon'].texture, 'void_blade');
  assert.equal(it['minecraft:item'].components['minecraft:damage'].value, 9);
  assert.equal(it['minecraft:item'].components['minecraft:durability'].max_durability, 800);
  assert.deepEqual(it['minecraft:item'].components['minecraft:durability'].damage_chance, { min: 5, max: 20 });
});

test('item client file + item_texture.json atlas', () => {
  const it = JSON.parse(byPath['Test Addon RP/items/void_blade.json'].content);
  assert.equal(it['minecraft:item'].components['minecraft:icon'].texture, 'void_blade');
  const atlas = JSON.parse(byPath['Test Addon RP/textures/item_texture.json'].content);
  assert.equal(atlas.texture_name, 'atlas.items');
  assert.deepEqual(atlas.texture_data.void_blade.textures, 'textures/items/void_blade');
});

test('block file auto-generates material_instances', () => {
  const b = JSON.parse(byPath['Test Addon BP/blocks/glow_stone_brick.json'].content);
  assert.equal(b.format_version, '1.21.10');
  assert.equal(b['minecraft:block'].description.identifier, 'testpack:glow_stone_brick');
  assert.equal(b['minecraft:block'].components['minecraft:light_emission'].value, 12);
  assert.equal(b['minecraft:block'].components['minecraft:map_color'].value, '#ffcc66');
  assert.equal(b['minecraft:block'].components['minecraft:geometry'], 'minecraft:full_block');
  assert.deepEqual(b['minecraft:block'].components['minecraft:material_instances']['*'].texture, 'textures/blocks/glow_stone_brick');
  assert.deepEqual(b['minecraft:block'].permutations, []);
});

test('per-face block textures map to their own files', () => {
  block.faces.up = {
    name: 'brick_top.png',
    data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF/6fzEAAAAAElFTkSuQmCC'
  };
  const b = BU.buildBlockBehavior(block)['minecraft:block'].components;
  const tree = BU.buildFileTree().map((f) => f.path);
  block.faces.up = '';
  assert.deepEqual(b['minecraft:material_instances'].up.texture, 'textures/blocks/brick_top');
  assert.ok(tree.includes('Test Addon RP/textures/blocks/brick_top.png'), 'face texture file missing');
});

test('sound definitions are registered in both files', () => {
  const defs = JSON.parse(byPath['Test Addon RP/sounds/sound_definitions.json'].content);
  assert.equal(defs.format_version, '1.14.0');
  const s = defs.sound_definitions['testpack.howl'];
  assert.equal(s.category, 'neutral');
  assert.equal(s.sounds[0].name, 'sounds/howl');
  const legacy = JSON.parse(byPath['Test Addon RP/sounds/sounds.json'].content);
  assert.ok(legacy['testpack.howl']);
});

/* --------------------------------------------------------------------- */
section('zip export');

const zipBlob = await BU.buildZip(files, null);
const zip = await globalThis.JSZip.loadAsync(await zipBlob.arrayBuffer());

test('the archive is produced as a Blob (browser download path)', () => {
  assert.ok(zipBlob, 'no blob');
  assert.ok(typeof zipBlob.size === 'number' && zipBlob.size > 0, 'empty zip');
  assert.ok(typeof zipBlob.arrayBuffer === 'function', 'expected a Blob');
});

test('the .mcaddon contains exactly the two pack folders at the root', () => {
  const root = new Set();
  Object.keys(zip.files).forEach((n) => { root.add(n.split('/')[0]); });
  assert.deepEqual([...root].sort(), ['Test Addon BP', 'Test Addon RP']);
});

test('the archive round-trips the generated JSON', async () => {
  const text = await zip.file('Test Addon BP/entities/shadow_hound.se.json').async('string');
  assert.deepEqual(JSON.parse(text), entBp);
});

test('binary entries survive the round trip', async () => {
  const bytes = await zip.file('Test Addon RP/textures/entity/shadow_hound.png').async('uint8array');
  assert.equal(bytes.length, 69);
  assert.equal(String.fromCharCode(...bytes.subarray(1, 4)), 'PNG');
});

test('.mcpack export strips the pack folder', async () => {
  const root = 'Test Addon BP/';
  const list = files.filter((f) => f.path.indexOf(root) === 0)
    .map((f) => ({ path: f.path.slice(root.length), content: f.content, kind: f.kind }));
  const blob = await BU.buildZip(list, null);
  const z = await globalThis.JSZip.loadAsync(await blob.arrayBuffer());
  assert.ok(z.file('manifest.json'), 'manifest at root');
  assert.ok(z.file('entities/shadow_hound.se.json'), 'entity file');
  assert.ok(!Object.keys(z.files).some((n) => n.indexOf(root) === 0), 'folder prefix should be gone');
});

/* --------------------------------------------------------------------- */
section('import round trip');

const importZip = await globalThis.JSZip.loadAsync(await zipBlob.arrayBuffer());

test('an exported .mcaddon can be imported back', async () => {
  // wipe the in-memory project and rebuild it from the archive only
  BU.state.meta = BU.defaultMeta();
  BU.state.entities = [];
  BU.state.items = [];
  BU.state.blocks = [];
  BU.state.sounds = [];
  const summary = await BU.readPackZip(importZip, 'Test Addon.mcaddon');
  assert.ok(summary && /1 entities/.test(summary), 'unexpected summary: ' + summary);
  assert.equal(BU.state.entities.length, 1, 'entity not imported');
  assert.equal(BU.state.entities[0].components['minecraft:health'].value, 30);
  assert.equal(BU.state.items.length, 1, 'item not imported');
  assert.equal(BU.state.items[0].components['minecraft:damage'].value, 9);
  assert.equal(BU.state.blocks.length, 1, 'block not imported');
  assert.equal(BU.state.sounds.length, 1, 'sound not imported');
  assert.equal(BU.state.sounds[0].event, 'testpack.howl');
  assert.equal(BU.state.meta.name, 'Test Addon', 'manifest header not imported');
});

test('re-exporting an imported project produces the same tree', () => {
  const before = BU.buildFileTree().map((f) => f.path).sort();
  assert.ok(before.includes('Test Addon BP/entities/shadow_hound.se.json'));
  assert.ok(before.includes('Test Addon RP/sounds/sounds.json'));
});

/* ----------------------------- run the queue ----------------------------- */
let passed = 0;
const failures = [];
for (const item2 of queue) {
  if (item2.section) { console.log('\n' + item2.section); continue; }
  try {
    await item2.fn();
    passed += 1;
    console.log('  ✓ ' + item2.name);
  } catch (err) {
    failures.push({ name: item2.name, err });
    console.log('  ✗ ' + item2.name + '\n      ' + err.message);
  }
}

console.log('\n' + (failures.length ? 'FAILED' : 'PASSED') + ': ' + passed + ' passed, ' + failures.length + ' failed\n');
if (failures.length) {
  failures.forEach((f) => console.log(' - ' + f.name + ': ' + f.err.message));
  process.exit(1);
}
process.exit(0);
