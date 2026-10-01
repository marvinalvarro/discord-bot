const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const path = require("path");

const FONTS_DIR = path.join(__dirname, "fonts");

// Daftar font + alias yang dipakai di card ini.
// Dibungkus try/catch karena font ini kemungkinan udah di-register duluan
// sama taarufCardGenerator.js / birthdayCardGenerator.js pas bot start —
// biar gak error kalau ke-register dobel.
function safeRegisterFont(fileName, alias) {
    try {
        GlobalFonts.registerFromPath(path.join(FONTS_DIR, fileName), alias);
    } catch (err) {
        // Font kemungkinan udah ke-register dari generator lain, aman diabaikan
    }
}

safeRegisterFont("Bevan-Regular.ttf", "Bevan-Regular");
safeRegisterFont("ChakraPetch-Bold.ttf", "ChakraPetch-Bold");

const WIDTH = 900;
const HEIGHT = 500;

async function generateBannedCard(user) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // Background gradient merah gelap
    const bgGradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bgGradient.addColorStop(0, "#1a0000");
    bgGradient.addColorStop(1, "#3d0000");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Ambil avatar user
    const avatarURL = user.displayAvatarURL({ extension: "png", size: 512 });
    const res = await fetch(avatarURL);
    const buffer = Buffer.from(await res.arrayBuffer());
    const avatarImg = await loadImage(buffer);

    // Avatar gede transparan sebagai background dekoratif
    const bgAvatarSize = HEIGHT;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.drawImage(avatarImg, (WIDTH - bgAvatarSize) / 2, 0, bgAvatarSize, bgAvatarSize);
    ctx.restore();

    // Overlay gelap biar teks kebaca jelas
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Avatar bulat kecil di kiri, dikasih border merah
    const smallAvatarSize = 160;
    const avatarX = 130;
    const avatarY = HEIGHT / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, smallAvatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX - smallAvatarSize / 2, avatarY - smallAvatarSize / 2, smallAvatarSize, smallAvatarSize);
    ctx.restore();

    ctx.lineWidth = 6;
    ctx.strokeStyle = "#E74C3C";
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, smallAvatarSize / 2, 0, Math.PI * 2);
    ctx.stroke();

    // Teks "BANNED" diagonal gede, kayak stempel
    ctx.save();
    ctx.translate(WIDTH / 2 + 70, HEIGHT / 2 - 10);
    ctx.rotate(-0.12);
    ctx.textAlign = "center";
    ctx.font = "bold 110px Bevan-Regular";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 8;
    ctx.strokeText("BANNED", 0, 0);
    ctx.fillStyle = "#E74C3C";
    ctx.fillText("BANNED", 0, 0);
    ctx.restore();

    // Username di bawah teks BANNED
    ctx.textAlign = "center";
    ctx.font = "bold 34px ChakraPetch-Bold";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(user.username.toUpperCase(), WIDTH / 2 + 70, HEIGHT / 2 + 85);

    return canvas.toBuffer("image/png");
}

module.exports = { generateBannedCard };