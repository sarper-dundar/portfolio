#!/usr/bin/env bun
// Resize Substance Designer PBR exports from src/assets/materials/ into
// public/materials/ at a web-friendly size and format. Source folder is
// gitignored; only the resized output ships with the site.

import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import sharp from 'sharp';

const SRC = resolve('src/assets/materials');
const OUT = resolve('public/materials');
const SIZE = 1024;
const QUALITY = 82;

const MAP_ALIASES: Record<string, string> = {
  basecolor: 'basecolor',
  base_color: 'basecolor',
  color: 'basecolor',
  albedo: 'basecolor',
  normal: 'normal',
  roughness: 'roughness',
  metallic: 'metallic',
  metalness: 'metallic',
  height: 'height',
  displacement: 'height',
  ambientocclusion: 'ao',
  ambient_occlusion: 'ao',
  ao: 'ao',
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function detectMap(filename: string): string | null {
  const base = filename.toLowerCase().replace(/\.(png|jpg|jpeg|tga|webp)$/, '');
  for (const [key, value] of Object.entries(MAP_ALIASES)) {
    if (base.endsWith('_' + key) || base === key) return value;
  }
  return null;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

type MaterialEntry = { dir: string; map: string; source: string };

async function collect(): Promise<Map<string, MaterialEntry[]>> {
  const result = new Map<string, MaterialEntry[]>();
  const entries = await readdir(SRC, { withFileTypes: true });

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dirPath = join(SRC, e.name);
    const files = await readdir(dirPath);
    const slug = slugify(e.name);
    const items: MaterialEntry[] = [];

    // Group by map type; prefer PNG over TGA/JPG when both exist
    const byMap = new Map<string, string>();
    for (const f of files) {
      const ext = f.split('.').pop()?.toLowerCase();
      if (!ext || !['png', 'jpg', 'jpeg', 'tga'].includes(ext)) continue;
      const map = detectMap(f);
      if (!map) continue;
      const existing = byMap.get(map);
      const rank = { png: 3, jpg: 2, jpeg: 2, tga: 1 }[ext] ?? 0;
      const existingRank = existing
        ? ({ png: 3, jpg: 2, jpeg: 2, tga: 1 }[existing.split('.').pop()!.toLowerCase()] ?? 0)
        : -1;
      if (rank > existingRank) byMap.set(map, f);
    }

    for (const [map, file] of byMap) {
      items.push({ dir: slug, map, source: join(dirPath, file) });
    }

    if (items.length > 0) result.set(slug, items);
  }

  return result;
}

async function processOne(entry: MaterialEntry): Promise<void> {
  const outDir = join(OUT, entry.dir);
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `${entry.map}.webp`);

  // Sharp cannot read TGA — caller skips those
  const ext = entry.source.split('.').pop()?.toLowerCase();
  if (ext === 'tga') {
    console.warn(`  skip TGA (need PNG/JPG): ${relative(SRC, entry.source)}`);
    return;
  }

  const isNormal = entry.map === 'normal';
  const pipeline = sharp(entry.source).resize(SIZE, SIZE, {
    fit: 'cover',
    kernel: isNormal ? 'lanczos3' : 'lanczos3',
  });

  await pipeline.webp({ quality: isNormal ? 95 : QUALITY, effort: 4 }).toFile(outPath);
  const { size } = await stat(outPath);
  console.log(
    `  ${entry.map.padEnd(10)} → ${relative(OUT, outPath)} (${(size / 1024).toFixed(0)}KB)`,
  );
}

async function main() {
  if (!(await exists(SRC))) {
    console.error(`Source not found: ${SRC}`);
    process.exit(1);
  }

  const materials = await collect();
  if (materials.size === 0) {
    console.log('No materials found.');
    return;
  }

  console.log(`Exporting ${materials.size} materials → ${relative(process.cwd(), OUT)}\n`);
  for (const [slug, items] of materials) {
    console.log(`${slug}:`);
    for (const entry of items) await processOne(entry);
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
