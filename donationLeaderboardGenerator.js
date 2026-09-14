const { createCanvas, GlobalFonts, loadImage } = require("@napi-rs/canvas");
const path = require("path");

try {
    GlobalFonts.registerFromPath(path.join(__dirname, "fonts", "Quicksand-Variable.ttf"), "Quicksand");
} catch (err) {
    console.log("[DonationCard] Gagal load font Quicksand:", err.message);
}

const FONT = "Quicksand";
// Taruh file logo di sini: <folder ini>/assets/gameverse_logo.png
const LOGO_PATH = path.join(__dirname, "assets", "gameverse_logo.png");

function roundRectTop(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
}

function truncateName(name, max = 14) {
    if (!name) return "";
    return name.length > max ? name.slice(0, max) + "…" : name;
}

function formatRupiah(amount) {
    return "Rp " + amount.toLocaleString("id-ID");
}

// Tekstur kertas kusut ala low-poly: canvas dibagi jadi grid segitiga,
// tiap segitiga dikasih shading acak (lebih terang/gelap dikit) biar kayak bidang kertas terlipat.
function drawPaperBackground(ctx, width, height) {
    let seed = 42;
    function rand() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    }

    const DARK = [8, 120, 145];
    const LIGHT = [58, 214, 227];

    function shade(factor) {
        const t = (factor + 1) / 2; // factor -1..1 -> t 0..1
        const r = Math.round(DARK[0] + (LIGHT[0] - DARK[0]) * t);
        const g = Math.round(DARK[1] + (LIGHT[1] - DARK[1]) * t);
        const b = Math.round(DARK[2] + (LIGHT[2] - DARK[2]) * t);
        return `rgb(${r},${g},${b})`;
    }

    const cell = 85;
    const jitter = cell * 0.4;
    const cols = Math.ceil(width / cell) + 2;
    const rows = Math.ceil(height / cell) + 2;

    const pts = [];
    for (let gy = 0; gy <= rows; gy++) {
        pts[gy] = [];
        for (let gx = 0; gx <= cols; gx++) {
            pts[gy][gx] = {
                x: gx * cell - cell + (rand() - 0.5) * jitter,
                y: gy * cell - cell + (rand() - 0.5) * jitter,
            };
        }
    }

    ctx.save();
    for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
            const p00 = pts[gy][gx];
            const p10 = pts[gy][gx + 1];
            const p01 = pts[gy + 1][gx];
            const p11 = pts[gy + 1][gx + 1];

            // arah "cahaya" nyamar dari kiri-atas: makin ke kanan-bawah facet, makin gelap dikit
            const lightBias = (gx / cols + gy / rows) * 0.4;

            ctx.beginPath();
            ctx.moveTo(p00.x, p00.y);
            ctx.lineTo(p10.x, p10.y);
            ctx.lineTo(p01.x, p01.y);
            ctx.closePath();
            ctx.fillStyle = shade((rand() - 0.5) * 1.3 - lightBias);
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(p10.x, p10.y);
            ctx.lineTo(p11.x, p11.y);
            ctx.lineTo(p01.x, p01.y);
            ctx.closePath();
            ctx.fillStyle = shade((rand() - 0.5) * 1.3 - lightBias);
            ctx.fill();
        }
    }
    ctx.restore();

    // vignette halus biar tengah lebih fokus
    const vg = ctx.createRadialGradient(width / 2, height * 0.4, height * 0.2, width / 2, height * 0.4, width * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,20,25,0.25)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, width, height);
}

// Coretan cat putih di bagian bawah (dekorasi seperti referensi)
function drawPaintSmear(ctx, width, y, height) {
    let seed = 7;
    function rand() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    }

    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.moveTo(0, y + height);
    ctx.lineTo(0, y + 30);
    let cx = 0;
    while (cx < width) {
        const step = 40 + rand() * 60;
        const ny = y + rand() * height * 0.6;
        ctx.quadraticCurveTo(cx + step / 2, ny, cx + step, y + 20 + rand() * 20);
        cx += step;
    }
    ctx.lineTo(width, y + height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawCrown(ctx, x, y, size, color, rotationDeg = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rotationDeg * Math.PI) / 180);

    const bandTop = size * 0.2;
    const bandBottom = size * 0.62;

    // badan mahkota lancip 3 ujung, SOLID (base band nyambung penuh, gak ada celah/lubang)
    ctx.beginPath();
    ctx.moveTo(-size, bandBottom);
    ctx.lineTo(-size, bandTop);
    ctx.lineTo(-size * 0.66, -size * 0.5);
    ctx.lineTo(-size * 0.33, bandTop);
    ctx.lineTo(0, -size * 0.82);
    ctx.lineTo(size * 0.33, bandTop);
    ctx.lineTo(size * 0.66, -size * 0.5);
    ctx.lineTo(size, bandTop);
    ctx.lineTo(size, bandBottom);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, -size, 0, bandBottom);
    grad.addColorStop(0, "#FFE9A8");
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, "#D98F1E");
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = "rgba(150,90,0,0.4)";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    // garis highlight tipis di pita bawah biar kesan metalik
    ctx.beginPath();
    ctx.moveTo(-size + 6, bandBottom - size * 0.12);
    ctx.lineTo(size - 6, bandBottom - size * 0.12);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // permata cuma di tengah, gak ada di ujung-ujung lancip
    ctx.beginPath();
    ctx.arc(0, (bandTop + bandBottom) / 2, size * 0.11, 0, Math.PI * 2);
    ctx.fillStyle = "#E8482A";
    ctx.fill();

    ctx.restore();
}

async function drawAvatarCircle(ctx, x, y, radius, avatarURL, fallbackLetter, ringColor, ringWidth) {
    let loaded = false;

    if (avatarURL) {
        try {
            const img = await loadImage(avatarURL);
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
            ctx.restore();
            loaded = true;
        } catch (err) {
            loaded = false;
        }
    }

    if (!loaded) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `800 ${radius}px ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((fallbackLetter || "?").toUpperCase(), x, y + 2);
        ctx.textBaseline = "alphabetic";
        ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = ringWidth;
    ctx.stroke();
    ctx.restore();
}

function drawPodiumBlock(ctx, x, y, w, h, name, amount, color, colorDark, textColor) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    roundRectTop(ctx, x, y, w, h, 14);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    // gradient tipis biar blok gak keliatan flat
    roundRectTop(ctx, x, y, w, h, 14);
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, color);
    grad.addColorStop(1, colorDark);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.textAlign = "center";
    ctx.fillStyle = textColor;
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText(`@${truncateName(name, 14)}`, x + w / 2, y + 42);

    ctx.font = `800 20px ${FONT}`;
    ctx.fillText(formatRupiah(amount), x + w / 2, y + 72);
}

async function generateDonationLeaderboard({ monthLabel, entries, total, serverName = "GAME VERSE" }) {
    const width = 1000;
    const height = 622;

    const top3 = entries.slice(0, 3);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    drawPaperBackground(ctx, width, height);

    // Logo pojok kanan atas
    try {
        const logo = await loadImage(LOGO_PATH);
        const logoW = 120;
        const logoH = logoW * (logo.height / logo.width);
        ctx.drawImage(logo, width - logoW - 30, 25, logoW, logoH);
    } catch (err) {
        // logo opsional, kalau gak ada ya skip aja
    }

    // ===== Podium: kiri = rank2, tengah = rank1, kanan = rank3 =====
    const blockW = 230;
    const gap = 24;
    const totalW = blockW * 3 + gap * 2;
    const marginX = (width - totalW) / 2;
    const bottomY = height - 90;

    const columns = [
        { entryIndex: 1, x: marginX, blockH: 230, radius: 52, color: "#E4E4E4", colorDark: "#B9B9B9", textColor: "#2B2B2B" },
        { entryIndex: 0, x: marginX + blockW + gap, blockH: 320, radius: 58, color: "#F8B25E", colorDark: "#E08A2E", textColor: "#3A2100" },
        { entryIndex: 2, x: marginX + (blockW + gap) * 2, blockH: 190, radius: 48, color: "#F0821E", colorDark: "#C4600E", textColor: "#FFF3E4" },
    ];

    for (const col of columns) {
        const entry = top3[col.entryIndex];
        if (!entry) continue;

        const blockTop = bottomY - col.blockH;
        // blok digambar sampai bener-bener ke bawah canvas (biar gak ada celah sebelum coretan cat)
        drawPodiumBlock(ctx, col.x, blockTop, blockW, height - blockTop, entry.name, entry.amount, col.color, col.colorDark, col.textColor);

        const cx = col.x + blockW / 2;
        const avatarCy = blockTop - col.radius - 34;

        if (col.entryIndex === 0) {
            drawCrown(ctx, cx + col.radius * 0.85, avatarCy - col.radius * 1.3, 28, "#FFC94A", 22);
        }

        await drawAvatarCircle(ctx, cx, avatarCy, col.radius, entry.avatarURL, entry.name.charAt(0), "#FFD54A", 6);
    }

    // Coretan cat putih di bawah
    drawPaintSmear(ctx, width, bottomY, 90);

    // Judul kecil + total di area putih bawah
    ctx.textAlign = "center";
    ctx.fillStyle = "#0F9EBD";
    ctx.font = `800 15px ${FONT}`;
    ctx.fillText(`TOP DONATUR ${serverName.toUpperCase()} - ${monthLabel.toUpperCase()} | TOTAL ${formatRupiah(total)}`, width / 2, height - 20);

    return canvas.toBuffer("image/png");
}

module.exports = { generateDonationLeaderboard };