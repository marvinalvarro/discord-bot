const fs = require("fs");
const path = require("path");
const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { generateRankCard } = require("./rankCard");
const { VOICE_TIERS, syncMemberRole } = require("./rankRoles");

const DATA_PATH = path.join(__dirname, "xpData.json");

// ====== KONFIGURASI ======
const CHECK_INTERVAL_MS = 60 * 1000; // bot cek voice tiap 1 menit
const XP_PER_CHECK = 5;              // XP yang didapat tiap interval kalau lagi di voice
const IGNORE_AFK_CHANNEL = true;     // gak dapat XP kalau di AFK channel
const IGNORE_BOTS = true;            // bot lain gak dapat XP
const IGNORE_IF_ALONE = false;       // true = gak dapat XP kalau sendirian di VC
const IGNORE_IF_MUTED_DEAFENED = false; // true = gak dapat XP kalau self-mute/deaf

const EMBED_COLOR = 0x1ABC9C;
const ACCENT_HEX = "#1ABC9C";

function xpNeededForLevel(level) {
    return 100 + (level - 1) * 50;
}

function loadData() {
    if (!fs.existsSync(DATA_PATH)) {
        fs.writeFileSync(DATA_PATH, JSON.stringify({}, null, 2));
    }
    try {
        return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    } catch (err) {
        console.error("[voiceXP] Gagal membaca xpData.json:", err);
        return {};
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function getUser(data, userId) {
    if (!data[userId]) {
        data[userId] = { xp: 0, level: 1, voiceMinutes: 0 };
    }
    return data[userId];
}

function addXP(data, userId, amount) {
    const user = getUser(data, userId);
    user.xp += amount;
    user.voiceMinutes += amount === XP_PER_CHECK ? CHECK_INTERVAL_MS / 60000 : 0;

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

async function sendLevelUpCard(channel, member, newLevel, user) {
    const needed = xpNeededForLevel(newLevel);

    const buffer = await generateRankCard({
        username: member.displayName,
        avatarURL: member.displayAvatarURL({ extension: "png", size: 256 }),
        level: newLevel,
        xp: user.xp,
        xpNeeded: needed,
        type: "VOICE",
        accentColor: ACCENT_HEX,
    });

    const attachment = new AttachmentBuilder(buffer, { name: "levelup-voice.png" });

    const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setDescription(`🎉 <@${member.id}> naik ke **Level ${newLevel}** dari ngobrol di voice channel!`)
        .setImage("attachment://levelup-voice.png");

    channel.send({ embeds: [embed], files: [attachment] }).catch((err) =>
        console.error("[voiceXP] Gagal kirim log level up:", err)
    );
}

function startVoiceXPLoop(client, config = {}) {
    const logChannelId = config.levelUpChannelId || null;

    setInterval(() => {
        const data = loadData();
        let changed = false;

        client.guilds.cache.forEach((guild) => {
            guild.channels.cache.forEach((channel) => {
                if (!channel.isVoiceBased()) return;
                if (IGNORE_AFK_CHANNEL && guild.afkChannelId === channel.id) return;

                const members = channel.members.filter((m) => {
                    if (IGNORE_BOTS && m.user.bot) return false;
                    if (IGNORE_IF_MUTED_DEAFENED && (m.voice.selfMute || m.voice.selfDeaf)) return false;
                    return true;
                });

                if (IGNORE_IF_ALONE && members.size < 2) return;
                if (members.size === 0) return;

                members.forEach((member) => {
                    changed = true;
                    const { leveledUp, newLevel, user } = addXP(data, member.id, XP_PER_CHECK);

                    if (leveledUp) {
                        console.log(`[voiceXP] ${member.user.tag} naik ke level ${newLevel}`);

                        if (logChannelId) {
                            const logChannel = guild.channels.cache.get(logChannelId);
                            if (logChannel && logChannel.isTextBased()) {
                                sendLevelUpCard(logChannel, member, newLevel, user);
                            }
                        }

                        syncMemberRole(member, newLevel, VOICE_TIERS);
                    }
                });
            });
        });

        if (changed) saveData(data);
    }, CHECK_INTERVAL_MS);

    console.log(`[voiceXP] Voice XP loop aktif (cek tiap ${CHECK_INTERVAL_MS / 1000} detik)`);
}

module.exports = {
    loadData,
    saveData,
    getUser,
    addXP,
    xpNeededForLevel,
    startVoiceXPLoop,
    XP_PER_CHECK,
    CHECK_INTERVAL_MS,
};