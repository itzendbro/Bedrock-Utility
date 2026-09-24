# Vendored dependency

`jszip.min.js` is [JSZip v3.10.1](https://github.com/Stuk/jszip) by Stuart Knightley,
dual licensed under **MIT or GPL-3.0-or-later** (used here under the MIT terms).
It bundles pako (MIT).

`index.html` loads JSZip from a CDN first (cdnjs, then jsDelivr, then unpkg) and falls
back to this local copy, so the app keeps working with no network access. The file is
byte-identical to `dist/jszip.min.js` from the npm package.
