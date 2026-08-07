const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "xpData.json");

// ====== KONFIGURASI ======
const CHECK_INTERVAL_MS = 60 * 1000; // bot cek voice tiap 1 menit
const XP_PER_CHECK = 5;              // XP yang didapat tiap interval kalau lagi di voice
const IGNORE_AFK_CHANNEL = true;     // gak dapat XP kalau di AFK channel
const IGNORE_BOTS = true;            // bot lain gak dapat XP
const IGNORE_IF_ALONE = false;       // true = gak dapat XP kalau sendirian di VC
const IGNORE_IF_MUTED_DEAFENED = false; // true = gak dapat XP kalau self-mute/deaf

// Rumus XP dibutuhkan untuk naik ke level berikutnya
// level 1 -> 2 butuh 100 XP, level 2 -> 3 butuh 150 XP, dst (naik 50 tiap level)
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

/**
 * Tambah XP ke seorang user, otomatis handle level up.
 * @returns {leveledUp: boolean, newLevel: number, user: object}
 */
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

/**
 * Loop utama: dipanggil tiap CHECK_INTERVAL_MS, mengecek semua voice channel
 * di semua guild bot ini, dan menambah XP untuk member yang eligible.
 */
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
                    const { leveledUp, newLevel } = addXP(data, member.id, XP_PER_CHECK);

                    if (leveledUp) {
                        console.log(`[voiceXP] ${member.user.tag} naik ke level ${newLevel}`);

                        // Kirim notifikasi level up ke channel log kalau ada
                        if (logChannelId) {
                            const logChannel = guild.channels.cache.get(logChannelId);
                            if (logChannel && logChannel.isTextBased()) {
                                logChannel
                                    .send(`🎉 <@${member.id}> naik ke **Level ${newLevel}** dari ngobrol di voice channel!`)
                                    .catch((err) => console.error("[voiceXP] Gagal kirim log level up:", err));
                            }
                        }
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