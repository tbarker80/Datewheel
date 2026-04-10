/**
 * Generates app icon PNGs using node-canvas.
 * Run: node scripts/generate-icon.js
 *
 * Design: dark navy background, bold red ring, white "D" + blue "W" centered.
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'images');

// ── helpers ────────────────────────────────────────────────────────────────

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Draw the icon artwork onto `ctx`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size  - canvas dimension (square)
 * @param {object} opts
 *   bg          - background color or null for transparent
 *   cornerRadius- 0 for no rounding (adaptive layers)
 *   ringScale   - fraction of size for ring radius (default 0.36)
 */
function drawIcon(ctx, size, { bg = '#0F1923', cornerRadius = 0, ringScale = 0.36 } = {}) {
  const cx = size / 2;
  const cy = size / 2;
  const ringRadius = size * ringScale;
  const ringWidth  = size * 0.085;

  // Background
  if (bg) {
    ctx.save();
    if (cornerRadius > 0) {
      roundedRect(ctx, 0, 0, size, size, cornerRadius);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.clip();
    } else {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.restore();
  }

  // ── Multicolored ring — 6 equal arc segments ─────────────────────────────
  const segments = [
    { color: '#FF2D2D' },  // red
    { color: '#FF9500' },  // orange
    { color: '#FFD700' },  // yellow
    { color: '#34C759' },  // green
    { color: '#007AFF' },  // blue
    { color: '#AF52DE' },  // purple
  ];
  const segAngle = (Math.PI * 2) / segments.length;
  const startOffset = -Math.PI / 2; // start at top

  ctx.save();
  ctx.lineWidth = ringWidth;
  ctx.lineCap = 'butt';
  segments.forEach((seg, i) => {
    const start = startOffset + i * segAngle;
    const end   = start + segAngle + 0.02; // tiny overlap to avoid hairline gaps
    ctx.beginPath();
    ctx.strokeStyle = seg.color;
    ctx.arc(cx, cy, ringRadius, start, end);
    ctx.stroke();
  });
  ctx.restore();

  // ── "DW" text ────────────────────────────────────────────────────────────
  const fontSize = Math.round(size * 0.32);
  const font     = `bold ${fontSize}px "Arial Black", "Arial Bold", Arial, sans-serif`;
  const gap      = size * 0.012; // small gap between D and W

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.font = font;

  // Measure both chars to center the pair
  const dW  = ctx.measureText('D').width;
  const wW  = ctx.measureText('W').width;
  const totalW = dW + gap + wW;
  const startX = cx - totalW / 2;

  // D – white with subtle drop shadow
  ctx.shadowColor  = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur   = size * 0.015;
  ctx.shadowOffsetX = size * 0.005;
  ctx.shadowOffsetY = size * 0.005;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('D', startX, cy);

  // W – blue
  ctx.fillStyle = '#3B9EE8';
  ctx.fillText('W', startX + dW + gap, cy);
  ctx.restore();
}

// ── icon.png  (1024×1024, iOS-style rounded bg) ────────────────────────────
function genIcon() {
  const s = 1024;
  const c = createCanvas(s, s);
  drawIcon(c.getContext('2d'), s, { bg: '#0F1923', cornerRadius: 180 });
  fs.writeFileSync(path.join(OUT, 'icon.png'), c.toBuffer('image/png'));
  console.log('✓ icon.png');
}

// ── adaptive-icon.png  (1024×1024, no bg — Android clips its own shape) ───
function genAdaptive() {
  const s = 1024;
  const c = createCanvas(s, s);
  // Draw on transparent (no bg), ring slightly smaller so it fits safe zone
  drawIcon(c.getContext('2d'), s, { bg: null, cornerRadius: 0, ringScale: 0.30 });
  fs.writeFileSync(path.join(OUT, 'adaptive-icon.png'), c.toBuffer('image/png'));
  console.log('✓ adaptive-icon.png');
}

// ── android-icon-background.png (solid navy) ───────────────────────────────
function genAndroidBg() {
  const s = 1024;
  const c = createCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0F1923';
  ctx.fillRect(0, 0, s, s);
  fs.writeFileSync(path.join(OUT, 'android-icon-background.png'), c.toBuffer('image/png'));
  console.log('✓ android-icon-background.png');
}

// ── android-icon-foreground.png (transparent bg, ring + DW) ───────────────
function genAndroidFg() {
  const s = 1024;
  const c = createCanvas(s, s);
  drawIcon(c.getContext('2d'), s, { bg: null, cornerRadius: 0, ringScale: 0.30 });
  fs.writeFileSync(path.join(OUT, 'android-icon-foreground.png'), c.toBuffer('image/png'));
  console.log('✓ android-icon-foreground.png');
}

// ── android-icon-monochrome.png (white on transparent) ─────────────────────
function genAndroidMono() {
  const s = 1024;
  const c = createCanvas(s, s);
  const ctx = c.getContext('2d');

  const cx = s / 2, cy = s / 2;
  const ringRadius = s * 0.30;
  const ringWidth  = s * 0.085;

  // Ring – white
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth   = ringWidth;
  ctx.beginPath();
  ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  // DW – white
  const fontSize = Math.round(s * 0.32);
  const font = `bold ${fontSize}px "Arial Black", "Arial Bold", Arial, sans-serif`;
  ctx.font = font;
  ctx.textBaseline = 'middle';
  const dW = ctx.measureText('D').width;
  const wW = ctx.measureText('W').width;
  const gap = s * 0.012;
  const totalW = dW + gap + wW;
  const startX = cx - totalW / 2;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('D', startX, cy);
  ctx.fillText('W', startX + dW + gap, cy);

  fs.writeFileSync(path.join(OUT, 'android-icon-monochrome.png'), c.toBuffer('image/png'));
  console.log('✓ android-icon-monochrome.png');
}

// ── favicon.png (48×48) ────────────────────────────────────────────────────
function genFavicon() {
  const s = 48;
  const c = createCanvas(s, s);
  drawIcon(c.getContext('2d'), s, { bg: '#0F1923', cornerRadius: 8, ringScale: 0.36 });
  fs.writeFileSync(path.join(OUT, 'favicon.png'), c.toBuffer('image/png'));
  console.log('✓ favicon.png');
}

// ── splash-icon.png  (just the DW mark, no bg, for splash overlay) ─────────
function genSplash() {
  const s = 400;
  const c = createCanvas(s, s);
  drawIcon(c.getContext('2d'), s, { bg: null, cornerRadius: 0, ringScale: 0.36 });
  fs.writeFileSync(path.join(OUT, 'splash-icon.png'), c.toBuffer('image/png'));
  console.log('✓ splash-icon.png');
}

// ── run all ────────────────────────────────────────────────────────────────
genIcon();
genAdaptive();
genAndroidBg();
genAndroidFg();
genAndroidMono();
genFavicon();
genSplash();

console.log('\nAll icons written to assets/images/');
