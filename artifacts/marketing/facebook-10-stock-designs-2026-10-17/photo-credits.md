# Demo photo credits

Photographs used by the demo property (`demo-cottage`) on `/wall/:slug` and
`/stay/:slug`. They dress a **fictional** property, "Seabreeze Cottage" — the
place, the hosts and the guest memories are invented.

All files come from [Unsplash](https://unsplash.com) under the
[Unsplash License](https://unsplash.com/license), which permits commercial use
and does not require attribution. Credits are recorded here anyway so the
provenance of every committed binary is traceable.

Files are committed to `public/wall/` and served from our own origin. Nothing is
hotlinked, so the site still makes no third-party request at runtime — see the
note at the top of `src/styles.css`.

| File | Unsplash photo ID | Source |
| --- | --- | --- |
| `cover.webp` | `photo-1579297206620-c410c4af42e4` | https://unsplash.com/photos/1579297206620-c410c4af42e4 |
| `memory-coast.webp` | `photo-1597053448029-d4b6571d78ae` | https://unsplash.com/photos/1597053448029-d4b6571d78ae |
| `memory-fire.webp` | `photo-1603039531759-1a1bbe4f9f94` | https://unsplash.com/photos/1603039531759-1a1bbe4f9f94 |
| `memory-garden.webp` | `photo-1569787811498-32f428436f46` | https://unsplash.com/photos/1569787811498-32f428436f46 |
| `memory-tide.webp` | `photo-1567928135432-e1de35478dd5` | https://unsplash.com/photos/1567928135432-e1de35478dd5 |
| `memory-evening.webp` | `photo-1429152937938-07b5f2828cdd` | https://unsplash.com/photos/1429152937938-07b5f2828cdd |
| `memory-games.webp` | `photo-1677024486583-5539ae4cfc67` | https://unsplash.com/photos/1677024486583-5539ae4cfc67 |
| `memory-window.webp` | `photo-1508965386566-d0d8cade38c9` | https://unsplash.com/photos/1508965386566-d0d8cade38c9 |
| `memory-table.webp` | `photo-1758810742940-892122ccdcf1` | https://unsplash.com/photos/1758810742940-892122ccdcf1 |

## Processing

Fetched from the Unsplash image CDN already resized and re-encoded, so no local
image tooling is required to reproduce them:

- Cover: `?w=1500&h=660&q=58&fm=webp&fit=crop&crop=entropy`
- Memories: `?w=880&h=660&q=60&fm=webp&fit=crop&crop=entropy`

Total weight of `public/wall/` is roughly 1.3 MB. Memory photos below the first
row are lazily loaded, so a first view of the wall fetches only the cover and
the top of the grid.

## Replacing them

These are demo dressing, not product assets. A real property's cover and guest
photos come from Firestore and Cloud Storage. If the fictional framing ever
becomes a problem, swap the files and update `wallPhotos` and
`demoProperty.cover` in `src/ui/wall/demoWall.ts` — the alt text lives there too
and must be rewritten to match any new image.
