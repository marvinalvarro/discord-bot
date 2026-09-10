
const fs = require("fs");
const path = require("path");

const STREAK_DATA_PATH = path.join(__dirname, "streakData.json");

// Channel khusus tempat streak dihitung. Pesan di channel lain gak ngaruh.
const STREAK_CHANNEL_ID = "1477885866046263329";

function loadStreakData() {
    try {
        const raw = fs.readFileSync(STREAK_DATA_PATH, "utf8");
        return JSON.parse(raw);
    } catch (err) {
        return {}; // file belum ada / kosong / rusak -> mulai dari kosong
    }
}

function saveStreakData(data) {
    try {
        fs.writeFileSync(STREAK_DATA_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
        console.log("[streakTracker] Gagal simpan data streak:", err.message);
    }
}

// Format tanggal YYYY-MM-DD sesuai waktu Jakarta, biar konsisten walau server hosting di zona waktu lain
function getDateStringJakarta(date) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}

function getTodayStr() {
    return getDateStringJakarta(new Date());
}

function getYesterdayStr() {
    return getDateStringJakarta(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

/**
 * Dipanggil tiap ada pesan baru masuk. Kalau pesannya di channel streak,
 * update hitungan streak user itu (nambah kalau lanjut dari kemarin, reset kalau kelewat sehari).
 * Apapun jenis pesannya (teks, stiker, foto, video, GIF) dihitung sama, asal minimal 1 pesan.
 */
async function handleStreakMessage(message) {
    if (!message.guild) return null;
    if (message.author.bot) return null;
    if (message.channelId !== STREAK_CHANNEL_ID) return null;

    const data = loadStreakData();
    const userId = message.author.id;
    const todayStr = getTodayStr();
    const yesterdayStr = getYesterdayStr();

    const entry = data[userId] || { count: 0, longest: 0, lastDate: null, username: message.author.username };

    // Udah kehitung hari ini, gak usah diproses lagi (biar gak dobel walau kirim banyak pesan)
    if (entry.lastDate === todayStr) {
        return null;
    }

    if (entry.lastDate === yesterdayStr) {
        entry.count += 1; // lanjutin streak dari kemarin
    } else {
        entry.count = 1; // streak putus (atau emang baru mulai)
    }

    entry.longest = Math.max(entry.longest, entry.count);
    entry.lastDate = todayStr;
    entry.username = message.author.username;

    data[userId] = entry;
    saveStreakData(data);

    // Kasih react api biar berasa kayak TikTok
    try {
        await message.react("🔥");
    } catch (err) {
        // gapapa kalau gagal react (misal kurang izin), streak-nya tetap kehitung
    }

    return entry;
}

/**
 * Ambil streak user, tapi "divalidasi" dulu: kalau lastDate-nya bukan hari ini atau kemarin,
 * berarti streak-nya udah putus (walau angka count di file masih nyantol dari sebelumnya).
 */
function getEffectiveStreak(userId) {
    const data = loadStreakData();
    const entry = data[userId];

    if (!entry) {
        return { count: 0, longest: 0, lastDate: null };
    }

    const todayStr = getTodayStr();
    const yesterdayStr = getYesterdayStr();
    const isActive = entry.lastDate === todayStr || entry.lastDate === yesterdayStr;

    return {
        count: isActive ? entry.count : 0,
        longest: entry.longest,
        lastDate: entry.lastDate,
    };
}

function getAllStreaks() {
    return loadStreakData();
}

module.exports = {
    handleStreakMessage,
    getEffectiveStreak,
    getAllStreaks,
    STREAK_CHANNEL_ID,
};