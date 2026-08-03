const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

// Kalau Railway Volume ter-mount di /data, pakai itu (permanen, gak ke-reset tiap deploy).
// Kalau jalan di lokal (gak ada folder /data), fallback ke folder project biasa.
const VOLUME_PATH = "/data";
const DATA_FILE = fs.existsSync(VOLUME_PATH)
    ? path.join(VOLUME_PATH, "banCounterData.json")
    : path.join(__dirname, "banCounterData.json");

// ==== KONFIGURASI TEKS PESAN ====
const TITLE = "JANGAN MENGIRIM PESAN DI CHANNEL INI";
const SUBTITLE = "DO NOT SEND MESSAGES IN THIS CHANNEL";
const DESC_ID = "Channel ini khusus untuk mendeteksi spam & phishing, setiap pesan yang dikirim di sini akan mengakibatkan kicked otomatis.";
const DESC_EN = "This channel is strictly for spam & phishing detection, any messages sent here will result in an immediate ban";
const FOOTER_TEXT = "stay safe and read the rules";

function loadData() {
    try {
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        return JSON.parse(raw);
    } catch (err) {
        return { messageId: null, count: 0 };
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function buildEmbed(count) {
    return new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle(TITLE)
        .setDescription(
            `${SUBTITLE}\n\n**${DESC_ID}**\n\n${DESC_EN}\n\n${FOOTER_TEXT}`
        )
        .addFields({ name: "\u200b", value: `🔨 **Bans count:** ${count}` });
}

// Dipanggil sekali waktu bot ready, mastiin pesan pembuka ada di channel trap
async function ensureBanCounterMessage(channel) {
    const data = loadData();

    if (data.messageId) {
        try {
            const existing = await channel.messages.fetch(data.messageId);
            if (existing) return; // pesan udah ada, gak perlu kirim lagi
        } catch (err) {
            // pesan lama udah kehapus / gak ketemu, lanjut kirim baru di bawah
        }
    }

    const sent = await channel.send({ embeds: [buildEmbed(data.count)] });
    data.messageId = sent.id;
    saveData(data);
}

// Dipanggil tiap kali ada auto-ban dari trap channel
async function incrementBanCounter(channel) {
    console.log("[BAN COUNTER] Mulai update, DATA_FILE:", DATA_FILE);
    const data = loadData();
    console.log("[BAN COUNTER] Data sebelum update:", data);
    data.count += 1;
    saveData(data);
    console.log("[BAN COUNTER] Data sesudah update:", data);

    if (!data.messageId) {
        console.log("[BAN COUNTER] Belum ada messageId, kirim pesan baru.");
        const sent = await channel.send({ embeds: [buildEmbed(data.count)] });
        data.messageId = sent.id;
        saveData(data);
        return;
    }

    try {
        const msg = await channel.messages.fetch(data.messageId);
        await msg.edit({ embeds: [buildEmbed(data.count)] });
        console.log("[BAN COUNTER] Berhasil edit pesan messageId:", data.messageId);
    } catch (err) {
        console.log("[BAN COUNTER] Gagal fetch/edit pesan lama, kirim baru. Error:", err.message);
        const sent = await channel.send({ embeds: [buildEmbed(data.count)] });
        data.messageId = sent.id;
        saveData(data);
    }
}

module.exports = { ensureBanCounterMessage, incrementBanCounter };