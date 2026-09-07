const { createCanvas } = require("@napi-rs/canvas");

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Ikon kue ulang tahun kecil, background transparan, buat dipakai sebagai thumbnail embed.
function generateCakeIcon() {
    const size = 200;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d");

    ctx.save();
    ctx.translate(size / 2, size / 2 + 15);

    // Alas kue
    ctx.fillStyle = "#F5DEB3";
    roundRect(ctx, -75, 25, 150, 55, 10);
    ctx.fill();

    // Frosting bergelombang
    ctx.fillStyle = "#B79BF0";
    ctx.beginPath();
    ctx.moveTo(-75, 25);
    for (let i = -75; i <= 75; i += 15) {
        ctx.quadraticCurveTo(i + 7.5, -2, i + 15, 20);
    }
    ctx.lineTo(75, 25);
    ctx.closePath();
    ctx.fill();

    // Lilin warna-warni
    const candleColors = ["#F5A0C6", "#7C9EF2", "#FFC15E"];
    let ci = 0;
    for (const cx of [-30, 0, 30]) {
        ctx.fillStyle = candleColors[ci % candleColors.length];
        ci++;
        ctx.fillRect(cx - 4, -35, 8, 30);

        // Api lilin
        ctx.beginPath();
        ctx.ellipse(cx, -42, 6, 10, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#FFB84D";
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx, -40, 3, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#FFF3B0";
        ctx.fill();
    }

    ctx.restore();

    return canvas.toBuffer("image/png");
}

module.exports = { generateCakeIcon };