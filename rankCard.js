const { createCanvas, loadImage } = require("@napi-rs/canvas");

const WIDTH = 700;
const HEIGHT = 160;

/**
 * Generate a PNG rank card buffer, compact style (rank + level top-right,
 * username + tag row, thin full-width progress bar).
 * @param {Object} opts
 * @param {string} opts.username - display name
 * @param {string} opts.tag - secondary tag text, e.g. "#2978" or user id snippet
 * @param {string} opts.avatarURL - URL of the user's avatar image
 * @param {number} opts.rank - leaderboard position (1 = top)
 * @param {number} opts.level - current level
 * @param {number} opts.xp - current XP within level
 * @param {number} opts.xpNeeded - XP needed for next level
 * @param {string} opts.accentColor - hex color for ring/bar, e.g. "#3B82F6"
 * @returns {Promise<Buffer>}
 */
async function generateRankCard({ username, tag = "", avatarURL, rank = 1, level = 1, xp = 0, xpNeeded = 100, accentColor = "#3B82F6" }) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#1e1f22";
    roundRect(ctx, 0, 0, WIDTH, HEIGHT, 20);
    ctx.fill();

    // Avatar
    const avatarSize = 100;
    const avatarX = 30;
    const avatarY = (HEIGHT - avatarSize) / 2;

    try {
        const avatarImg = await loadImage(avatarURL);
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
    } catch (err) {
        ctx.fillStyle = "#3a3b3f";
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Avatar ring
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
    ctx.stroke();

    const textLeft = avatarX + avatarSize + 30;
    const rightMargin = 40;

    // RANK X    LEVEL Y (top right)
    ctx.font = "bold 24px sans-serif";
    ctx.fillStyle = "#ffffff";
    const levelText = `LEVEL ${level}`;
    const rankText = `RANK ${rank}`;
    const levelWidth = ctx.measureText(levelText).width;
    const gapWidth = 30;
    const rankWidth = ctx.measureText(rankText).width;

    const levelX = WIDTH - rightMargin - levelWidth;
    const rankX = levelX - gapWidth - rankWidth;

    ctx.fillText(rankText, rankX, 48);
    ctx.fillText(levelText, levelX, 48);

    // Username + tag row
    ctx.font = "bold 30px sans-serif";
    ctx.fillStyle = "#ffffff";
    const usernameY = 90;
    ctx.fillText(truncate(ctx, username, 30, 260), textLeft, usernameY);
    const usernameWidth = ctx.measureText(truncate(ctx, username, 30, 260)).width;

    if (tag) {
        ctx.font = "22px sans-serif";
        ctx.fillStyle = "#8a8d93";
        ctx.fillText(tag, textLeft + usernameWidth + 12, usernameY);
    }

    // XP text (right aligned, same row)
    ctx.font = "22px sans-serif";
    ctx.fillStyle = "#b5bac1";
    const xpText = `${xp} / ${xpNeeded}`;
    const xpWidth = ctx.measureText(xpText).width;
    ctx.fillText(xpText, WIDTH - rightMargin - xpWidth, usernameY);

    // Thin progress bar
    const barX = textLeft;
    const barY = 115;
    const barWidth = WIDTH - rightMargin - textLeft;
    const barHeight = 14;
    const ratio = Math.max(0, Math.min(1, xp / xpNeeded));

    ctx.fillStyle = "#3a3b3f";
    roundRect(ctx, barX, barY, barWidth, barHeight, barHeight / 2);
    ctx.fill();

    if (ratio > 0) {
        ctx.fillStyle = "#ffffff";
        roundRect(ctx, barX, barY, Math.max(barHeight, barWidth * ratio), barHeight, barHeight / 2);
        ctx.fill();
    }

    return canvas.encode("png");
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
}

function truncate(ctx, text, fontSize, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let result = text;
    while (ctx.measureText(result + "…").width > maxWidth && result.length > 0) {
        result = result.slice(0, -1);
    }
    return result + "…";
}

module.exports = { generateRankCard };