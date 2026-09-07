const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const path = require("path");

// ===============================
// DAFTARKAN FONT
// Taruh 2 file font ini di folder "fonts/" (sejajar file ini):
// - Quicksand-Variable.ttf   -> buat teks biasa
// - DancingScript-Variable.ttf -> buat nama (gaya cursive)
// ===============================
try {
    GlobalFonts.registerFromPath(path.join(__dirname, "fonts", "Quicksand-Variable.ttf"), "Quicksand");
} catch (err) {
    console.log("[BirthdayCard] Gagal load font Quicksand:", err.message);
}
try {
    GlobalFonts.registerFromPath(path.join(__dirname, "fonts", "DancingScript-Variable.ttf"), "Dancing Script");
} catch (err) {
    console.log("[BirthdayCard] Gagal load font Dancing Script:", err.message);
}

const FONT = "Quicksand";
const FONT_CURSIVE = "Dancing Script";

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
    const paragraphs = text.split("\n");
    const lines = [];
    for (const paragraph of paragraphs) {
        const words = paragraph.split(" ");
        let currentLine = words[0] || "";
        for (let i = 1; i < words.length; i++) {
            const testLine = `${currentLine} ${words[i]}`;
            if (ctx.measureText(testLine).width < maxWidth) {
                currentLine = testLine;
            } else {
                lines.push(currentLine);
                currentLine = words[i];
            }
        }
        lines.push(currentLine);
    }
    return lines;
}

// Bingkai foto bentuk bergelombang (scalloped), dibikin dari lingkaran + benjolan di tepinya
function scallopFramePath(ctx, cx, cy, radius, bumps, bumpSize) {
    ctx.beginPath();
    const steps = bumps * 2;
    for (let i = 0; i <= steps; i++) {
        const angle = (Math.PI * 2 * i) / steps;
        const r = radius + (i % 2 === 0 ? bumpSize : -bumpSize * 0.2);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
}

// 1 balon (oval + highlight + tali)
function drawBalloon(ctx, x, y, size, color, stringLength) {
    ctx.save();
    ctx.translate(x, y);

    // Tali
    ctx.strokeStyle = "rgba(120,120,120,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.9);
    ctx.quadraticCurveTo(size * 0.3, size * 0.9 + stringLength * 0.5, 0, size * 0.9 + stringLength);
    ctx.stroke();

    // Badan balon
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.75, size, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.ellipse(-size * 0.22, -size * 0.35, size * 0.18, size * 0.28, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fill();

    // Simpul kecil
    ctx.beginPath();
    ctx.moveTo(-size * 0.08, size * 0.95);
    ctx.lineTo(size * 0.08, size * 0.95);
    ctx.lineTo(0, size * 1.08);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
}

// Beberapa balon dikumpulin jadi 1 gerombol di pojok
function drawBalloonCluster(ctx, x, y, colors) {
    const offsets = [
        { dx: -18, dy: 10, s: 34 },
        { dx: 15, dy: -5, s: 40 },
        { dx: 40, dy: 18, s: 30 },
        { dx: -2, dy: -30, s: 28 },
    ];
    offsets.forEach((o, i) => {
        drawBalloon(ctx, x + o.dx, y + o.dy, o.s, colors[i % colors.length], 40);
    });
}

// Banner bendera kecil-kecil melengkung di atas
function drawBunting(ctx, width, topY, colors) {
    const flagCount = 11;
    const startX = width * 0.12;
    const endX = width * 0.88;
    const spacing = (endX - startX) / (flagCount - 1);
    const sag = 26; // seberapa "melorot" talinya di tengah

    // Tali
    ctx.strokeStyle = "#5C7CFA";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const x = startX + (endX - startX) * t;
        const y = topY + Math.sin(t * Math.PI) * sag;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Bendera
    const flagW = 34;
    const flagH = 44;
    for (let i = 0; i < flagCount; i++) {
        const t = i / (flagCount - 1);
        const x = startX + (endX - startX) * t;
        const y = topY + Math.sin(t * Math.PI) * sag;
        const angle = Math.atan2(
            Math.cos((t + 0.01) * Math.PI) * sag - Math.cos(t * Math.PI) * sag,
            spacing
        ) * 0.3;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-flagW / 2, 0);
        ctx.lineTo(flagW / 2, 0);
        ctx.lineTo(0, flagH);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        ctx.restore();
    }
}

// Sepotong kue ulang tahun sederhana (flat design) di pojok kiri bawah
function drawCakeDoodle(ctx, x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Alas kue
    ctx.fillStyle = "#F5DEB3";
    roundRect(ctx, -70, 30, 140, 55, 10);
    ctx.fill();

    // Body atas (frosting)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-70, 30);
    for (let i = -70; i <= 70; i += 14) {
        ctx.quadraticCurveTo(i + 7, 4, i + 14, 20);
    }
    ctx.lineTo(70, 30);
    ctx.closePath();
    ctx.fill();

    // Lilin
    const candleColors = ["#F5A0C6", "#7C9EF2", "#8ED6A8"];
    let ci = 0;
    for (const cx of [-30, 0, 30]) {
        ctx.fillStyle = candleColors[ci % candleColors.length];
        ci++;
        ctx.fillRect(cx - 3, -35, 6, 30);
        ctx.beginPath();
        ctx.ellipse(cx, -40, 5, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#FFB84D";
        ctx.fill();
    }

    ctx.restore();
}

// Bintang bersinar kecil (dekorasi)
function drawSparkle(ctx, x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.quadraticCurveTo(size * 0.15, -size * 0.15, size, 0);
    ctx.quadraticCurveTo(size * 0.15, size * 0.15, 0, size);
    ctx.quadraticCurveTo(-size * 0.15, size * 0.15, -size, 0);
    ctx.quadraticCurveTo(-size * 0.15, -size * 0.15, 0, -size);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

async function generateBirthdayCard({ username, avatarURL, message, userId, fromText = "Dari seluruh warga Game Verse" }) {
    const width = 940;
    const height = 620;
    const radius = 22;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // ===== Shadow luar =====
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#000000";
    roundRect(ctx, 0, 0, width, height, radius);
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRect(ctx, 0, 0, width, height, radius);
    ctx.clip();

    // ===== Background putih =====
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);

    let seedNum = 0;
    for (const ch of (userId || username || "x")) seedNum += ch.charCodeAt(0);

    const palette = ["#F5A0C6", "#7C9EF2", "#FFC15E", "#8ED6A8", "#B79BF0"];

    // ===== Banner bunting di atas =====
    drawBunting(ctx, width, 28, palette);

    // ===== Balon pojok kiri atas & kanan atas =====
    drawBalloonCluster(ctx, 65, 95, ["#7C9EF2", "#F5A0C6", "#B79BF0", "#FFC15E"]);
    drawBalloonCluster(ctx, width - 70, 100, ["#B79BF0", "#FFC15E", "#7C9EF2"]);

    // ===== Sparkle dekorasi =====
    drawSparkle(ctx, width - 130, height / 2 - 20, 14, "#FFC15E");
    drawSparkle(ctx, 60, height - 90, 12, "#7C9EF2");
    drawSparkle(ctx, width - 60, height - 200, 10, "#F5A0C6");

    // ===== Kue doodle pojok kiri bawah =====
    drawCakeDoodle(ctx, 105, height - 90, 1.15, "#B79BF0");

    // ===== Foto profil bingkai bergelombang =====
    const frameCx = width * 0.27;
    const frameCy = height * 0.48;
    const frameR = 155;

    try {
        const avatar = await loadImage(avatarURL);

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = 18;
        scallopFramePath(ctx, frameCx, frameCy, frameR, 14, 12);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.restore();

        ctx.save();
        scallopFramePath(ctx, frameCx, frameCy, frameR - 8, 14, 11);
        ctx.clip();
        const s = (frameR * 2.1);
        ctx.drawImage(avatar, frameCx - s / 2, frameCy - s / 2, s, s);
        ctx.restore();
    } catch (err) {
        console.log("[BirthdayCard] Gagal load avatar:", err.message);
    }

    // ===== Teks di sisi kanan =====
    const textX = width * 0.53;
    let ty = 175;

    ctx.textAlign = "left";
    ctx.fillStyle = "#6C63C7";
    ctx.font = `700 24px ${FONT}`;
    ctx.save();
    ctx.letterSpacing = "2px";
    ctx.fillText("SELAMAT ULANG TAHUN!", textX, ty);
    ctx.restore();

    ty += 70;
    ctx.fillStyle = "#7C6FE0";
    ctx.font = `700 58px "${FONT_CURSIVE}"`;
    ctx.fillText(username, textX, ty);

    ty += 55;
    ctx.fillStyle = "#4A4A4A";
    ctx.font = `500 17px ${FONT}`;
    const maxTextWidth = width - textX - 60;
    const lines = wrapText(ctx, message, maxTextWidth);
    for (const line of lines) {
        ty += 27;
        ctx.fillText(line, textX, ty);
    }

    // ===== Pill button "Dari ..." =====
    ty += 55;
    ctx.font = `700 16px ${FONT}`;
    const pillPaddingX = 28;
    const pillText = fromText;
    const pillTextWidth = ctx.measureText(pillText).width;
    const pillW = pillTextWidth + pillPaddingX * 2;
    const pillH = 48;
    const pillX = textX;
    const pillY = ty;

    ctx.save();
    ctx.shadowColor = "rgba(124,111,224,0.35)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = "#7C6FE0";
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText(pillText, pillX + pillPaddingX, pillY + pillH / 2 + 6);

    ctx.restore();

    // ===== Border tipis =====
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 2;
    roundRect(ctx, 1, 1, width - 2, height - 2, radius);
    ctx.stroke();

    return canvas.toBuffer("image/png");
}

module.exports = { generateBirthdayCard };