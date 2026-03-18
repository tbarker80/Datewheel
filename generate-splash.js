const { createCanvas } = require('canvas');
const fs = require('fs');

const W = 1284;
const H = 2778;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// Background
ctx.fillStyle = '#0F1923';
ctx.fillRect(0, 0, W, H);

// Stars
const rand = (min, max) => Math.random() * (max - min) + min;
ctx.fillStyle = 'rgba(255,255,255,0.6)';
for (let i = 0; i < 200; i++) {
  const x = rand(0, W);
  const y = rand(0, H * 0.6);
  const r = rand(0.5, 2);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Pyramid
const cx = W / 2;
const pyBase = H * 0.78;
const pyTop = H * 0.28;
const pyWidth = W * 0.72;

// Pyramid glow
const grd = ctx.createRadialGradient(cx, pyBase, 10, cx, pyBase, pyWidth);
grd.addColorStop(0, 'rgba(240,165,0,0.15)');
grd.addColorStop(1, 'rgba(240,165,0,0)');
ctx.fillStyle = grd;
ctx.fillRect(0, 0, W, H);

// Pyramid left face
ctx.beginPath();
ctx.moveTo(cx, pyTop);
ctx.lineTo(cx - pyWidth / 2, pyBase);
ctx.lineTo(cx, pyBase);
ctx.closePath();
ctx.fillStyle = 'rgba(240,165,0,0.08)';
ctx.fill();
ctx.strokeStyle = 'rgba(240,165,0,0.5)';
ctx.lineWidth = 2.5;
ctx.stroke();

// Pyramid right face
ctx.beginPath();
ctx.moveTo(cx, pyTop);
ctx.lineTo(cx + pyWidth / 2, pyBase);
ctx.lineTo(cx, pyBase);
ctx.closePath();
ctx.fillStyle = 'rgba(240,165,0,0.14)';
ctx.fill();
ctx.strokeStyle = 'rgba(240,165,0,0.5)';
ctx.lineWidth = 2.5;
ctx.stroke();

// Pyramid horizontal construction lines
const levels = 8;
for (let i = 1; i < levels; i++) {
  const t = i / levels;
  const y = pyTop + (pyBase - pyTop) * t;
  const halfW = (pyWidth / 2) * t;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, y);
  ctx.lineTo(cx + halfW, y);
  ctx.strokeStyle = `rgba(240,165,0,${0.08 + t * 0.08})`;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Date wheel overlaid on pyramid center
const wheelCX = cx;
const wheelCY = H * 0.52;
const wheelR = W * 0.28;
const ringR = wheelR - 18;

// Wheel background circle
ctx.beginPath();
ctx.arc(wheelCX, wheelCY, wheelR, 0, Math.PI * 2);
ctx.fillStyle = 'rgba(15,25,35,0.85)';
ctx.fill();
ctx.strokeStyle = 'rgba(46,125,188,0.4)';
ctx.lineWidth = 1;
ctx.stroke();

// Wheel ring (background track)
ctx.beginPath();
ctx.arc(wheelCX, wheelCY, ringR, 0, Math.PI * 2);
ctx.strokeStyle = '#1C2B38';
ctx.lineWidth = 36;
ctx.stroke();

// Task arcs — 4 construction phases
const phases = [
  { start: -90, end: -90 + 72, color: '#2E9BFF' },   // Planning
  { start: -90 + 72, end: -90 + 144, color: '#1DB8A0' }, // Foundation
  { start: -90 + 144, end: -90 + 216, color: '#8B5CF6' }, // Structure
  { start: -90 + 216, end: -90 + 270, color: '#F97316' }, // Finish
];

phases.forEach(phase => {
  const startRad = (phase.start * Math.PI) / 180;
  const endRad = (phase.end * Math.PI) / 180;
  ctx.beginPath();
  ctx.arc(wheelCX, wheelCY, ringR, startRad, endRad);
  ctx.strokeStyle = phase.color;
  ctx.lineWidth = 36;
  ctx.globalAlpha = 0.75;
  ctx.stroke();
  ctx.globalAlpha = 1.0;
});

// Ring borders
ctx.beginPath();
ctx.arc(wheelCX, wheelCY, ringR + 18, 0, Math.PI * 2);
ctx.strokeStyle = 'rgba(46,125,188,0.4)';
ctx.lineWidth = 1;
ctx.stroke();

ctx.beginPath();
ctx.arc(wheelCX, wheelCY, ringR - 18, 0, Math.PI * 2);
ctx.strokeStyle = 'rgba(46,125,188,0.4)';
ctx.lineWidth = 1;
ctx.stroke();

// Center hub
ctx.beginPath();
ctx.arc(wheelCX, wheelCY, wheelR - 80, 0, Math.PI * 2);
ctx.fillStyle = '#0F1923';
ctx.fill();
ctx.strokeStyle = 'rgba(46,125,188,0.6)';
ctx.lineWidth = 1.5;
ctx.stroke();

// Center text — duration
ctx.fillStyle = '#FFFFFF';
ctx.font = 'bold 90px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('365', wheelCX, wheelCY - 40);

ctx.fillStyle = '#2E9BFF';
ctx.font = '600 32px sans-serif';
ctx.fillText('DAYS', wheelCX, wheelCY + 20);

ctx.fillStyle = 'rgba(138,175,196,0.8)';
ctx.font = '26px sans-serif';
ctx.fillText('1 YEAR TO BUILD', wheelCX, wheelCY + 65);

// Start dot (blue)
const startAngle = (-90 * Math.PI) / 180;
const startDotX = wheelCX + ringR * Math.cos(startAngle);
const startDotY = wheelCY + ringR * Math.sin(startAngle);
ctx.beginPath();
ctx.arc(startDotX, startDotY, 14, 0, Math.PI * 2);
ctx.fillStyle = '#2E9BFF';
ctx.fill();
ctx.strokeStyle = 'rgba(255,255,255,0.6)';
ctx.lineWidth = 2;
ctx.stroke();

// End dot (amber)
const endAngle = (180 * Math.PI) / 180;
const endDotX = wheelCX + ringR * Math.cos(endAngle);
const endDotY = wheelCY + ringR * Math.sin(endAngle);
ctx.beginPath();
ctx.arc(endDotX, endDotY, 18, 0, Math.PI * 2);
ctx.fillStyle = '#F0A500';
ctx.globalAlpha = 0.9;
ctx.fill();
ctx.globalAlpha = 1.0;
ctx.strokeStyle = 'rgba(255,255,255,0.6)';
ctx.lineWidth = 2;
ctx.stroke();

// App title
ctx.font = 'bold 96px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

// DATE in white
ctx.fillStyle = '#FFFFFF';
ctx.fillText('DATE', cx - 110, H * 0.88);

// WHEEL in blue
ctx.fillStyle = '#2E9BFF';
ctx.font = '300 96px sans-serif';
ctx.fillText('WHEEL', cx + 120, H * 0.88);

// Tagline
ctx.fillStyle = 'rgba(90,122,150,0.8)';
ctx.font = '32px sans-serif';
ctx.fillText('Project timeline planning', cx, H * 0.92);

// Save
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('./assets/images/splash-icon.png', buffer);
console.log('Splash screen generated!');
