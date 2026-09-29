const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "friendStreakData.json");

function loadData() {
    if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, "{}");
    return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

function saveData(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// Key unik buat 1 pasangan user, urutan ID gak ngaruh (A-B sama aja kayak B-A)
function getPairKey(idA, idB) {
    return [idA, idB].sort().join("_");
}

function getJakartaDateString(date = new Date()) {
    return date.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

// Dipanggil dari messageCreate buat SETIAP pesan (teks/foto/video apapun),
// otomatis deteksi kalau ada mention user lain di dalamnya.
async function handleFriendStreakMessage(message) {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (message.mentions.everyone) return;

    const mentionedUsers = message.mentions.users.filter(
        (u) => !u.bot && u.id !== message.author.id
    );

    if (mentionedUsers.size === 0) return;

    const data = loadData();
    const today = getJakartaDateString();
    const yesterday = getJakartaDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
    let changed = false;

    for (const target of mentionedUsers.values()) {
        const key = getPairKey(message.author.id, target.id);
        let entry = data[key];

        if (!entry) {
            entry = {
                streak: 0,
                lastCompletedDate: null,
                pendingDate: null,
                pendingUserId: null,
                userA: message.author.id,
                userB: target.id,
            };
            data[key] = entry;
        }

        // Udah lengkap hari ini buat pasangan ini, gak ngapa-ngapain lagi
        if (entry.lastCompletedDate === today) continue;

        if (entry.pendingDate === today && entry.pendingUserId !== message.author.id) {
            // Orang KEDUA ngirim pesan ke orang pertama di hari yang sama -> LENGKAP, streak nambah
            if (entry.lastCompletedDate === yesterday) {
                entry.streak += 1;
            } else {
                entry.streak = 1; // kelewat sehari sebelumnya, atau pertama kali -> mulai dari 1
            }
            entry.lastCompletedDate = today;
            entry.pendingDate = null;
            entry.pendingUserId = null;
            changed = true;

            try {
                await message.react("🔥");
            } catch (err) {
                // gak fatal kalau gagal react (misal kurang izin), tetep lanjut kirim pesan
            }

            message.channel
                .send(`🔥 **${message.author.username}** & **${target.username}** streak sekarang: **${entry.streak} hari**!`)
                .catch(() => {});
        } else if (entry.pendingDate !== today) {
            // Belum ada yang mulai hari ini -> orang ini jadi yang PERTAMA, diam aja nunggu balesan
            entry.pendingDate = today;
            entry.pendingUserId = message.author.id;
            changed = true;
        }
        // Kalau pendingDate === today DAN pendingUserId === message.author.id,
        // berarti orang yang sama ngirim pesan lagi ke orang yang sama, gak ngapa-ngapain (diam, gak spam reply)
    }

    if (changed) saveData(data);
}

module.exports = { handleFriendStreakMessage };