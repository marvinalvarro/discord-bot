const fs = require("fs");
const path = require("path");
const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { generateRankCard } = require("./rankCard");
const { CHAT_TIERS, syncMemberRole } = require("./rankRoles");

const DATA_PATH = path.join(__dirname, "chatXpData.json");

// ====== KONFIGURASI ======
const XP_MIN = 5;
const XP_MAX = 10;
const COOLDOWN_MS = 60 * 1000;
const MIN_MESSAGE_LENGTH = 3;

const EMBED_COLOR = 0x9B59B6;
const ACCENT_HEX = "#9B59B6";

function xpNeededForLevel(level) {
    return 100 + (level - 1) * 50;
}

function getLeaderboardRank(data, userId) {
    const sorted = Object.entries(data).sort(
        ([, a], [, b]) => b.level - a.level || b.xp - a.xp
    );
    const index = sorted.findIndex(([id]) => id === userId);
    return index === -1 ? sorted.length : index + 1;
}

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

async function sendLevelUpCard(channel, author, newLevel, user, rank) {
    const needed = xpNeededForLevel(newLevel);

    const buffer = await generateRankCard({
        username: author.username,
        avatarURL: author.displayAvatarURL({ extension: "png", size: 256 }),
        rank,
        level: newLevel,
        xp: user.xp,
        xpNeeded: needed,
        type: "CHAT",
        accentColor: ACCENT_HEX,
    });

    const attachment = new AttachmentBuilder(buffer, { name: "levelup-chat.png" });

    const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setDescription(`💬 <@${author.id}> naik ke **Level Chat ${newLevel}** karena aktif ngobrol!`)
        .setImage("attachment://levelup-chat.png");

    channel.send({ embeds: [embed], files: [attachment] }).catch((err) =>
        console.error("[chatXP] Gagal kirim notif level up:", err)
    );
}

// Cari channel/thread tujuan notif level-up. Coba dari cache dulu (cepat),
// kalau gak ketemu (misal thread forum yang belum pernah "keliatan" bot sejak nyala),
// baru fetch langsung ke API Discord. Ini buat nutup celah bug: channels.cache.get()
// doang bisa diem-diem gagal tanpa error kalau channel/thread-nya belum ke-cache.
async function resolveTargetChannel(guild, channelId, fallbackChannel) {
    if (!channelId) return fallbackChannel;

    let channel = guild.channels.cache.get(channelId) || null;
    if (!channel) {
        try {
            channel = await guild.channels.fetch(channelId);
        } catch (err) {
            console.error(`[chatXP] Gagal fetch channel level up (ID: ${channelId}):`, err.message);
            return null;
        }
    }
    return channel;
}

function handleChatMessage(message, config = {}) {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (message.content.trim().length < MIN_MESSAGE_LENGTH) return;

    const userId = message.author.id;
    const now = Date.now();
    const lastTime = cooldowns.get(userId) || 0;

    if (now - lastTime < COOLDOWN_MS) return;

    cooldowns.set(userId, now);

    const data = loadData();
    const amount = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
    const { leveledUp, newLevel, user } = addXP(data, userId, amount);
    saveData(data);

    if (leveledUp) {
        console.log(`[chatXP] ${message.author.tag} naik ke level chat ${newLevel}`);

        const channelId = config.chatLevelUpChannelId || null;

        (async () => {
            const targetChannel = await resolveTargetChannel(message.guild, channelId, message.channel);

            if (targetChannel && targetChannel.isTextBased()) {
                const rank = getLeaderboardRank(data, userId);
                sendLevelUpCard(targetChannel, message.author, newLevel, user, rank);
            } else {
                console.error(`[chatXP] Target channel gak ketemu atau bukan text-based. ID yang dicari: ${channelId}`);
            }
        })();

        if (message.member) {
            syncMemberRole(message.member, newLevel, CHAT_TIERS);
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