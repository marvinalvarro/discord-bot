const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const path = require("path");

try {
    GlobalFonts.registerFromPath(path.join(__dirname, "fonts", "Quicksand-Variable.ttf"), "Quicksand");
} catch (err) {
    console.log("[TaarufCard] Gagal load font Quicksand:", err.message);
}

try {
    GlobalFonts.registerFromPath(path.join(__dirname, "fonts", "Baloo2.ttf"), "Baloo2");
} catch (err) {
    console.log("[TaarufCard] Gagal load font Baloo2:", err.message);
}

const FONT = "Quicksand";
const TITLE_FONT = "Baloo2"; // font judul "CV PESERTA GAME VERSE", gaya bold & rounded
const BG_COLOR = "#4FE1CA";
const DARK_TEXT = "#0F3D3A";

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawStar(ctx, cx, cy, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const outerX = Math.cos(angle) * size;
        const outerY = Math.sin(angle) * size;
        const innerAngle = angle + Math.PI / 5;
        const innerX = Math.cos(innerAngle) * size * 0.45;
        const innerY = Math.sin(innerAngle) * size * 0.45;
        if (i === 0) ctx.moveTo(outerX, outerY);
        else ctx.lineTo(outerX, outerY);
        ctx.lineTo(innerX, innerY);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// Logo kiri atas: load gambar logo asli Game Verse (file logo.png, sama yang dipakai ktpGenerator.js)
async function drawGameVerseLogo(ctx, x, y) {
    try {
        const logo = await loadImage(path.join(__dirname, "logo.png"));
        const logoH = 46;
        const logoW = logoH * (logo.width / logo.height);
        ctx.drawImage(logo, x, y - logoH + 6, logoW, logoH);
    } catch (err) {
        console.log("[TaarufCard] Logo tidak ditemukan:", err.message);
    }
}

function drawImageCover(ctx, img, x, y, w, h) {
    const imgRatio = img.width / img.height;
    const boxRatio = w / h;
    let sx, sy, sw, sh;
    if (imgRatio > boxRatio) {
        sh = img.height;
        sw = sh * boxRatio;
        sx = (img.width - sw) / 2;
        sy = 0;
    } else {
        sw = img.width;
        sh = sw / boxRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/**
 * Generate kartu CV ala ta'aruf dengan branding Game Verse.
 * @param {Object} opts
 * @param {string} opts.photoURL - URL foto (biasanya avatar Discord user)
 * @param {string} opts.nama - nama lengkap/panggilan user
 * @param {string} opts.locationAge - teks kayak "Bekasi, 26"
 * @param {string} [opts.ig] - handle Instagram (tanpa/dengan @, bebas)
 * @param {string} [opts.tiktok] - handle TikTok
 * @param {string} [opts.discord] - username/handle Discord
 */
async function generateTaarufCard({ photoURL, nama, locationAge, ig, tiktok, discord }) {
    const socialLines = [];
    if (ig) socialLines.push(`Instagram: ${ig}`);
    if (tiktok) socialLines.push(`Tiktok: ${tiktok}`);
    if (discord) socialLines.push(`Discord: ${discord}`);

    const width = 800;
    const socialBlockH = socialLines.length > 0 ? 40 * socialLines.length + 24 : 0;
    const height = 1000 + socialBlockH;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Background polos
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, width, height);

    // Logo
    drawGameVerseLogo(ctx, 55, 90);

    // Judul
    ctx.textAlign = "center";
    ctx.fillStyle = DARK_TEXT;
    ctx.font = `700 46px ${TITLE_FONT}`;
    ctx.fillText("CV PESERTA", width / 2, 195);
    ctx.fillText("GAME VERSE", width / 2, 250);

    // Foto (mat/frame beda warna + border gelap + shadow lebih kerasa)
    const photoW = 420;
    const photoH = 460;
    const photoX = (width - photoW) / 2;
    const photoY = 330;

    // Lapisan 1: "mat" — kotak agak beda warna dari background, lebih lebar dari foto
    const matPad = 22;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, photoX - matPad, photoY - matPad, photoW + matPad * 2, photoH + matPad * 2, 24);
    ctx.fillStyle = "#3FC9B3"; // versi lebih gelap dikit dari BG_COLOR, biar keliatan beda
    ctx.fill();
    ctx.restore();

    // Lapisan 2: border gelap nempel langsung ke foto
    ctx.save();
    roundRect(ctx, photoX - 6, photoY - 6, photoW + 12, photoH + 12, 20);
    ctx.fillStyle = DARK_TEXT;
    ctx.fill();
    ctx.restore();

    try {
        const photo = await loadImage(photoURL);
        ctx.save();
        roundRect(ctx, photoX, photoY, photoW, photoH, 16);
        ctx.clip();
        drawImageCover(ctx, photo, photoX, photoY, photoW, photoH);
        ctx.restore();
    } catch (err) {
        console.log("[TaarufCard] Gagal load foto:", err.message);
        ctx.fillStyle = "#E5E5E5";
        roundRect(ctx, photoX, photoY, photoW, photoH, 16);
        ctx.fill();
    }

    // Kotak lokasi + umur, nempel di bawah foto
    const boxY = photoY + photoH - 45;
    const boxW = photoW - 40;
    const boxH = 80;
    const boxX = (width - boxW) / 2;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 10;
    roundRect(ctx, boxX, boxY, boxW, boxH, 14);
    ctx.fillStyle = DARK_TEXT;
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    roundRect(ctx, boxX, boxY, boxW, boxH, 14);
    ctx.stroke();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 34px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(locationAge, width / 2, boxY + boxH / 2 + 12);

    // Handle sosmed di paling bawah, satu baris per platform (font lebih tegas/bold)
    ctx.fillStyle = DARK_TEXT;
    ctx.font = `700 27px ${FONT}`;
    ctx.textAlign = "center";
    let socialY = boxY + boxH + 64;
    for (const line of socialLines) {
        ctx.fillText(line, width / 2, socialY);
        socialY += 40;
    }

    return canvas.toBuffer("image/png");
}

module.exports = { generateTaarufCard };