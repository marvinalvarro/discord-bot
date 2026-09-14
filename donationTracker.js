const fs = require("fs");
const path = require("path");

const DONATION_DATA_PATH = path.join(__dirname, "donationData.json");
const PROCESSED_IDS_PATH = path.join(__dirname, "donationProcessedIds.json");
const DONATOR_ALIASES_PATH = path.join(__dirname, "donatorAliases.json");

// Channel tempat webhook Saweria posting notifikasi donasi
const DONATION_CHANNEL_ID = "1531039427948843110";

// Regex buat "baca" pesan default Saweria:
// "Makasih! {donator} baru saja mensupport {amount} untuk Game Verse!"
const DONATION_MESSAGE_REGEX = /Makasih!\s*(.+?)\s*baru saja mensupport\s*([\d.,]+)\s*untuk/i;

// Gabungin message.content DAN isi embed (title, description) jadi 1 teks buat di-scan.
// Perlu ini karena webhook Saweria kemungkinan ngirim pesannya lewat embed, bukan teks polos.
function getSearchableText(message) {
    let text = message.content || "";

    if (message.embeds && message.embeds.length > 0) {
        for (const embed of message.embeds) {
            if (embed.title) text += "\n" + embed.title;
            if (embed.description) text += "\n" + embed.description;
            if (embed.fields) {
                for (const field of embed.fields) {
                    text += "\n" + (field.name || "") + "\n" + (field.value || "");
                }
            }
        }
    }

    return text;
}

function loadDonationData() {
    try {
        const raw = fs.readFileSync(DONATION_DATA_PATH, "utf8");
        return JSON.parse(raw);
    } catch (err) {
        return {}; // file belum ada / kosong / rusak -> mulai dari kosong
    }
}

function saveDonationData(data) {
    try {
        fs.writeFileSync(DONATION_DATA_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
        console.log("[donationTracker] Gagal simpan data donasi:", err.message);
    }
}

// Nyimpen ID pesan yang UDAH diproses, biar gak kehitung dobel
// (misal kalau command backfill gak sengaja dijalanin 2x)
function loadProcessedIds() {
    try {
        const raw = fs.readFileSync(PROCESSED_IDS_PATH, "utf8");
        return new Set(JSON.parse(raw));
    } catch (err) {
        return new Set();
    }
}

function saveProcessedIds(idsSet) {
    try {
        fs.writeFileSync(PROCESSED_IDS_PATH, JSON.stringify(Array.from(idsSet), null, 2));
    } catch (err) {
        console.log("[donationTracker] Gagal simpan processed IDs:", err.message);
    }
}

// Alias manual: "nama persis yang ditulis di Saweria" -> Discord user ID.
// Contoh isi donatorAliases.json:
// { "hamba tuhan": "123456789012345678", "jovan need ma": "234567890123456789" }
function loadDonatorAliases() {
    try {
        const raw = fs.readFileSync(DONATOR_ALIASES_PATH, "utf8");
        return JSON.parse(raw);
    } catch (err) {
        return {};
    }
}

// Format kunci bulan: "2026-09" (sesuai waktu Jakarta)
function getMonthKey(date = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
    }).format(date).slice(0, 7);
}

function getMonthLabel(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, 1));
    return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

/**
 * Dipanggil tiap ada pesan baru masuk (atau pas backfill history). Kalau pesannya dari webhook Saweria
 * di channel donasi, parse nama donatur & nominalnya, terus tambahin ke total bulan sesuai TANGGAL ASLI pesan itu.
 */
function handleDonationMessage(message) {
    if (!message.guild) return null;
    if (message.channelId !== DONATION_CHANNEL_ID) return null;
    if (!message.webhookId) return null; // cuma proses pesan dari webhook, bukan chat biasa

    const processedIds = loadProcessedIds();
    if (processedIds.has(message.id)) return null; // udah pernah diproses, skip

    const searchableText = getSearchableText(message);
    const match = searchableText.match(DONATION_MESSAGE_REGEX);
    if (!match) return null;

    const donatorName = match[1].trim();
    const amountStr = match[2].replace(/[.,]/g, ""); // hapus titik/koma pemisah ribuan
    const amount = parseInt(amountStr, 10);

    if (!donatorName || isNaN(amount)) return null;

    const monthKey = getMonthKey(message.createdAt);
    const data = loadDonationData();

    if (!data[monthKey]) {
        data[monthKey] = {};
    }

    data[monthKey][donatorName] = (data[monthKey][donatorName] || 0) + amount;

    saveDonationData(data);

    processedIds.add(message.id);
    saveProcessedIds(processedIds);

    console.log(`[donationTracker] +Rp${amount.toLocaleString("id-ID")} dari ${donatorName} (bulan ${monthKey})`);

    return { donatorName, amount, monthKey };
}

function getMonthlyLeaderboard(monthKey) {
    const data = loadDonationData();
    const monthData = data[monthKey];

    if (!monthData) return null;

    const sorted = Object.entries(monthData)
        .sort(([, a], [, b]) => b - a)
        .map(([name, amount]) => ({ name, amount }));

    const total = sorted.reduce((sum, entry) => sum + entry.amount, 0);

    return { entries: sorted, total };
}

function getCurrentMonthKey() {
    return getMonthKey();
}

function getPreviousMonthKey() {
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return getMonthKey(prevMonthDate);
}

/**
 * Coba cocokin nama donatur (teks bebas dari Saweria) sama member Discord di server.
 * Urutan pencocokan, dari yang paling dipercaya ke paling longgar:
 *   1. Alias manual (donatorAliases.json) -> paling akurat, admin yang nentuin sendiri.
 *   2. Username/displayName/nickname SAMA PERSIS (case-insensitive).
 *   3. Username/displayName/nickname MENGANDUNG nama donatur (atau sebaliknya) -> buat kasus
 *      kayak "Jovan need ma" yang cuma potongan dari nama Discord aslinya "Jovan need mabar".
 * Kalau tetap gak ketemu, entry dikembalikan tanpa avatarURL (bakal pakai placeholder inisial).
 */
async function attachDonatorAvatars(guild, entries) {
    if (!guild) return entries;

    try {
        await guild.members.fetch(); // pastiin cache member lengkap
    } catch (err) {
        console.log("[donationTracker] Gagal fetch semua member, pakai cache yang ada:", err.message);
    }

    const aliases = loadDonatorAliases();

    return entries.map((entry) => {
        const nameLower = entry.name.toLowerCase();

        // 1. Cek alias manual dulu
        const aliasId = aliases[entry.name] || aliases[nameLower];
        if (aliasId) {
            const aliasMember = guild.members.cache.get(aliasId);
            if (aliasMember) {
                return { ...entry, avatarURL: aliasMember.displayAvatarURL({ extension: "png", size: 128 }) };
            }
        }

        // 2. Exact match ke username/displayName/nickname
        let member = guild.members.cache.find((m) => {
            return (
                m.user.username.toLowerCase() === nameLower ||
                m.displayName.toLowerCase() === nameLower ||
                (m.nickname && m.nickname.toLowerCase() === nameLower)
            );
        });

        // 3. Kalau belum ketemu, coba partial match (salah satu mengandung yang lain).
        // Minimal 3 karakter biar gak ada match ngasal dari nama pendek.
        if (!member && nameLower.length >= 3) {
            member = guild.members.cache.find((m) => {
                const uname = m.user.username.toLowerCase();
                const dname = m.displayName.toLowerCase();
                const nick = m.nickname ? m.nickname.toLowerCase() : "";

                return (
                    uname.includes(nameLower) || nameLower.includes(uname) ||
                    dname.includes(nameLower) || nameLower.includes(dname) ||
                    (nick && (nick.includes(nameLower) || nameLower.includes(nick)))
                );
            });
        }

        if (member) {
            return { ...entry, avatarURL: member.displayAvatarURL({ extension: "png", size: 128 }) };
        }
        return entry;
    });
}

module.exports = {
    handleDonationMessage,
    getMonthlyLeaderboard,
    getMonthLabel,
    getCurrentMonthKey,
    getPreviousMonthKey,
    attachDonatorAvatars,
    DONATION_CHANNEL_ID,
};