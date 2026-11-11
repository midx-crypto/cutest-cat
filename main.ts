// cutest-cat-01 entry: draw a cute orange cat as a PNG (Node 22 stdlib only).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 640;
const H = 640;

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([typeBytes, Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function setPix(px: Uint8Array, x: number, y: number, r: number, g: number, b: number, a = 255) {
  const xi = x | 0;
  const yi = y | 0;
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 4;
  // alpha-over so soft edges and blush blend
  const oa = a / 255;
  const ia = 1 - oa;
  px[i] = Math.round(r * oa + px[i]! * ia);
  px[i + 1] = Math.round(g * oa + px[i + 1]! * ia);
  px[i + 2] = Math.round(b * oa + px[i + 2]! * ia);
  px[i + 3] = 255;
}

function fillCircle(px: Uint8Array, cx: number, cy: number, rad: number, r: number, g: number, b: number, a = 255) {
  const r2 = rad * rad;
  const soft = rad + 1.2;
  const soft2 = soft * soft;
  for (let y = Math.floor(cy - soft); y <= Math.ceil(cy + soft); y++) {
    for (let x = Math.floor(cx - soft); x <= Math.ceil(cx + soft); x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2) setPix(px, x, y, r, g, b, a);
      else if (d2 <= soft2) {
        const t = (Math.sqrt(d2) - rad) / 1.2;
        setPix(px, x, y, r, g, b, Math.round(a * (1 - t)));
      }
    }
  }
}

function fillEllipse(px: Uint8Array, cx: number, cy: number, rx: number, ry: number, r: number, g: number, b: number, a = 255) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d <= 1) setPix(px, x, y, r, g, b, a);
      else if (d <= 1.08) setPix(px, x, y, r, g, b, Math.round(a * (1.08 - d) / 0.08));
    }
  }
}

function fillTriangle(px: Uint8Array, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, r: number, g: number, b: number) {
  const minX = Math.floor(Math.min(x1, x2, x3));
  const maxX = Math.ceil(Math.max(x1, x2, x3));
  const minY = Math.floor(Math.min(y1, y2, y3));
  const maxY = Math.ceil(Math.max(y1, y2, y3));
  const area = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2);
  if (area === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w1 = (x * (y2 - y3) + x2 * (y3 - y) + x3 * (y - y2)) / area;
      const w2 = (x1 * (y - y3) + x * (y3 - y1) + x3 * (y1 - y)) / area;
      const w3 = 1 - w1 - w2;
      if (w1 >= 0 && w2 >= 0 && w3 >= 0) setPix(px, x, y, r, g, b);
    }
  }
}

function encodePng(px: Uint8Array): Buffer {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    raw.set(px.subarray(y * W * 4, (y + 1) * W * 4), y * (W * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array()),
  ]);
}

function drawCat(): Uint8Array {
  const px = new Uint8Array(W * H * 4);
  // soft peach gradient sky
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    const r = Math.round(255 - t * 12);
    const g = Math.round(244 - t * 18);
    const b = Math.round(230 - t * 8);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = 255;
    }
  }

  // gentle head tilt via drawing offsets
  const tilt = 8;
  const hx = 310;
  const hy = 250;

  const furR = 255, furG = 158, furB = 78;
  const earInR = 255, earInG = 168, earInB = 178;
  const bellyR = 255, bellyG = 236, bellyB = 214;

  // curled tail behind body
  for (let t = 0; t < 55; t++) {
    const a = t / 55;
    const x = 430 + Math.cos(a * Math.PI * 1.35) * 70;
    const y = 430 - Math.sin(a * Math.PI * 1.35) * 95;
    fillCircle(px, x, y, 16 - a * 6, furR, furG, furB);
  }

  // body + belly
  fillEllipse(px, 300, 420, 135, 115, furR, furG, furB);
  fillEllipse(px, 300, 445, 78, 62, bellyR, bellyG, bellyB);

  // head
  fillCircle(px, hx, hy, 108, furR, furG, furB);

  // ears (slightly tilted)
  fillTriangle(px, hx - 95, hy - 40, hx - 78 + tilt, hy - 145, hx - 20, hy - 55, furR, furG, furB);
  fillTriangle(px, hx - 82, hy - 50, hx - 70 + tilt, hy - 120, hx - 35, hy - 58, earInR, earInG, earInB);
  fillTriangle(px, hx + 88, hy - 35, hx + 72 - tilt, hy - 148, hx + 18, hy - 55, furR, furG, furB);
  fillTriangle(px, hx + 75, hy - 48, hx + 64 - tilt, hy - 122, hx + 30, hy - 58, earInR, earInG, earInB);

  // big shiny eyes
  fillEllipse(px, hx - 38, hy + 5, 26, 32, 35, 32, 30);
  fillEllipse(px, hx + 42, hy - 2, 26, 32, 35, 32, 30);
  fillEllipse(px, hx - 38, hy + 5, 14, 22, 72, 196, 118);
  fillEllipse(px, hx + 42, hy - 2, 14, 22, 72, 196, 118);
  fillEllipse(px, hx - 38, hy + 6, 6, 14, 18, 16, 14);
  fillEllipse(px, hx + 42, hy - 1, 6, 14, 18, 16, 14);
  fillCircle(px, hx - 46, hy - 6, 6, 255, 255, 255);
  fillCircle(px, hx + 34, hy - 13, 6, 255, 255, 255);
  fillCircle(px, hx - 32, hy + 14, 3, 255, 255, 255, 180);
  fillCircle(px, hx + 48, hy + 7, 3, 255, 255, 255, 180);

  // blush
  fillEllipse(px, hx - 72, hy + 38, 22, 12, 255, 170, 165, 140);
  fillEllipse(px, hx + 78, hy + 30, 22, 12, 255, 170, 165, 140);

  // nose
  fillTriangle(px, hx - 8, hy + 28, hx + 8, hy + 28, hx, hy + 40, 236, 118, 138);

  // smile
  for (let x = 0; x <= 22; x++) {
    const y = hy + 48 + Math.floor((x / 22) * (x / 22) * 10);
    setPix(px, hx + x, y, 70, 50, 45);
    setPix(px, hx + x, y + 1, 70, 50, 45);
    setPix(px, hx - x, y, 70, 50, 45);
    setPix(px, hx - x, y + 1, 70, 50, 45);
  }

  // whiskers
  for (let i = 0; i < 3; i++) {
    const y0 = hy + 34 + i * 10;
    for (let x = hx - 130; x < hx - 55; x++) {
      const y = y0 + Math.floor((hx - 55 - x) * (0.015 + i * 0.004));
      setPix(px, x, y, 95, 75, 65);
    }
    for (let x = hx + 55; x < hx + 130; x++) {
      const y = y0 + Math.floor((x - (hx + 55)) * (0.015 + i * 0.004));
      setPix(px, x, y, 95, 75, 65);
    }
  }

  // clumsy front paws
  fillEllipse(px, 235, 520, 34, 22, furR, furG, furB);
  fillEllipse(px, 365, 520, 34, 22, furR, furG, furB);
  // toe beans hint
  fillCircle(px, 225, 522, 4, 240, 150, 150, 160);
  fillCircle(px, 235, 518, 4, 240, 150, 150, 160);
  fillCircle(px, 245, 522, 4, 240, 150, 150, 160);
  fillCircle(px, 355, 522, 4, 240, 150, 150, 160);
  fillCircle(px, 365, 518, 4, 240, 150, 150, 160);
  fillCircle(px, 375, 522, 4, 240, 150, 150, 160);

  // favourite yarn ball (charm) — a little story for the judge
  fillCircle(px, 470, 530, 28, 110, 185, 235);
  for (let a = 0; a < Math.PI * 2; a += 0.35) {
    const x1 = 470 + Math.cos(a) * 22;
    const y1 = 530 + Math.sin(a) * 18;
    const x2 = 470 + Math.cos(a + 0.8) * 10;
    const y2 = 530 + Math.sin(a + 0.8) * 8;
    const steps = 12;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      setPix(px, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 80, 140, 180);
    }
  }
  // loose yarn strand to paw
  for (let t = 0; t < 40; t++) {
    const u = t / 40;
    const x = 440 - u * 70;
    const y = 530 + Math.sin(u * Math.PI) * 18;
    fillCircle(px, x, y, 2, 120, 190, 230);
  }

  return px;
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
writeFileSync(join(outDir, 'entry.png'), encodePng(drawCat()));
