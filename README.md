# Bedrock Utility

A no-code **Minecraft Bedrock Edition (MCPE 1.21.10+) addon creation hub** that runs
entirely in the browser. Fill in forms, toggle Minecraft components, and export a real
Behavior Pack + Resource Pack as a single `.mcaddon`.

The interface is deliberately modelled on **Minecraft Pocket Edition's "Ore UI"** — the
screens Bedrock players already know: a near-black canvas, dark app bars pinned to the top
and bottom of the screen, rounded panels with a lighter header strip and a faint block
grain, Minecraft green as the single accent, and controls sized for a thumb. Buttons keep
the classic Minecraft bevel. Headings, buttons, tabs and badges are set in a pixel face;
prose and help text stay in a clean sans so they are easy to read. The app logo is the
toolbox emoji on a green tile.

On a phone the navigation drawer becomes a **bottom tab bar**, the way Minecraft's own
screens do it — there is no hamburger menu to hunt for, and the toolbox in the top bar
always takes you back to your list of addons.

```
index.html      SPA shell (Addon library → Addon dashboard → Component editor)
style.css       Ore UI design system (Grid + Flexbox, no frameworks)
script.js       addon library, component schemas, JSON generators, JSZip export, UI
vendor/         local fallback copy of JSZip (the page loads it from a CDN first)
test/           Node test suites for the generators and the UI pipeline
docs/           generated component reference + GitHub Pages hosting notes
```

## How it flows

1. **Your addons** — the homepage lists every addon saved in this browser, each with an
   **Edit** and a **Delete** button, plus **Create new addon** to start another one.
2. **Addon dashboard** — press **Edit** (or finish the wizard) to land here. It shows the
   pack details, what is inside it, and three actions: **Add new**, **Delete**, and
   **Build Addon**.
3. **Add new** asks what you want to create — entity, item, block or sound — and opens
   that editor.

Everything is stored in `localStorage` under one key, so several addons can live side by
side and nothing is ever uploaded.

## Quick start

Any static file server works — there is no build step and no dependencies:

```bash
# option 1: python
python3 -m http.server 8080

# option 2: node
npx serve .
```

Then open <http://localhost:8080>. Opening `index.html` straight from disk also works
in most browsers, but a local server is recommended (some browsers block
`localStorage` and Blob downloads on `file://` URLs).

### Host it on GitHub Pages

The app is plain HTML/CSS/JS, so Pages can serve it with no build step. Two options,
both documented in [docs/HOSTING.md](docs/HOSTING.md):

**Option A — GitHub Actions.** Add the workflow from `docs/HOSTING.md` as
`.github/workflows/deploy-pages.yml`, then set **Settings → Pages → Source** to
**GitHub Actions**. It publishes only `index.html`, `style.css`, `script.js` and
`vendor/`, so the live site is exactly the HTML/CSS/JS the app loads.

**Option B — deploy from a branch.** Set **Settings → Pages → Source** to *Deploy from
a branch*, pick `main` and `/ (root)`. No workflow needed; a few extra files
(`test/`, `docs/`) are published alongside the app.

Everything that makes this Pages-safe: all asset paths are relative (so it works from
`https://<user>.github.io/<repo>/` and custom domains), routing uses hash fragments
only, JSZip is fetched over HTTPS, and `.nojekyll` stops Jekyll from rewriting files.


## Using it

1. **Homepage** → *Create New Addon*: name, author, description, namespace, version and
   the target `format_version` (anything from `1.21.10` upwards). A `manifest.json`
   is generated immediately with four fresh UUIDs.
2. **Dashboard** → four cards: **Entities**, **Items**, **Blocks**, **Sounds**. Each card
   shows how many are defined and links to the editor. The dashboard also shows a live
   validation panel and the full generated file tree.
3. **Component Editor** → per entry: identity, assets, the component toggle list,
   component groups, events, spawning and a live JSON preview (Behavior / Resource side).
4. **Build Addon** → validation runs first, then you can download a `.mcaddon`
   (both packs), a single `.mcpack`, or just the JSON.

### Entities

Upload a Blockbench model (`.geo.json`), a texture (`.png`) and animations
(`.animation.json`). The editor reads the geometry identifier and the animation keys out
of the files you upload and wires them into the client entity automatically. More than
45 components are available as toggle switches — health, movement, navigation, physics,
attack, all the `minecraft:behavior.*` goals, families, loot, breeding, taming, and so on.
Anything not covered can be pasted as raw JSON.

### Items and blocks

Items get a creative category/group, an icon that is registered in
`textures/item_texture.json`, and the usual item components. Blocks get a cube or custom
geometry with per-face textures, and `minecraft:material_instances` is generated from the
texture mapping for you.

### Sounds

Register `.ogg` files as sound events with a category, volume and pitch. They are written
to `sounds/sound_definitions.json` (and the legacy `sounds.json`) and are exposed to every
entity through the client entity's `sound_effects` map, so animation sound-effect
timelines can reference them.

## What lands in the zip

```
My Addon BP/
  manifest.json                     format_version 2, header + data module UUIDs
  entities/<name>.se.json           server entity: description, components, groups, events
  items/<name>.json                 item definition
  blocks/<name>.json                block definition + material_instances
  spawn_rules/<name>.json           optional natural spawning
  texts/en_US.lang                  pack.name, entity/item/tile display names
  pack_icon.png                     optional
My Addon RP/
  manifest.json                     resources module + dependency on the BP header UUID
  entity/<name>.entity.json         client entity: materials, textures, geometry, animations
  models/entity/<name>.geo.json     uploaded model
  animations/<name>.animation.json  uploaded animation
  render_controllers/<name>.rc.json generated render controller
  textures/entity/<name>.png        uploaded texture
  items/<name>.json                 client item
  textures/item_texture.json        item atlas
  textures/blocks/<name>.png        block textures
  textures/items/<name>.png         item textures
  sounds/sound_definitions.json     sound events
  sounds/sounds.json                legacy sound registry
  sounds/<name>.ogg                 uploaded audio
  texts/en_US.lang
```

The resource pack declares a dependency on the behavior pack's header UUID, which is what
makes a `.mcaddon` work when both packs are dropped into a world at once.

## Technical notes

* Every generated file is written with `JSON.stringify(…, 2)`, so there are no trailing
  commas or comments anywhere.
* `format_version` for entities, items and blocks follows the project setting and is
  validated to be `1.21.10` or higher. Fixed format versions are used for the
  resource-pack side files (client entity `1.10.0`, render controller `1.10.0`,
  animation `1.8.0`, sound definitions `1.14.0`, spawn rules `1.8.0`).
* Identifiers must match `^[a-z0-9_.-]+:[a-z0-9_.-]+$` and must be unique across the
  whole project; the validator blocks the build on violations.
* File names inside the packs are normalised to lowercase, because Bedrock requires it.
* The project is stored in `localStorage` only. If the 5 MB quota is exceeded the
  binary assets are dropped from the saved copy rather than failing the save.

## Importing

*Import* accepts an existing `.mcaddon`, `.mcpack` or `.zip` and rebuilds the project:
manifests, entities, items, blocks, sound events and their audio files. Uploaded models,
textures and animations are not restored (Bedrock packs can reference them, but the
importer keeps the definitions only).

## Tests

```bash
npm test                 # all three suites
node test/build.test.mjs # generators, validation, manifests, zip round trip, import
node test/ui.smoke.mjs  # drives the real UI inside a minimal DOM
node test/dom-ids.test.mjs # every id referenced by script.js exists in index.html
```

The suites run on plain Node with no dependencies — JSZip is loaded from
`vendor/jszip.min.js`. `test/ui.smoke.mjs` includes `test/minidom.mjs`, a small DOM
implementation used to boot the app headlessly.
