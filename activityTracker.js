const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "activityData.json");

// GANTI dengan ID role "New Member" kamu
const NEW_MEMBER_ROLE_ID = "1553746802413543564";

// Total waktu aktif (voice ATAU chat, gak dobel kalau bareng) yang harus tercapai
// sebelum role New Member kecabut otomatis. Default 3 hari.
const REQUIRED_ACTIVE_MS = 3 * 24 * 60 * 60 * 1000;

// Kalau jeda antar pesan chat user <= ini, dianggap masih "aktif chat"
// (nutupin gap antar pesan, biar ngetik 1 kalimat tiap 2 menit tetep keitung nyambung)
const CHAT_SESSION_GAP_MS = 5 * 60 * 1000;

// Interval "tick" buat akumulasi waktu aktif. Makin kecil makin presisi,
// tapi makin sering baca/tulis file. 1 menit sudah cukup akurat buat threshold 3 hari.
const TICK_INTERVAL_MS = 60 * 1000;

function loadData() {
    if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, "{}");
    return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

function saveData(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function initMember(guildId, userId) {
    const data = loadData();
    if (!data[userId]) {
        data[userId] = {
            guildId,
            activeMs: 0,
            voiceJoinedAt: null,
            lastChatAt: null,
            lastTickAt: Date.now(),
            completed: false,
        };
        saveData(data);
        console.log(`[activityTracker] Mulai tracking aktivitas untuk userId ${userId}`);
    }
}

function isCurrentlyActive(entry, now) {
    const inVoice = !!entry.voiceJoinedAt;
    const inChatSession = entry.lastChatAt && (now - entry.lastChatAt) <= CHAT_SESSION_GAP_MS;
    return inVoice || inChatSession;
}

async function checkCompletion(member) {
    if (!member) return;
    const data = loadData();
    const entry = data[member.id];
    if (!entry || entry.completed) return;

    if (entry.activeMs >= REQUIRED_ACTIVE_MS) {
        try {
            await member.roles.remove(NEW_MEMBER_ROLE_ID);
            entry.completed = true;
            saveData(data);
            console.log(`[activityTracker] Role New Member dicabut dari ${member.user.tag} (syarat aktif terpenuhi)`);
        } catch (err) {
            console.error("[activityTracker] Gagal cabut role:", err);
        }
    }
}

// Dipanggil tiap TICK_INTERVAL_MS: nambahin waktu aktif ke SEMUA user yang lagi
// aktif (voice dan/atau chat), tanpa dobel-hitung, lalu cek siapa yang udah tembus syarat.
async function tickActivity(client) {
    const data = loadData();
    const now = Date.now();
    let changed = false;

    for (const userId in data) {
        const entry = data[userId];
        if (entry.completed) continue;

        if (isCurrentlyActive(entry, now)) {
            const elapsed = now - (entry.lastTickAt || now);
            entry.activeMs += Math.max(0, elapsed);
            changed = true;
        }
        entry.lastTickAt = now;
    }

    if (changed) saveData(data);

    const latestData = loadData();
    for (const userId in latestData) {
        const entry = latestData[userId];
        if (entry.completed) continue;
        if (entry.activeMs >= REQUIRED_ACTIVE_MS) {
            const guild = client.guilds.cache.get(entry.guildId);
            if (!guild) continue;
            const member = guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
            if (member) await checkCompletion(member);
        }
    }
}

function startActivityTickLoop(client) {
    setInterval(() => {
        tickActivity(client).catch((err) => console.error("[activityTracker] Error saat tick:", err));
    }, TICK_INTERVAL_MS);
    console.log(`[activityTracker] Tick loop aktif (cek tiap ${TICK_INTERVAL_MS / 1000} detik)`);
}

module.exports = {
    loadData,
    saveData,
    initMember,
    checkCompletion,
    tickActivity,
    startActivityTickLoop,
    NEW_MEMBER_ROLE_ID,
    CHAT_SESSION_GAP_MS,
};