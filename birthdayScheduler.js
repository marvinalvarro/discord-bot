const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const { sendBirthdayMessage } = require("./birthdaySender");

const BIRTHDAY_DATA_PATH = path.join(__dirname, "birthdayData.json");

// ===============================
// GANTI ID CHANNEL INI sesuai channel tempat ucapan ulang tahun otomatis mau dikirim
// ===============================
const BIRTHDAY_CHANNEL_ID = "1529480671800852500";

function loadBirthdayData() {
    try {
        const raw = fs.readFileSync(BIRTHDAY_DATA_PATH, "utf8");
        return JSON.parse(raw);
    } catch (err) {
        return {};
    }
}

async function checkAndSendBirthdays(client) {
    const birthdayData = loadBirthdayData();
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth() + 1; // getMonth() itu 0-11, jadi +1

    const birthdayUserIds = Object.entries(birthdayData)
        .filter(([, data]) => data.day === todayDay && data.month === todayMonth)
        .map(([userId]) => userId);

    if (birthdayUserIds.length === 0) {
        console.log("[birthdayScheduler] Gak ada yang ulang tahun hari ini.");
        return;
    }

    try {
        const channel = await client.channels.fetch(BIRTHDAY_CHANNEL_ID);

        if (!channel) {
            console.log("[birthdayScheduler] Channel ulang tahun tidak ditemukan, cek BIRTHDAY_CHANNEL_ID.");
            return;
        }

        for (const userId of birthdayUserIds) {
            try {
                const user = await client.users.fetch(userId);
                await sendBirthdayMessage(channel, user);
                console.log(`[birthdayScheduler] Berhasil kirim ucapan ulang tahun otomatis buat ${user.username}`);
            } catch (err) {
                console.log(`[birthdayScheduler] Gagal kirim ucapan buat userId ${userId}:`, err.message);
            }
        }
    } catch (err) {
        console.log("[birthdayScheduler] Gagal fetch channel ulang tahun:", err.message);
    }
}

/**
 * Jalankan ini sekali di index.js setelah bot ready, contoh:
 * const { startBirthdayScheduler } = require("./birthdayScheduler");
 * startBirthdayScheduler(client);
 */
function startBirthdayScheduler(client) {
    // Jalan tiap hari jam 00:00 tengah malam waktu Jakarta
    cron.schedule("0 0 * * *", () => {
        checkAndSendBirthdays(client);
    }, {
        timezone: "Asia/Jakarta",
    });

    console.log("[birthdayScheduler] Pengecekan ulang tahun otomatis dijadwalkan tiap jam 00:00 (Asia/Jakarta).");
}

module.exports = { startBirthdayScheduler };