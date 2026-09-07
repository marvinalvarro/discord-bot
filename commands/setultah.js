const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const path = require("path");

// Font yang sama kayak kartu ucapan, biar konsisten 1 tema visual
try {
    GlobalFonts.registerFromPath(path.join(__dirname, "fonts", "Quicksand-Variable.ttf"), "Quicksand");
} catch (err) {
    console.log("[SetultahCard] Gagal load font Quicksand:", err.message);
}

const FONT = "Quicksand";

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
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

// Titik-titik confetti kecil, warna biru/teal biar beda dari kartu ucapan (pink/kuning)
function drawConfetti(ctx, w, h, seed) {
    const colors = ["#8ECDF5", "#A0E8C8", "#B8A8F0", "#F5D77E"];
    let s = seed;
    const r = (n) => {
        s = (s * 9301 + 49297) % 233280;
        return (s / 233280) * n;
    };

    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 30; i++) {
        const x = r(w);
        const y = r(h);
        const size = 3 + r(5);
        ctx.fillStyle = colors[Math.floor(r(colors.length))];
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// Ikon kalender sederhana
function drawCalendarIcon(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);

    // Body kalender
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, -size / 2, -size / 2, size, size, size * 0.12);
    ctx.fill();
    ctx.strokeStyle = "#4C6EF5";
    ctx.lineWidth = size * 0.05;
    roundRect(ctx, -size / 2, -size / 2, size, size, size * 0.12);
    ctx.stroke();

    // Header kalender
    ctx.fillStyle = "#4C6EF5";
    roundRect(ctx, -size / 2, -size / 2, size, size * 0.28, size * 0.12);
    ctx.fill();
    ctx.fillRect(-size / 2, -size / 2 + size * 0.14, size, size * 0.14);

    // Ring gantungan
    ctx.fillStyle = "#364FC7";
    for (const dx of [-size * 0.22, size * 0.22]) {
        ctx.beginPath();
        ctx.roundRect(dx - size * 0.04, -size / 2 - size * 0.08, size * 0.08, size * 0.18, size * 0.03);
        ctx.fill();
    }

    // Ikon kue mini di tengah kalender (gambar manual, bukan emoji)
    const cakeScale = size * 0.16;
    ctx.save();
    ctx.translate(0, size * 0.08);
    ctx.fillStyle = "#F5A0C6";
    roundRect(ctx, -cakeScale * 1.3, -cakeScale * 0.2, cakeScale * 2.6, cakeScale * 1.4, cakeScale * 0.3);
    ctx.fill();
    ctx.fillStyle = "#4C6EF5";
    ctx.fillRect(-cakeScale * 0.15, -cakeScale * 1.2, cakeScale * 0.3, cakeScale);
    ctx.beginPath();
    ctx.ellipse(0, -cakeScale * 1.3, cakeScale * 0.22, cakeScale * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#FFB84D";
    ctx.fill();
    ctx.restore();

    ctx.restore();
}

function drawNumberBadge(ctx, x, y, size, number, color) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 ${size * 1.1}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(number), x, y + 2);
    ctx.textBaseline = "alphabetic";
    ctx.restore();
}

function generateSetultahCard() {
    const width = 900;
    const height = 700;
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

    // ===== Background gradient biru-teal (beda dari kartu ucapan yang pink-kuning) =====
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "#E8F4FF");
    bg.addColorStop(0.5, "#F0FBF6");
    bg.addColorStop(1, "#EFF0FF");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    drawConfetti(ctx, width, height, 42);

    // ===== Header: ikon kalender + judul =====
    drawCalendarIcon(ctx, width / 2, 95, 110);

    ctx.textAlign = "center";
    ctx.fillStyle = "#4C6EF5";
    ctx.font = `700 52px ${FONT}`;
    ctx.fillText("Daftar Ulang Tahun Kamu", width / 2, 205);

    ctx.strokeStyle = "rgba(76, 110, 245, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 180, 224);
    ctx.lineTo(width / 2 + 180, 224);
    ctx.stroke();

    ctx.font = `600 23px ${FONT}`;
    ctx.fillStyle = "#4A4F58";
    ctx.fillText("Daftarin sekali aja, biar bot yang inget-inget buat kamu tiap tahun!", width / 2, 260);

    drawSparkle(ctx, width / 2 - 220, 100, 12, "#F5D77E");
    drawSparkle(ctx, width / 2 + 220, 110, 10, "#B8A8F0");

    // ===== Langkah-langkah =====
    const stepsX = 100;
    let stepY = 330;
    const steps = [
        "Klik tombol \"Daftar Ulang Tahun\" di bawah poster ini",
        "Isi tanggal lahir kamu di form yang muncul",
        "Selesai! Bot bakal otomatis ngucapin pas hari-H tiba",
    ];

    ctx.textAlign = "left";
    steps.forEach((step, i) => {
        const colors = ["#4C6EF5", "#40C4AA", "#F5A05A"];
        drawNumberBadge(ctx, stepsX, stepY, 26, i + 1, colors[i]);

        ctx.fillStyle = "#2E2E2E";
        ctx.font = `600 24px ${FONT}`;
        ctx.fillText(step, stepsX + 48, stepY + 8);

        stepY += 72;
    });

    // ===== Kotak format tanggal =====
    const boxY = stepY + 15;
    const boxW = width - 160;
    const boxX = (width - boxW) / 2;
    const boxH = 120;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.08)";
    ctx.shadowBlur = 10;
    roundRect(ctx, boxX, boxY, boxW, boxH, 16);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.restore();

    ctx.textAlign = "center";
    ctx.fillStyle = "#5C6470";
    ctx.font = `700 19px ${FONT}`;
    ctx.fillText("FORMAT TANGGAL", width / 2, boxY + 36);

    ctx.fillStyle = "#4C6EF5";
    ctx.font = `700 38px ${FONT}`;
    ctx.fillText("DD - MM - YYYY", width / 2, boxY + 78);

    ctx.fillStyle = "#8A8F99";
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText("contoh: 17-08-2005", width / 2, boxY + 100);

    ctx.restore();

    // ===== Border tipis =====
    ctx.strokeStyle = "rgba(76, 110, 245, 0.2)";
    ctx.lineWidth = 2;
    roundRect(ctx, 1, 1, width - 2, height - 2, radius);
    ctx.stroke();

    return canvas.toBuffer("image/png");
}

module.exports = { generateSetultahCard };