/* Regenerates docs/COMPONENTS.md from the component schemas in script.js.
   Usage: node test/gen-docs.mjs                                            */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const BU = require(path.join(ROOT, 'script.js'));

const TYPE_LABEL = {
  text: 'text', num: 'number', int: 'integer', bool: 'boolean', select: 'choice',
  list: 'list (comma separated)', color: 'colour', raw: 'raw JSON', vec3: 'vector'
};

function fieldTable(fields) {
  const rows = fields.map((f) => {
    const def = f.def === undefined || f.def === '' || f.def === false ? '—' : String(f.def).replace(/\|/g, '\\|');
    const type = TYPE_LABEL[f.type] || f.type;
    const note = f.help ? ' ' + f.help.replace(/\|/g, '\\|') : '';
    return '| `' + f.key + '` | ' + f.label + ' | ' + type + ' | ' + def + ' |' + note + ' |';
  });
  return ['| Field | Label | Type | Default | Notes |', '| --- | --- | --- | --- | --- |'].concat(rows).join('\n');
}

let out = '';
out += '# Component reference\n\n';
out += 'Generated from the schemas in `script.js` by `node test/gen-docs.mjs` — ';
out += 'do not edit by hand.\n\n';
out += 'Every component below appears as a toggle switch in the editor. Switching it on ';
out += 'reveals the input fields listed here, and the values are written straight into ';
out += 'the generated Bedrock JSON. Components marked with a version badge need at least ';
out += 'that `format_version`.\n';

const titles = { entity: 'Entities', item: 'Items', block: 'Blocks' };
Object.keys(titles).forEach((kind) => {
  const groups = BU.groupSchema(kind);
  out += '\n## ' + titles[kind] + '\n';
  out += '\n' + groups.length + ' groups, ' + BU.schemaFor(kind).length + ' components.\n';
  groups.forEach((g) => {
    out += '\n### ' + g.group + '\n';
    g.items.forEach((c) => {
      out += '\n#### `' + c.id + '`' + (c.since ? ' · requires format_version ' + c.since + '+' : '') + '\n\n';
      out += c.desc + '\n';
      if (c.fields.length) out += '\n' + fieldTable(c.fields) + '\n';
      else out += '\nNo fields — the component is enabled by its presence.\n';
    });
  });
});

out += '\n## Custom components\n\n';
out += 'Any component that is not in the list above can be added as raw JSON from the ';
out += '*Custom JSON* tab (or the *Add custom component* button on the Components tab). ';
out += 'The key and value are merged into the generated file exactly as written, so the ';
out += 'editor never has to know about them.\n';

writeFileSync(path.join(ROOT, 'docs', 'COMPONENTS.md'), out);
const total = Object.keys(titles).reduce((n, k) => n + BU.schemaFor(k).length, 0);
console.log('wrote docs/COMPONENTS.md (' + total + ' components)');
