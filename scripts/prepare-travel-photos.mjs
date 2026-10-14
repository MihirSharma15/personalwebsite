import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import exifr from 'exifr';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const input = path.join(root, 'public/travel-photos');
const output = path.join(root, 'public/travel');
const cache = path.join(root, '.cache/travel');
const boundaryURL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson';
const overrides = JSON.parse(await readFile(path.join(root, 'src/data/travel-overrides.json'), 'utf8'));
await Promise.all([mkdir(output, { recursive: true }), mkdir(cache, { recursive: true })]);

// Download the public map once. Photo coordinates are only compared locally.
let boundaries;
try {
  boundaries = JSON.parse(await readFile(path.join(cache, 'countries.json'), 'utf8'));
} catch {
  const response = await fetch(boundaryURL);
  if (!response.ok) throw new Error(`Country map download failed: ${response.status}`);
  boundaries = await response.json();
  await writeFile(path.join(cache, 'countries.json'), JSON.stringify(boundaries));
}

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

const countries = boundaries.features.map(feature => {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  return { name: feature.properties.ADMIN, code: feature.properties.ISO_A2_EH, polygons };
});

function countryAt(longitude, latitude) {
  const match = countries.find(country => country.polygons.some(polygon =>
    inRing(longitude, latitude, polygon[0]) && !polygon.slice(1).some(hole => inRing(longitude, latitude, hole))
  ));
  if (match) return { country: match.name, code: match.code, source: 'gps' };

  // A coarse coastline can put a beach photo slightly out to sea. Accept only
  // points within 1 km of land, with no competing country's coast within 2 km.
  const sx = 111.32 * Math.cos(latitude * Math.PI / 180);
  const distances = countries.map(country => {
    let distance = Infinity;
    for (const polygon of country.polygons) for (const ring of polygon) {
      for (let i = 1; i < ring.length; i++) {
        const a = ring[i - 1], b = ring[i];
        const ax = (a[0] - longitude) * sx, ay = (a[1] - latitude) * 111.32;
        const dx = (b[0] - a[0]) * sx, dy = (b[1] - a[1]) * 111.32;
        const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
        distance = Math.min(distance, Math.hypot(ax + t * dx, ay + t * dy));
      }
    }
    return { country, distance };
  }).sort((a, b) => a.distance - b.distance);
  const nearest = distances[0];
  if (nearest.distance <= 1 && distances[1].distance > 2) {
    return { country: nearest.country.name, code: nearest.country.code, source: 'gps-coastline' };
  }
  return null;
}

const photos = [], seen = new Map(), skipped = [], unresolved = [];
// Prefer the original filename to numbered duplicate copies.
const filenames = (await readdir(input)).sort((a, b) => a.length - b.length || a.localeCompare(b));
for (const filename of filenames) {
  if (filename.startsWith('.')) continue;
  if (!/\.(jpe?g|png|webp|tiff?|heic)$/i.test(filename)) {
    skipped.push({ file: filename, reason: 'Not a supported still photo' });
    continue;
  }
  const bytes = await readFile(path.join(input, filename));
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  if (seen.has(hash)) {
    skipped.push({ file: filename, reason: `Duplicate of ${seen.get(hash)}` });
    continue;
  }
  seen.set(hash, filename);
  const tags = await exifr.parse(bytes) || {};
  const override = overrides[filename];
  const location = override
    ? { country: override.country, code: override.code, source: 'manual' }
    : Number.isFinite(tags.latitude) && Number.isFinite(tags.longitude)
      ? countryAt(tags.longitude, tags.latitude) : null;
  if (!location) unresolved.push(filename);
  const id = filename.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + hash.slice(0, 8);
  const variants = [];
  for (const size of [800, 1600]) {
    // autoOrient honors the phone's rotation; sharp strips EXIF from output.
    const result = await sharp(bytes).autoOrient().resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84 }).toFile(path.join(output, `${id}-${size}.webp`));
    variants.push({ src: `/travel/${id}-${size}.webp`, width: result.width, height: result.height });
  }
  const date = tags.DateTimeOriginal instanceof Date && !Number.isNaN(tags.DateTimeOriginal.valueOf())
    ? tags.DateTimeOriginal.toISOString().slice(0, 10) : null;
  photos.push({ id, filename, ...location, country: location?.country || 'Elsewhere', code: location?.code || 'XX',
    date, width: variants[1].width, height: variants[1].height,
    src: variants[1].src, thumbnail: variants[0].src,
    alt: override?.alt || `Travel photograph in ${location?.country || 'an unassigned location'}` });
}

const groups = [...new Set(photos.map(photo => photo.country))].map(country => {
  const items = photos.filter(photo => photo.country === country).sort((a, b) =>
    (a.date || '9999').localeCompare(b.date || '9999') || a.filename.localeCompare(b.filename));
  return { country, code: items[0].code, photos: items };
}).sort((a, b) => (a.photos.find(p => p.date)?.date || '9999').localeCompare(b.photos.find(p => p.date)?.date || '9999'));

// Deliberately store only country-level location, never raw GPS coordinates.
await writeFile(path.join(root, 'src/data/travel-photos.json'), JSON.stringify({ groups }, null, 2) + '\n');
console.log(groups.map(group => `${group.country}: ${group.photos.length}`).join('\n'));
for (const item of skipped) console.log(`Skipped ${item.file}: ${item.reason}`);
if (unresolved.length) console.warn(`Country needed in src/data/travel-overrides.json: ${unresolved.join(', ')}`);
console.log(`Prepared ${photos.length} unique photographs.`);
