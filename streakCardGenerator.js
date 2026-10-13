// streakCardGenerator.js
// Taruh di folder yang sama dengan streakTracker.js
// Background: file "streakBg.jpg" di folder yang sama (gambar api).
// Kalau file itu gak ada, otomatis pakai background neon Game Verse sebagai cadangan.
// Library: @napi-rs/canvas  (npm i @napi-rs/canvas)
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

const FONT_DIR = path.join(__dirname, 'fonts');
try {
  GlobalFonts.registerFromPath(path.join(FONT_DIR, 'ChakraPetch-Bold.ttf'), 'ChakraPetch');
  GlobalFonts.registerFromPath(path.join(FONT_DIR, 'Quicksand-Variable.ttf'), 'Quicksand');
} catch (e) {
  console.warn('[streakCard] font gagal diload, pakai sans-serif:', e.message);
}

const W = 900;
const H = 420;

const BG_PATH = path.join(__dirname, 'streakBg.jpg');
let bgPromise = null;
function getBgImage() {
  if (!bgPromise) {
    bgPromise = fs.existsSync(BG_PATH)
      ? loadImage(BG_PATH).catch((e) => {
          console.warn('[streakCard] gagal load streakBg.jpg:', e.message);
          return null;
        })
      : Promise.resolve(null);
  }
  return bgPromise;
}

const THEME_FIRE = {
  isFire: true,
  glow: '#ffb020',
  name: '#ffffff',
  nameGlow: 'rgba(0,0,0,0.9)',
  number: '#ffffff',
  numberGlow: '#ff5a00',
  label: '#ffe08a',
  labelGlow: 'rgba(0,0,0,0.85)',
  footer: 'rgba(255,255,255,0.9)',
};
const THEME_NEON = {
  isFire: false,
  glow: '#00f0ff',
  name: '#ffffff',
  nameGlow: '#00f0ff',
  number: '#ffffff',
  numberGlow: '#ff5adc',
  label: '#00f0ff',
  labelGlow: '#00f0ff',
  footer: 'rgba(255,255,255,0.75)',
};

async function fetchImage(url) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  return loadImage(buf);
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- BACKGROUND GAMBAR API ----------
function drawFireBackground(ctx, img) {
  // cover-fit, rata bawah supaya nyala apinya tetap kelihatan
  const scale = Math.max(W / img.width, H / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (W - dw) / 2, H - dh, dw, dh);

  // gelapin dikit biar teks kebaca
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 0, W, H);

  // bayangan di tengah (belakang angka)
  const rg = ctx.createRadialGradient(W / 2, H * 0.45, 20, W / 2, H * 0.45, 280);
  rg.addColorStop(0, 'rgba(0,0,0,0.40)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);

  // bar aksen kiri
  ctx.fillStyle = '#ffd54a';
  ctx.fillRect(0, 0, 8, H);
}

// ---------- BACKGROUND NEON (cadangan) ----------
function drawNeonBackground(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d0626');
  g.addColorStop(0.55, '#2a0f5e');
  g.addColorStop(1, '#7a1fa2');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const rg = ctx.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, 380);
  rg.addColorStop(0, 'rgba(255,80,200,0.35)');
  rg.addColorStop(1, 'rgba(255,80,200,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);

  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const s = rand() > 0.85 ? 4 : 2;
    ctx.fillStyle = `rgba(255,255,255,${0.3 + rand() * 0.7})`;
    ctx.fillRect(Math.floor(rand() * W), Math.floor(rand() * H * 0.6), s, s);
  }

  const horizon = H * 0.62;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizon, W, H - horizon);
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,240,255,0.45)';
  ctx.lineWidth = 1.5;
  for (let i = -14; i <= 14; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 20, horizon);
    ctx.lineTo(W / 2 + i * 120, H);
    ctx.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const y = horizon + Math.pow(i / 8, 2) * (H - horizon);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,90,220,0.9)';
  ctx.shadowColor = '#ff5adc';
  ctx.shadowBlur = 14;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(W, horizon);
  ctx.stroke();
  ctx.shadowBlur = 0;

  drawController(ctx, 70, 60, 0.7, 'rgba(255,255,255,0.10)');
  drawController(ctx, W - 70, H - 60, 0.7, 'rgba(255,255,255,0.10)');

  ctx.fillStyle = '#00f0ff';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 12;
  ctx.fillRect(0, 0, 8, H);
  ctx.shadowBlur = 0;
}

// ---------- ikon stik game (tema neon) ----------
function drawController(ctx, cx, cy, scale, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  rr(ctx, -60, -28, 120, 56, 24);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-44, 22, 24, 0, Math.PI * 2);
  ctx.arc(44, 22, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(10,5,30,0.75)';
  ctx.fillRect(-42, -6, 22, 7);
  ctx.fillRect(-35, -13, 8, 21);
  ctx.beginPath();
  ctx.arc(30, -10, 6, 0, Math.PI * 2);
  ctx.arc(44, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------- ikon api (tema api) ----------
function flamePath(ctx) {
  ctx.beginPath();
  ctx.moveTo(0, -46);
  ctx.bezierCurveTo(8, -26, 30, -16, 28, 10);
  ctx.bezierCurveTo(27, 30, 12, 42, 0, 42);
  ctx.bezierCurveTo(-12, 42, -28, 30, -27, 10);
  ctx.bezierCurveTo(-27, -5, -15, -12, -12, -28);
  ctx.bezierCurveTo(-6, -20, -3, -15, -2, -8);
  ctx.bezierCurveTo(5, -18, 3, -34, 0, -46);
  ctx.closePath();
}

function drawFlame(ctx, cx, cy, scale) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  ctx.shadowColor = 'rgba(255,120,0,0.9)';
  ctx.shadowBlur = 22;
  const g = ctx.createLinearGradient(0, -46, 0, 42);
  g.addColorStop(0, '#ff3d00');
  g.addColorStop(0.55, '#ff8c00');
  g.addColorStop(1, '#ffd54a');
  ctx.fillStyle = g;
  flamePath(ctx);
  ctx.fill();
  ctx.shadowBlur = 0;

  // api bagian dalam
  ctx.save();
  ctx.translate(0, 12);
  ctx.scale(0.52, 0.52);
  const g2 = ctx.createLinearGradient(0, -46, 0, 42);
  g2.addColorStop(0, '#ffb300');
  g2.addColorStop(1, '#fff3b0');
  ctx.fillStyle = g2;
  flamePath(ctx);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawCenterIcon(ctx, x, y, theme) {
  if (theme.isFire) drawFlame(ctx, x, y, 1.0);
  else drawController(ctx, x, y, 1.1, '#ff5adc');
}

function drawAvatar(ctx, img, cx, cy, r, badge, theme) {
  ctx.save();
  ctx.shadowColor = theme.glow;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 7, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();

  if (badge) {
    const bx = cx + r * 0.72;
    const by = cy + r * 0.72;
    ctx.beginPath();
    ctx.arc(bx, by, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx, by, 16, 0, Math.PI * 2);
    ctx.fillStyle = badge === 'done' ? '#2ecc71' : '#f39c12';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (badge === 'done') {
      ctx.moveTo(bx - 7, by);
      ctx.lineTo(bx - 2, by + 6);
      ctx.lineTo(bx + 8, by - 6);
    } else {
      ctx.moveTo(bx, by - 8);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + 6, by + 4);
    }
    ctx.stroke();
  }
}

function centerText(ctx, text, x, y, font, color, glow) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/**
 * @param {object} o
 * @param {string} o.user1Name
 * @param {string} o.user1Avatar  URL avatar
 * @param {string} [o.user2Name]   kosongkan user2 untuk mode solo
 * @param {string} [o.user2Avatar]
 * @param {number} o.days
 * @param {'done'|'wait'|null} [o.user1Badge]
 * @param {'done'|'wait'|null} [o.user2Badge]
 * @param {string} [o.label]  default "HARI"; "MENUNGGU" untuk kartu api-dinyalakan
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generateStreakCard(o) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bg = await getBgImage();
  const theme = bg ? THEME_FIRE : THEME_NEON;
  if (bg) drawFireBackground(ctx, bg);
  else drawNeonBackground(ctx);

  if (!o.user2Avatar) return drawSolo(ctx, canvas, o, theme);

  const [a1, a2] = await Promise.all([fetchImage(o.user1Avatar), fetchImage(o.user2Avatar)]);
  const r = 90;
  drawAvatar(ctx, a1, 160, 170, r, o.user1Badge || null, theme);
  drawAvatar(ctx, a2, W - 160, 170, r, o.user2Badge || null, theme);

  const nameFont = 'bold 26px ChakraPetch, sans-serif';
  centerText(ctx, trunc(o.user1Name, 14), 160, 295, nameFont, theme.name, theme.nameGlow);
  centerText(ctx, trunc(o.user2Name, 14), W - 160, 295, nameFont, theme.name, theme.nameGlow);

  drawCenterIcon(ctx, W / 2, 92, theme);
  centerText(ctx, String(o.days), W / 2, 190, 'bold 96px ChakraPetch, sans-serif', theme.number, theme.numberGlow);
  centerText(ctx, o.label || 'HARI', W / 2, 255, 'bold 28px ChakraPetch, sans-serif', theme.label, theme.labelGlow);

  centerText(ctx, 'GAME VERSE  •  STREAK', W / 2, H - 28, 'bold 18px ChakraPetch, sans-serif', theme.footer);

  return canvas.toBuffer('image/png');
}

async function drawSolo(ctx, canvas, o, theme) {
  const a1 = await fetchImage(o.user1Avatar);
  drawAvatar(ctx, a1, 230, 185, 100, o.user1Badge || null, theme);

  centerText(ctx, trunc(o.user1Name, 16), 230, 318, 'bold 28px ChakraPetch, sans-serif', theme.name, theme.nameGlow);

  drawCenterIcon(ctx, 640, 98, theme);
  centerText(ctx, String(o.days), 640, 200, 'bold 100px ChakraPetch, sans-serif', theme.number, theme.numberGlow);
  centerText(ctx, o.label || 'HARI', 640, 268, 'bold 28px ChakraPetch, sans-serif', theme.label, theme.labelGlow);

  centerText(ctx, 'GAME VERSE  •  STREAK', W / 2, H - 28, 'bold 18px ChakraPetch, sans-serif', theme.footer);
  return canvas.toBuffer('image/png');
}

module.exports = { generateStreakCard };