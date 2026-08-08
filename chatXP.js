const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "chatXpData.json");

// ====== KONFIGURASI ======
const XP_MIN = 5;                  // XP minimum per pesan valid
const XP_MAX = 10;                 // XP maksimum per pesan valid
const COOLDOWN_MS = 60 * 1000;     // jeda 60 detik sebelum bisa dapat XP lagi (anti-spam)
const MIN_MESSAGE_LENGTH = 3;      // pesan di bawah ini gak dihitung (misal "ok", "wkwk" masih dihitung, tapi "." "😂" mepet)

// Rumus XP dibutuhkan untuk naik level (sama seperti voice XP, tapi datanya terpisah)
function xpNeededForLevel(level) {
    return 100 + (level - 1) * 50;
}

// Cooldown disimpan di memory aja (reset kalau bot restart, gak masalah)
const cooldowns = new Map();

function loadData() {
    if (!fs.existsSync(DATA_PATH)) {
        fs.writeFileSync(DATA_PATH, JSON.stringify({}, null, 2));
    }
    try {
        return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    } catch (err) {
        console.error("[chatXP] Gagal membaca chatXpData.json:", err);
        return {};
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function getUser(data, userId) {
    if (!data[userId]) {
        data[userId] = { xp: 0, level: 1, messageCount: 0 };
    }
    return data[userId];
}

function addXP(data, userId, amount) {
    const user = getUser(data, userId);
    user.xp += amount;
    user.messageCount += 1;

    let leveledUp = false;
    let needed = xpNeededForLevel(user.level);

    while (user.xp >= needed) {
        user.xp -= needed;
        user.level += 1;
        leveledUp = true;
        needed = xpNeededForLevel(user.level);
    }

    return { leveledUp, newLevel: user.level, user };
}

/**
 * Dipanggil dari events/messageCreate.js untuk tiap pesan yang masuk.
 * Otomatis handle cooldown, nambah XP, dan kirim notif kalau naik level.
 */
function handleChatMessage(message, config = {}) {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (message.content.trim().length < MIN_MESSAGE_LENGTH) return;

    const userId = message.author.id;
    const now = Date.now();
    const lastTime = cooldowns.get(userId) || 0;

    if (now - lastTime < COOLDOWN_MS) return; // masih cooldown, skip

    cooldowns.set(userId, now);

    const data = loadData();
    const amount = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
    const { leveledUp, newLevel } = addXP(data, userId, amount);
    saveData(data);

    if (leveledUp) {
        console.log(`[chatXP] ${message.author.tag} naik ke level chat ${newLevel}`);

        const channelId = config.chatLevelUpChannelId || null;
        const targetChannel = channelId ? message.guild.channels.cache.get(channelId) : message.channel;

        if (targetChannel && targetChannel.isTextBased()) {
            targetChannel
                .send(`💬 <@${userId}> naik ke **Level Chat ${newLevel}** karena aktif ngobrol!`)
                .catch((err) => console.error("[chatXP] Gagal kirim notif level up:", err));
        }
    }
}

module.exports = {
    loadData,
    saveData,
    getUser,
    addXP,
    xpNeededForLevel,
    handleChatMessage,
};