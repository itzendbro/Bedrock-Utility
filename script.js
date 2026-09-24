/* =====================================================================
   Bedrock Utility — script.js
   A no-code Minecraft Bedrock (MCPE 1.21.10+) addon creation hub.

   Structure of this file
   ---------------------------------------------------------------------
     1. Utilities
     2. Constants (Bedrock format versions, categories, …)
     3. Project state + persistence
     4. Component schemas (the "no-code" source of truth)
     5. JSON generators (behavior pack / resource pack)
     6. File tree builder + zip/export
     7. Validation
     8. UI: router, home, dashboard
     9. UI: component editor
    10. Boot

   The module is written as a UMD-ish factory so the pure builder logic
   (sections 1-7) can be required from Node for automated tests:
       node test/build.test.mjs
   ===================================================================== */

(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.BedrockUtility = api;
  if (typeof document !== 'undefined' && document.getElementById('app')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { api.mount(); });
    } else {
      api.mount();
    }
  }
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  /* =================================================================
     1. UTILITIES
     ================================================================= */

  var SEQ = 0;
  function uid(prefix) {
    SEQ += 1;
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + SEQ.toString(36);
  }

  function uuid() {
    var c = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : null;
    if (c) return c;
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (ch) {
      var r = (Math.random() * 16) | 0;
      var v = ch === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

  /** Lowercase snake-case identifier fragment accepted by Minecraft. */
  function slug(s) {
    return String(s || '').toLowerCase().trim()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'unnamed';
  }

  /** Slug for a texture / sound file name (keeps the extension out). */
  function slugFile(name) {
    var base = String(name || '').replace(/\.[a-z0-9]+$/i, '');
    return slug(base) || 'file';
  }

  function isNonEmpty(v) { return v !== undefined && v !== null && v !== '' && v !== false; }

  function dataUrlToBytes(dataUrl) {
    var m = /^data:([^;,]*)(;base64)?,(.*)$/.exec(String(dataUrl));
    if (!m) return null;
    var raw = m[3];
    if (m[2]) {
      var bin = atob(raw), out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new TextEncoder().encode(decodeURIComponent(raw));
  }

  function bytesToDataUrl(bytes, mime) {
    var bin = '', chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return 'data:' + mime + ';base64,' + btoa(bin);
  }

  function formatBytes(n) {
    if (n == null) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }

  function fileSize(entry) {
    if (!entry) return 0;
    if (entry.bytes) return entry.bytes.length;
    if (typeof entry.content === 'string') return new TextEncoder().encode(entry.content).length;
    return 0;
  }

  /** Compare two Bedrock format versions: -1, 0, 1 */
  function cmpVer(a, b) {
    var pa = String(a || '0').split('.').map(Number);
    var pb = String(b || '0').split('.').map(Number);
    for (var i = 0; i < Math.max(pa.length, pb.length); i += 1) {
      var x = pa[i] || 0, y = pb[i] || 0;
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  }

  function jsonStr(obj, pretty) {
    return JSON.stringify(obj, null, pretty === false ? 0 : 2);
  }

  /** Tiny JSON syntax highlighter for the live preview panes. */
  function highlightJson(text) {
    var s = esc(text);
    s = s.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      function (m) {
        var cls = 'n';
        if (/^"/.test(m)) cls = /:$/.test(m) ? 'k' : 's';
        else if (/true|false/.test(m)) cls = 'b';
        else if (/null/.test(m)) cls = 'b';
        return '<span class="' + cls + '">' + m + '</span>';
      });
    return s;
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 120);
    };
  }

  /* =================================================================
     2. CONSTANTS
     ================================================================= */

  /** Every Bedrock engine version the generator can target. */
  var FORMAT_VERSIONS = [
    '1.21.10', '1.21.20', '1.21.30', '1.21.40', '1.21.50', '1.21.60',
    '1.21.70', '1.21.80', '1.21.90', '1.21.100', '1.21.110', '1.21.120',
    '1.26.0', '1.26.10', '1.26.20', '1.26.30', '1.26.40', '1.26.50'
  ];
  var MIN_FORMAT_VERSION = '1.21.10';

  /** Fixed format versions of resource-pack side files. */
  var RP_FORMAT = {
    clientEntity: '1.10.0',
    renderController: '1.10.0',
    animation: '1.8.0',
    geometry: '1.12.0',
    item: '1.20.60',
    soundDefinitions: '1.14.0',
    spawnRules: '1.8.0',
    attachable: '1.10.0',
    animationController: '1.10.0'
  };

  var ITEM_CATEGORIES = ['construction', 'nature', 'equipment', 'items', 'none'];
  var ITEM_GROUPS = ['', 'itemGroup.name.sword', 'itemGroup.name.axe', 'itemGroup.name.pickaxe',
    'itemGroup.name.shovel', 'itemGroup.name.hoe', 'itemGroup.name.helmet', 'itemGroup.name.chestplate',
    'itemGroup.name.leggings', 'itemGroup.name.boots', 'itemGroup.name.bow', 'itemGroup.name.arrow',
    'itemGroup.name.food', 'itemGroup.name.potion', 'itemGroup.name.blocks', 'itemGroup.name.decorations',
    'itemGroup.name.miscFood', 'itemGroup.name.boat', 'itemGroup.name.minecart', 'itemGroup.name.chestboat'];
  var BLOCK_CATEGORIES = ['construction', 'nature', 'equipment', 'items', 'none'];
  var SOUND_CATEGORIES = ['master', 'music', 'record', 'weather', 'block', 'hostile', 'neutral',
    'player', 'ambient', 'ui', 'creative'];
  var POPULATION_CONTROLS = ['animal', 'monster', 'water_animal', 'villager', 'ambient', 'cat', 'none'];
  var RENDER_CONTROLLERS = [
    'controller.render.default',
    'controller.render.humanoid',
    'controller.render.squid',
    'controller.render.spider',
    'controller.render.creeper',
    'controller.render.sheep',
    'controller.render.cow',
    'controller.render.chicken',
    'controller.render.villager',
    'controller.render.witch',
    'controller.render.irongolem',
    'controller.render.snowgolem'
  ];
  var MATERIALS = ['entity_alphatest', 'entity', 'entity_emissive_alpha', 'entity_alphablend',
    'entity_multitexture_masked', 'spider', 'slime', 'guardian', 'drowned', 'shulker'];

  /** Vanilla runtime identifiers usable as a behaviour base. */
  var VANILLA_MOBS = [
    '', 'minecraft:zombie', 'minecraft:skeleton', 'minecraft:creeper', 'minecraft:spider',
    'minecraft:enderman', 'minecraft:witch', 'minecraft:slime', 'minecraft:blaze',
    'minecraft:pig', 'minecraft:cow', 'minecraft:sheep', 'minecraft:chicken', 'minecraft:wolf',
    'minecraft:villager', 'minecraft:iron_golem', 'minecraft:snow_golem', 'minecraft:husk',
    'minecraft:stray', 'minecraft:phantom', 'minecraft:ravager', 'minecraft:warden',
    'minecraft:allay', 'minecraft:axolotl', 'minecraft:goat', 'minecraft:strider', 'minecraft:turtle'
  ];

  var KINDS = {
    entity: { label: 'Entity', plural: 'Entities', bp: 'entities', rp: 'entity', color: '#4ade80', icon: 'mob' },
    item: { label: 'Item', plural: 'Items', bp: 'items', rp: 'items', color: '#4ade80', icon: 'item' },
    block: { label: 'Block', plural: 'Blocks', bp: '', rp: '', color: '#4ade80', icon: 'block' },
    sound: { label: 'Sound', plural: 'Sounds', bp: '', rp: 'sounds', color: '#4ade80', icon: 'sound' }
  };

  var REGISTRY_KEY = 'bedrock-utility.addons.v1';
  var LEGACY_KEY = 'bedrock-utility.project.v1';

  /* =================================================================
     3. ADDON LIBRARY + PERSISTENCE
     -----------------------------------------------------------------
     The browser holds a library of addons, not just one. Every addon is
     a full snapshot { id, meta, entities, items, blocks, sounds }. The
     one you are editing is loaded into `state`; everything else stays
     in the registry until you open it.
     ================================================================= */

  var state = {
    id: null,
    meta: null,
    entities: [],
    items: [],
    blocks: [],
    sounds: []
  };

  function newAddonId() { return 'addon-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6); }

  function loadRegistry() {
    if (typeof localStorage === 'undefined') return [];
    var list = [];
    try {
      var raw = localStorage.getItem(REGISTRY_KEY);
      list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
    } catch (err) { list = []; }
    if (!list.length) list = migrateLegacy();
    return list;
  }

  /** One-time move from the old single-project key. */
  function migrateLegacy() {
    if (typeof localStorage === 'undefined') return [];
    try {
      var raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return [];
      var d = JSON.parse(raw);
      if (!d || !d.meta || !d.meta.name) return [];
      var one = [normalizeAddon({
        id: newAddonId(), meta: d.meta,
        entities: d.entities || [], items: d.items || [], blocks: d.blocks || [], sounds: d.sounds || []
      })];
      try { localStorage.setItem(REGISTRY_KEY, JSON.stringify(one)); } catch (e2) { /* ignore */ }
      return one;
    } catch (err) { return []; }
  }

  function normalizeAddon(a) {
    a = a || {};
    return {
      id: a.id || newAddonId(),
      meta: a.meta || null,
      entities: a.entities || [],
      items: a.items || [],
      blocks: a.blocks || [],
      sounds: a.sounds || []
    };
  }

  function saveRegistry(list) {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.setItem(REGISTRY_KEY, JSON.stringify(list)); }
    catch (err) { /* quota — caller retries lighter */ }
  }

  var listeners = [];
  function onChange() {
    if (state.meta) state.meta.updatedAt = new Date().toISOString();
    persist();
    for (var i = 0; i < listeners.length; i += 1) listeners[i]();
  }
  var scheduleChange = debounce(onChange, 180);

  function defaultMeta() {
    return {
      name: 'My First Addon',
      author: 'YourName',
      description: 'A Minecraft Bedrock addon created with Bedrock Utility.',
      namespace: 'mypack',
      version: [1, 0, 0],
      minEngineVersion: [1, 21, 10],
      formatVersion: '1.21.10',
      bpUuid: uuid(),
      rpUuid: uuid(),
      bpModuleUuid: uuid(),
      rpModuleUuid: uuid(),
      icon: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function newEntity() {
    return {
      uid: uid('ent'),
      kind: 'entity',
      name: 'My Mob',
      identifier: '',
      runtimeIdentifier: '',
      isSpawnable: true,
      isSummonable: true,
      isExperimental: false,
      spawnEgg: true,
      baseColor: '#9fb3b3',
      overlayColor: '#bdd1d1',
      material: 'entity_alphatest',
      renderController: 'custom',
      animationShort: 'idle',
      assets: { model: null, texture: null, animation: null },
      components: {},
      groups: {},
      events: {},
      custom: [],
      spawnRules: {
        enabled: false,
        populationControl: 'animal',
        biomes: 'plains, forest',
        brightnessMin: 0,
        brightnessMax: 15,
        difficulty: 'easy',
        heightMin: 0,
        heightMax: 128,
        spawnDelay: 20
      }
    };
  }

  function newItem() {
    return {
      uid: uid('item'),
      kind: 'item',
      name: 'My Item',
      identifier: '',
      category: 'items',
      group: '',
      hiddenInCommands: false,
      texture: null,
      components: {},
      custom: []
    };
  }

  function newBlock() {
    return {
      uid: uid('blk'),
      kind: 'block',
      name: 'My Block',
      identifier: '',
      category: 'construction',
      render: 'cube',
      renderMethod: 'opaque',
      texture: null,
      faces: { up: '', down: '', north: '', south: '', east: '', west: '' },
      components: {},
      custom: []
    };
  }

  function newSound() {
    return {
      uid: uid('snd'),
      kind: 'sound',
      name: 'my_sound',
      event: '',
      category: 'neutral',
      volume: 1,
      pitch: 1,
      stream: false,
      loadOnLowMemory: true,
      files: []
    };
  }

  function hasProject() { return !!(state.meta && state.meta.name); }

  function namespace() { return state.meta ? slug(state.meta.namespace) : 'mypack'; }

  /** Resolve an entry identifier, auto-filling it from its display name. */
  function entryId(entry) {
    if (entry.identifier && entry.identifier.indexOf(':') > 0) return entry.identifier.trim();
    return namespace() + ':' + slug(entry.name);
  }

  function getList(kind) {
    return kind === 'entity' ? state.entities : kind === 'item' ? state.items : kind === 'block' ? state.blocks : state.sounds;
  }

  function findEntry(kind, uidToFind) {
    var list = getList(kind);
    for (var i = 0; i < list.length; i += 1) if (list[i].uid === uidToFind) return list[i];
    return null;
  }

  /* ---------------------------- persistence ---------------------------- */

  /** Drop the heavy base64 payloads so a snapshot fits the 5 MB quota. */
  function stripAssets(a) {
    var light = clone(a);
    ['entities', 'items', 'blocks'].forEach(function (k) {
      (light[k] || []).forEach(function (e) {
        if (e.texture) delete e.texture.data;
        if (e.assets) {
          ['model', 'texture', 'animation'].forEach(function (x) { if (e.assets[x]) delete e.assets[x].data; });
        }
        (e.files || []).forEach(function (f) { delete f.data; });
      });
    });
    return light;
  }

  function persist() {
    if (typeof localStorage === 'undefined') return;
    if (!state.meta) return;
    var list = loadRegistry();
    var mine = normalizeAddon(clone(state));
    var at = -1;
    for (var i = 0; i < list.length; i += 1) if (list[i].id === mine.id) { at = i; break; }
    if (at >= 0) list[at] = mine; else list.push(mine);
    try {
      saveRegistry(list);
    } catch (err) {
      // Most likely the 5 MB quota: retry without the heavy base64 assets.
      try {
        var light = stripAssets(mine);
        if (at >= 0) list[at] = light; else list[list.length - 1] = light;
        saveRegistry(list);
      } catch (err2) { /* give up silently */ }
    }
  }

  /** Load the library into memory. Nothing is opened yet. */
  function restore() {
    if (typeof localStorage === 'undefined') return false;
    return loadRegistry().length > 0;
  }

  /** Put one stored addon into `state` so it can be edited. */
  function openAddon(id) {
    var list = loadRegistry();
    var found = null;
    for (var i = 0; i < list.length; i += 1) if (list[i].id === id) { found = list[i]; break; }
    if (!found) return false;
    var a = normalizeAddon(found);
    state.id = a.id;
    state.meta = Object.assign(defaultMeta(), a.meta);
    state.entities = a.entities;
    state.items = a.items;
    state.blocks = a.blocks;
    state.sounds = a.sounds;
    return true;
  }

  /** Close the addon being edited without deleting it. */
  function closeAddon() {
    state.id = null;
    state.meta = null;
    state.entities = [];
    state.items = [];
    state.blocks = [];
    state.sounds = [];
  }

  function deleteAddon(id) {
    var list = loadRegistry().filter(function (a) { return a.id !== id; });
    saveRegistry(list);
    if (state.id === id) closeAddon();
    return list;
  }

  function addonSummary(a) {
    var counts = [a.entities.length, a.items.length, a.blocks.length, a.sounds.length];
    return {
      entities: counts[0], items: counts[1], blocks: counts[2], sounds: counts[3],
      total: counts[0] + counts[1] + counts[2] + counts[3]
    };
  }

  /**
   * Point `state` at an addon we may write into. The current one is
   * reused while it is still empty; otherwise a fresh one is started so
   * importing never overwrites work the user already did.
   */
  function ensureAddonSlot() {
    var hasWork = !!(state.entities.length || state.items.length || state.blocks.length || state.sounds.length);
    if (!state.meta || hasWork || state.meta.imported) {
      state.id = newAddonId();
      state.meta = defaultMeta();
      state.entities = [];
      state.items = [];
      state.blocks = [];
      state.sounds = [];
    }
    return state;
  }

  function resetProject() {
    state.meta = defaultMeta();
    state.entities = [];
    state.items = [];
    state.blocks = [];
    state.sounds = [];
    onChange();
  }

  /* =================================================================
     4. COMPONENT SCHEMAS
     The declarative source of truth behind the no-code forms. Each
     entry describes one Minecraft component: its JSON key, a human
     label, and the input fields that make up its value.
     ================================================================= */

  var FIELD_TYPES = ['text', 'num', 'int', 'bool', 'select', 'list', 'color', 'raw', 'vec3'];

  /** Field factory. type ∈ text|num|int|bool|select|list|color|raw|vec3 */
  function F(key, label, type, def, help, extra) {
    return Object.assign({ key: key, label: label, type: type, def: def, help: help || '' }, extra || {});
  }

  /** Component factory. */
  function C(id, group, label, desc, fields, extra) {
    return Object.assign({ id: id, group: group, label: label, desc: desc, fields: fields || [] }, extra || {});
  }

  var DAMAGE_SENSOR_TEMPLATE = [
    '{',
    '  "triggers": [',
    '    {',
    '      "on_damage": { "filters": "in_wall_or_risky" },',
    '      "deals_damage": false',
    '    }',
    '  ]',
    '}'
  ].join('\n');

  var ENV_SENSOR_TEMPLATE = [
    '{',
    '  "triggers": [',
    '    {',
    '      "filters": { "test": "is_missing_health" },',
    '      "event": "my_pack:on_low_health"',
    '    }',
    '  ]',
    '}'
  ].join('\n');

  var TARGET_TYPES_TEMPLATE = [
    '{',
    '  "entity_types": [',
    '    {',
    '      "filters": { "any_of": [',
    '        { "test": "is_family", "subject": "other", "value": "player" },',
    '        { "test": "is_family", "subject": "other", "value": "monster" }',
    '      ] },',
    '      "max_dist": 16',
    '    }',
    '  ]',
    '}'
  ].join('\n');

  var DIGGER_TEMPLATE = [
    '{',
    '  "destroy_speeds": [',
    '    { "block": "minecraft:dirt", "speed": 4 },',
    '    { "block": { "tags": "q.any_tag(\"stone\")" }, "speed": 6 }',
    '  ],',
    '  "use_efficiency": true',
    '}'
  ].join('\n');

  var DURABILITY_TEMPLATE = [
    '{',
    '  "max_durability": 250,',
    '  "damage_chance": { "min": 10, "max": 50 }',
    '}'
  ].join('\n');

  var SHOOTER_TEMPLATE = [
    '{',
    '  "charge_on_draw": false,',
    '  "max_draw_duration": 1.0,',
    '  "scale_power_by_draw_duration": true',
    '}'
  ].join('\n');

  var CHARGEABLE_TEMPLATE = [
    '{',
    '  "ammunition": [ { "item": "minecraft:arrow", "search_inventory": true, "use_offhand": true, "use_inventory": true } ],',
    '  "charge_on_draw": false,',
    '  "max_draw_duration": 1.0,',
    '  "scale_power_by_draw_duration": true',
    '}'
  ].join('\n');

  var REPAIR_TEMPLATE = [
    '{',
    '  "repair_items": [',
    '    { "items": ["minecraft:iron_ingot"], "repair_amount": 100 }',
    '  ]',
    '}'
  ].join('\n');

  var PLACEMENT_FILTER_TEMPLATE = [
    '{',
    '  "conditions": [',
    '    {',
    '      "block_filter": ["minecraft:grass_block", "minecraft:dirt"],',
    '      "allowed_faces": ["up"]',
    '    }',
    '  ]',
    '}'
  ].join('\n');

  var TRANSFORMATION_TEMPLATE = [
    '{',
    '  "into": "minecraft:air",',
    '  "transformation_sound": "dig.grass"',
    '}'
  ].join('\n');

  var REDSTONE_PRODUCER_TEMPLATE = [
    '{',
    '  "power": 15,',
    '  "connections": ["up", "down", "north", "south", "east", "west"]',
    '}'
  ].join('\n');

  var CUSTOM_MI_TEMPLATE = [
    '{',
    '  "*": { "texture": "textures/blocks/my_block", "render_method": "opaque" },',
    '  "up": { "texture": "textures/blocks/my_block_top", "render_method": "opaque" }',
    '}'
  ].join('\n');

  var BOOL = function (def) { return F('_', '_', 'bool', def); };

  /* ------------------------- entity components ------------------------- */

  var ENTITY_COMPONENTS = [
    /* --- Identity & lifecycle --- */
    C('minecraft:health', 'Attributes', 'Health', 'Maximum health of the entity.', [
      F('value', 'Max health', 'num', 20, 'Number of half-hearts. 20 = 10 hearts.'),
      F('min', 'Min regen health', 'num', 0, 'Health value used for natural regeneration.')
    ]),
    C('minecraft:scale', 'Attributes', 'Scale', 'Multiplies the entity hit-box and model size.', [
      F('value', 'Scale', 'num', 1, '1 = vanilla size, 2 = twice as large.')
    ]),
    C('minecraft:collision_box', 'Attributes', 'Collision box', 'Width and height of the hit-box.', [
      F('width', 'Width', 'num', 1),
      F('height', 'Height', 'num', 1)
    ]),
    C('minecraft:knockback_resistance', 'Attributes', 'Knockback resistance', 'Resistance against knockback (0-1).', [
      F('value', 'Resistance', 'num', 0, '0 = none, 1 = immune to knockback.')
    ]),
    C('minecraft:follow_range', 'Attributes', 'Follow range', 'Distance at which the entity can follow a target.', [
      F('value', 'Value', 'num', 16),
      F('max', 'Max', 'num', 0, '0 = unlimited.')
    ]),
    C('minecraft:breathable', 'Attributes', 'Breathable', 'Air supply and drowning behaviour.', [
      F('total_supply', 'Total supply', 'int', 15, 'Seconds of air before drowning.'),
      F('suffocate_time', 'Suffocate time', 'int', 0, 'Time in bubbles before damage starts.'),
      F('breathes_air', 'Breathes air', 'bool', true),
      F('breathes_water', 'Breathes water', 'bool', false),
      F('breathes_solids', 'Breathes solids', 'bool', false),
      F('generates_bubbles', 'Generates bubbles', 'bool', true)
    ]),
    C('minecraft:type_family', 'Identity', 'Type family', 'Families this entity belongs to (used by filters).', [
      F('family', 'Families', 'list', 'mob, monster', 'Comma separated, e.g. "mob, monster, mypack".')
    ]),
    C('minecraft:variant', 'Identity', 'Variant', 'Integer/text variant marker used by client textures.', [
      F('value', 'Value', 'text', '0')
    ]),
    C('minecraft:nameable', 'Identity', 'Nameable', 'Allows name tags.', [
      F('always_show', 'Always show name', 'bool', true),
      F('allow_name_tag_renaming', 'Allow renaming', 'bool', true)
    ]),
    C('minecraft:is_hidden_when_invisible', 'Identity', 'Hidden when invisible', 'Hides the entity while it has invisibility.'),
    C('minecraft:persistent', 'Identity', 'Persistent', 'Entity never despawns naturally.'),
    C('minecraft:despawn', 'Lifecycle', 'Despawn', 'Distance / chance based despawning.', [
      F('despawn_from_distance', 'Despawn from distance', 'bool', true),
      F('min_distance', 'Min distance', 'int', 32, 'Blocks.'),
      F('max_distance', 'Max distance', 'int', 128, 'Blocks.'),
      F('despawn_from_chance', 'Despawn from chance', 'num', 0, '0 = disabled.')
    ]),
    C('minecraft:ageable', 'Lifecycle', 'Ageable', 'Baby / adult lifecycle.', [
      F('duration', 'Duration', 'num', 1200, 'Ticks as a baby (20 ticks = 1 s).'),
      F('grow_up', 'Grow up event', 'text', '', 'Event fired when the baby becomes an adult.'),
      F('feed_items', 'Feed items', 'list', '', 'Comma separated item ids that speed up growth.'),
      F('transform_to_item', 'Transform to item', 'text', '', 'Item id the baby turns into.'),
      F('transform_to_item_amount', 'Transform amount', 'int', 1),
      F('drop_items', 'Drop items', 'list', '', 'Items dropped when the baby is not fed.')
    ]),
    C('minecraft:breedable', 'Lifecycle', 'Breedable', 'Breeding behaviour.', [
      F('require_tame', 'Require tame', 'bool', true),
      F('breed_items', 'Breed items', 'list', 'minecraft:wheat', 'Comma separated item ids.'),
      F('causes_pregnancy', 'Causes pregnancy', 'bool', false),
      F('love_causes_pregnancy', 'Love causes pregnancy', 'bool', false),
      F('breed_cooldown', 'Breed cooldown', 'num', 0)
    ]),
    C('minecraft:experience_reward', 'Lifecycle', 'Experience reward', 'XP dropped on death / breeding.', [
      F('on_death', 'On death', 'text', '3', 'Number or a Molang expression.'),
      F('on_bred', 'On bred', 'text', '1')
    ]),
    C('minecraft:transformation', 'Lifecycle', 'Transformation', 'Turns into another entity after a delay.', [
      F('into', 'Into', 'text', 'minecraft:zombie', 'Target identifier.'),
      F('delay', 'Delay', 'raw', '{}', 'Optional {"value":1,"block_association":"grass"} object.'),
      F('drop_equipment', 'Drop equipment', 'bool', true),
      F('keep_level', 'Keep level', 'bool', true),
      F('transformation_sound', 'Transformation sound', 'text', '')
    ]),

    /* --- Movement & physics --- */
    C('minecraft:movement', 'Movement', 'Movement', 'Movement speed of the entity.', [
      F('type', 'Movement type', 'select', 'normal', '', {
        options: [['normal', 'normal (minecraft:movement)'], ['generic', 'generic'],
          ['fly', 'fly'], ['hover', 'hover'], ['swoop', 'swoop'],
          ['amphibious', 'amphibious'], ['jump', 'jump'], ['skip', 'skip']]
      }),
      F('value', 'Speed', 'num', 0.25, 'Blocks per tick.')
    ], {
      dynamicId: function (v) {
        return v && v.type && v.type !== 'normal' ? 'minecraft:movement.' + v.type : 'minecraft:movement';
      }
    }),
    C('minecraft:navigation.generic', 'Movement', 'Navigation (generic)', 'Full pathfinding component (1.19.40+).', [
      F('is_amphibious', 'Is amphibious', 'bool', false),
      F('can_path_over_water', 'Can path over water', 'bool', false),
      F('avoid_water', 'Avoid water', 'bool', false),
      F('can_swim', 'Can swim', 'bool', false),
      F('can_walk', 'Can walk', 'bool', true),
      F('can_breach', 'Can breach', 'bool', false),
      F('avoid_damage_blocks', 'Avoid damage blocks', 'bool', false),
      F('can_open_doors', 'Can open doors', 'bool', false),
      F('can_open_iron_doors', 'Can open iron doors', 'bool', false),
      F('can_pass_doors', 'Can pass doors', 'bool', true),
      F('can_break_doors', 'Can break doors', 'bool', false),
      F('can_jump', 'Can jump', 'bool', true),
      F('can_sink', 'Can sink', 'bool', false),
      F('can_path_from_air', 'Can path from air', 'bool', false)
    ]),
    C('minecraft:navigation.walk', 'Movement', 'Navigation (walk)', 'Legacy walking pathfinding component.', [
      F('can_path_over_water', 'Can path over water', 'bool', false),
      F('avoid_water', 'Avoid water', false),
      F('can_pass_doors', 'Can pass doors', 'bool', true),
      F('can_open_doors', 'Can open doors', 'bool', false),
      F('avoid_damage_blocks', 'Avoid damage blocks', 'bool', false),
      F('can_swim', 'Can swim', 'bool', false)
    ]),
    C('minecraft:navigation.float', 'Movement', 'Navigation (float)', 'Floating pathfinding (used by most mobs).', [
      F('can_float', 'Can float', 'bool', true),
      F('can_path_over_water', 'Can path over water', 'bool', true),
      F('avoid_water', 'Avoid water', 'bool', false),
      F('can_sink', 'Can sink', 'bool', false)
    ]),
    C('minecraft:navigation.climb', 'Movement', 'Navigation (climb)', 'Pathfinding that can climb blocks.', [
      F('can_path_over_water', 'Can path over water', 'bool', false),
      F('avoid_water', 'Avoid water', 'bool', false)
    ]),
    C('minecraft:jump.static', 'Movement', 'Jump (static)', 'Base jump impulse.', [
      F('jump_power', 'Jump power', 'num', 0.42)
    ]),
    C('minecraft:physics', 'Physics', 'Physics', 'Gravity and collision with the world.', [
      F('has_gravity', 'Has gravity', 'bool', true),
      F('has_collision', 'Has collision', 'bool', true)
    ]),
    C('minecraft:pushable', 'Physics', 'Pushable', 'Whether other entities/pistons can push it.', [
      F('is_pushable', 'Is pushable', 'bool', true),
      F('is_pushable_by_piston', 'Pushable by piston', 'bool', true)
    ]),
    C('minecraft:fire_immune', 'Physics', 'Fire immune', 'Entity takes no fire/lava damage.'),

    /* --- Combat --- */
    C('minecraft:attack', 'Combat', 'Attack', 'Melee damage dealt on contact.', [
      F('damage', 'Damage', 'num', 3),
      F('effect_name', 'Effect name', 'text', '', 'e.g. poison'),
      F('effect_duration', 'Effect duration', 'int', 0, 'Seconds.')
    ]),
    C('minecraft:damage_sensor', 'Combat', 'Damage sensor', 'Custom reactions to damage sources.', [
      F('_raw', 'Triggers', 'raw', DAMAGE_SENSOR_TEMPLATE, 'Full JSON object with a "triggers" array.', { rawKey: 'triggers', span: true })
    ]),
    C('minecraft:angry', 'Combat', 'Angry', 'Temporary anger state after being hit.', [
      F('duration', 'Duration', 'num', 20, 'Seconds.'),
      F('broadcast_anger', 'Broadcast anger', 'bool', true),
      F('broadcast_range', 'Broadcast range', 'int', 20),
      F('calm_event', 'Calm event', 'text', ''),
      F('angry_sound', 'Angry sound', 'text', '')
    ]),
    C('minecraft:loot', 'Combat', 'Loot table', 'Loot table dropped on death.', [
      F('table', 'Table path', 'text', 'loot_tables/entities/my_mob.json')
    ]),

    /* --- AI / behaviour --- */
    C('minecraft:behavior.float', 'AI', 'Behavior: float', 'Swim / float up in liquids.', [
      F('priority', 'Priority', 'int', 0, 'Lower runs first.')
    ]),
    C('minecraft:behavior.panic', 'AI', 'Behavior: panic', 'Run away after taking damage.', [
      F('priority', 'Priority', 'int', 1),
      F('speed_multiplier', 'Speed multiplier', 'num', 1.25),
      F('force', 'Force panic', 'bool', false),
      F('ignore_mob_damage', 'Ignore mob damage', 'bool', false),
      F('damage_sources', 'Damage sources', 'list', '', 'Comma separated, e.g. "fall, fire".')
    ]),
    C('minecraft:behavior.melee_attack', 'AI', 'Behavior: melee attack', 'Chase and hit the target.', [
      F('priority', 'Priority', 'int', 2),
      F('speed_multiplier', 'Speed multiplier', 'num', 1.25),
      F('track_target', 'Track target', 'bool', true),
      F('reach_multiplier', 'Reach multiplier', 'num', 1),
      F('attack_once', 'Attack once', 'bool', false),
      F('cooldown_time', 'Cooldown time', 'num', 1),
      F('x_max_rotation', 'X max rotation', 'num', 30),
      F('y_max_rotation', 'Y max rotation', 'num', 30),
      F('require_complete_path', 'Require complete path', 'bool', true)
    ]),
    C('minecraft:behavior.nearest_attackable_target', 'AI', 'Behavior: nearest attackable target', 'Pick the closest valid target.', [
      F('priority', 'Priority', 'int', 1),
      F('must_see', 'Must see', 'bool', true),
      F('must_see_forget_duration', 'Must see forget duration', 'num', 3),
      F('within_radius', 'Within radius', 'num', 0, '0 = use follow_range.'),
      F('reselect_targets', 'Reselect targets', 'bool', true),
      F('attack_interval', 'Attack interval', 'num', 1),
      F('persist_time', 'Persist time', 'num', 0),
      F('scan_interval', 'Scan interval', 'num', 1),
      F('entity_types', 'Entity types', 'raw', TARGET_TYPES_TEMPLATE, 'Targeting filters.', { span: true })
    ]),
    C('minecraft:behavior.hurt_by_target', 'AI', 'Behavior: hurt by target', 'Retaliate against whoever hurt it.', [
      F('priority', 'Priority', 'int', 1),
      F('alert_same_type', 'Alert same type', 'bool', true),
      F('hurt_owner', 'Hurt owner', 'bool', false),
      F('entity_types', 'Entity types', 'raw', TARGET_TYPES_TEMPLATE, 'Who it retaliates against.', { span: true })
    ]),
    C('minecraft:behavior.random_stroll', 'AI', 'Behavior: random stroll', 'Wander around.', [
      F('priority', 'Priority', 'int', 6),
      F('speed_multiplier', 'Speed multiplier', 'num', 1),
      F('xz_dist', 'XZ distance', 'num', 10),
      F('y_dist', 'Y distance', 'num', 7)
    ]),
    C('minecraft:behavior.random_look_around', 'AI', 'Behavior: random look around', 'Idle head movement.', [
      F('priority', 'Priority', 'int', 8),
      F('look_time', 'Look time', 'text', '[2, 4]', 'Min/max seconds as a vector.')
    ]),
    C('minecraft:behavior.look_at_player', 'AI', 'Behavior: look at player', 'Turn the head towards nearby players.', [
      F('priority', 'Priority', 'int', 7),
      F('look_distance', 'Look distance', 'num', 8),
      F('angle_of_view_horizontal', 'Horizontal angle of view', 'num', 90),
      F('angle_of_view_vertical', 'Vertical angle of view', 'num', 90),
      F('probability', 'Probability', 'num', 0.02)
    ]),
    C('minecraft:behavior.follow_owner', 'AI', 'Behavior: follow owner', 'Follow its owner.', [
      F('priority', 'Priority', 'int', 4),
      F('speed_multiplier', 'Speed multiplier', 'num', 1),
      F('start_distance', 'Start distance', 'num', 10),
      F('stop_distance', 'Stop distance', 'num', 2),
      F('max_distance', 'Max distance', 'num', 20),
      F('can_teleport', 'Can teleport', 'bool', true)
    ]),
    C('minecraft:behavior.follow_parent', 'AI', 'Behavior: follow parent', 'Babies follow their parent.', [
      F('priority', 'Priority', 'int', 5),
      F('speed_multiplier', 'Speed multiplier', 'num', 1.1)
    ]),
    C('minecraft:behavior.follow_mob', 'AI', 'Behavior: follow mob', 'Follow another entity type.', [
      F('priority', 'Priority', 'int', 4),
      F('speed_multiplier', 'Speed multiplier', 'num', 1),
      F('search_range', 'Search range', 'num', 20),
      F('stop_distance', 'Stop distance', 'num', 2),
      F('max_distance', 'Max distance', 'num', 24)
    ]),
    C('minecraft:behavior.avoid_mob', 'AI', 'Behavior: avoid mob', 'Run away from a mob type.', [
      F('priority', 'Priority', 'int', 3),
      F('speed_multiplier', 'Speed multiplier', 'num', 1.2),
      F('max_dist', 'Max distance', 'num', 12),
      F('min_dist', 'Min distance', 'num', 8),
      F('probability_per_tick', 'Probability per tick', 'num', 0.001),
      F('sneak_speed_multiplier', 'Sneak speed multiplier', 'num', 0.6),
      F('walk_speed_multiplier', 'Walk speed multiplier', 'num', 1),
      F('sprint_speed_multiplier', 'Sprint speed multiplier', 'num', 1.4),
      F('entity_types', 'Entity types', 'raw', TARGET_TYPES_TEMPLATE, 'What to avoid.', { span: true })
    ]),
    C('minecraft:behavior.tempt', 'AI', 'Behavior: tempt', 'Lure the entity with items.', [
      F('priority', 'Priority', 'int', 2),
      F('speed_multiplier', 'Speed multiplier', 'num', 1.2),
      F('within_radius', 'Within radius', 'num', 10),
      F('can_tempt_vertically', 'Can tempt vertically', 'bool', true),
      F('items', 'Items', 'list', 'minecraft:wheat', 'Comma separated.')
    ]),
    C('minecraft:behavior.pickup_items', 'AI', 'Behavior: pickup items', 'Pick up nearby items.', [
      F('priority', 'Priority', 'int', 6),
      F('max_dist', 'Max distance', 'num', 3),
      F('goal_radius', 'Goal radius', 'num', 2),
      F('speed_multiplier', 'Speed multiplier', 'num', 1),
      F('can_pickup_to_hand', 'Can pickup to hand', 'bool', true)
    ]),
    C('minecraft:behavior.stay_while_sitting', 'AI', 'Behavior: stay while sitting', 'Do not move while sitting.', [
      F('priority', 'Priority', 'int', 3)
    ]),
    C('minecraft:behavior.owner_hurt_by_target', 'AI', 'Behavior: owner hurt by target', 'Attack whoever hurt the owner.', [
      F('priority', 'Priority', 'int', 1)
    ]),
    C('minecraft:behavior.owner_hurt_target', 'AI', 'Behavior: owner hurt target', 'Attack the owner\'s target.', [
      F('priority', 'Priority', 'int', 2)
    ]),
    C('minecraft:behavior.open_door', 'AI', 'Behavior: open door', 'Open and close doors while pathing.', [
      F('priority', 'Priority', 'int', 5),
      F('close_door_after', 'Close door after', 'bool', true)
    ]),
    C('minecraft:behavior.circle_around_anchor', 'AI', 'Behavior: circle around anchor', 'Fly in circles around a point.', [
      F('priority', 'Priority', 'int', 3),
      F('radius', 'Radius', 'num', 8),
      F('radius_change_chance', 'Radius change chance', 'num', 250),
      F('height_above_target_range', 'Height above target range', 'num', 10),
      F('height_offset_range', 'Height offset range', 'num', 5),
      F('height_change_chance', 'Height change chance', 'num', 350),
      F('goal_radius', 'Goal radius', 'num', 1),
      F('speed_multiplier', 'Speed multiplier', 'num', 1),
      F('angular_momentum', 'Angular momentum', 'num', 10)
    ]),
    C('minecraft:environment_sensor', 'AI', 'Environment sensor', 'Run events when Molang filters match.', [
      F('_raw', 'Triggers', 'raw', ENV_SENSOR_TEMPLATE, 'Full JSON object with a "triggers" array.', { rawKey: 'triggers', span: true })
    ]),
    C('minecraft:timer', 'AI', 'Timer', 'Fire an event on a timer.', [
      F('looping', 'Looping', 'bool', true),
      F('time', 'Time', 'num', 1.8, 'Seconds.'),
      F('time_down_event', 'Time down event', 'text', '')
    ]),

    /* --- Interaction --- */
    C('minecraft:tameable', 'Interaction', 'Tameable', 'Tame with items.', [
      F('probability', 'Probability', 'num', 0.33),
      F('tame_items', 'Tame items', 'list', 'minecraft:bone', 'Comma separated.'),
      F('tame_event', 'Tame event', 'text', '')
    ]),
    C('minecraft:sittable', 'Interaction', 'Sittable', 'Can be told to sit.', [
      F('event', 'Event', 'text', '')
    ]),
    C('minecraft:leashable', 'Interaction', 'Leashable', 'Can be put on a lead.', [
      F('soft_distance', 'Soft distance', 'num', 4),
      F('hard_distance', 'Hard distance', 'num', 6),
      F('max_distance', 'Max distance', 'num', 10),
      F('can_be_stolen', 'Can be stolen', 'bool', false)
    ]),
    C('minecraft:shareables', 'Interaction', 'Shareables', 'Items it can hand to another entity.', [
      F('items', 'Items', 'list', 'minecraft:wheat', 'Comma separated.'),
      F('items_wanted', 'Items wanted', 'list', ''),
      F('singular_pickup', 'Singular pickup', 'bool', false)
    ]),
    C('minecraft:is_saddled', 'Interaction', 'Is saddled', 'Shows the saddle texture while ridden.'),
    C('minecraft:boss', 'Interaction', 'Boss', 'Boss bar and sky darkening.', [
      F('should_darken_sky', 'Should darken sky', 'bool', true),
      F('hud_range', 'HUD range', 'int', 50),
      F('name', 'Name', 'text', '', 'Leave blank to use the entity name.')
    ]),
    C('minecraft:home', 'Interaction', 'Home', 'Stay inside a radius of its home.', [
      F('restriction_radius', 'Restriction radius', 'int', 4)
    ]),
    C('minecraft:conditional_bandwidth_optimization', 'Misc', 'Conditional bandwidth optimization', 'Reduces network traffic for distant entities.')
  ];

  /* -------------------------- item components -------------------------- */

  var ITEM_COMPONENTS = [
    C('minecraft:display_name', 'Appearance', 'Display name', 'In-game name (overrides the .lang entry).', [
      F('value', 'Value', 'text', '', 'Plain text or a translation key.')
    ]),
    C('minecraft:hover_text_color', 'Appearance', 'Hover text color', 'Colour of the item name tooltip.', [
      F('value', 'Value', 'text', 'aqua', 'Colour name, e.g. "aqua", "light_purple".')
    ]),
    C('minecraft:glint', 'Appearance', 'Glint', 'Enchantment-style shine.'),
    C('minecraft:hand_equipped', 'Appearance', 'Hand equipped', 'Item is held like a tool.'),
    C('minecraft:max_stack_size', 'Misc', 'Max stack size', 'How many fit in one slot.', [
      F('value', 'Value', 'int', 64, '1-64.')
    ]),
    C('minecraft:stacked_by_data', 'Misc', 'Stacked by data', 'Different aux values still stack together.'),
    C('minecraft:should_despawn', 'Misc', 'Should despawn', 'Item despawns after 5 minutes.'),
    C('minecraft:ignores_permission', 'Misc', 'Ignores permission', 'Usable in adventure mode without permissions.'),
    C('minecraft:liquid_clipped', 'Misc', 'Liquid clipped', 'Item is not slowed by liquids.'),
    C('minecraft:can_destroy_in_creative', 'Misc', 'Can destroy in creative', 'Breaks blocks in creative.'),
    C('minecraft:tags', 'Misc', 'Tags', 'Item tags used by vanilla systems.', [
      F('tags', 'Tags', 'list', 'minecraft:is_tool', 'Comma separated.')
    ]),
    C('minecraft:damage', 'Combat', 'Damage', 'Damage dealt when used as a weapon.', [
      F('value', 'Value', 'int', 5)
    ]),
    C('minecraft:armor', 'Combat', 'Armor', 'Armor points while worn.', [
      F('protection', 'Protection', 'int', 3, 'Half-shields of protection.')
    ]),
    C('minecraft:durability', 'Combat', 'Durability', 'Durability of the item.', [
      F('_raw', 'Durability', 'raw', DURABILITY_TEMPLATE, 'max_durability + damage_chance.', { span: true })
    ]),
    C('minecraft:repairable', 'Combat', 'Repairable', 'Repair with materials.', [
      F('_raw', 'Repair items', 'raw', REPAIR_TEMPLATE, '', { span: true })
    ]),
    C('minecraft:enchantable', 'Combat', 'Enchantable', 'Enchantment slot and value.', [
      F('slot', 'Slot', 'text', 'sword'),
      F('value', 'Value', 'int', 10)
    ]),
    C('minecraft:wearable', 'Appearance', 'Wearable', 'Equip slot of the item.', [
      F('slot', 'Slot', 'select', 'slot.armor.head', '', {
        options: [['slot.weapon.mainhand', 'Main hand'], ['slot.weapon.offhand', 'Off hand'],
          ['slot.armor.head', 'Head'], ['slot.armor.chest', 'Chest'], ['slot.armor.legs', 'Legs'],
          ['slot.armor.feet', 'Feet'], ['slot.armor.body', 'Body (1.21.10+)'],
          ['slot.enderchest', 'Ender chest'], ['slot.hotbar', 'Hotbar'],
          ['slot.inventory', 'Inventory'], ['slot.saddle', 'Saddle']]
      })
    ]),
    C('minecraft:food', 'Food', 'Food', 'Edible item.', [
      F('nutrition', 'Nutrition', 'int', 4, 'Hunger points restored.'),
      F('saturation', 'Saturation', 'num', 0.8, 'Saturation modifier.'),
      F('can_always_eat', 'Can always eat', 'bool', false),
      F('using_converts_to', 'Using converts to', 'text', '', 'Item left behind, e.g. minecraft:bowl.')
    ]),
    C('minecraft:cooldown', 'Behavior', 'Cooldown', 'Reuse delay after use.', [
      F('category', 'Category', 'text', 'my_item', 'Shared cooldown category.'),
      F('duration', 'Duration', 'num', 3, 'Seconds.')
    ]),
    C('minecraft:use_modifiers', 'Behavior', 'Use modifiers', 'Movement / duration while using (1.21.30+).', [
      F('movement_modifier', 'Movement modifier', 'num', 0.35),
      F('use_duration', 'Use duration', 'num', 0)
    ], { since: '1.21.30' }),
    C('minecraft:digger', 'Behavior', 'Digger', 'Mining speeds of a tool.', [
      F('_raw', 'Digger', 'raw', DIGGER_TEMPLATE, '', { span: true })
    ]),
    C('minecraft:projectile', 'Combat', 'Projectile', 'Entity fired when shot.', [
      F('projectile_entity', 'Projectile entity', 'text', 'minecraft:arrow'),
      F('minimum_critical_power', 'Minimum critical power', 'num', 1)
    ]),
    C('minecraft:shooter', 'Combat', 'Shooter', 'Draw-and-release behaviour (1.20.60+).', [
      F('_raw', 'Shooter', 'raw', SHOOTER_TEMPLATE, '', { span: true })
    ], { since: '1.20.60' }),
    C('minecraft:chargeable', 'Behavior', 'Chargeable', 'Charge up while holding (1.20.60+).', [
      F('_raw', 'Chargeable', 'raw', CHARGEABLE_TEMPLATE, '', { span: true })
    ], { since: '1.20.60' }),
    C('minecraft:block_placer', 'Behavior', 'Block placer', 'Places a block on use (1.21.20+).', [
      F('block', 'Block', 'text', 'minecraft:dirt'),
      F('use_on', 'Use on', 'list', '', 'Comma separated block ids. Empty = any.')
    ], { since: '1.21.20' }),
    C('minecraft:compostable', 'Misc', 'Compostable', 'Composting chance.', [
      F('composting_chance', 'Chance', 'num', 30, '0-100.')
    ]),
    C('minecraft:fuel', 'Misc', 'Fuel', 'Burn time in a furnace.', [
      F('duration', 'Duration', 'num', 20, 'Seconds.')
    ])
  ];

  /* -------------------------- block components -------------------------- */

  var BLOCK_COMPONENTS = [
    C('minecraft:display_name', 'Appearance', 'Display name', 'In-game name of the block item.', [
      F('value', 'Value', 'text', '')
    ]),
    C('minecraft:map_color', 'Appearance', 'Map color', 'Colour shown on maps.', [
      F('value', 'Value', 'color', '#ffffff', 'Hex colour, e.g. #ff0000.')
    ]),
    C('minecraft:geometry', 'Appearance', 'Geometry', 'Custom block model.', [
      F('identifier', 'Geometry identifier', 'text', 'geometry.my_block'),
      F('culling', 'Culling identifier', 'text', '', 'Optional.')
    ]),
    C('minecraft:material_instances', 'Appearance', 'Material instances', 'Per-face textures (advanced override).', [
      F('_raw', 'Material instances', 'raw', CUSTOM_MI_TEMPLATE,
        'Only needed to override the texture mapping built on the Assets tab.', { span: true })
    ]),
    C('minecraft:destruction_particles', 'Appearance', 'Destruction particles', 'Particles spawned on break.', [
      F('texture', 'Texture', 'text', 'textures/blocks/my_block')
    ]),
    C('minecraft:random_offset', 'Appearance', 'Random offset', 'Random position offset when placed.', [
      F('x', 'X', 'num', 0, '0-1'), F('y', 'Y', 'num', 0, '0-1'), F('z', 'Z', 'num', 0, '0-1')
    ]),
    C('minecraft:destructible_by_mining', 'Physics', 'Destructible by mining', 'Mining time.', [
      F('seconds_to_destroy', 'Seconds to destroy', 'num', 1, '0 = instant.')
    ]),
    C('minecraft:destructible_by_explosion', 'Physics', 'Destructible by explosion', 'Blast resistance.', [
      F('explosion_resistance', 'Explosion resistance', 'num', 1)
    ]),
    C('minecraft:friction', 'Physics', 'Friction', 'Slipperiness of the block.', [
      F('value', 'Value', 'num', 0.6, 'Ice is 0.98.')
    ]),
    C('minecraft:light_dampening', 'Physics', 'Light dampening', 'Light blocked by the block.', [
      F('value', 'Value', 'int', 15, '0-15.')
    ]),
    C('minecraft:light_emission', 'Physics', 'Light emission', 'Light emitted by the block.', [
      F('value', 'Value', 'int', 0, '0-15.')
    ]),
    C('minecraft:collision_box', 'Physics', 'Collision box', 'Collision area in pixels.', [
      F('ox', 'Origin X', 'num', -8), F('oy', 'Origin Y', 'num', 0), F('oz', 'Origin Z', 'num', -8),
      F('sx', 'Size X', 'num', 16), F('sy', 'Size Y', 'num', 16), F('sz', 'Size Z', 'num', 16)
    ]),
    C('minecraft:selection_box', 'Physics', 'Selection box', 'Mouse-over outline in pixels.', [
      F('ox', 'Origin X', 'num', -8), F('oy', 'Origin Y', 'num', 0), F('oz', 'Origin Z', 'num', -8),
      F('sx', 'Size X', 'num', 16), F('sy', 'Size Y', 'num', 16), F('sz', 'Size Z', 'num', 16)
    ]),
    C('minecraft:flammable', 'Physics', 'Flammable', 'Fire behaviour.', [
      F('flame_odds', 'Flame odds', 'int', 0, 'Chance of catching fire, 0-1000.'),
      F('burn_odds', 'Burn odds', 'int', 0, 'Chance of burning away, 0-1000.')
    ]),
    C('minecraft:loot', 'Misc', 'Loot table', 'Drops when broken.', [
      F('table', 'Table path', 'text', 'loot_tables/blocks/my_block.json')
    ]),
    C('minecraft:tags', 'Misc', 'Tags', 'Block tags.', [
      F('tags', 'Tags', 'list', 'minecraft:is_pickaxe_item_destructible', 'Comma separated.')
    ]),
    C('minecraft:replaceable', 'Misc', 'Replaceable', 'Replaced when another block is placed.'),
    C('minecraft:movable', 'Misc', 'Movable', 'Can be pushed by pistons.'),
    C('minecraft:sound', 'Misc', 'Sound', 'Step / break sounds and volume.', [
      F('sound', 'Sound event', 'text', ''),
      F('volume', 'Volume', 'num', 1),
      F('pitch', 'Pitch', 'num', 1)
    ]),
    C('minecraft:placement_filter', 'Interaction', 'Placement filter', 'Where the block can be placed.', [
      F('_raw', 'Conditions', 'raw', PLACEMENT_FILTER_TEMPLATE, '', { span: true })
    ]),
    C('minecraft:crafting_table', 'Interaction', 'Crafting table', 'Opens a crafting grid.', [
      F('grid_size', 'Grid size', 'int', 3, '2 or 3.'),
      F('crafting_tags', 'Crafting tags', 'list', 'crafting_table', 'Comma separated.')
    ]),
    C('minecraft:tick', 'Behavior', 'Tick', 'Random / queued ticking.', [
      F('interval', 'Interval', 'num', 1, 'Seconds (0 = random).'),
      F('looping', 'Looping', 'bool', true)
    ]),
    C('minecraft:redstone_conductivity', 'Interaction', 'Redstone conductivity', 'Conducts redstone.', [
      F('value', 'Value', 'select', 'none', '', { options: [['none', 'none'], ['all', 'all'], ['sides', 'sides']] })
    ]),
    C('minecraft:redstone_consumer', 'Interaction', 'Redstone consumer', 'Receives redstone signal.', [
      F('_raw', 'Consumer', 'raw', '{ "minimum_signal": 1 }', '', { span: true })
    ]),
    C('minecraft:redstone_producer', 'Interaction', 'Redstone producer', 'Emits redstone signal.', [
      F('_raw', 'Producer', 'raw', REDSTONE_PRODUCER_TEMPLATE, '', { span: true })
    ]),
    C('minecraft:transformation', 'Behavior', 'Transformation', 'Turns into another block when ticked.', [
      F('_raw', 'Transformation', 'raw', TRANSFORMATION_TEMPLATE, '', { span: true })
    ]),
    C('minecraft:precipitation_interactions', 'Misc', 'Precipitation interactions', 'Rain/snow interactions.'),
    C('minecraft:liquid_detection', 'Behavior', 'Liquid detection', 'Liquid detection rules.', [
      F('_raw', 'Liquid detection', 'raw', '{}', 'Empty object = default behaviour.', { span: true })
    ])
  ];

  function schemaFor(kind) {
    if (kind === 'entity') return ENTITY_COMPONENTS;
    if (kind === 'item') return ITEM_COMPONENTS;
    if (kind === 'block') return BLOCK_COMPONENTS;
    return [];
  }

  function schemaById(kind) {
    var map = {};
    schemaFor(kind).forEach(function (c) { map[c.id] = c; });
    return map;
  }

  function groupSchema(kind) {
    var out = [];
    schemaFor(kind).forEach(function (c) {
      var bucket = null;
      for (var i = 0; i < out.length; i += 1) if (out[i].group === c.group) bucket = out[i];
      if (!bucket) { bucket = { group: c.group, items: [] }; out.push(bucket); }
      bucket.items.push(c);
    });
    return out;
  }

  /** Turn the raw form values of a component into its JSON value. */
  function buildComponentValue(spec, values) {
    var out = {};
    (spec.fields || []).forEach(function (f) {
      var v = values ? values[f.key] : undefined;
      if (v === undefined || v === null || v === '') return;
      if (f.type === 'bool') { if (v) out[f.key] = true; return; }
      if (f.type === 'num') { var n = Number(v); if (!isNaN(n)) out[f.key] = n; return; }
      if (f.type === 'int') { var i2 = Math.round(Number(v)); if (!isNaN(i2)) out[f.key] = i2; return; }
      if (f.type === 'list') {
        out[f.key] = String(v).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        return;
      }
      if (f.type === 'raw') {
        var parsed = null, okRaw = false;
        try { parsed = JSON.parse(v); okRaw = true; } catch (e) { okRaw = false; }
        if (!okRaw) { out[f.key] = v; return; }
        if (f.rawKey) {
          // The template may be the whole component value ({ "triggers": [...] })
          // or just the value of that key.
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && f.rawKey in parsed) {
            out[f.rawKey] = parsed[f.rawKey];
          } else {
            out[f.rawKey] = parsed;
          }
          return;
        }
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          // Merge the object's keys into the component value.
          Object.keys(parsed).forEach(function (k) { out[k] = parsed[k]; });
          return;
        }
        out[f.key] = parsed;
        return;
      }
      if (f.type === 'vec3') { out[f.key] = [Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0]; return; }
      out[f.key] = v;
    });
    return out;
  }

  /** Default form values for a component. */
  function defaultComponentValues(spec) {
    var out = {};
    (spec.fields || []).forEach(function (f) {
      if (f.type === 'bool') out[f.key] = !!f.def;
      else out[f.key] = f.def == null ? '' : f.def;
    });
    return out;
  }

  /** Resolve the JSON key of a component given its current values. */
  function componentKey(spec, values) {
    if (spec.dynamicId) {
      try { return spec.dynamicId(values) || spec.id; } catch (e) { return spec.id; }
    }
    return spec.id;
  }

  /** Serialise the components object of an entry into Bedrock JSON. */
  function serializeComponents(kind, components) {
    var out = {};
    var specs = schemaById(kind);
    Object.keys(components || {}).forEach(function (key) {
      var values = components[key];
      var spec = specs[key];
      if (spec) {
        out[componentKey(spec, values)] = buildComponentValue(spec, values);
      } else {
        // custom / raw component
        if (values && values.__raw) {
          try { out[key] = JSON.parse(values.__raw); } catch (e) { out[key] = values.__raw; }
        } else {
          out[key] = values;
        }
      }
    });
    // custom raw components live outside the schema map
    return out;
  }

  /* =================================================================
     5. JSON GENERATORS
     Everything below produces plain objects that are serialised with
     JSON.stringify(…, 2). Minecraft is strict about syntax, so the
     generators never emit trailing commas or comments.
     ================================================================= */

  function parseJsonSafe(str) {
    try { return { ok: true, value: JSON.parse(str) }; }
    catch (err) { return { ok: false, error: err.message }; }
  }

  function packFolders() {
    var base = (state.meta.name || 'addon').replace(/[\\/:*?"<>|]/g, '').trim() || 'addon';
    return { bp: base + ' BP', rp: base + ' RP' };
  }

  function buildManifest(which) {
    var m = state.meta;
    var header = {
      name: m.name,
      description: m.description,
      uuid: which === 'bp' ? m.bpUuid : m.rpUuid,
      version: (m.version && m.version.length ? m.version : [1, 0, 0]).slice(0, 3),
      min_engine_version: (m.minEngineVersion && m.minEngineVersion.length ? m.minEngineVersion : [1, 21, 10]).slice(0, 3)
    };
    var out = {
      format_version: 2,
      header: header,
      modules: [{
        type: which === 'bp' ? 'data' : 'resources',
        uuid: which === 'bp' ? m.bpModuleUuid : m.rpModuleUuid,
        version: header.version
      }],
      metadata: {
        authors: [m.author || 'Unknown'],
        license: 'MIT',
        generated_with: { 'bedrock-utility': ['1.0.0'] }
      }
    };
    if (which === 'rp') {
      // A resource pack must declare a dependency on the behavior pack it belongs to.
      out.dependencies = [{ uuid: m.bpUuid, version: header.version }];
    }
    return out;
  }

  /** All animation identifiers contained in an uploaded .animation.json. */
  function animationKeys(animJson) {
    var parsed = parseJsonSafe(animJson);
    if (!parsed.ok || !parsed.value || !parsed.value.animations) return [];
    return Object.keys(parsed.value.animations);
  }

  /** The geometry identifier declared inside an uploaded .geo.json. */
  function geometryId(geoJson, fallback) {
    var parsed = parseJsonSafe(geoJson);
    if (parsed.ok && parsed.value && parsed.value['minecraft:geometry']) {
      var list = parsed.value['minecraft:geometry'];
      if (list.length && list[0].description && list[0].description.identifier) return list[0].description.identifier;
    }
    return fallback;
  }

  /* ------------------------------ entities ------------------------------ */

  function buildEntityBehavior(entry) {
    var id = entryId(entry);
    var description = { identifier: id };
    if (entry.isSpawnable) description.is_spawnable = true;
    if (entry.isSummonable) description.is_summonable = true;
    if (entry.runtimeIdentifier) description.runtime_identifier = entry.runtimeIdentifier;
    if (entry.isExperimental) description.is_experimental = true;
    if (entry.spawnEgg) description.spawn_egg = { base_color: entry.baseColor, overlay_color: entry.overlayColor };

    var out = {
      format_version: state.meta.formatVersion,
      'minecraft:entity': {
        description: description,
        component_groups: {},
        components: serializeComponents('entity', entry.components),
        events: {}
      }
    };

    Object.keys(entry.groups || {}).forEach(function (gname) {
      out['minecraft:entity'].component_groups[gname] = serializeComponents('entity', entry.groups[gname]);
    });
    Object.keys(entry.events || {}).forEach(function (ename) {
      var ev = entry.events[ename] || {};
      var node = {};
      if (ev.add && ev.add.length) node.add = { component_groups: ev.add.slice() };
      if (ev.remove && ev.remove.length) node.remove = { component_groups: ev.remove.slice() };
      if (ev.sequence && ev.sequence.length) {
        node.sequence = ev.sequence.map(function (step) {
          var s = {};
          if (step.add && step.add.length) s.add = { component_groups: step.add.slice() };
          if (step.remove && step.remove.length) s.remove = { component_groups: step.remove.slice() };
          return s;
        });
      }
      out['minecraft:entity'].events[ename] = node;
    });
    (entry.custom || []).forEach(function (c) {
      var parsed = parseJsonSafe(c.value);
      out['minecraft:entity'].components[c.key] = parsed.ok ? parsed.value : c.value;
    });
    return out;
  }

  function buildEntityClient(entry) {
    var id = entryId(entry);
    var slugName = slug(entry.name);
    var geoId = 'geometry.' + slugName;
    if (entry.assets && entry.assets.model && entry.assets.model.data) {
      geoId = geometryId(entry.assets.model.data, geoId);
    }
    var d = { identifier: id };

    d.materials = { 'default': entry.material || 'entity_alphatest' };
    d.textures = { 'default': 'textures/entity/' + slugName };
    if (entry.assets && entry.assets.model && entry.assets.model.data) {
      d.geometry = { 'default': geoId };
    }
    if (entry.assets && entry.assets.animation && entry.assets.animation.data) {
      var anims = {};
      animationKeys(entry.assets.animation.data).forEach(function (key) {
        var short = key.indexOf('.') >= 0 ? key.slice(key.lastIndexOf('.') + 1) : key;
        anims[short] = key;
      });
      if (Object.keys(anims).length) {
        d.animations = anims;
        d.scripts = { animate: Object.keys(anims) };
      }
    }
    var soundEffects = {};
    state.sounds.forEach(function (s) {
      if (s.files && s.files.length) soundEffects[slug(s.name)] = s.event || (namespace() + '.' + slug(s.name));
    });
    if (Object.keys(soundEffects).length) d.sound_effects = soundEffects;

    var rc = entry.renderController;
    if (!rc || rc === 'custom') rc = 'controller.render.' + slugName;
    d.render_controllers = [rc];

    if (entry.spawnEgg) d.spawn_egg = { base_color: entry.baseColor, overlay_color: entry.overlayColor };

    return { format_version: RP_FORMAT.clientEntity, 'minecraft:client_entity': { description: d } };
  }

  function buildRenderController(entry) {
    var slugName = slug(entry.name);
    var geoId = 'geometry.' + slugName;
    if (entry.assets && entry.assets.model && entry.assets.model.data) {
      geoId = geometryId(entry.assets.model.data, geoId);
    }
    var out = { format_version: RP_FORMAT.renderController, render_controllers: {} };
    out.render_controllers['controller.render.' + slugName] = {
      geometry: geoId,
      materials: [{ '*': entry.material || 'entity_alphatest' }],
      textures: ['texture.default']
    };
    return out;
  }

  function buildSpawnRules(entry) {
    var sr = entry.spawnRules || {};
    var condition = {
      'minecraft:spawns_on_surface': {},
      'minecraft:brightness_filter': { min: Number(sr.brightnessMin) || 0, max: Number(sr.brightnessMax) || 15, adjust_for_weather: false },
      'minecraft:difficulty_filter': { min: sr.difficulty || 'easy', max: 'hard' },
      'minecraft:height_filter': { min: Number(sr.heightMin) || 0, max: Number(sr.heightMax) || 128 },
      'minecraft:weight': { default: 8 },
      'minecraft:density_limit': { surface: 4 },
      'minecraft:delay_filter': { min: Number(sr.spawnDelay) || 20, max: (Number(sr.spawnDelay) || 20) + 60 }
    };
    var biomes = String(sr.biomes || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (biomes.length) {
      condition['minecraft:biome_filter'] = biomes.length === 1
        ? { test: 'has_biome_tag', operator: '==', value: biomes[0] }
        : { any_of: biomes.map(function (b) { return { test: 'has_biome_tag', operator: '==', value: b }; }) };
    }
    return {
      format_version: RP_FORMAT.spawnRules,
      'minecraft:spawn_rules': {
        description: { identifier: entryId(entry), population_control: sr.populationControl || 'animal' },
        conditions: [condition]
      }
    };
  }

  /* -------------------------------- items -------------------------------- */

  function buildItemBehavior(entry) {
    var description = { identifier: entryId(entry) };
    var menuCategory = { category: entry.category || 'items' };
    if (entry.group) menuCategory.group = entry.group;
    if (entry.hiddenInCommands) menuCategory.is_hidden_in_commands = true;
    description.menu_category = menuCategory;

    var components = serializeComponents('item', entry.components);
    if (entry.texture) {
      components['minecraft:icon'] = { texture: slugFile(entry.texture.name) };
    }
    var out = { format_version: state.meta.formatVersion, 'minecraft:item': { description: description, components: components } };
    (entry.custom || []).forEach(function (c) {
      var parsed = parseJsonSafe(c.value);
      out['minecraft:item'].components[c.key] = parsed.ok ? parsed.value : c.value;
    });
    return out;
  }

  function buildItemClient(entry) {
    var out = {
      format_version: RP_FORMAT.item,
      'minecraft:item': {
        description: { identifier: entryId(entry), category: 'Items' },
        components: {}
      }
    };
    if (entry.texture) out['minecraft:item'].components['minecraft:icon'] = { texture: slugFile(entry.texture.name) };
    return out;
  }

  function buildItemTextureJson() {
    var data = {};
    state.items.forEach(function (it) {
      if (it.texture) data[slugFile(it.texture.name)] = { textures: 'textures/items/' + slugFile(it.texture.name) };
    });
    return {
      resource_pack_name: slug(state.meta.namespace),
      texture_name: 'atlas.items',
      texture_data: data
    };
  }

  /* -------------------------------- blocks ------------------------------- */

  function blockMaterialInstances(entry) {
    var mi = {};
    var faces = entry.faces || {};
    ['up', 'down', 'north', 'south', 'east', 'west'].forEach(function (face) {
      if (faces[face]) mi[face] = { texture: 'textures/blocks/' + slugFile(faces[face].name), render_method: entry.renderMethod || 'opaque' };
    });
    if (entry.texture) mi['*'] = { texture: 'textures/blocks/' + slugFile(entry.texture.name), render_method: entry.renderMethod || 'opaque' };
    else if (!Object.keys(mi).length) mi['*'] = { texture: 'missing_texture', render_method: entry.renderMethod || 'opaque' };
    return mi;
  }

  function buildBlockBehavior(entry) {
    var description = { identifier: entryId(entry) };
    if (entry.category && entry.category !== 'none') {
      description.menu_category = { category: entry.category };
    }
    var components = serializeComponents('block', entry.components);
    if (entry.render === 'cube' || entry.render === 'all') {
      components['minecraft:material_instances'] = blockMaterialInstances(entry);
      components['minecraft:geometry'] = 'minecraft:full_block';
    } else if (entry.render === 'geometry') {
      if (!components['minecraft:geometry']) components['minecraft:geometry'] = 'minecraft:full_block';
      if (!components['minecraft:material_instances']) {
        components['minecraft:material_instances'] = blockMaterialInstances(entry);
      }
    }
    if (!components['minecraft:destructible_by_mining']) {
      components['minecraft:destructible_by_mining'] = { seconds_to_destroy: 1 };
    }
    var out = {
      format_version: state.meta.formatVersion,
      'minecraft:block': { description: description, components: components, permutations: [] }
    };
    (entry.custom || []).forEach(function (c) {
      var parsed = parseJsonSafe(c.value);
      out['minecraft:block'].components[c.key] = parsed.ok ? parsed.value : c.value;
    });
    return out;
  }

  /* -------------------------------- sounds ------------------------------- */

  function buildSoundDefinitions(withFormatVersion) {
    var defs = {};
    state.sounds.forEach(function (s) {
      if (!s.files || !s.files.length) return;
      var event = s.event || (namespace() + '.' + slug(s.name));
      defs[event] = {
        category: s.category || 'neutral',
        sounds: s.files.map(function (f) {
          var o = { name: 'sounds/' + slugFile(f.name), volume: Number(s.volume) || 1, pitch: Number(s.pitch) || 1 };
          if (s.stream) o.stream = true;
          if (s.loadOnLowMemory) o.load_on_low_memory = true;
          return o;
        })
      };
    });
    if (withFormatVersion) return { format_version: RP_FORMAT.soundDefinitions, sound_definitions: defs };
    return defs;
  }

  /* --------------------------------- lang -------------------------------- */

  function buildLang() {
    var lines = [];
    lines.push('## Bedrock Utility generated language file');
    lines.push('pack.name=' + state.meta.name);
    lines.push('pack.description=' + state.meta.description);
    state.entities.forEach(function (e) {
      lines.push('entity.' + entryId(e) + '.name=' + e.name);
    });
    state.items.forEach(function (i) {
      lines.push('item.' + entryId(i) + '.name=' + i.name);
    });
    state.blocks.forEach(function (b) {
      lines.push('tile.' + entryId(b) + '.name=' + b.name);
    });
    return lines.join('\n') + '\n';
  }

  /* =================================================================
     6. FILE TREE + ZIP EXPORT
     ================================================================= */

  function addFile(files, path, content, kind) {
    if (content === undefined || content === null || content === '') return;
    files.push({ path: path, content: content, kind: kind || (typeof content === 'string' ? 'text' : 'binary') });
  }

  function buildFileTree() {
    var files = [];
    var folders = packFolders();
    var bp = folders.bp, rp = folders.rp;
    var fv = state.meta.formatVersion;

    /* ---- shared ---- */
    if (state.meta.icon) {
      var bytes = dataUrlToBytes(state.meta.icon);
      if (bytes) { addFile(files, bp + '/pack_icon.png', bytes, 'binary'); addFile(files, rp + '/pack_icon.png', bytes, 'binary'); }
    }
    addFile(files, bp + '/manifest.json', jsonStr(buildManifest('bp')));
    addFile(files, rp + '/manifest.json', jsonStr(buildManifest('rp')));

    /* ---- entities ---- */
    state.entities.forEach(function (e) {
      var s = slug(e.name);
      addFile(files, bp + '/entities/' + s + '.se.json', jsonStr(buildEntityBehavior(e)));
      addFile(files, rp + '/entity/' + s + '.entity.json', jsonStr(buildEntityClient(e)));
      if (e.assets && e.assets.model && e.assets.model.data) {
        addFile(files, rp + '/models/entity/' + s + '.geo.json', e.assets.model.data);
      }
      if (e.assets && e.assets.animation && e.assets.animation.data) {
        addFile(files, rp + '/animations/' + s + '.animation.json', e.assets.animation.data);
      }
      if (e.assets && e.assets.texture && e.assets.texture.data) {
        var tb = dataUrlToBytes(e.assets.texture.data);
        if (tb) addFile(files, rp + '/textures/entity/' + s + '.png', tb, 'binary');
      }
      if (!e.renderController || e.renderController === 'custom') {
        addFile(files, rp + '/render_controllers/' + s + '.rc.json', jsonStr(buildRenderController(e)));
      }
      if (e.spawnRules && e.spawnRules.enabled) {
        addFile(files, bp + '/spawn_rules/' + s + '.json', jsonStr(buildSpawnRules(e)));
      }
    });

    /* ---- items ---- */
    state.items.forEach(function (it) {
      var s = slug(it.name);
      addFile(files, bp + '/items/' + s + '.json', jsonStr(buildItemBehavior(it)));
      addFile(files, rp + '/items/' + s + '.json', jsonStr(buildItemClient(it)));
      if (it.texture && it.texture.data) {
        var ib = dataUrlToBytes(it.texture.data);
        if (ib) addFile(files, rp + '/textures/items/' + s + '.png', ib, 'binary');
      }
    });
    if (state.items.some(function (i) { return i.texture; })) {
      addFile(files, rp + '/textures/item_texture.json', jsonStr(buildItemTextureJson()));
    }

    /* ---- blocks ---- */
    state.blocks.forEach(function (b) {
      var s = slug(b.name);
      addFile(files, bp + '/blocks/' + s + '.json', jsonStr(buildBlockBehavior(b)));
      if (b.texture && b.texture.data) {
        var bb = dataUrlToBytes(b.texture.data);
        if (bb) addFile(files, rp + '/textures/blocks/' + s + '.png', bb, 'binary');
      }
      Object.keys(b.faces || {}).forEach(function (face) {
        var f = b.faces[face];
        if (f && f.data) {
          var fb = dataUrlToBytes(f.data);
          if (fb) addFile(files, rp + '/textures/blocks/' + slugFile(f.name) + '.png', fb, 'binary');
        }
      });
    });

    /* ---- sounds ---- */
    if (state.sounds.length && state.sounds.some(function (s) { return s.files && s.files.length; })) {
      addFile(files, rp + '/sounds/sound_definitions.json', jsonStr(buildSoundDefinitions(true)));
      addFile(files, rp + '/sounds/sounds.json', jsonStr(buildSoundDefinitions(false)));
      state.sounds.forEach(function (s) {
        (s.files || []).forEach(function (f) {
          if (f.data) {
            var sb = dataUrlToBytes(f.data);
            if (sb) addFile(files, rp + '/sounds/' + slugFile(f.name) + (f.ext || '.ogg'), sb, 'binary');
          }
        });
      });
    }

    /* ---- language ---- */
    addFile(files, bp + '/texts/en_US.lang', buildLang());
    addFile(files, rp + '/texts/en_US.lang', buildLang());

    return files;
  }

  /** Files that belong to a single pack (used for .mcpack exports). */
  function filterTree(files, which) {
    var root = packFolders()[which];
    return files.filter(function (f) { return f.path.indexOf(root + '/') === 0; });
  }

  function stripRoot(files, root) {
    return files.map(function (f) {
      return { path: f.path.slice(root.length + 1), content: f.content, kind: f.kind };
    });
  }

  function zipName(ext) {
    var base = (state.meta.name || 'addon').replace(/[\\/:*?"<>|]/g, '').trim() || 'addon';
    return base + ext;
  }

  function buildZip(fileList, rootFolder) {
    if (typeof JSZip === 'undefined') {
      return Promise.reject(new Error('JSZip is not available. Check your internet connection or use the local vendor/jszip.min.js copy.'));
    }
    var zip = new JSZip();
    fileList.forEach(function (f) {
      var path = rootFolder ? rootFolder + '/' + f.path : f.path;
      if (f.kind === 'binary') zip.file(path, f.content, { binary: true });
      else zip.file(path, f.content);
    });
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function downloadText(text, filename, mime) {
    downloadBlob(new Blob([text], { type: mime || 'text/plain;charset=utf-8' }), filename);
  }

  function exportMcaddon() {
    var files = buildFileTree();
    return buildZip(files, null).then(function (blob) {
      downloadBlob(blob, zipName('.mcaddon'));
      return { files: files.length, size: blob.size };
    });
  }

  function exportMcpack(which) {
    var folders = packFolders();
    var files = stripRoot(filterTree(buildFileTree(), which), folders[which]);
    return buildZip(files, null).then(function (blob) {
      downloadBlob(blob, zipName(which === 'bp' ? '_BP.mcpack' : '_RP.mcpack'));
      return { files: files.length, size: blob.size };
    });
  }

  /* =================================================================
     7. VALIDATION
     ================================================================= */

  var ID_RE = /^[a-z0-9_.-]+:[a-z0-9_.-]+$/;

  function validate() {
    var issues = [];
    var m = state.meta;

    function err(where, msg) { issues.push({ level: 'error', where: where, msg: msg }); }
    function warn(where, msg) { issues.push({ level: 'warn', where: where, msg: msg }); }

    if (!m) return issues;
    if (cmpVer(m.formatVersion, MIN_FORMAT_VERSION) < 0) {
      err('format_version', 'format_version "' + m.formatVersion + '" is below ' + MIN_FORMAT_VERSION +
        '. Bedrock Utility targets MCPE 1.21.10 and later.');
    }
    if (!m.name || !m.name.trim()) err('manifest', 'The pack needs a name.');
    if (!m.author || !m.author.trim()) warn('manifest', 'No author set — the pack will show an empty author.');
    var minEng = (m.minEngineVersion || []).join('.');
    if (cmpVer(minEng, MIN_FORMAT_VERSION) < 0) {
      warn('manifest', 'min_engine_version ' + minEng + ' is below ' + MIN_FORMAT_VERSION + '.');
    }
    var ns = slug(m.namespace);
    if (!ns || /^[0-9]/.test(ns)) err('manifest', 'The namespace must start with a letter.');

    var seen = {};
    function checkId(kind, entry) {
      var id = entryId(entry);
      if (!ID_RE.test(id)) {
        err(kind + ':' + entry.name, 'Identifier "' + id + '" is invalid. Use lowercase letters, digits, "_", ".", "-" and exactly one ":".');
      }
      if (seen[id]) err(kind + ':' + entry.name, 'Identifier "' + id + '" is already used by ' + seen[id] + '.');
      seen[id] = entry.name;
      if (id.indexOf(ns + ':') !== 0) {
        warn(kind + ':' + entry.name, 'Identifier "' + id + '" does not use the pack namespace "' + ns + ':".');
      }
    }

    state.entities.forEach(function (e) {
      checkId('entity', e);
      if (!e.components['minecraft:health']) warn('entity:' + e.name, 'No minecraft:health component — the entity may die instantly.');
      if (!e.components['minecraft:movement'] && !e.components['minecraft:movement.fly']) {
        warn('entity:' + e.name, 'No minecraft:movement component — the entity cannot move.');
      }
      if (!e.assets || !e.assets.model || !e.assets.model.data) {
        warn('entity:' + e.name, 'No model (.geo.json) uploaded — the entity will be invisible in game.');
      }
      if (!e.assets || !e.assets.texture || !e.assets.texture.data) {
        warn('entity:' + e.name, 'No texture (.png) uploaded — the entity will use the missing texture.');
      }
      if (e.assets && e.assets.model && e.assets.model.data) {
        var g = parseJsonSafe(e.assets.model.data);
        if (!g.ok) err('entity:' + e.name, 'The uploaded model is not valid JSON: ' + g.error);
      }
      if (e.assets && e.assets.animation && e.assets.animation.data) {
        var a = parseJsonSafe(e.assets.animation.data);
        if (!a.ok) err('entity:' + e.name, 'The uploaded animation is not valid JSON: ' + a.error);
      }
      if (e.components['minecraft:loot'] && e.components['minecraft:loot'].table) {
        warn('entity:' + e.name, 'Loot table "' + e.components['minecraft:loot'].table + '" must exist inside the behavior pack.');
      }
    });

    state.items.forEach(function (it) {
      checkId('item', it);
      if (!it.texture || !it.texture.data) {
        warn('item:' + it.name, 'No icon texture uploaded — minecraft:icon will be missing.');
      }
      var max = it.components['minecraft:max_stack_size'];
      if (max && max.value && (max.value < 1 || max.value > 64)) {
        err('item:' + it.name, 'minecraft:max_stack_size must be between 1 and 64.');
      }
    });

    state.blocks.forEach(function (b) {
      checkId('block', b);
      if (!b.texture && !Object.keys(b.faces || {}).some(function (k) { return b.faces[k]; })) {
        warn('block:' + b.name, 'No texture uploaded — material_instances will point at a missing texture.');
      }
    });

    state.sounds.forEach(function (s) {
      if (!s.files || !s.files.length) warn('sound:' + s.name, 'No .ogg file uploaded — this sound event will not play.');
      var ev = s.event || (ns + '.' + slug(s.name));
      if (!/^[a-z0-9_.-]+$/.test(ev)) err('sound:' + s.name, 'Sound event "' + ev + '" must be lowercase with dots only.');
    });

    if (!state.entities.length && !state.items.length && !state.blocks.length && !state.sounds.length) {
      warn('project', 'The pack is empty. Add at least one entity, item, block or sound before exporting.');
    }

    if (!issues.length) issues.push({ level: 'ok', where: 'project', msg: 'Everything looks good. Ready to build.' });
    return issues;
  }

  /* =================================================================
     8. UI — router, home, dashboard
     ================================================================= */

  var ICONS = {
    mob: '<svg viewBox="0 0 24 24"><path d="M4 8h4v8H4zM16 8h4v8h-4zM8 6h8v12H8z"/><path d="M9 10h2M13 10h2M9 13h6"/></svg>',
    item: '<svg viewBox="0 0 24 24"><path d="M4 7h16v12H4z"/><path d="M4 11h16M9 7V5h6v2"/></svg>',
    block: '<svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></svg>',
    sound: '<svg viewBox="0 0 24 24"><path d="M4 10v4h3l4 3V7L7 10z"/><path d="M15 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    folder: '<svg viewBox="0 0 24 24"><path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    file: '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5h10"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"/></svg>',
    upload: '<svg viewBox="0 0 24 24"><path d="M12 16V6m0 0L8 10m4-4 4 4M5 20h14"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    cube: '<svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5"/></svg>',
    image: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M4 18l5-5 4 4 3-3 4 4"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>',
    zip: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18H6z"/><path d="M12 3v4M12 9v2M12 13v2"/></svg>',
    bolt: '<svg viewBox="0 0 24 24"><path d="M13 3 5 14h5l-1 7 8-11h-5z"/></svg>'
  };
  function icon(name) { return ICONS[name] || ICONS.file; }

  function el(id) { return document.getElementById(id); }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var route = { view: 'home', kind: null, uid: null, tab: null };
  var pendingFileCb = null;
  var pendingFileMode = 'data';

  /* ------------------------------ toasts ------------------------------ */

  function toast(type, title, msg, ms) {
    var root = el('toast-root');
    var node = document.createElement('div');
    node.className = 'toast ' + (type || 'info');
    node.innerHTML = '<span class="t-ico">' + icon(type === 'ok' ? 'check' : type === 'err' ? 'alert' : type === 'warn' ? 'alert' : 'info') + '</span>' +
      '<div><b>' + esc(title) + '</b>' + (msg ? '<span>' + esc(msg) + '</span>' : '') + '</div>';
    root.appendChild(node);
    setTimeout(function () {
      node.classList.add('out');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 250);
    }, ms || 4200);
  }

  /* ------------------------------ modals ------------------------------ */

  function openModal(opts) {
    var back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML =
      '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="modal-head"><h2>' + esc(opts.title || '') + '</h2>' +
          '<button class="modal-x" data-x>' + icon('alert') + '</button></div>' +
        '<div class="modal-body">' + opts.body + '</div>' +
        (opts.actions ? '<div class="modal-foot">' + opts.actions + '</div>' : '') +
      '</div>';
    document.body.appendChild(back);
    function close() { if (back.parentNode) back.parentNode.removeChild(back); }
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    qs('[data-x]', back).addEventListener('click', close);
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    });
    return { root: back, close: close };
  }

  function confirmDialog(title, msg, confirmLabel) {
    return new Promise(function (resolve) {
      var m = openModal({
        title: title,
        body: '<p class="muted">' + esc(msg) + '</p>',
        actions: '<button class="btn ghost" data-no>Cancel</button>' +
                 '<button class="btn danger" data-yes>' + esc(confirmLabel || 'Delete') + '</button>'
      });
      qs('[data-no]', m.root).addEventListener('click', function () { m.close(); resolve(false); });
      qs('[data-yes]', m.root).addEventListener('click', function () { m.close(); resolve(true); });
    });
  }

  function promptDialog(title, fields, confirmLabel) {
    return new Promise(function (resolve) {
      var body = '<div class="form-grid">' + fields.map(function (f, i) {
        var input;
        if (f.type === 'select') {
          input = '<select data-i="' + i + '">' + f.options.map(function (o) {
            return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(f.value) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
          }).join('') + '</select>';
        } else if (f.type === 'textarea') {
          input = '<textarea data-i="' + i + '" rows="4" placeholder="' + esc(f.placeholder || '') + '">' + esc(f.value || '') + '</textarea>';
        } else {
          input = '<input type="' + (f.type || 'text') + '" data-i="' + i + '" value="' + esc(f.value == null ? '' : f.value) + '" placeholder="' + esc(f.placeholder || '') + '">';
        }
        return '<div class="field' + (f.span ? ' span2' : '') + '"><label>' + esc(f.label) + '</label>' + input +
          (f.help ? '<div class="help">' + esc(f.help) + '</div>' : '') + '</div>';
      }).join('') + '</div>';
      var m = openModal({
        title: title, body: body,
        actions: '<button class="btn ghost" data-no>Cancel</button><button class="btn primary" data-yes>' + esc(confirmLabel || 'Save') + '</button>'
      });
      function read() {
        var out = {};
        qsa('[data-i]', m.root).forEach(function (n) { out[fields[Number(n.getAttribute('data-i'))].key] = n.value; });
        return out;
      }
      qs('[data-no]', m.root).addEventListener('click', function () { m.close(); resolve(null); });
      qs('[data-yes]', m.root).addEventListener('click', function () { m.close(); resolve(read()); });
      var first = qs('input,select,textarea', m.root);
      if (first) first.focus();
    });
  }

  /* --------------------------- file picker --------------------------- */

  /** mode: 'text' | 'data' (data URL) | 'buffer' (ArrayBuffer) */
  function pickFile(accept, cb, mode) {
    var input = el('hidden-file');
    input.value = '';
    input.setAttribute('accept', accept);
    pendingFileCb = cb;
    pendingFileMode = mode || 'data';
    input.click();
  }

  function readFileAs(file, mode) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(new Error('Could not read ' + file.name)); };
      if (mode === 'text') fr.readAsText(file);
      else if (mode === 'buffer') fr.readAsArrayBuffer(file);
      else fr.readAsDataURL(file);
    });
  }

  /* ---------------------------- navigation ---------------------------- */

  function navigate(view, params) {
    params = params || {};
    route = { view: view, kind: params.kind || null, uid: params.uid || null, tab: params.tab || null };
    if (view === 'home') history.replaceState(null, '', '#/home');
    else if (view === 'dashboard') history.replaceState(null, '', '#/dashboard');
    else history.replaceState(null, '', '#/editor/' + (params.kind || 'entity') + '/' + (params.uid || ''));
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function currentEntry() {
    if (!route.uid) return null;
    var list = getList(route.kind);
    for (var i = 0; i < list.length; i += 1) if (list[i].uid === route.uid) return list[i];
    return null;
  }

  /* ------------------------------ render ------------------------------ */

  function render() {
    var app = el('app');
    app.hidden = false;
    var boot = el('boot');
    if (boot && boot.parentNode) boot.parentNode.removeChild(boot);

    ['view-home', 'view-dashboard', 'view-editor'].forEach(function (id) {
      var v = el(id);
      v.hidden = !(id === 'view-' + route.view);
    });

    if (!hasProject() && route.view !== 'home') {
      route.view = 'home';
      el('view-home').hidden = false;
      el('view-dashboard').hidden = true;
      el('view-editor').hidden = true;
    }

    renderTopbar();
    renderSidebar();
    if (route.view === 'home') renderHome();
    else if (route.view === 'dashboard') renderDashboard();
    else renderEditor();
  }

  function renderTopbar() {
    var chip = el('engine-chip');
    if (state.meta) chip.textContent = state.meta.formatVersion + '+';
    else chip.textContent = '1.21.10+';

    // status bar
    if (state.meta) {
      el('sb-format').textContent = state.meta.formatVersion;
      el('sb-engine').textContent = (state.meta.minEngineVersion || []).join('.');
      var n = state.entities.length + state.items.length + state.blocks.length + state.sounds.length;
      el('sb-objects').textContent = n + ' object' + (n === 1 ? '' : 's') + ' · ' + namespace();
    } else {
      el('sb-format').textContent = '—';
      el('sb-engine').textContent = '—';
      el('sb-objects').textContent = 'no project';
    }
    var crumbs = el('crumbs');
    var parts = ['<span>Bedrock Utility</span>'];
    if (hasProject() && route.view !== 'home') {
      parts.push('<span class="sep">/</span><b>' + esc(state.meta.name) + '</b>');
      if (route.view === 'editor' && route.kind) {
        parts.push('<span class="sep">/</span><b>' + esc(KINDS[route.kind].plural) + '</b>');
      }
    }
    crumbs.innerHTML = parts.join(' ');
    el('btn-build').disabled = !hasProject();
    el('btn-build-2').disabled = !hasProject();
  }

  function renderSidebar() {
    var box = el('side-project');
    if (!hasProject()) { box.innerHTML = '<div class="sp-sub">No project yet</div>'; }
    else {
      var counts = [state.entities.length, state.items.length, state.blocks.length, state.sounds.length];
      var total = counts.reduce(function (a, b) { return a + b; }, 0);
      box.innerHTML =
        '<div class="sp-name">' + esc(state.meta.name) + '</div>' +
        '<div class="sp-sub">' + esc(namespace()) + ' &middot; v' + (state.meta.version || []).join('.') + '</div>' +
        '<div class="sp-bar"><i style="width:' + Math.min(100, total * 10) + '%"></i></div>';
    }

    var nav = el('side-nav');
    var items = [];
    items.push({ id: 'home', label: 'Home', icon: 'back', count: '' });
    if (hasProject()) {
      items.push({ id: 'dashboard', label: 'Dashboard', icon: 'cube', count: '' });
      items.push({ group: 'Content' });
      items.push({ id: 'editor:entity', label: 'Entities', icon: 'mob', count: state.entities.length });
      items.push({ id: 'editor:item', label: 'Items', icon: 'item', count: state.items.length });
      items.push({ id: 'editor:block', label: 'Blocks', icon: 'block', count: state.blocks.length });
      items.push({ id: 'editor:sound', label: 'Sounds', icon: 'sound', count: state.sounds.length });
    }
    var html = '';
    items.forEach(function (it) {
      if (it.group) { html += '<div class="group-label">' + esc(it.group) + '</div>'; return; }
      var active = (route.view === 'home' && it.id === 'home') ||
        (route.view === 'dashboard' && it.id === 'dashboard') ||
        (route.view === 'editor' && it.id === 'editor:' + route.kind);
      html += '<button class="side-link' + (active ? ' active' : '') + '" data-go="' + esc(it.id) + '">' +
        '<span class="s-ico">' + icon(it.icon) + '</span>' + esc(it.label) +
        (it.count !== '' && it.count !== undefined ? '<span class="count">' + it.count + '</span>' : '') + '</button>';
    });
    nav.innerHTML = html;
    qsa('[data-go]', nav).forEach(function (b) {
      b.addEventListener('click', function () {
        var go = b.getAttribute('data-go');
        el('sidebar').classList.remove('open');
        if (go.indexOf('editor:') === 0) navigate('editor', { kind: go.split(':')[1], uid: null });
        else navigate(go);
      });
    });
    el('save-label').textContent = hasProject() ? 'saved to this browser' : 'nothing saved yet';
    var closeBtn = el('btn-close-addon');
    if (closeBtn) closeBtn.disabled = !hasProject();
  }

  /* ------------------------------- home ------------------------------- */
  /* The homepage is the addon library: every addon you have made, with an
     Edit button and a Delete button. Nothing else. */

  function sortAddons(list) {
    return list.slice().sort(function (a, b) {
      var x = (a.meta && a.meta.updatedAt) || '';
      var y = (b.meta && b.meta.updatedAt) || '';
      return x < y ? 1 : x > y ? -1 : 0;
    });
  }

  function addonBits(a) {
    var s = addonSummary(a);
    var out = [];
    if (s.entities) out.push(s.entities + (s.entities === 1 ? ' entity' : ' entities'));
    if (s.items) out.push(s.items + (s.items === 1 ? ' item' : ' items'));
    if (s.blocks) out.push(s.blocks + (s.blocks === 1 ? ' block' : ' blocks'));
    if (s.sounds) out.push(s.sounds + (s.sounds === 1 ? ' sound' : ' sounds'));
    return out.length ? out : ['empty'];
  }

  function addonMetaLine(a) {
    var m = a.meta || {};
    var bits = [];
    if (m.author) bits.push('by ' + m.author);
    if (m.namespace) bits.push(slug(m.namespace));
    if (m.version) bits.push('v' + m.version.join('.'));
    if (m.formatVersion) bits.push('Minecraft ' + m.formatVersion + '+');
    return bits.join(' · ');
  }

  function renderHome() {
    var list = sortAddons(loadRegistry());
    el('home-count').textContent = list.length
      ? list.length + (list.length === 1 ? ' addon' : ' addons') + ' saved in this browser'
      : 'nothing saved yet';

    var box = el('addon-list');
    if (!list.length) {
      box.innerHTML = '<div class="empty"><b>No addons yet</b>' +
        'Press <b>Create new addon</b> to make your first one. It is stored in this browser only.</div>';
      return;
    }

    box.innerHTML = list.map(function (a) {
      var m = a.meta || {};
      return '<article class="addon-row" data-addon="' + esc(a.id) + '">' +
        '<span class="a-ico" aria-hidden="true">🧰</span>' +
        '<div class="a-main">' +
          '<div class="a-name">' + esc(m.name || 'Untitled addon') + '</div>' +
          '<div class="a-meta">' + esc(addonMetaLine(a)) + '</div>' +
          '<div class="a-tags">' + addonBits(a).map(function (t) {
            return '<span class="tag">' + esc(t) + '</span>';
          }).join('') + '</div>' +
        '</div>' +
        '<div class="a-actions">' +
          '<button class="btn primary" data-edit="' + esc(a.id) + '">Edit</button>' +
          '<button class="btn danger" data-del="' + esc(a.id) + '">Delete</button>' +
        '</div>' +
      '</article>';
    }).join('');

    qsa('[data-edit]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        if (openAddon(b.getAttribute('data-edit'))) navigate('dashboard');
        else toast('err', 'Could not open that addon');
      });
    });
    qsa('[data-del]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-del');
        var a = loadRegistry().filter(function (x) { return x.id === id; })[0];
        var name = (a && a.meta && a.meta.name) || 'this addon';
        confirmDialog('Delete addon', 'Delete "' + name + '" and everything inside it? This cannot be undone.', 'Delete')
          .then(function (ok) {
            if (!ok) return;
            deleteAddon(id);
            render();
            toast('ok', 'Addon deleted', name);
          });
      });
    });
  }

  /* ----------------------------- dashboard ----------------------------- */

  function renderDashboard() {
    if (!hasProject()) return;
    var m = state.meta;
    el('dash-title').textContent = m.name;
    el('dash-meta').textContent = 'by ' + (m.author || 'Unknown') + ' · ' + namespace() +
      ' · v' + (m.version || []).join('.') + ' · Minecraft ' + m.formatVersion + '+';
      ' · v' + (m.version || []).join('.') + ' · format_version ' + m.formatVersion + ' · min_engine_version ' + (m.minEngineVersion || []).join('.');

    var stats = [
      { k: 'Entities', v: state.entities.length },
      { k: 'Items', v: state.items.length },
      { k: 'Blocks', v: state.blocks.length },
      { k: 'Sounds', v: state.sounds.length },
      { k: 'Components', v: countComponents() }
    ];
    el('dash-stats').innerHTML = stats.map(function (s) {
      return '<div class="stat"><div class="k">' + esc(s.k) + '</div><div class="v">' + s.v + '</div></div>';
    }).join('');

    var kinds = [
      { kind: 'entity', title: 'Entities', empty: 'No mobs yet' },
      { kind: 'item', title: 'Items', empty: 'No items yet' },
      { kind: 'block', title: 'Blocks', empty: 'No blocks yet' },
      { kind: 'sound', title: 'Sounds', empty: 'No sounds yet' }
    ];
    el('content-grid').innerHTML = kinds.map(function (c) {
      var list = getList(c.kind);
      var rows = list.length
        ? list.map(function (e) {
            return '<div class="entry-row">' +
              '<div class="e-ico">' + icon(KINDS[c.kind].icon) + '</div>' +
              '<div class="e-main"><div class="e-name">' + esc(e.name) + '</div>' +
              '<div class="e-id">' + esc(entryId(e)) + '</div></div>' +
              '<div class="e-actions">' +
                '<button class="btn tiny outline" data-open="' + esc(c.kind + ':' + e.uid) + '">Edit</button>' +
                '<button class="btn tiny danger" data-drop="' + esc(c.kind + ':' + e.uid) + '" title="Delete">' + icon('trash') + '</button>' +
              '</div></div>';
          }).join('')
        : '<div class="panel-empty">' + esc(c.empty) + '</div>';
      return '<section class="panel">' +
        '<div class="panel-head"><h2>' + esc(c.title) + '</h2>' +
        '<span class="badge">' + list.length + '</span></div>' +
        '<div class="entry-list">' + rows + '</div>' +
        '<div class="btn-row"><button class="btn ghost full" data-add="' + esc(c.kind) + '">' + icon('plus') + 'Add ' + esc(KINDS[c.kind].label.toLowerCase()) + '</button></div>' +
        '</section>';
    }).join('');

    qsa('[data-open]', el('content-grid')).forEach(function (b) {
      b.addEventListener('click', function () {
        var parts = b.getAttribute('data-open').split(':');
        navigate('editor', { kind: parts[0], uid: parts[1] });
      });
    });
    qsa('[data-add]', el('content-grid')).forEach(function (b) {
      b.addEventListener('click', function () { createEntry(b.getAttribute('data-add')); });
    });
    qsa('[data-drop]', el('content-grid')).forEach(function (b) {
      b.addEventListener('click', function () {
        var parts = b.getAttribute('data-drop').split(':');
        var kind = parts[0], uidToFind = parts[1];
        var e = findEntry(kind, uidToFind);
        if (!e) return;
        confirmDialog('Delete ' + KINDS[kind].label.toLowerCase(), 'Delete "' + e.name + '"?', 'Delete').then(function (ok) {
          if (!ok) return;
          var list = getList(kind);
          list.splice(list.indexOf(e), 1);
          onChange();
          render();
          toast('ok', 'Deleted', e.name);
        });
      });
    });

    var issues = validate();
    var errors = issues.filter(function (i) { return i.level === 'error'; }).length;
    var warns = issues.filter(function (i) { return i.level === 'warn'; }).length;
    var badge = el('validation-badge');
    badge.textContent = errors ? errors + ' error' + (errors > 1 ? 's' : '') : warns ? warns + ' warning' + (warns > 1 ? 's' : '') : 'all good';
    badge.className = 'badge ' + (errors ? 'err' : warns ? 'warn' : 'ok');
    el('validation').innerHTML = issues.map(function (i) {
      return '<div class="v-item ' + i.level + '"><span class="v-ico">' +
        icon(i.level === 'ok' ? 'check' : i.level === 'warn' ? 'alert' : 'alert') + '</span>' +
        '<div class="v-msg"><b>' + esc(i.where) + '</b><span>' + esc(i.msg) + '</span></div></div>';
    }).join('');

    var files = buildFileTree();
    el('tree-count').textContent = files.length + ' files';
    el('filetree').innerHTML = treeRows(files);
  }

  function countComponents() {
    var n = 0;
    ['entities', 'items', 'blocks'].forEach(function (k) {
      (state[k] || []).forEach(function (e) {
        n += Object.keys(e.components || {}).length;
        Object.keys(e.groups || {}).forEach(function (g) { n += Object.keys(e.groups[g]).length; });
      });
    });
    return n;
  }

  function treeRows(files) {
    var rows = [];
    var dirSeen = {};
    var sorted = files.slice().sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });
    sorted.forEach(function (f) {
      var parts = f.path.split('/');
      var dirParts = parts.slice(0, -1);
      var acc = '';
      dirParts.forEach(function (seg, idx) {
        acc = acc ? acc + '/' + seg : seg;
        if (!dirSeen[acc]) {
          dirSeen[acc] = true;
          rows.push({ type: 'dir', name: seg, depth: idx });
        }
      });
      rows.push({ type: 'file', name: parts[parts.length - 1], depth: dirParts.length, size: fileSize(f), path: f.path });
    });
    return rows.map(function (r) {
      var pad = 'padding-left:' + (r.depth * 14) + 'px;--ind:' + (r.depth * 14) + 'px';
      if (r.type === 'dir') {
        return '<div class="row dir" style="' + pad + '"><span class="ic">' + icon('folder') + '</span>' + esc(r.name) + '/</div>';
      }
      return '<div class="row" style="' + pad + '"><span class="ic">' + icon('file') + '</span>' + esc(r.name) +
        '<span class="size">' + formatBytes(r.size) + '</span></div>';
    }).join('');
  }

  /* --------------------------- project wizard --------------------------- */

  function openCreateModal() {
    var hasContent = state.entities.length || state.items.length || state.blocks.length || state.sounds.length;
    if (hasProject() && hasContent) {
      confirmDialog('Start a new addon?',
        'This replaces "' + state.meta.name + '" and everything inside it. Export it first if you want to keep it.',
        'Replace').then(function (ok) {
        if (ok) openCreateModal();
      });
      return;
    }
    promptDialog('Create a new addon', [
      { key: 'name', label: 'Pack name', value: 'My First Addon', help: 'This is what players see in the Minecraft pack list.' },
      { key: 'author', label: 'Made by', value: 'YourName', help: 'Your name or studio name.' },
      { key: 'description', label: 'What does it do?', value: 'A Minecraft Bedrock addon created with Bedrock Utility.', type: 'textarea', span: true },
      { key: 'namespace', label: 'Short id', value: 'mypack', help: 'Goes in front of every name, like mypack:my_mob. Lowercase letters, numbers and underscores only.' },
      { key: 'formatVersion', label: 'Oldest Minecraft version', type: 'select', value: '1.21.10',
        options: FORMAT_VERSIONS.slice().reverse().map(function (v) { return [v, v]; }),
        help: 'The oldest version your addon should work on. 1.21.10 or higher.' },
      { key: 'version', label: 'Addon version', value: '1.0.0', help: 'Bump this whenever you release an update.' }
    ], 'Create addon').then(function (res) {
      if (!res) return;
      ensureAddonSlot();
      state.meta = defaultMeta();
      state.meta.name = (res.name || 'My Addon').trim();
      state.meta.author = (res.author || '').trim();
      state.meta.description = (res.description || '').trim();
      state.meta.namespace = slug(res.namespace) || 'mypack';
      state.meta.formatVersion = FORMAT_VERSIONS.indexOf(res.formatVersion) >= 0 ? res.formatVersion : '1.21.10';
      var vparts = String(res.version || '1.0.0').split('.').map(function (n) { return parseInt(n, 10) || 0; });
      while (vparts.length < 3) vparts.push(0);
      state.meta.version = vparts.slice(0, 3);
      state.meta.minEngineVersion = state.meta.formatVersion.split('.').map(function (n) { return parseInt(n, 10) || 0; });
      onChange();
      navigate('dashboard');
      toast('ok', 'Addon created', state.meta.name + ' is ready — press "Add new" to add your first mob, item, block or sound.');
    });
  }

  function openMetaModal() {
    var m = state.meta;
    promptDialog('Pack details', [
      { key: 'name', label: 'Pack name', value: m.name, help: 'Shown to players in the Minecraft pack list.' },
      { key: 'author', label: 'Made by', value: m.author },
      { key: 'description', label: 'What does it do?', value: m.description, type: 'textarea', span: true },
      { key: 'namespace', label: 'Short id', value: m.namespace, help: 'Goes in front of every name, like mypack:my_mob.' },
      { key: 'formatVersion', label: 'Oldest Minecraft version', type: 'select', value: m.formatVersion,
        options: FORMAT_VERSIONS.slice().reverse().map(function (v) { return [v, v]; }),
        help: 'Raising this unlocks newer components but drops older phones.' },
      { key: 'minEngine', label: 'Minimum engine version', value: (m.minEngineVersion || []).join('.'), help: 'Usually the same as the version above.' },
      { key: 'version', label: 'Addon version', value: (m.version || []).join('.') },
      { key: 'icon', label: 'Pack icon', value: m.icon ? 'replace' : '', help: 'Type "replace" to pick a new 512×512 PNG. Leave empty to keep the current icon.' }
    ], 'Save').then(function (res) {
      if (!res) return;
      m.name = (res.name || m.name).trim();
      m.author = (res.author || '').trim();
      m.description = (res.description || '').trim();
      m.namespace = slug(res.namespace) || m.namespace;
      m.formatVersion = FORMAT_VERSIONS.indexOf(res.formatVersion) >= 0 ? res.formatVersion : m.formatVersion;
      var me = String(res.minEngine || '1.21.10').split('.').map(function (n) { return parseInt(n, 10) || 0; });
      while (me.length < 3) me.push(0);
      m.minEngineVersion = me.slice(0, 3);
      var vp = String(res.version || '1.0.0').split('.').map(function (n) { return parseInt(n, 10) || 0; });
      while (vp.length < 3) vp.push(0);
      m.version = vp.slice(0, 3);
      if (res.icon === 'replace') {
        pickFile('image/png', function (dataUrl, file) {
          m.icon = dataUrl;
          onChange();
          toast('ok', 'Pack icon updated', file.name);
          render();
        });
      }
      onChange();
      render();
      toast('ok', 'Pack details saved');
    });
  }

  /* ------------------------------ exporting ------------------------------ */

  function withExport(fn, okMsg) {
    return function () {
      var btn = this;
      var old = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;margin:0"></span> Building…';
      fn().then(function (info) {
        btn.disabled = false;
        btn.innerHTML = old;
        toast('ok', okMsg, info ? info.files + ' files · ' + formatBytes(info.size) : '');
        render();
      }).catch(function (err) {
        btn.disabled = false;
        btn.innerHTML = old;
        toast('err', 'Export failed', err && err.message ? err.message : String(err));
      });
    };
  }

  function wireDashboard() {
    el('btn-build-2').addEventListener('click', function () { doBuild(); });
    el('btn-export-mcaddon').addEventListener('click', withExport(function () {
      return exportMcaddon();
    }, 'Downloaded .mcaddon'));
    el('btn-export-bp').addEventListener('click', withExport(function () {
      return exportMcpack('bp');
    }, 'Downloaded behavior pack'));
    el('btn-export-rp').addEventListener('click', withExport(function () {
      return exportMcpack('rp');
    }, 'Downloaded resource pack'));
    el('btn-download-manifest').addEventListener('click', function () {
      downloadText(jsonStr(buildManifest('bp')), 'manifest.json', 'application/json');
      toast('ok', 'manifest.json downloaded');
    });
    el('btn-download-lang').addEventListener('click', function () {
      downloadText(buildLang(), 'en_US.lang', 'text/plain;charset=utf-8');
      toast('ok', 'en_US.lang downloaded');
    });
    el('btn-copy-json').addEventListener('click', function () {
      var all = buildFileTree().filter(function (f) { return f.kind !== 'binary'; })
        .map(function (f) { return '// ' + f.path + '\n' + f.content; }).join('\n\n');
      copyText(all).then(function () { toast('ok', 'All JSON copied to clipboard'); });
    });
    el('btn-edit-meta').addEventListener('click', openMetaModal);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve) {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      resolve();
    });
  }

  /** The "Build Addon" flow: validate first, then show the export dialog. */
  function doBuild() {
    if (!hasProject()) { toast('warn', 'No project', 'Create an addon first.'); return; }
    var issues = validate();
    var errors = issues.filter(function (i) { return i.level === 'error'; });
    if (errors.length) {
      var m = openModal({
        title: 'Fix these errors first',
        body: '<div class="validation">' + errors.map(function (i) {
          return '<div class="v-item err"><span class="v-ico">' + icon('alert') + '</span><div class="v-msg"><b>' + esc(i.where) + '</b><span>' + esc(i.msg) + '</span></div></div>';
        }).join('') + '</div>',
        actions: '<button class="btn ghost" data-x>Close</button>'
      });
      qs('[data-x]', m.root).addEventListener('click', m.close);
      return;
    }
    var files = buildFileTree();
    var folders = packFolders();
    var warns = issues.filter(function (i) { return i.level === 'warn'; }).length;
    var m = openModal({
      title: 'Build addon',
      wide: true,
      body:
        '<p class="muted small">' + files.length + ' files across two packs. ' +
        (warns ? warns + ' warning(s) — check the validation panel on the dashboard.' : 'No issues found.') + '</p>' +
        '<div class="filetree" style="max-height:260px">' + treeRows(files) + '</div>' +
        '<div class="btn-row">' +
          '<button class="btn primary" data-build-mcaddon>' + icon('zip') + 'Download .mcaddon</button>' +
          '<button class="btn outline" data-build-bp>Behavior pack only</button>' +
          '<button class="btn outline" data-build-rp>Resource pack only</button>' +
        '</div>' +
        '<p class="hint">Folders: <code>' + esc(folders.bp) + '</code> and <code>' + esc(folders.rp) + '</code>. ' +
        'Import the .mcaddon by opening it with Minecraft, then enable both packs in your world settings.</p>',
      actions: '<button class="btn ghost" data-x>Close</button>'
    });
    qs('[data-x]', m.root).addEventListener('click', m.close);
    qs('[data-build-mcaddon]', m.root).addEventListener('click', withExport(function () { return exportMcaddon(); }, 'Downloaded .mcaddon').bind(qs('[data-build-mcaddon]', m.root)));
    qs('[data-build-bp]', m.root).addEventListener('click', withExport(function () { return exportMcpack('bp'); }, 'Downloaded behavior pack').bind(qs('[data-build-bp]', m.root)));
    qs('[data-build-rp]', m.root).addEventListener('click', withExport(function () { return exportMcpack('rp'); }, 'Downloaded resource pack').bind(qs('[data-build-rp]', m.root)));
  }

  /* =================================================================
     9. UI — component editor
     ================================================================= */

  var TABS = {
    entity: [
      { id: 'identity', label: 'Basics' },
      { id: 'assets', label: 'Model & look' },
      { id: 'components', label: 'Components' },
      { id: 'groups', label: 'Variants' },
      { id: 'events', label: 'Reactions' },
      { id: 'spawn', label: 'Spawning' },
      { id: 'custom', label: 'Raw JSON' }
    ],
    item: [
      { id: 'identity', label: 'Basics' },
      { id: 'assets', label: 'Icon & texture' },
      { id: 'components', label: 'Components' },
      { id: 'custom', label: 'Raw JSON' }
    ],
    block: [
      { id: 'identity', label: 'Basics' },
      { id: 'assets', label: 'Textures' },
      { id: 'components', label: 'Components' },
      { id: 'custom', label: 'Raw JSON' }
    ],
    sound: [
      { id: 'identity', label: 'Sound event' },
      { id: 'assets', label: 'Audio files' }
    ]
  };

  var editorUi = { compSearch: '', compGroup: 'All', preview: 'bp', entryUid: null };

  /** Ask which kind of thing the user wants to add, then open its editor. */
  function openAddPicker() {
    if (!hasProject()) { toast('warn', 'No addon open', 'Create or open an addon first.'); return; }
    var choices = [
      { kind: 'entity', label: 'Entity', desc: 'A mob with a model, texture, animations and behaviour.' },
      { kind: 'item', label: 'Item', desc: 'A tool, a food, or a piece of gear.' },
      { kind: 'block', label: 'Block', desc: 'A new block with its own textures and physics.' },
      { kind: 'sound', label: 'Sound', desc: 'A sound event your mobs and animations can play.' }
    ];
    var body = '<div class="pick-grid">' + choices.map(function (c) {
      return '<button class="pick" data-pick="' + c.kind + '">' +
        '<span class="pick-ico">' + icon(KINDS[c.kind].icon) + '</span>' +
        '<span class="pick-text"><b>' + esc(c.label) + '</b><small>' + esc(c.desc) + '</small></span>' +
        '<span class="pick-go">' + icon('plus') + '</span></button>';
    }).join('') + '</div>';
    var m = openModal({
      title: 'What do you want to add?',
      body: body,
      actions: '<button class="btn ghost" data-no>Cancel</button>'
    });
    qs('[data-no]', m.root).addEventListener('click', function () { m.close(); });
    qsa('[data-pick]', m.root).forEach(function (b) {
      b.addEventListener('click', function () {
        var kind = b.getAttribute('data-pick');
        m.close();
        createEntry(kind);
      });
    });
  }

  function deleteCurrentAddon() {
    if (!hasProject()) return;
    var name = state.meta.name;
    confirmDialog('Delete addon',
      'Delete "' + name + '" and every entity, item, block and sound inside it? This cannot be undone.',
      'Delete addon').then(function (ok) {
      if (!ok) return;
      deleteAddon(state.id);
      navigate('home');
      toast('ok', 'Addon deleted', name);
    });
  }

  function createEntry(kind) {
    var entry = kind === 'entity' ? newEntity() : kind === 'item' ? newItem() : kind === 'block' ? newBlock() : newSound();
    getList(kind).push(entry);
    onChange();
    navigate('editor', { kind: kind, uid: entry.uid, tab: 'identity' });
    return entry;
  }

  function renderEditor() {
    var kind = route.kind || 'entity';
    if (!KINDS[kind]) { navigate('dashboard'); return; }
    var tabs = TABS[kind];
    var entry = currentEntry();

    if (!entry) { renderEntryList(kind); return; }

    el('ed-title').textContent = entry.name || KINDS[kind].label;
    el('ed-sub').innerHTML = '<code>' + esc(entryId(entry)) + '</code>';

    // a different entry starts with a clean component filter
    if (editorUi.entryUid !== entry.uid) {
      editorUi.entryUid = entry.uid;
      editorUi.compSearch = '';
      editorUi.compGroup = 'All';
    }

    var active = tabs.filter(function (t) { return t.id === route.tab; })[0] || tabs[0];
    el('ed-tabs').innerHTML = tabs.map(function (t) {
      var extra = '';
      if (t.id === 'components') extra = '<span class="n">' + Object.keys(entry.components || {}).length + '</span>';
      if (t.id === 'groups') extra = '<span class="n">' + Object.keys(entry.groups || {}).length + '</span>';
      if (t.id === 'events') extra = '<span class="n">' + Object.keys(entry.events || {}).length + '</span>';
      if (t.id === 'custom') extra = '<span class="n">' + (entry.custom || []).length + '</span>';
      return '<button class="ed-tab' + (t.id === active.id ? ' active' : '') + '" data-tab="' + t.id + '" role="tab">' +
        esc(t.label) + extra + '</button>';
    }).join('');
    qsa('[data-tab]', el('ed-tabs')).forEach(function (b) {
      b.addEventListener('click', function () { route.tab = b.getAttribute('data-tab'); render(); });
    });

    var body = el('ed-body');
    body.innerHTML = '';
    var renderers = {
      identity: renderIdentityTab,
      assets: renderAssetsTab,
      components: renderComponentsTab,
      groups: renderGroupsTab,
      events: renderEventsTab,
      spawn: renderSpawnTab,
      custom: renderCustomTab
    };
    (renderers[active.id] || renderIdentityTab)(body, entry, kind);

    el('preview-toggle').innerHTML =
      '<button data-pv="bp" class="' + (editorUi.preview === 'bp' ? 'active' : '') + '">Behavior</button>' +
      '<button data-pv="rp" class="' + (editorUi.preview === 'rp' ? 'active' : '') + '">Resource</button>';
    qsa('[data-pv]', el('preview-toggle')).forEach(function (b) {
      b.addEventListener('click', function () { editorUi.preview = b.getAttribute('data-pv'); renderEditor(); });
    });
    updatePreview(entry, kind);
  }

  /** Refresh the tab counters and the live JSON preview without a full re-render. */
  function refreshEditorChrome(entry, kind) {
    var tabs = TABS[kind];
    el('ed-tabs').innerHTML = tabs.map(function (t) {
      var extra = '';
      if (t.id === 'components') extra = '<span class="n">' + Object.keys(entry.components || {}).length + '</span>';
      if (t.id === 'groups') extra = '<span class="n">' + Object.keys(entry.groups || {}).length + '</span>';
      if (t.id === 'events') extra = '<span class="n">' + Object.keys(entry.events || {}).length + '</span>';
      if (t.id === 'custom') extra = '<span class="n">' + (entry.custom || []).length + '</span>';
      return '<button class="ed-tab' + (t.id === route.tab ? ' active' : '') + '" data-tab="' + t.id + '" role="tab">' +
        esc(t.label) + extra + '</button>';
    }).join('');
    qsa('[data-tab]', el('ed-tabs')).forEach(function (b) {
      b.addEventListener('click', function () { route.tab = b.getAttribute('data-tab'); render(); });
    });
    updatePreview(entry, kind);
  }

  function updatePreview(entry, kind) {
    var obj;
    try {
      if (editorUi.preview === 'rp') {
        obj = kind === 'entity' ? buildEntityClient(entry)
          : kind === 'item' ? buildItemClient(entry)
          : kind === 'block' ? buildBlockBehavior(entry)
          : buildSoundDefinitions(true);
      } else {
        obj = kind === 'entity' ? buildEntityBehavior(entry)
          : kind === 'item' ? buildItemBehavior(entry)
          : kind === 'block' ? buildBlockBehavior(entry)
          : buildSoundDefinitions(true);
      }
    } catch (err) {
      obj = { error: err.message };
    }
    el('ed-preview').innerHTML = highlightJson(jsonStr(obj));
  }

  /* ------------------------ field primitives ------------------------ */

  function fieldWrap(f, inner, span) {
    return '<div class="field' + (span ? ' span2' : '') + '">' +
      '<label>' + esc(f.label) + (f.since ? ' <span class="comp-ver">' + esc(f.since) + '+</span>' : '') + '</label>' +
      inner + (f.help ? '<div class="help">' + esc(f.help) + '</div>' : '') + '</div>';
  }

  function fieldInput(f, value) {
    var v = value === undefined || value === null ? '' : value;
    var common = 'data-f="' + esc(f.key) + '" data-ft="' + f.type + '"';
    switch (f.type) {
      case 'bool':
        return '<label class="switch"><input type="checkbox" ' + common + (v ? ' checked' : '') + '><span class="track"></span>' +
          '<span class="sw-label">' + esc(f.boolLabel || 'Enabled') + '</span></label>';
      case 'select':
        return '<select ' + common + '>' + (f.options || []).map(function (o) {
          return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
        }).join('') + '</select>';
      case 'color':
        return '<input type="color" ' + common + ' value="' + esc(v || '#ffffff') + '">';
      case 'num':
      case 'int':
        return '<input type="number" class="input-mono" ' + common + ' value="' + esc(v) + '"' +
          (f.step ? ' step="' + f.step + '"' : '') + (f.min !== undefined ? ' min="' + f.min + '"' : '') +
          (f.max !== undefined ? ' max="' + f.max + '"' : '') + '>';
      case 'raw':
        return '<div class="raw-json"><textarea rows="7" ' + common + ' spellcheck="false">' + esc(v) + '</textarea>' +
          '<span class="rj-status" data-rj="' + esc(f.key) + '"></span></div>';
      default:
        return '<input type="text" ' + common + ' value="' + esc(v) + '" placeholder="' + esc(f.placeholder || '') + '">';
    }
  }

  /** Render the fields of one component and bind them to `target`. */
  function renderFields(spec, target, container) {
    var html = '<div class="form-grid">';
    (spec.fields || []).forEach(function (f) {
      if (f.key === '_raw') {
        html += '<div class="field span2"><label>' + esc(f.label) + '</label>' + fieldInput(f, target[f.key] || f.def) + '</div>';
      } else {
        html += fieldWrap(f, fieldInput(f, target[f.key]), !!f.span);
      }
    });
    html += '</div>';
    container.insertAdjacentHTML('beforeend', html);
    bindFields(container, target);
  }

  function bindFields(container, target) {
    qsa('[data-f]', container).forEach(function (n) {
      var key = n.getAttribute('data-f');
      var type = n.getAttribute('data-ft');
      var ev = (type === 'bool' || n.tagName === 'SELECT') ? 'change' : 'input';
      n.addEventListener(ev, function () {
        target[key] = type === 'bool' ? n.checked : n.value;
        if (type === 'raw') {
          var badge = qs('[data-rj="' + key + '"]', container);
          if (badge) {
            var ok = parseJsonSafe(n.value).ok;
            badge.textContent = ok ? 'valid JSON' : 'invalid JSON';
            badge.className = 'rj-status ' + (ok ? 'ok' : 'bad');
          }
        }
        scheduleChange();
        var entry = currentEntry();
        if (entry) {
          el('ed-title').textContent = entry.name || el('ed-title').textContent;
          updatePreview(entry, route.kind);
        }
      });
    });
  }

  /* ----------------------------- identity ----------------------------- */

  function renderIdentityTab(body, entry, kind) {
    var fields = [];
    fields.push(F('name', 'Display name', 'text', entry.name, 'Used for the .lang entry and file names.'));
    fields.push(F('identifier', 'Identifier', 'text', entry.identifier,
      'Leave empty to auto-generate ' + namespace() + ':' + slug(entry.name)));

    if (kind === 'entity') {
      fields.push(F('runtimeIdentifier', 'Runtime identifier', 'select', entry.runtimeIdentifier,
        'Inherits behaviour from a vanilla entity (optional).', {
        options: VANILLA_MOBS.map(function (v) { return [v, v === '' ? '— none —' : v]; })
      }));
      fields.push(F('isSpawnable', 'Spawnable', 'bool', entry.isSpawnable, '', { boolLabel: 'Appears in the spawn egg inventory' }));
      fields.push(F('isSummonable', 'Summonable', 'bool', entry.isSummonable, '', { boolLabel: 'Can be used with /summon' }));
      fields.push(F('isExperimental', 'Experimental', 'bool', entry.isExperimental, '', { boolLabel: 'Requires experimental toggles' }));
      fields.push(F('spawnEgg', 'Spawn egg', 'bool', entry.spawnEgg, '', { boolLabel: 'Generate a spawn egg' }));
      fields.push(F('baseColor', 'Egg base colour', 'color', entry.baseColor));
      fields.push(F('overlayColor', 'Egg overlay colour', 'color', entry.overlayColor));
    } else if (kind === 'item') {
      fields.push(F('category', 'Creative category', 'select', entry.category, '', {
        options: ITEM_CATEGORIES.map(function (c) { return [c, c]; })
      }));
      fields.push(F('group', 'Creative group', 'select', entry.group, '', {
        options: ITEM_GROUPS.map(function (g) { return [g, g === '' ? '— none —' : g]; })
      }));
      fields.push(F('hiddenInCommands', 'Hidden in commands', 'bool', entry.hiddenInCommands, '', { boolLabel: 'is_hidden_in_commands' }));
    } else if (kind === 'block') {
      fields.push(F('category', 'Creative category', 'select', entry.category, '', {
        options: BLOCK_CATEGORIES.map(function (c) { return [c, c]; })
      }));
      fields.push(F('render', 'Render as', 'select', entry.render, '', {
        options: [['cube', 'Full cube (6 faces)'], ['all', 'Same texture on every face'], ['geometry', 'Custom geometry']]
      }));
      fields.push(F('renderMethod', 'Render method', 'select', entry.renderMethod || 'opaque', '', {
        options: [['opaque', 'opaque'], ['alpha_test', 'alpha_test'], ['alpha_test_single_sided', 'alpha_test_single_sided'],
          ['blend', 'blend'], ['double_sided', 'double_sided']]
      }));
    } else if (kind === 'sound') {
      fields.push(F('event', 'Sound event name', 'text', entry.event,
        'Leave empty for ' + namespace() + '.' + slug(entry.name)));
      fields.push(F('category', 'Category', 'select', entry.category, '', {
        options: SOUND_CATEGORIES.map(function (c) { return [c, c]; })
      }));
      fields.push(F('volume', 'Volume', 'num', entry.volume, '0-1 (values above 1 are allowed).', { step: 0.05, min: 0 }));
      fields.push(F('pitch', 'Pitch', 'num', entry.pitch, '1 = normal speed.', { step: 0.05, min: 0.1 }));
      fields.push(F('stream', 'Stream from disk', 'bool', entry.stream, '', { boolLabel: 'For long music tracks' }));
      fields.push(F('loadOnLowMemory', 'Load on low memory', 'bool', entry.loadOnLowMemory));
    }

    var wrap = document.createElement('div');
    wrap.className = 'panel';
    wrap.innerHTML = '<div class="panel-head"><h2>Basics</h2>' +
      '<span class="badge">' + esc(entryId(entry)) + '</span></div><div class="form-grid" id="id-grid"></div>';
    body.appendChild(wrap);
    var grid = qs('#id-grid', wrap);
    fields.forEach(function (f) {
      grid.insertAdjacentHTML('beforeend', fieldWrap(f, fieldInput(f, entry[f.key]), !!f.span));
    });
    bindFields(grid, entry);
    qsa('[data-f="name"]', grid).forEach(function (n) {
      n.addEventListener('input', function () { el('ed-title').textContent = n.value || 'Untitled'; });
    });
  }

  /* ------------------------------ assets ------------------------------ */

  function assetBox(opts) {
    return '<div class="asset' + (opts.has ? ' has' : '') + '" data-asset="' + opts.key + '">' +
      '<div class="a-head"><span class="a-ico">' + icon(opts.icon) + '</span>' + esc(opts.title) + '</div>' +
      '<div class="a-preview">' + (opts.preview || '<span>' + esc(opts.empty || 'No file') + '</span>') + '</div>' +
      '<div class="a-path">' + (opts.path || '—') + '</div>' +
      '<div class="a-actions">' +
        '<button class="btn tiny outline" data-up="' + opts.key + '">Upload</button>' +
        (opts.has ? '<button class="btn tiny ghost" data-rm="' + opts.key + '">Remove</button>' : '') +
      '</div>' +
      (opts.note ? '<div class="a-note">' + opts.note + '</div>' : '') +
      '</div>';
  }

  function wireAssets(container, entry, kind) {
    qsa('[data-up]', container).forEach(function (b) {
      b.addEventListener('click', function () { uploadAsset(b.getAttribute('data-up'), entry, kind); });
    });
    qsa('[data-rm]', container).forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-rm');
        if (entry.assets) delete entry.assets[key];
        if (entry.faces) delete entry.faces[key];
        if (entry.files) entry.files = [];
        if (entry.texture && key === 'texture') entry.texture = null;
        onChange();
        renderEditor();
      });
    });
  }

  function uploadAsset(key, entry, kind) {
    var accept, as;
    if (key === 'texture' || key === 'icon') { accept = 'image/png'; as = 'data'; }
    else if (key === 'audio') { accept = 'audio/ogg,.ogg,.wav,.fsb'; as = 'data'; }
    else { accept = '.json,application/json'; as = 'text'; }
    pickFile(accept, function (result, file) {
      var name = file.name;
      if (kind === 'sound' || key === 'audio') {
        entry.files = entry.files || [];
        entry.files.push({ name: name, data: result, ext: (name.match(/\.[a-z0-9]+$/i) || ['.ogg'])[0].toLowerCase() });
      } else if (key === 'texture') {
        entry.texture = { name: name, data: result };
      } else if (entry.faces && key in entry.faces) {
        entry.faces[key] = { name: name, data: result };
      } else {
        entry.assets = entry.assets || {};
        entry.assets[key] = { name: name, data: result };
      }
      onChange();
      renderEditor();
      toast('ok', 'Uploaded', name);
    }, as);
  }

  function renderAssetsTab(body, entry, kind) {
    var wrap = document.createElement('div');
    wrap.className = 'panel';
    wrap.innerHTML = '<div class="panel-head"><h2>Files</h2><span class="badge">' + esc(KINDS[kind].label) + '</span></div>' +
      '<p class="muted small">Files are copied into the Resource Pack at build time. ' +
      'Bedrock requires lowercase file names inside packs — names are normalised automatically.</p>' +
      '<div class="asset-grid" id="asset-grid"></div>';
    body.appendChild(wrap);
    var grid = qs('#asset-grid', wrap);
    var a = entry.assets || {};

    if (kind === 'entity') {
      var modelNote = a.model && a.model.data
        ? 'geometry: <code>' + esc(geometryId(a.model.data, 'geometry.' + slug(entry.name))) + '</code>'
        : 'A Blockbench model exported as "Bedrock Entity" (.geo.json).';
      grid.insertAdjacentHTML('beforeend', assetBox({
        key: 'model', icon: 'cube', title: 'Model (.geo.json)', has: !!a.model,
        path: a.model ? a.model.name : '—', preview: a.model ? '<span>geometry ready</span>' : '', note: modelNote
      }));
      grid.insertAdjacentHTML('beforeend', assetBox({
        key: 'texture', icon: 'image', title: 'Texture (.png)', has: !!a.texture,
        path: a.texture ? 'textures/entity/' + slug(entry.name) + '.png' : '—',
        preview: a.texture ? '<img src="' + a.texture.data + '" alt="entity texture">' : '',
        note: 'Referenced as <code>texture.default</code> in the render controller.'
      }));
      var animNote = a.animation && a.animation.data
        ? 'Detected: ' + animationKeys(a.animation.data).map(function (k) { return '<code>' + esc(k) + '</code>'; }).join(', ')
        : 'Exported from Blockbench as "Bedrock Animation" (.animation.json).';
      grid.insertAdjacentHTML('beforeend', assetBox({
        key: 'animation', icon: 'play', title: 'Animation (.animation.json)', has: !!a.animation,
        path: a.animation ? 'animations/' + slug(entry.name) + '.animation.json' : '—',
        preview: a.animation ? '<span>' + animationKeys(a.animation.data).length + ' animation(s)</span>' : '', note: animNote
      }));

      var opt = document.createElement('div');
      opt.className = 'panel';
      opt.style.marginTop = '0';
      opt.innerHTML = '<div class="panel-head"><h2>Rendering</h2></div><div class="form-grid" id="opt-grid"></div>';
      wrap.appendChild(opt);
      var og = qs('#opt-grid', opt);
      var opts = [
        F('material', 'Material', 'select', entry.material, 'Usually entity_alphatest for cut-out textures.', {
          options: MATERIALS.map(function (m2) { return [m2, m2]; })
        }),
        F('renderController', 'Render controller', 'select', entry.renderController,
          'Custom generates a render controller file in the resource pack.', {
          options: [['custom', 'Custom (generate one)']].concat(RENDER_CONTROLLERS.map(function (r) { return [r, r]; }))
        })
      ];
      opts.forEach(function (f) { og.insertAdjacentHTML('beforeend', fieldWrap(f, fieldInput(f, entry[f.key]))); });
      bindFields(og, entry);
    } else if (kind === 'item') {
      grid.insertAdjacentHTML('beforeend', assetBox({
        key: 'texture', icon: 'image', title: 'Item icon (.png)', has: !!entry.texture,
        path: entry.texture ? 'textures/items/' + slug(entry.texture.name) + '.png' : '—',
        preview: entry.texture ? '<img src="' + entry.texture.data + '" alt="item icon">' : '',
        note: 'Registered in <code>textures/item_texture.json</code> and used by <code>minecraft:icon</code>.'
      }));
    } else if (kind === 'block') {
      grid.insertAdjacentHTML('beforeend', assetBox({
        key: 'texture', icon: 'image', title: 'Base texture (.png)', has: !!entry.texture,
        path: entry.texture ? 'textures/blocks/' + slug(entry.texture.name) + '.png' : '—',
        preview: entry.texture ? '<img src="' + entry.texture.data + '" alt="block texture">' : '',
        note: 'Used for the <code>*</code> material instance (every face).'
      }));
      ['up', 'down', 'north', 'south', 'east', 'west'].forEach(function (face) {
        var f = (entry.faces || {})[face];
        grid.insertAdjacentHTML('beforeend', assetBox({
          key: face, icon: 'image', title: 'Face: ' + face, has: !!f,
          path: f ? 'textures/blocks/' + slug(f.name) + '.png' : '—',
          preview: f ? '<img src="' + f.data + '" alt="' + face + '">' : '',
          note: f ? 'material_instances.' + face : 'Optional override for the ' + face + ' face.'
        }));
      });
    } else if (kind === 'sound') {
      var list = (entry.files || []).map(function (f, i) {
        return '<div class="entry-row"><div class="e-ico">' + icon('sound') + '</div>' +
          '<div class="e-main"><div class="e-name">' + esc(f.name) + '</div>' +
          '<div class="e-id">sounds/' + esc(slugFile(f.name) + f.ext) + '</div></div>' +
          '<div class="e-actions"><button class="btn tiny danger" data-delfile="' + i + '">Remove</button></div></div>';
      }).join('');
      grid.insertAdjacentHTML('beforeend', '<div class="asset" style="grid-column:1/-1">' +
        '<div class="a-head"><span class="a-ico">' + icon('sound') + '</span>Audio files</div>' +
        '<p class="a-note">Minecraft plays <code>.ogg</code> (Vorbis) files. Upload one or more — a random one is chosen each time.</p>' +
        '<div class="a-actions"><button class="btn tiny outline" data-up="audio">Upload .ogg</button></div>' +
        '<div class="entry-list" style="margin-top:10px">' + (list || '<div class="empty"><b>No audio yet</b>Upload at least one .ogg file.</div>') + '</div>' +
        '</div>');
      qsa('[data-delfile]', grid).forEach(function (b) {
        b.addEventListener('click', function () {
          entry.files.splice(Number(b.getAttribute('data-delfile')), 1);
          onChange();
          renderEditor();
        });
      });
    }
    wireAssets(grid, entry, kind);
  }

  /* ---------------------------- components ---------------------------- */

  function renderComponentsTab(body, entry, kind, storeKey) {
    var store = storeKey ? entry[storeKey] : entry.components;
    // the group chips re-render this tab in place, so start from a clean body
    body.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'panel';
    wrap.innerHTML = '<div class="panel-head"><h2>Components</h2>' +
      '<span class="badge">' + Object.keys(store || {}).length + ' enabled</span></div>' +
      '<div class="comp-toolbar">' +
        '<div class="search">' + icon('search') + '<input type="search" id="comp-search" placeholder="Search components…" value="' + esc(editorUi.compSearch) + '"></div>' +
        '<div class="chip-row" id="comp-chips"></div>' +
      '</div>' +
      '<div id="comp-list" class="comp-list"></div>' +
      '<div class="btn-row"><button class="btn ghost" id="add-custom-comp">' + icon('plus') + 'Add custom component (raw JSON)</button></div>';
    body.appendChild(wrap);

    var groups = groupSchema(kind);
    var chips = ['All'].concat(groups.map(function (g) { return g.group; }));
    qs('#comp-chips', wrap).innerHTML = chips.map(function (c) {
      return '<button class="chip' + (editorUi.compGroup === c ? ' active' : '') + '" data-chip="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
    qsa('[data-chip]', wrap).forEach(function (b) {
      b.addEventListener('click', function () { editorUi.compGroup = b.getAttribute('data-chip'); renderComponentsTab(body, entry, kind, storeKey); });
    });

    var list = qs('#comp-list', wrap);
    renderCompList(list, kind, store, entry, storeKey);

    qs('#comp-search', wrap).addEventListener('input', function () {
      editorUi.compSearch = this.value;
      renderCompList(list, kind, store, entry, storeKey);
      this.focus();
    });

    qs('#add-custom-comp', wrap).addEventListener('click', function () {
      promptDialog('Custom component', [
        { key: 'key', label: 'Component id', value: 'minecraft:my_component', span: true, help: 'Any Minecraft component id, e.g. minecraft:interact' },
        { key: 'value', label: 'JSON value', value: '{}', type: 'textarea', span: true, help: 'The complete value of the component.' }
      ], 'Add component').then(function (res) {
        if (!res || !res.key) return;
        var parsed = parseJsonSafe(res.value);
        entry.custom = entry.custom || [];
        entry.custom.push({ key: res.key.trim(), value: parsed.ok ? jsonStr(parsed.value) : res.value });
        onChange();
        renderEditor();
        toast('ok', 'Component added', res.key);
      });
    });
  }

  /** (Re)draw the filtered component list inside the Components tab. */
  function renderCompList(list, kind, store, entry, storeKey) {
    list.innerHTML = '';
    var groups = groupSchema(kind);
    var q = editorUi.compSearch.toLowerCase();
    var shown = 0;
    groups.forEach(function (g) {
      if (editorUi.compGroup !== 'All' && editorUi.compGroup !== g.group) return;
      var items = g.items.filter(function (c) {
        if (!q) return true;
        return (c.id + ' ' + c.label + ' ' + c.desc).toLowerCase().indexOf(q) >= 0;
      });
      if (!items.length) return;
      list.insertAdjacentHTML('beforeend', '<div class="comp-group-title">' + esc(g.group) + '</div>');
      items.forEach(function (spec) { list.appendChild(compNode(spec, store, entry, kind, storeKey)); shown += 1; });
    });
    if (!shown) {
      list.innerHTML = '<div class="empty"><b>No components match</b>Try another search term, or add a custom component below.</div>';
    }
  }

  function compNode(spec, store, entry, kind, storeKey) {
    var on = Object.prototype.hasOwnProperty.call(store || {}, spec.id);
    var node = document.createElement('div');
    node.className = 'comp' + (on ? ' on' : '');
    node.setAttribute('data-comp', spec.id);
    node.innerHTML =
      '<div class="comp-head">' +
        '<div style="min-width:0"><div class="c-name">' + esc(spec.id) + '</div>' +
        '<div class="c-desc">' + esc(spec.desc) + '</div></div>' +
        (spec.since ? '<span class="comp-ver" title="Needs format_version ' + esc(spec.since) + ' or later">' + esc(spec.since) + '+</span>' : '') +
        '<label class="switch"><input type="checkbox" data-toggle="' + esc(spec.id) + '"' + (on ? ' checked' : '') + '><span class="track"></span></label>' +
      '</div>' +
      '<div class="comp-body"></div>';
    var bodyEl = qs('.comp-body', node);
    if (on) renderFields(spec, store[spec.id], bodyEl);

    qs('[data-toggle]', node).addEventListener('change', function (e) {
      var checked = e.target.checked;
      if (checked) {
        store[spec.id] = defaultComponentValues(spec);
      } else {
        delete store[spec.id];
      }
      node.classList.toggle('on', checked);
      bodyEl.innerHTML = '';
      if (checked) renderFields(spec, store[spec.id], bodyEl);
      onChange();
      refreshEditorChrome(entry, kind);
    });
    return node;
  }

  /* ------------------------------ groups ------------------------------ */

  function renderGroupsTab(body, entry, kind) {
    var wrap = document.createElement('div');
    wrap.className = 'panel';
    var names = Object.keys(entry.groups || {});
    wrap.innerHTML = '<div class="panel-head"><h2>Variants</h2>' +
      '<span class="badge">' + names.length + ' groups</span></div>' +
      '<p class="muted small">Groups hold components that can be added and removed at runtime by events. ' +
      'Reference them from the <b>Events</b> tab, e.g. <code>minecraft:entity_spawned</code>.</p>' +
      '<div id="group-list" class="comp-list"></div>' +
      '<div class="btn-row"><button class="btn outline" id="add-group">' + icon('plus') + 'Add component group</button></div>';
    body.appendChild(wrap);
    var list = qs('#group-list', wrap);

    if (!names.length) {
      list.innerHTML = '<div class="empty"><b>No groups yet</b>Groups are optional — most simple addons only need the top level components.</div>';
    }
    names.forEach(function (gname) {
      var box = document.createElement('div');
      box.className = 'panel';
      box.style.marginTop = '0';
      box.innerHTML = '<div class="panel-head"><h3 style="font-family:var(--mono)">' + esc(gname) + '</h3>' +
        '<span class="badge">' + Object.keys(entry.groups[gname]).length + ' components</span>' +
        '<button class="btn tiny ghost" data-ren="' + esc(gname) + '">Rename</button>' +
        '<button class="btn tiny danger" data-del="' + esc(gname) + '">Delete</button></div>' +
        '<div class="comp-list" id="gl-' + esc(gname) + '"></div>';
      list.appendChild(box);
      var inner = qs('#gl-' + gname, box);
      var groups = groupSchema(kind);
      groups.forEach(function (g) {
        g.items.forEach(function (spec) {
          if (Object.prototype.hasOwnProperty.call(entry.groups[gname], spec.id)) {
            inner.appendChild(compNode(spec, entry.groups[gname], entry, kind, 'groups'));
          }
        });
      });
      // quick add for this group
      var add = document.createElement('div');
      add.className = 'btn-row';
      add.innerHTML = '<button class="btn tiny ghost" data-addto="' + esc(gname) + '">' + icon('plus') + 'Add component</button>';
      inner.appendChild(add);
      qs('[data-addto]', inner).addEventListener('click', function () {
        promptDialog('Add component to ' + gname, [
          { key: 'id', label: 'Component', type: 'select', span: true,
            options: schemaFor(kind).map(function (c) { return [c.id, c.id + ' — ' + c.label]; }) }
        ], 'Add').then(function (res) {
          if (!res) return;
          var spec = schemaById(kind)[res.id];
          if (spec) entry.groups[gname][res.id] = defaultComponentValues(spec);
          onChange();
          renderEditor();
        });
      });
      qs('[data-del]', box).addEventListener('click', function () {
        delete entry.groups[gname];
        Object.keys(entry.events || {}).forEach(function (ev) {
          var e2 = entry.events[ev];
          e2.add = (e2.add || []).filter(function (g2) { return g2 !== gname; });
          e2.remove = (e2.remove || []).filter(function (g2) { return g2 !== gname; });
        });
        onChange();
        renderEditor();
      });
      qs('[data-ren]', box).addEventListener('click', function () {
        promptDialog('Rename group', [{ key: 'name', label: 'Group name', value: gname }], 'Rename').then(function (res) {
          if (!res || !res.name) return;
          var nn = slug(res.name, '_');
          if (nn === gname) return;
          entry.groups[nn] = entry.groups[gname];
          delete entry.groups[gname];
          Object.keys(entry.events || {}).forEach(function (ev) {
            var e2 = entry.events[ev];
            e2.add = (e2.add || []).map(function (g2) { return g2 === gname ? nn : g2; });
            e2.remove = (e2.remove || []).map(function (g2) { return g2 === gname ? nn : g2; });
          });
          onChange();
          renderEditor();
        });
      });
    });

    qs('#add-group', wrap).addEventListener('click', function () {
      promptDialog('New component group', [
        { key: 'name', label: 'Group name', value: 'my_group', help: 'Lowercase, no spaces.' }
      ], 'Create').then(function (res) {
        if (!res || !res.name) return;
        var nn = slug(res.name, '_');
        if (!nn || entry.groups[nn]) { toast('err', 'Invalid name', 'Use a unique lowercase name.'); return; }
        entry.groups[nn] = {};
        onChange();
        renderEditor();
      });
    });
  }

  /* ------------------------------ events ------------------------------ */

  var COMMON_EVENTS = [
    'minecraft:entity_spawned', 'minecraft:entity_born', 'minecraft:entity_transformed',
    'minecraft:on_prime', 'minecraft:ageable_grow_up', 'minecraft:become_pregnant',
    'minecraft:on_tame', 'minecraft:on_leash', 'minecraft:on_unleash', 'minecraft:on_ignite',
    'minecraft:on_death', 'minecraft:on_hurt_event', 'my_pack:custom_event'
  ];

  function renderEventsTab(body, entry, kind) {
    var wrap = document.createElement('div');
    wrap.className = 'panel';
    var names = Object.keys(entry.events || {});
    wrap.innerHTML = '<div class="panel-head"><h2>Reactions</h2><span class="badge">' + names.length + ' reaction' + (names.length === 1 ? '' : 's') + '</span></div>' +
      '<p class="muted small">Events add or remove component groups. Vanilla events such as ' +
      '<code>minecraft:entity_spawned</code> can be overridden to customise your mob.</p>' +
      '<div id="event-list" class="comp-list"></div>' +
      '<div class="btn-row"><button class="btn outline" id="add-event">' + icon('plus') + 'Add event</button></div>';
    body.appendChild(wrap);
    var list = qs('#event-list', wrap);
    var groupNames = Object.keys(entry.groups || {});

    if (!names.length) {
      list.innerHTML = '<div class="empty"><b>No events yet</b>Events are only useful once you have created component groups.</div>';
    }
    names.forEach(function (ename) {
      var ev = entry.events[ename];
      var box = document.createElement('div');
      box.className = 'panel';
      box.style.marginTop = '0';
      var checkboxes = function (selected, field) {
        if (!groupNames.length) return '<div class="help">Create a component group first.</div>';
        return groupNames.map(function (g) {
          return '<label class="check"><input type="checkbox" data-ev="' + esc(ename) + '" data-field="' + field + '" value="' + esc(g) + '"' +
            ((selected || []).indexOf(g) >= 0 ? ' checked' : '') + '>' + esc(g) + '</label>';
        }).join('');
      };
      box.innerHTML = '<div class="panel-head"><h3 style="font-family:var(--mono)">' + esc(ename) + '</h3>' +
        '<button class="btn tiny danger" data-evm-del="' + esc(ename) + '">Delete</button></div>' +
        '<div class="form-grid">' +
          '<div class="field span2"><label>Add component groups</label><div class="chip-row">' + checkboxes(ev.add, 'add') + '</div></div>' +
          '<div class="field span2"><label>Remove component groups</label><div class="chip-row">' + checkboxes(ev.remove, 'remove') + '</div></div>' +
        '</div>';
      list.appendChild(box);
      qs('[data-evm-del]', box).addEventListener('click', function () {
        delete entry.events[ename];
        onChange();
        renderEditor();
      });
      qsa('[data-ev]', box).forEach(function (cb) {
        cb.addEventListener('change', function () {
          var name = cb.getAttribute('data-ev');
          var field = cb.getAttribute('data-field');
          entry.events[name][field] = qsa('[data-ev="' + name + '"][data-field="' + field + '"]', box)
            .filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
          onChange();
        });
      });
    });

    qs('#add-event', wrap).addEventListener('click', function () {
      promptDialog('New event', [
        { key: 'name', label: 'Event name', type: 'select', span: true,
          options: COMMON_EVENTS.map(function (e) { return [e, e]; }) }
      ], 'Create').then(function (res) {
        if (!res || !res.name) return;
        if (entry.events[res.name]) { toast('warn', 'Already exists'); return; }
        entry.events[res.name] = { add: [], remove: [] };
        onChange();
        renderEditor();
      });
    });
  }

  /* ---------------------------- spawn rules ---------------------------- */

  function renderSpawnTab(body, entry, kind) {
    var sr = entry.spawnRules;
    var wrap = document.createElement('div');
    wrap.className = 'panel';
    wrap.innerHTML = '<div class="panel-head"><h2>Natural spawning</h2>' +
      '<span class="badge">' + (sr.enabled ? 'spawn_rules generated' : 'disabled') + '</span></div>' +
      '<p class="muted small">Writes <code>spawn_rules/' + esc(slug(entry.name)) + '.json</code> so the mob appears naturally in the world. ' +
      'The spawn egg works either way.</p>' +
      '<div class="form-grid" id="spawn-grid"></div>';
    body.appendChild(wrap);
    var grid = qs('#spawn-grid', wrap);
    var fields = [
      F('enabled', 'Natural spawning', 'bool', sr.enabled, '', { boolLabel: 'Generate spawn rules' }),
      F('populationControl', 'Population control', 'select', sr.populationControl, '', {
        options: POPULATION_CONTROLS.map(function (p) { return [p, p]; })
      }),
      F('biomes', 'Biomes / biome tags', 'text', sr.biomes, 'Comma separated, e.g. "plains, forest, monster".'),
      F('brightnessMin', 'Brightness min', 'int', sr.brightnessMin, '0-15'),
      F('brightnessMax', 'Brightness max', 'int', sr.brightnessMax, '0-15'),
      F('difficulty', 'Difficulty', 'select', sr.difficulty, '', {
        options: [['peaceful', 'peaceful'], ['easy', 'easy'], ['normal', 'normal'], ['hard', 'hard']]
      }),
      F('heightMin', 'Height min', 'int', sr.heightMin, 'Y level.'),
      F('heightMax', 'Height max', 'int', sr.heightMax, 'Y level.'),
      F('spawnDelay', 'Spawn delay', 'int', sr.spawnDelay, 'Ticks between spawn attempts.')
    ];
    fields.forEach(function (f) { grid.insertAdjacentHTML('beforeend', fieldWrap(f, fieldInput(f, sr[f.key]))); });
    bindFields(grid, sr);
  }

  /* ---------------------------- custom JSON ---------------------------- */

  function renderCustomTab(body, entry, kind) {
    var wrap = document.createElement('div');
    wrap.className = 'panel';
    wrap.innerHTML = '<div class="panel-head"><h2>Raw JSON components</h2>' +
      '<span class="badge">' + (entry.custom || []).length + '</span></div>' +
      '<p class="muted small">Anything the form builder does not cover: paste a component id and its raw JSON value. ' +
      'It is merged into the generated file exactly as written.</p>' +
      '<div id="custom-list" class="comp-list"></div>' +
      '<div class="btn-row"><button class="btn outline" id="add-custom">' + icon('plus') + 'Add custom component</button></div>';
    body.appendChild(wrap);
    var list = qs('#custom-list', wrap);

    if (!(entry.custom || []).length) {
      list.innerHTML = '<div class="empty"><b>No custom components</b>The toggle list above covers the common components.</div>';
    }
    (entry.custom || []).forEach(function (c, i) {
      var node = document.createElement('div');
      node.className = 'comp on';
      node.innerHTML = '<div class="comp-head"><div style="min-width:0"><div class="c-name">' + esc(c.key) + '</div>' +
        '<div class="c-desc">raw JSON value</div></div>' +
        '<button class="btn tiny danger" data-cdel="' + i + '">Remove</button></div>' +
        '<div class="comp-body"><div class="form-grid"><div class="field span2">' +
        '<textarea rows="6" data-cval="' + i + '" spellcheck="false">' + esc(c.value) + '</textarea></div></div></div>';
      list.appendChild(node);
      qs('[data-cdel]', node).addEventListener('click', function () {
        entry.custom.splice(i, 1);
        onChange();
        renderEditor();
      });
      qs('[data-cval]', node).addEventListener('input', function () {
        entry.custom[i].value = this.value;
        scheduleChange();
        var e2 = currentEntry();
        if (e2) updatePreview(e2, route.kind);
      });
    });

    qs('#add-custom', wrap).addEventListener('click', function () {
      promptDialog('Custom component', [
        { key: 'key', label: 'Component id', value: 'minecraft:my_component', span: true },
        { key: 'value', label: 'JSON value', value: '{}', type: 'textarea', span: true }
      ], 'Add').then(function (res) {
        if (!res || !res.key) return;
        var parsed = parseJsonSafe(res.value);
        entry.custom.push({ key: res.key.trim(), value: parsed.ok ? jsonStr(parsed.value) : res.value });
        onChange();
        renderEditor();
      });
    });
  }

  /* ----------------------------- entry list ----------------------------- */

  function renderEntryList(kind) {
    var list = getList(kind);
    el('ed-title').textContent = KINDS[kind].plural;
    el('ed-sub').textContent = list.length + ' defined in this pack';
    el('ed-tabs').innerHTML = '';
    var body = el('ed-body');
    body.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'panel';
    wrap.innerHTML = '<div class="panel-head"><h2>' + esc(KINDS[kind].plural) + '</h2>' +
      '<button class="btn primary tiny" id="list-add">' + icon('plus') + 'New ' + esc(KINDS[kind].label.toLowerCase()) + '</button></div>' +
      '<div class="entry-list" id="entries"></div>';
    body.appendChild(wrap);
    var box = qs('#entries', wrap);
    if (!list.length) {
      box.innerHTML = '<div class="empty"><b>Nothing here yet</b>Create your first ' + esc(KINDS[kind].label.toLowerCase()) +
        ' — it will appear in this list and in the exported pack.</div>';
    }
    list.forEach(function (e) {
      var row = document.createElement('div');
      row.className = 'entry-row';
      var meta = kind === 'sound'
        ? ((e.files || []).length + ' file(s) · ' + (e.category || 'neutral'))
        : (Object.keys(e.components || {}).length + ' components');
      row.innerHTML = '<div class="e-ico">' + icon(KINDS[kind].icon) + '</div>' +
        '<div class="e-main"><div class="e-name">' + esc(e.name) + '</div>' +
        '<div class="e-id">' + esc(entryId(e)) + ' · ' + esc(meta) + '</div></div>' +
        '<div class="e-actions">' +
          '<button class="btn tiny outline" data-dup>Duplicate</button>' +
          '<button class="btn tiny primary" data-open>Edit</button>' +
          '<button class="btn tiny danger" data-del>Delete</button>' +
        '</div>';
      qs('[data-open]', row).addEventListener('click', function () { navigate('editor', { kind: kind, uid: e.uid, tab: 'identity' }); });
      qs('[data-dup]', row).addEventListener('click', function () {
        var copy = clone(e);
        copy.uid = uid(kind.slice(0, 3));
        copy.name = e.name + ' copy';
        copy.identifier = '';
        getList(kind).push(copy);
        onChange();
        renderEntryList(kind);
      });
      qs('[data-del]', row).addEventListener('click', function () {
        confirmDialog('Delete ' + KINDS[kind].label.toLowerCase(), 'Delete "' + e.name + '"? This cannot be undone.', 'Delete').then(function (ok) {
          if (!ok) return;
          var arr = getList(kind);
          arr.splice(arr.indexOf(e), 1);
          onChange();
          renderEntryList(kind);
        });
      });
      box.appendChild(row);
    });
    qs('#list-add', wrap).addEventListener('click', function () { createEntry(kind); });
    el('preview-toggle').innerHTML = '';
    el('ed-preview').innerHTML = '<span class="muted">Select an entry to see its JSON.</span>';
  }

  /* =================================================================
     10. BOOT
     ================================================================= */

  function mount() {
    if (typeof JSZip === 'undefined') {
      var warn = document.createElement('div');
      warn.className = 'cdn-warn';
      warn.innerHTML = icon('alert') + '<div><b>JSZip did not load.</b> The JSON generators still work, but ' +
        'downloading a .mcaddon needs JSZip. Reload the page, or serve the folder locally so ' +
        '<code>vendor/jszip.min.js</code> can be used as a fallback.</div>';
      qs('#view-home').insertBefore(warn, qs('#view-home').firstChild);
    }

    var had = restore();

    el('btn-create-new').addEventListener('click', openCreateModal);
    el('btn-import-home').addEventListener('click', function () { importAddon(); });
    el('btn-import').addEventListener('click', function () { importAddon(); });
    el('btn-build').addEventListener('click', function () { doBuild(); });
    el('btn-close-addon').addEventListener('click', function () {
      closeAddon();
      navigate('home');
    });
    el('btn-add-new').addEventListener('click', function () { openAddPicker(); });
    el('btn-delete-addon').addEventListener('click', function () { deleteCurrentAddon(); });
    el('btn-ed-back').addEventListener('click', function () { navigate('dashboard'); });
    el('btn-ed-duplicate').addEventListener('click', function () {
      var e = currentEntry();
      if (!e) return;
      var copy = clone(e);
      copy.uid = uid(route.kind.slice(0, 3));
      copy.name = e.name + ' copy';
      copy.identifier = '';
      getList(route.kind).push(copy);
      onChange();
      navigate('editor', { kind: route.kind, uid: copy.uid, tab: route.tab });
      toast('ok', 'Duplicated', copy.name);
    });
    el('btn-ed-delete').addEventListener('click', function () {
      var e = currentEntry();
      if (!e) return;
      confirmDialog('Delete ' + KINDS[route.kind].label.toLowerCase(), 'Delete "' + e.name + '"?', 'Delete').then(function (ok) {
        if (!ok) return;
        var arr = getList(route.kind);
        arr.splice(arr.indexOf(e), 1);
        onChange();
        navigate('editor', { kind: route.kind, uid: null });
      });
    });
    el('btn-menu').addEventListener('click', function () { el('sidebar').classList.toggle('open'); });
    el('hidden-file').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f || !pendingFileCb) return;
      var cb = pendingFileCb;
      pendingFileCb = null;
      var isJson = /\.json$/i.test(f.name) || (f.type && f.type.indexOf('json') >= 0);
      readFileAs(f, isJson ? 'text' : 'data').then(function (res) { cb(res, f); })
        .catch(function (err) { toast('err', 'Upload failed', err.message); });
    });
    qsa('.brand').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); navigate('home'); }); });
    wireDashboard();

    if (had) navigate('dashboard');
    else navigate('home');
  }

  /* --------------------------- .mcaddon import --------------------------- */

  function importAddon() {
    if (typeof JSZip === 'undefined') { toast('err', 'JSZip missing', 'Importing needs JSZip.'); return; }
    pickFile('.mcaddon,.mcpack,.zip,application/zip', function (result, file) {
      if (!result || (typeof result !== 'string' && !(result instanceof ArrayBuffer))) {
        toast('err', 'Import failed', 'Expected a zip file.');
        return;
      }
      var zip;
      try { zip = new JSZip(); }
      catch (e) { toast('err', 'Import failed', e.message); return; }
      zip.loadAsync(result, { createFolders: true }).then(function (z) {
        return readPackZip(z, file.name);
      }).then(function (info) {
        if (!info) { toast('err', 'Nothing imported', 'No manifest.json found in that archive.'); return; }
        onChange();
        navigate('dashboard');
        toast('ok', 'Imported ' + file.name, info);
      }).catch(function (err) {
        toast('err', 'Import failed', err && err.message ? err.message : String(err));
      });
    }, 'buffer');
  }

  function readPackZip(zip, filename) {
    var names = Object.keys(zip.files);
    var manifests = names.filter(function (n) { return /(^|\/)manifest\.json$/.test(n); });
    if (!manifests.length) return Promise.resolve(null);

    var bpRoot = null;
    var rpRoot = null;
    var summary = { entities: 0, items: 0, blocks: 0, sounds: 0 };
    ensureAddonSlot();

    function readText(path) {
      var f = zip.file(path);
      return f ? f.async('string') : Promise.resolve(null);
    }

    var chain = Promise.resolve();
    manifests.forEach(function (m) { chain = chain.then(function () { return zip.file(m).async('string'); }).then(function (txt) {
      var parsed = parseJsonSafe(txt);
      if (!parsed.ok) return;
      var mods = parsed.value.modules || [];
      var isData = mods.some(function (m2) { return m2.type === 'data'; });
      var isRes = mods.some(function (m2) { return m2.type === 'resources'; });
      var dir = m.replace(/manifest\.json$/, '');
      if (isData) bpRoot = dir; else if (isRes) rpRoot = dir;
      if (!state.meta || (filename && !state.meta.imported)) {
        var h = parsed.value.header || {};
        state.meta = defaultMeta();
        state.meta.name = h.name || 'Imported addon';
        state.meta.description = h.description || '';
        state.meta.author = (parsed.value.metadata && parsed.value.metadata.authors && parsed.value.metadata.authors[0]) || 'Unknown';
        state.meta.version = h.version || [1, 0, 0];
        state.meta.minEngineVersion = h.min_engine_version || [1, 21, 10];
        state.meta.imported = true;
        if (isData) { state.meta.bpUuid = h.uuid; }
        if (isRes) { state.meta.rpUuid = h.uuid; }
      }
    }); });

    return chain.then(function () {
      if (!bpRoot && !rpRoot) return null;
      var jobs = [];

      // Behavior pack: entities
      names.filter(function (n) { return bpRoot && n.indexOf(bpRoot + 'entities/') === 0 && /\.json$/.test(n); })
        .forEach(function (n) {
          jobs.push(readText(n).then(function (txt) {
            if (!txt) return;
            var parsed = parseJsonSafe(txt);
            if (!parsed.ok || !parsed.value['minecraft:entity']) return;
            var src = parsed.value['minecraft:entity'];
            var d = src.description || {};
            var e = newEntity();
            e.name = (d.identifier || 'imported').split(':').pop().replace(/_/g, ' ');
            e.identifier = d.identifier || '';
            e.runtimeIdentifier = d.runtime_identifier || '';
            e.isSpawnable = d.is_spawnable !== false;
            e.isSummonable = d.is_summonable !== false;
            e.isExperimental = !!d.is_experimental;
            e.spawnEgg = !!d.spawn_egg;
            e.components = src.components || {};
            e.groups = src.component_groups || {};
            e.events = src.events || {};
            e.custom = [];
            state.entities.push(e);
            summary.entities += 1;
          }));
        });

      // Behavior pack: items
      names.filter(function (n) { return bpRoot && n.indexOf(bpRoot + 'items/') === 0 && /\.json$/.test(n); })
        .forEach(function (n) {
          jobs.push(readText(n).then(function (txt) {
            if (!txt) return;
            var parsed = parseJsonSafe(txt);
            if (!parsed.ok || !parsed.value['minecraft:item']) return;
            var src = parsed.value['minecraft:item'];
            var d = src.description || {};
            var it = newItem();
            it.name = (d.identifier || 'imported').split(':').pop().replace(/_/g, ' ');
            it.identifier = d.identifier || '';
            it.category = (d.menu_category && d.menu_category.category) || 'items';
            it.group = (d.menu_category && d.menu_category.group) || '';
            it.components = src.components || {};
            state.items.push(it);
            summary.items += 1;
          }));
        });

      // Behavior pack: blocks
      names.filter(function (n) { return bpRoot && n.indexOf(bpRoot + 'blocks/') === 0 && /\.json$/.test(n); })
        .forEach(function (n) {
          jobs.push(readText(n).then(function (txt) {
            if (!txt) return;
            var parsed = parseJsonSafe(txt);
            if (!parsed.ok || !parsed.value['minecraft:block']) return;
            var src = parsed.value['minecraft:block'];
            var d = src.description || {};
            var b = newBlock();
            b.name = (d.identifier || 'imported').split(':').pop().replace(/_/g, ' ');
            b.identifier = d.identifier || '';
            b.category = (d.menu_category && d.menu_category.category) || 'construction';
            b.components = src.components || {};
            state.blocks.push(b);
            summary.blocks += 1;
          }));
        });

      // Resource pack: sounds
      names.filter(function (n) { return rpRoot && /(^|\/)sounds\.json$/.test(n); }).forEach(function (n) {
        jobs.push(readText(n).then(function (txt) {
          if (!txt) return;
          var parsed = parseJsonSafe(txt);
          if (!parsed.ok) return;
          var defs = parsed.value.sound_definitions || parsed.value;
          Object.keys(defs).forEach(function (key) {
            var def = defs[key];
            if (!def || !def.sounds) return;
            var s = newSound();
            s.event = key;
            s.name = key.split('.').pop();
            s.category = def.category || 'neutral';
            s.volume = (def.sounds[0] && def.sounds[0].volume) || 1;
            s.pitch = (def.sounds[0] && def.sounds[0].pitch) || 1;
            state.sounds.push(s);
            summary.sounds += 1;
          });
        }));
      });

      // Resource pack: the .ogg files themselves, so a re-export keeps the audio
      names.filter(function (n) {
        return rpRoot && n.indexOf(rpRoot + 'sounds/') === 0 && !/\.json$/.test(n) && !/\/$/.test(n);
      }).forEach(function (n) {
        jobs.push(zip.file(n).async('base64').then(function (b64) {
          var base = n.slice(n.lastIndexOf('/') + 1);
          var ext = (base.match(/\.[a-z0-9]+$/i) || ['.ogg'])[0].toLowerCase();
          var stem = slug(base.replace(/\.[a-z0-9]+$/i, ''));
          var mime = ext === '.wav' ? 'audio/wav' : ext === '.mp3' ? 'audio/mpeg' : 'audio/ogg';
          state.sounds.forEach(function (s) {
            s.files = s.files || [];
            if (s.files.some(function (f) { return slugFile(f.name) === stem; })) return;
            if (slug(s.name) !== stem && slug((s.event || '').split('.').pop()) !== stem) return;
            s.files.push({ name: base, data: 'data:' + mime + ';base64,' + b64, ext: ext });
          });
        }));
      });

      // Resource pack: entity assets (textures/models/animations)
      names.filter(function (n) { return rpRoot && n.indexOf(rpRoot + 'entity/') === 0 && /\.entity\.json$/.test(n); })
        .forEach(function (n) {
          jobs.push(readText(n).then(function (txt) {
            if (!txt) return;
            var parsed = parseJsonSafe(txt);
            if (!parsed.ok || !parsed.value['minecraft:client_entity']) return;
            var d = parsed.value['minecraft:client_entity'].description || {};
            var match = state.entities.filter(function (e) { return entryId(e) === d.identifier; })[0];
            if (!match) return;
            match.material = (d.materials && d.materials['default']) || match.material;
            match.renderController = (d.render_controllers && d.render_controllers[0]) || match.renderController;
            if (d.spawn_egg) { match.spawnEgg = true; match.baseColor = d.spawn_egg.base_color || match.baseColor; match.overlayColor = d.spawn_egg.overlay_color || match.overlayColor; }
          }));
        });

      return Promise.all(jobs).then(function () {
        var total = summary.entities + summary.items + summary.blocks + summary.sounds;
        if (!total && !state.meta.imported) return null;
        return summary.entities + ' entities, ' + summary.items + ' items, ' + summary.blocks + ' blocks, ' + summary.sounds + ' sounds';
      });
    });
  }

  /* ------------------------------ public API ------------------------------ */

  return {
    state: state,
    route: route,
    FORMAT_VERSIONS: FORMAT_VERSIONS,
    MIN_FORMAT_VERSION: MIN_FORMAT_VERSION,
    KINDS: KINDS,
    schemaFor: schemaFor,
    schemaById: schemaById,
    groupSchema: groupSchema,
    buildComponentValue: buildComponentValue,
    serializeComponents: serializeComponents,
    buildManifest: buildManifest,
    buildEntityBehavior: buildEntityBehavior,
    buildEntityClient: buildEntityClient,
    buildRenderController: buildRenderController,
    buildSpawnRules: buildSpawnRules,
    buildItemBehavior: buildItemBehavior,
    buildItemClient: buildItemClient,
    buildItemTextureJson: buildItemTextureJson,
    buildBlockBehavior: buildBlockBehavior,
    buildSoundDefinitions: buildSoundDefinitions,
    buildLang: buildLang,
    buildFileTree: buildFileTree,
    buildZip: buildZip,
    validate: validate,
    entryId: entryId,
    slug: slug,
    slugFile: slugFile,
    cmpVer: cmpVer,
    mount: mount,
    render: render,
    navigate: navigate,
    resetProject: resetProject,
    defaultMeta: defaultMeta,
    newEntity: newEntity,
    newItem: newItem,
    newBlock: newBlock,
    newSound: newSound,
    importAddon: importAddon,
    readPackZip: readPackZip,
    exportMcaddon: exportMcaddon,
    exportMcpack: exportMcpack,
    doBuild: doBuild
  };
});
