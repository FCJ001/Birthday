#!/usr/bin/env node
/**
 * 批量压缩 / 缩小相册图片（JPEG），适合微信内置浏览器。
 *
 * 用法：
 *   npm install
 *   npm run optimize-images
 *
 * 默认写入 assets/images-optimized/，不改动原图。确认无误后自行替换 assets/images。
 *
 * 选项：
 *   --dir <path>        输入目录，默认 ./assets/images
 *   --out <path>        输出目录，默认 ./assets/images-optimized
 *   --max-edge <px>     长边上限，默认 1600
 *   --quality <1-100>   JPEG 质量，默认 82
 *   --in-place          直接覆盖原文件（会先备份到 --backup-dir）
 *   --backup-dir <path> 与 --in-place 配合，默认 <输入目录>/.backup-<时间戳>
 *   --dry-run           只打印将处理的文件，不写盘
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = {
    dir: path.join(ROOT, "assets", "images"),
    outDir: path.join(ROOT, "assets", "images-optimized"),
    maxEdge: 1600,
    quality: 82,
    inPlace: false,
    backupDir: null,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--in-place") out.inPlace = true;
    else if (a === "--dir") out.dir = path.resolve(ROOT, argv[++i] || "");
    else if (a === "--out") out.outDir = path.resolve(ROOT, argv[++i] || "");
    else if (a === "--max-edge") out.maxEdge = Math.max(1, Number(argv[++i]) || 1600);
    else if (a === "--quality") out.quality = Math.min(100, Math.max(1, Number(argv[++i]) || 82));
    else if (a === "--backup-dir") out.backupDir = path.resolve(ROOT, argv[++i] || "");
    else if (a === "-h" || a === "--help") {
      console.log(`
用法: node scripts/optimize-images.mjs [选项]

  --dir <path>         输入目录（默认 ./assets/images）
  --out <path>         输出目录（默认 ./assets/images-optimized）
  --max-edge <px>      长边上限（默认 1600）
  --quality <1-100>    JPEG 质量（默认 82）
  --in-place           覆盖原图，会先备份到 --backup-dir
  --backup-dir <path>  原地模式备份目录（默认 输入目录/.backup-时间戳）
  --dry-run            只列出将处理的文件
`);
      process.exit(0);
    }
  }
  return out;
}

const JPEG_RE = /\.(jpe?g)$/i;

async function processOne(src, dest, maxEdge, quality, dryRun) {
  const meta = await sharp(src).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  const longEdge = Math.max(w, h);
  let pipeline = sharp(src).rotate();

  if (longEdge > maxEdge) {
    pipeline = pipeline.resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  pipeline = pipeline.jpeg({
    quality,
    mozjpeg: true,
    chromaSubsampling: "4:2:0",
  });

  if (dryRun) {
    const nextW = longEdge > maxEdge ? Math.round((w / longEdge) * maxEdge) : w;
    const nextH = longEdge > maxEdge ? Math.round((h / longEdge) * maxEdge) : h;
    console.log(`  ${path.basename(src)}  ${w}×${h} → ~${nextW}×${nextH}`);
    return { skipped: false, bytes: 0 };
  }

  const buf = await pipeline.toBuffer();
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.writeFile(dest, buf);
  return { skipped: false, bytes: buf.length };
}

async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.dir || !fs.existsSync(opts.dir)) {
    console.error("输入目录不存在:", opts.dir);
    process.exit(1);
  }

  if (opts.inPlace && !opts.backupDir) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    opts.backupDir = path.join(opts.dir, `.backup-${stamp}`);
  }

  const names = (await fs.promises.readdir(opts.dir)).filter(
    (n) => JPEG_RE.test(n) && !n.startsWith(".")
  );

  if (names.length === 0) {
    console.log("未找到 JPEG 文件:", opts.dir);
    process.exit(0);
  }

  console.log(
    `目录: ${opts.dir}\n` +
      `${opts.inPlace ? "模式: 原地覆盖（先备份）" : `输出: ${opts.outDir}`}\n` +
      `长边≤${opts.maxEdge}px, JPEG 质量 ${opts.quality}${opts.dryRun ? " [dry-run]" : ""}\n`
  );

  if (opts.inPlace && !opts.dryRun) {
    await fs.promises.mkdir(opts.backupDir, { recursive: true });
    console.log("备份到:", opts.backupDir, "\n");
  }

  let totalIn = 0;
  let totalOut = 0;

  for (const name of names.sort()) {
    const src = path.join(opts.dir, name);
    const dest = opts.inPlace ? src : path.join(opts.outDir, name);

    const st = await fs.promises.stat(src);
    totalIn += st.size;

    if (opts.inPlace && !opts.dryRun) {
      await fs.promises.copyFile(src, path.join(opts.backupDir, name));
    }

    const { bytes } = await processOne(src, dest, opts.maxEdge, opts.quality, opts.dryRun);
    if (!opts.dryRun) totalOut += bytes;

    if (!opts.dryRun) {
      const saved = ((1 - bytes / st.size) * 100).toFixed(1);
      console.log(`${name}  ${(st.size / 1024).toFixed(0)} KB → ${(bytes / 1024).toFixed(0)} KB  (-${saved}%)`);
    }
  }

  if (opts.dryRun) {
    console.log(`\n共 ${names.length} 个文件（dry-run，未写入）`);
    return;
  }

  const ratio = totalIn ? ((1 - totalOut / totalIn) * 100).toFixed(1) : "0";
  console.log(`\n合计: ${(totalIn / 1024 / 1024).toFixed(2)} MB → ${(totalOut / 1024 / 1024).toFixed(2)} MB  约省 ${ratio}%`);

  if (!opts.inPlace) {
    console.log("\n下一步: 确认画质后，可将 images-optimized 内文件覆盖到 assets/images，或改脚本默认目录。");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
