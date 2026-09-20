const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const path = require("path");
const fs = require("fs");

// Lokasi yang dicek buat nyari folder fonts / logo.png: di sebelah file ini, satu folder di atasnya,
// dan folder kerja bot. Jadi tetap ketemu walau file ini salah taruh (misal nyasar ke events/).
const SEARCH_DIRS = [__dirname, path.join(__dirname, ".."), process.cwd()];

function findFile(...parts) {
    for (const dir of SEARCH_DIRS) {
        const candidate = path.join(dir, ...parts);
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

console.log("[TaarufCard] File ini dimuat dari:", __dirname, "| versi: sosmed urut IG-Discord-Tiktok");

// Daftarin 1 font + cetak statusnya di Console. Return true kalau berhasil.
function registerFont(fileName, alias) {
    try {
        const fullPath = findFile("fonts", fileName);
        if (!fullPath) {
            console.log(`[TaarufCard] ${fileName}: FILE TIDAK ADA (dicari di folder fonts/ dekat ${__dirname})`);
            return false;
        }
        const sizeKB = (fs.statSync(fullPath).size / 1024).toFixed(1);
        const ok = GlobalFonts.registerFromPath(fullPath, alias);
        console.log(`[TaarufCard] ${fileName} (${sizeKB} KB) -> ${ok ? "OK" : "GAGAL didaftarkan"}`);
        return !!ok;
    } catch (err) {
        console.log(`[TaarufCard] ${fileName}: error ${err.message}`);
        return false;
    }
}

// Font: Bevan (judul + lokasi & umur) dan Chakra Petch Bold (handle sosmed).
// Kalau salah satu gagal load, otomatis pakai sans-serif biasa supaya bot nggak error.
const bevanOk = registerFont("Bevan-Regular.ttf", "Bevan");
const chakraOk = registerFont("ChakraPetch-Bold.ttf", "ChakraPetch");

const TITLE_FONT = bevanOk ? "Bevan" : "sans-serif";
const LOCATION_FONT = bevanOk ? "Bevan" : "sans-serif";
const SOCIAL_FONT = chakraOk ? "ChakraPetch" : "sans-serif";

const BG_COLOR = "#4FE1CA";
const DARK_TEXT = "#0F3D3A";

// Path kotak rounded TANPA beginPath (dipakai buat gabungin 2 path, misal efek bayangan dalam)
function roundRectPath(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h, r);
}

// Lingkaran cahaya lembut (glow) buat hiasan latar
function drawGlow(ctx, cx, cy, radius, color) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

// Kilau 4 titik (sparkle) kecil
function drawSparkle(ctx, cx, cy, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.quadraticCurveTo(size * 0.12, -size * 0.12, size, 0);
    ctx.quadraticCurveTo(size * 0.12, size * 0.12, 0, size);
    ctx.quadraticCurveTo(-size * 0.12, size * 0.12, -size, 0);
    ctx.quadraticCurveTo(-size * 0.12, -size * 0.12, 0, -size);
    ctx.fill();
    ctx.restore();
}

// Latar bermotif: gradasi + cahaya + pola titik + cincin + kilau (bukan warna polos lagi)
function drawBackground(ctx, width, height) {
    // Gradasi dasar (terang di kiri atas -> agak gelap di kanan bawah)
    const base = ctx.createLinearGradient(0, 0, width * 0.6, height);
    base.addColorStop(0, "#86F5E3");
    base.addColorStop(0.45, BG_COLOR);
    base.addColorStop(1, "#2FB9A4");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    // Cahaya lembut
    drawGlow(ctx, 130, 150, 300, "rgba(255,255,255,0.45)");
    drawGlow(ctx, width - 60, 560, 320, "rgba(255,255,255,0.25)");
    drawGlow(ctx, 160, height - 90, 360, "rgba(15,61,58,0.22)");

    // Pola titik-titik halus (selang-seling)
    ctx.fillStyle = "rgba(15,61,58,0.09)";
    for (let row = 0, y = 26; y < height; row++, y += 34) {
        for (let x = row % 2 ? 26 : 9; x < width; x += 34) {
            ctx.beginPath();
            ctx.arc(x, y, 2.1, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Cincin dekorasi
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath(); ctx.arc(width - 40, 90, 95, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(width - 40, 90, 60, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(15,61,58,0.10)";
    ctx.beginPath(); ctx.arc(45, height - 70, 110, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(45, height - 70, 72, 0, Math.PI * 2); ctx.stroke();

    // Kilau kecil
    drawSparkle(ctx, 110, 300, 16, "rgba(255,255,255,0.85)");
    drawSparkle(ctx, width - 105, 330, 22, "rgba(255,255,255,0.8)");
    drawSparkle(ctx, width - 70, 800, 14, "rgba(255,255,255,0.7)");
    drawSparkle(ctx, 80, 760, 20, "rgba(255,255,255,0.75)");
    drawSparkle(ctx, width - 190, 60, 11, "rgba(255,255,255,0.7)");
}

// Bayangan DALAM (inset) supaya foto kelihatan "masuk" ke dalam bingkai
function drawInnerShadow(ctx, x, y, w, h, r, blur, color) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.rect(x - 300, y - 300, w + 600, h + 600);
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fill("evenodd");
    ctx.restore();
}

// Kecilin ukuran font otomatis kalau teksnya kepanjangan (misal nama kota panjang)
function fitFontSize(ctx, text, family, startSize, maxWidth, minSize = 16) {
    let size = startSize;
    ctx.font = `${size}px ${family}`;
    while (ctx.measureText(text).width > maxWidth && size > minSize) {
        size -= 1;
        ctx.font = `${size}px ${family}`;
    }
    return size;
}

// Logo kiri atas: load gambar logo asli Game Verse (file logo.png, sama yang dipakai ktpGenerator.js)
async function drawGameVerseLogo(ctx, x, y) {
    try {
        const logoPath = findFile("logo.png");
        if (!logoPath) throw new Error("logo.png tidak ada di folder bot");
        const logo = await loadImage(logoPath);
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
    // Urutan tampil: Instagram, Discord, Tiktok
    if (ig) socialLines.push(`Instagram: ${ig}`);
    if (discord) socialLines.push(`Discord: ${discord}`);
    if (tiktok) socialLines.push(`Tiktok: ${tiktok}`);

    const width = 800;
    const socialBlockH = socialLines.length > 0 ? 40 * socialLines.length + 24 : 0;
    const height = 1000 + socialBlockH;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Background bermotif (gradasi + cahaya + pola titik + hiasan)
    drawBackground(ctx, width, height);

    // Logo
    await drawGameVerseLogo(ctx, 55, 90);

    // Judul "CV PESERTA TAARUF" (1 baris): bold + huruf renggang (letterSpacing), digeser setengah spasi biar tetap pas tengah
    const titleSpacing = 3;
    ctx.textAlign = "center";
    ctx.fillStyle = DARK_TEXT;
    const titleText = "CV PESERTA TAARUF";
    ctx.letterSpacing = `${titleSpacing}px`;
    fitFontSize(ctx, titleText, TITLE_FONT, 54, width - 150, 24); // otomatis mengecil biar muat 1 baris
    ctx.fillText(titleText, width / 2 + titleSpacing / 2, 235);
    ctx.letterSpacing = "0px";

    // ====== Foto dengan bingkai 3D ======
    const photoW = 420;
    const photoH = 460;
    const photoX = (width - photoW) / 2;
    const photoY = 330;
    const matPad = 22;
    const matX = photoX - matPad;
    const matY = photoY - matPad;
    const matW = photoW + matPad * 2;
    const matH = photoH + matPad * 2;

    // 1) Bayangan besar di bawah bingkai (kesan melayang)
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 48;
    ctx.shadowOffsetY = 34;
    roundRect(ctx, matX, matY, matW, matH, 26);
    ctx.fillStyle = "#1F8F7E";
    ctx.fill();
    ctx.restore();

    // 2) Ketebalan bingkai (sisi bawah lebih gelap) -> efek 3D
    roundRect(ctx, matX, matY + 16, matW, matH, 26);
    ctx.fillStyle = "#1B8878";
    ctx.fill();

    // 3) "Mat" bingkai dengan gradasi terang -> gelap
    const matGrad = ctx.createLinearGradient(matX, matY, matX + matW * 0.4, matY + matH);
    matGrad.addColorStop(0, "#7EF0DE");
    matGrad.addColorStop(1, "#37BFAA");
    roundRect(ctx, matX, matY, matW, matH, 26);
    ctx.fillStyle = matGrad;
    ctx.fill();

    // Pantulan cahaya di tepi atas-kiri mat
    const rimGrad = ctx.createLinearGradient(matX, matY, matX + matW, matY + matH);
    rimGrad.addColorStop(0, "rgba(255,255,255,0.85)");
    rimGrad.addColorStop(0.5, "rgba(255,255,255,0.05)");
    rimGrad.addColorStop(1, "rgba(0,60,50,0.35)");
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = rimGrad;
    roundRect(ctx, matX + 1.25, matY + 1.25, matW - 2.5, matH - 2.5, 25);
    ctx.stroke();

    // 4) Border gelap + ketebalan sendiri
    roundRect(ctx, photoX - 6, photoY - 6 + 9, photoW + 12, photoH + 12, 20);
    ctx.fillStyle = "#04201D";
    ctx.fill();

    const frameGrad = ctx.createLinearGradient(0, photoY - 6, 0, photoY + photoH + 6);
    frameGrad.addColorStop(0, "#1C5A55");
    frameGrad.addColorStop(1, DARK_TEXT);
    roundRect(ctx, photoX - 6, photoY - 6, photoW + 12, photoH + 12, 20);
    ctx.fillStyle = frameGrad;
    ctx.fill();

    // 5) Foto
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

    // 6) Bayangan dalam biar foto kelihatan masuk ke bingkai
    drawInnerShadow(ctx, photoX, photoY, photoW, photoH, 16, 22, "rgba(0,0,0,0.55)");

    // 7) Kilap kaca tipis di pojok kiri atas
    ctx.save();
    roundRect(ctx, photoX, photoY, photoW, photoH, 16);
    ctx.clip();
    const gloss = ctx.createLinearGradient(photoX, photoY, photoX + photoW * 0.75, photoY + photoH * 0.55);
    gloss.addColorStop(0, "rgba(255,255,255,0.22)");
    gloss.addColorStop(0.55, "rgba(255,255,255,0.04)");
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss;
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.restore();

    // ====== Kotak lokasi + umur (efek tombol 3D) ======
    const boxY = photoY + photoH - 45;
    const boxW = photoW - 40;
    const boxH = 80;
    const boxX = (width - boxW) / 2;

    // Ketebalan bawah + bayangan
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 12;
    roundRect(ctx, boxX, boxY + 8, boxW, boxH, 14);
    ctx.fillStyle = "#04201D";
    ctx.fill();
    ctx.restore();

    // Permukaan kotak (gradasi)
    const boxGrad = ctx.createLinearGradient(0, boxY, 0, boxY + boxH);
    boxGrad.addColorStop(0, "#1D5B56");
    boxGrad.addColorStop(1, "#0C3431");
    roundRect(ctx, boxX, boxY, boxW, boxH, 14);
    ctx.fillStyle = boxGrad;
    ctx.fill();

    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    roundRect(ctx, boxX, boxY, boxW, boxH, 14);
    ctx.stroke();

    // Kilap tipis di bagian atas kotak
    ctx.save();
    roundRect(ctx, boxX + 3, boxY + 3, boxW - 6, boxH / 2 - 2, 11);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();
    ctx.restore();

    // Teks lokasi + umur (Bevan), otomatis mengecil kalau kepanjangan
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    fitFontSize(ctx, locationAge, LOCATION_FONT, 36, boxW - 40, 20);
    ctx.fillText(locationAge, width / 2, boxY + boxH / 2 + 12);

    // Handle sosmed di paling bawah, satu baris per platform (Chakra Petch Bold)
    ctx.fillStyle = DARK_TEXT;
    ctx.textAlign = "center";
    let socialY = boxY + boxH + 98; // makin besar angkanya, makin turun (jarak dari kotak lokasi)
    for (const line of socialLines) {
        fitFontSize(ctx, line, SOCIAL_FONT, 30, width - 80, 16);
        ctx.fillText(line, width / 2, socialY);
        socialY += 40;
    }

    return canvas.toBuffer("image/png");
}

module.exports = { generateTaarufCard };