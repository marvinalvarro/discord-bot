const { createCanvas, loadImage } = require("@napi-rs/canvas");
const QRCode = require("qrcode");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Menggambar image dengan mode "cover": rasio aspect gambar dipertahankan,
// bagian yang kelebihan di-crop, mengisi penuh kotak target tanpa distorsi/gepeng.
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

// Pola guilloche sederhana (garis bergelombang halus + lingkaran konsentris tipis)
// buat kesan "kertas sekuriti" khas ID card resmi, tanpa meniru pola KTP asli manapun.
function drawGuillochePattern(ctx, x, y, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.strokeStyle = "rgba(61, 110, 160, 0.10)";
    ctx.lineWidth = 1;

    const waveSpacing = 9;
    const amplitude = 5;
    const wavelength = 40;

    for (let ly = y - amplitude; ly < y + h + amplitude; ly += waveSpacing) {
        ctx.beginPath();
        for (let lx = x; lx <= x + w; lx += 4) {
            const yOff = Math.sin((lx / wavelength) + ly * 0.15) * amplitude;
            if (lx === x) ctx.moveTo(lx, ly + yOff);
            else ctx.lineTo(lx, ly + yOff);
        }
        ctx.stroke();
    }

    // Aksen lingkaran konsentris tipis di kiri & kanan bawah, ala rosette sekuriti
    ctx.strokeStyle = "rgba(61, 110, 160, 0.12)";
    const rosettes = [
        { cx: x + 55, cy: y + h - 55 },
        { cx: x + w - 55, cy: y + h * 0.35 },
    ];
    for (const { cx, cy } of rosettes) {
        for (let r = 6; r < 60; r += 7) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    ctx.restore();
}

// Tanda tangan dekoratif digambar prosedural (bukan tiruan tanda tangan siapapun).
function drawSignatureFlourish(ctx, x, y, w, h, seed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "#1c2b3a";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let s = seed;
    const r = (n) => {
        s = (s * 9301 + 49297) % 233280;
        return (s / 233280) * n;
    };

    ctx.beginPath();
    ctx.moveTo(0, h * 0.6);
    ctx.bezierCurveTo(w * 0.1, r(h * 0.3), w * 0.2, h * 0.9, w * 0.35, h * 0.4);
    ctx.bezierCurveTo(w * 0.42, h * 0.1, w * 0.48, h * 0.1, w * 0.5, h * 0.5);
    ctx.bezierCurveTo(w * 0.55, r(h * 0.6) + h * 0.2, w * 0.6, 0, w * 0.7, h * 0.45);
    ctx.bezierCurveTo(w * 0.78, h * 0.7, w * 0.85, h * 0.2, w * 0.95, h * 0.55);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w * 0.05, h * 0.85);
    ctx.lineTo(w * 0.9, h * 0.8);
    ctx.stroke();

    ctx.restore();
}

async function generateKTPImage({
    noKTP,
    nama,
    ttl,
    jk,
    golda,
    alamat,
    kelDesa,
    kecamatan,
    agama,
    statusKawin,
    pekerjaan,
    kewarganegaraan = "WNI",
    berlakuHingga = "SELAMA JADI MEMBER SERVER",
    avatarURL,
    userId,
}) {
    const cardW = 800;
    const cardH = 620;
    const pad = 15;
    const width = cardW + pad * 2;
    const height = cardH + pad * 2;
    const radius = 12;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // ===== Shadow kartu =====
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#000000";
    roundRect(ctx, pad, pad, cardW, cardH, radius);
    ctx.fill();
    ctx.restore();

    // ===== Clip ke bentuk kartu =====
    ctx.save();
    roundRect(ctx, pad, pad, cardW, cardH, radius);
    ctx.clip();
    ctx.translate(pad, pad);

    const headerH = 78;
    const textColor = "#1c2b3a";
    const lineColor = "rgba(28, 43, 58, 0.35)";

    // ===== Background terang (kertas sekuriti) =====
    const bgGradient = ctx.createLinearGradient(0, headerH, 0, cardH);
    bgGradient.addColorStop(0, "#f3f6fa");
    bgGradient.addColorStop(1, "#e4ebf2");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, headerH, cardW, cardH - headerH);

    drawGuillochePattern(ctx, 0, headerH, cardW, cardH - headerH);

    // Watermark diagonal (halus, abu-abu)
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = "#3d6ea0";
    ctx.font = "bold 70px sans-serif";
    ctx.textAlign = "center";
    ctx.translate(cardW / 2, cardH / 2 + 30);
    ctx.rotate(-0.35);
    ctx.fillText("GAME VERSE", 0, 0);
    ctx.restore();
    ctx.textAlign = "left";

    // ===== Header (tetap gelap, kontras) =====
    ctx.fillStyle = "#243447";
    ctx.fillRect(0, 0, cardW, headerH);

    try {
        const rawLogoBuffer = fs.readFileSync(path.join(__dirname, "logo.png"));
        const cleanLogoBuffer = await sharp(rawLogoBuffer).toFormat("png").toBuffer();
        const logo = await loadImage(cleanLogoBuffer);
        const logoSize = 56;
        ctx.drawImage(logo, 20, headerH / 2 - logoSize / 2, logoSize, logoSize);
    } catch (err) {
        console.log("[KTP] Logo tidak ditemukan, dilewati:", err.message);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 26px serif";
    ctx.fillText("KARTU TANDA PENDUDUK", cardW / 2, 32);

    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cardW / 2 - 85, 41);
    ctx.lineTo(cardW / 2 + 85, 41);
    ctx.stroke();

    ctx.font = "bold 21px sans-serif";
    ctx.fillText("GAME VERSE", cardW / 2, 63);
    ctx.textAlign = "left";

    // ===== No KTP =====
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, headerH + 22);
    ctx.lineTo(cardW, headerH + 22);
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = "bold 19px sans-serif";
    ctx.fillText(`No. KTP : ${noKTP}`, 30, headerH + 46);

    ctx.beginPath();
    ctx.moveTo(0, headerH + 57);
    ctx.lineTo(cardW, headerH + 57);
    ctx.stroke();

    // ===== Data fields =====
    const fields = [
        ["Nama", nama],
        ["Tempat/Tgl Lahir", ttl],
        ["Jenis Kelamin", jk],
        ["Alamat", alamat],
        ["Kel/Desa", kelDesa],
        ["Kecamatan", kecamatan],
        ["Agama", agama],
        ["Status Perkawinan", statusKawin],
        ["Pekerjaan", pekerjaan],
        ["Kewarganegaraan", kewarganegaraan],
        ["Berlaku Hingga", berlakuHingga],
    ];

    const labelX = 30;
    const colonX = 195;
    const valueX = 212;
    const rowHeight = 33;

    const label2X = 440;
    const colon2X = 548;
    const value2X = 562;

    let y = headerH + 88;
    for (const row of fields) {
        const [label, value, label2, value2] = row;

        ctx.fillStyle = textColor;
        ctx.font = "15px sans-serif";
        ctx.fillText(label, labelX, y);
        ctx.fillText(":", colonX, y);

        ctx.font = "bold 15px sans-serif";
        ctx.fillText(value ?? "-", valueX, y);

        if (label2) {
            ctx.font = "15px sans-serif";
            ctx.fillText(label2, label2X, y);
            ctx.fillText(":", colon2X, y);

            ctx.font = "bold 15px sans-serif";
            ctx.fillText(value2 ?? "-", value2X, y);
        }

        y += rowHeight;
    }

    // ===== Foto (portrait, lebih tinggi, sejajar blok data atas-tengah) =====
    const photoW = 142;
    const photoH = 178;
    const photoX = cardW - photoW - 42;
    const photoY = headerH + 66;

    try {
        const avatar = await loadImage(avatarURL);
        const pr = 3;

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.25)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = "#FFFFFF";
        roundRect(ctx, photoX - 3, photoY - 3, photoW + 6, photoH + 6, pr + 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        roundRect(ctx, photoX, photoY, photoW, photoH, pr);
        ctx.clip();
        drawImageCover(ctx, avatar, photoX, photoY, photoW, photoH);
        ctx.restore();
    } catch (err) {
        console.log("[KTP] Gagal load avatar:", err.message);
    }

    // Caption kota + tanggal tepat di bawah foto
    const tanggalSingkat = new Date().toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });

    ctx.fillStyle = textColor;
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GAME VERSE", photoX + photoW / 2, photoY + photoH + 20);
    ctx.font = "12px sans-serif";
    ctx.fillText(tanggalSingkat, photoX + photoW / 2, photoY + photoH + 36);
    ctx.textAlign = "left";

    // Tanda tangan, nempel tepat di bawah caption (dekat foto)
    let seedNum = 0;
    for (const ch of (userId || nama || "x")) seedNum += ch.charCodeAt(0);
    drawSignatureFlourish(
        ctx,
        photoX + photoW / 2 - 65,
        photoY + photoH + 42,
        130,
        32,
        seedNum || 1
    );

    // ===== QR Code (tetap dipertahankan, kiri bawah) =====
    try {
        const qrTarget = userId
            ? `https://discord.com/users/${userId}`
            : "https://discord.com";

        const qrBuffer = await QRCode.toBuffer(qrTarget, {
            width: 70,
            margin: 0,
            color: { dark: "#243447", light: "#FFFFFFFF" },
        });
        const qrImage = await loadImage(qrBuffer);

        const qrSize = 70;
        const qrX = 30;
        const qrY = cardH - qrSize - 18;

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = 6;
        ctx.fillStyle = "#FFFFFF";
        roundRect(ctx, qrX - 5, qrY - 5, qrSize + 10, qrSize + 10, 4);
        ctx.fill();
        ctx.restore();
        ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
    } catch (err) {
        console.log("[KTP] Gagal generate QR code:", err.message);
    }

    ctx.restore();

    // ===== Border tipis di tepi kartu =====
    ctx.strokeStyle = "rgba(28, 43, 58, 0.4)";
    ctx.lineWidth = 1;
    roundRect(ctx, pad + 0.5, pad + 0.5, cardW - 1, cardH - 1, radius);
    ctx.stroke();

    return canvas.toBuffer("image/png");
}

module.exports = { generateKTPImage };