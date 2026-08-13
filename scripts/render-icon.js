"use strict";

// High-precision rasterizer for the Web2Fig extension mark.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SCALE = 4;
const SIZE = 128 * SCALE; // 512x512
const outputDir = path.join(__dirname, "..", "assets");

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function mix(a, b, amount) {
  return a + (b - a) * amount;
}

function roundedBoxCoverage(x, y, left, top, right, bottom, radius) {
  const cx = clamp(x, left + radius, right - radius);
  const cy = clamp(y, top + radius, bottom - radius);
  return clamp(Math.hypot(x - cx, y - cy) + 0.5 - radius);
}

function strokeRoundedBoxCoverage(x, y, left, top, right, bottom, radius, strokeWidth) {
  const outer = roundedBoxCoverage(x, y, left, top, right, bottom, radius);
  const inner = roundedBoxCoverage(
    x,
    y,
    left + strokeWidth,
    top + strokeWidth,
    right - strokeWidth,
    bottom - strokeWidth,
    Math.max(0, radius - strokeWidth)
  );
  return clamp((1 - outer) - (1 - inner));
}

function circleCoverage(x, y, cx, cy, radius) {
  return clamp(Math.hypot(x - cx, y - cy) + 0.5 - radius);
}

function blend(pixel, color, coverage) {
  const alpha = clamp(coverage) * color[3];
  pixel[0] = mix(pixel[0], color[0], alpha);
  pixel[1] = mix(pixel[1], color[1], alpha);
  pixel[2] = mix(pixel[2], color[2], alpha);
  pixel[3] = Math.max(pixel[3], alpha);
}

function renderSource() {
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const pixel = [0, 0, 0, 0];

      // 1. Dark obsidian squircle base container
      const baseCoverage = 1 - roundedBoxCoverage(x, y, 16, 16, SIZE - 16, SIZE - 16, 110);
      blend(pixel, [11, 13, 20, 1], baseCoverage);

      // Subtle ambient violet glow around center
      const distFromCenter = Math.hypot(x - cx, y - cy);
      const glow = clamp(1 - distFromCenter / 240);
      blend(pixel, [99, 102, 241, 0.22 * glow], baseCoverage);

      // Outer squircle border
      const outerBorder = strokeRoundedBoxCoverage(x, y, 16, 16, SIZE - 16, SIZE - 16, 110, 4);
      blend(pixel, [255, 255, 255, 0.08], outerBorder);

      // 2. Web Viewport Card (Outer frame)
      const frameCoverage = 1 - roundedBoxCoverage(x, y, 76, 76, SIZE - 76, SIZE - 76, 52);
      blend(pixel, [21, 25, 41, 1], frameCoverage);

      // Frame border with electric indigo accent
      const frameBorder = strokeRoundedBoxCoverage(x, y, 76, 76, SIZE - 76, SIZE - 76, 52, 5);
      blend(pixel, [129, 140, 248, 0.65], frameBorder);

      // Web Viewport Header bar
      const headerCoverage = 1 - roundedBoxCoverage(x, y, 76, 76, SIZE - 76, 148, 48);
      // Clip bottom corners of header to be square
      const headerSquareClip = y >= 120 && y <= 148 && x >= 76 && x <= SIZE - 76 ? 1 : 0;
      const finalHeaderCov = Math.max(headerCoverage, headerSquareClip) * frameCoverage;
      blend(pixel, [30, 36, 59, 1], finalHeaderCov);

      // Header divider line
      const lineCov = Math.abs(y - 148) <= 1 && x >= 76 && x <= SIZE - 76 ? 1 : 0;
      blend(pixel, [255, 255, 255, 0.12], lineCov * frameCoverage);

      // Window dots
      const dot1 = 1 - circleCoverage(x, y, 116, 112, 9);
      const dot2 = 1 - circleCoverage(x, y, 142, 112, 9);
      const dot3 = 1 - circleCoverage(x, y, 168, 112, 9);
      blend(pixel, [239, 68, 68, 0.9], dot1);
      blend(pixel, [245, 158, 11, 0.9], dot2);
      blend(pixel, [16, 185, 129, 0.9], dot3);

      // 3. Figma Layer Stack (Back Layer)
      const backLayerCov = 1 - roundedBoxCoverage(x, y, 190, 230, 396, 386, 28);
      blend(pixel, [99, 102, 241, 0.35], backLayerCov * frameCoverage);
      const backLayerBorder = strokeRoundedBoxCoverage(x, y, 190, 230, 396, 386, 28, 3);
      blend(pixel, [165, 180, 252, 0.5], backLayerBorder * frameCoverage);

      // 4. Figma Layer Stack (Front Layer - Main Focus)
      const frontLayerCov = 1 - roundedBoxCoverage(x, y, 136, 186, 342, 342, 28);
      // Gradient across front layer: Violet (#6366f1) -> Purple (#8b5cf6) -> Pink (#ec4899)
      const gradProgress = clamp((x + y - 322) / 360);
      const frontR = mix(99, 236, gradProgress);
      const frontG = mix(102, 72, gradProgress);
      const frontB = mix(241, 153, gradProgress);
      blend(pixel, [frontR, frontG, frontB, 0.95], frontLayerCov * frameCoverage);

      // Inner stroke on front layer
      const frontLayerBorder = strokeRoundedBoxCoverage(x, y, 136, 186, 342, 342, 28, 4);
      blend(pixel, [255, 255, 255, 0.6], frontLayerBorder * frameCoverage);

      // 5. Figma Vector Selection Handles (White squares with indigo border)
      const handles = [
        [136, 186],
        [342, 186],
        [136, 342],
        [342, 342]
      ];
      for (const [hx, hy] of handles) {
        const handleCov = 1 - roundedBoxCoverage(x, y, hx - 14, hy - 14, hx + 14, hy + 14, 6);
        blend(pixel, [255, 255, 255, 1], handleCov * baseCoverage);
        const handleStroke = strokeRoundedBoxCoverage(x, y, hx - 14, hy - 14, hx + 14, hy + 14, 6, 3);
        blend(pixel, [79, 70, 229, 1], handleStroke * baseCoverage);
      }

      pixels[i] = Math.round(pixel[0]);
      pixels[i + 1] = Math.round(pixel[1]);
      pixels[i + 2] = Math.round(pixel[2]);
      pixels[i + 3] = Math.round(pixel[3] * 255);
    }
  }
  return pixels;
}

function resize(source, targetSize) {
  const factor = SIZE / targetSize;
  const target = Buffer.alloc(targetSize * targetSize * 4);
  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const sums = [0, 0, 0, 0];
      for (let yy = 0; yy < factor; yy++) {
        for (let xx = 0; xx < factor; xx++) {
          const sourceIndex = ((y * factor + yy) * SIZE + x * factor + xx) * 4;
          for (let channel = 0; channel < 4; channel++) sums[channel] += source[sourceIndex + channel];
        }
      }
      const targetIndex = (y * targetSize + x) * 4;
      for (let channel = 0; channel < 4; channel++) target[targetIndex + channel] = Math.round(sums[channel] / (factor * factor));
    }
  }
  return target;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  typeBuffer.copy(header, 4);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([header, data, checksum]);
}

function png(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * width * 4, width * 4).copy(raw, row + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const source = renderSource();
for (const size of [16, 32, 48, 128]) {
  fs.writeFileSync(path.join(outputDir, `icon-${size}.png`), png(size, size, resize(source, size)));
}
console.log("Successfully generated modern icon set in assets/");
