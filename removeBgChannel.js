// removeBgChannel.js  (taruh di root, sejajar dengan streakTracker.js)
// Otomatis hapus background tiap ada gambar yang diupload di channel khusus.
// Pakai remove.bg API (ringan, gak makan disk/RAM server). Butuh REMOVEBG_API_KEY di .env
const { AttachmentBuilder } = require("discord.js");

const REMOVEBG_CHANNEL_ID = "1530113668006678528";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB per gambar
const MAX_IMAGES_PER_MESSAGE = 4;

async function removeBgApi(buffer) {
    const key = process.env.REMOVEBG_API_KEY;
    if (!key) throw new Error("NO_KEY");

    const form = new FormData();
    form.append("size", "auto");
    form.append("image_file", new Blob([buffer]), "image.png");

    const res = await fetch("https://api.remove.bg/v1.0/removebg", {
        method: "POST",
        headers: { "X-Api-Key": key },
        body: form,
    });
    if (!res.ok) throw new Error(`REMOVEBG_${res.status}`); // 402 = kuota habis
    return Buffer.from(await res.arrayBuffer());
}

function errorText(code) {
    if (code === "NO_KEY") return "❌ API key remove.bg belum dipasang di server. Kabari admin ya.";
    if (code === "REMOVEBG_402") return "❌ Kuota Remove.bg habis.";
    if (code === "REMOVEBG_403") return "❌ API key remove.bg tidak valid. Kabari admin ya.";
    if (code === "REMOVEBG_429") return "❌ Terlalu banyak permintaan, coba lagi sebentar ya.";
    return "❌ Gagal menghapus background. Coba gambar lain ya.";
}

// Antrian: proses satu per satu
let queue = Promise.resolve();

async function processMessage(message, images) {
    const loading = await message
        .reply({ content: "⏳ Lagi hapus background...", allowedMentions: { repliedUser: false } })
        .catch(() => null);

    const files = [];
    let lastError = null;
    let failed = 0;

    for (const img of images) {
        try {
            const input = Buffer.from(await (await fetch(img.url)).arrayBuffer());
            const output = await removeBgApi(input);
            files.push(new AttachmentBuilder(output, { name: `removebg_${files.length + 1}.png` }));
        } catch (err) {
            console.log("[removeBgChannel] gagal proses gambar:", err.message);
            lastError = err.message;
            failed++;
        }
    }

    const payload = files.length
        ? {
              content:
                  `✅ Background gambar dari — **${message.author.username}** berhasil dihapus.` +
                  (failed ? `\n⚠️ ${failed} gambar gagal diproses.` : ""),
              files,
          }
        : { content: errorText(lastError) };

    if (loading) {
        await loading.edit(payload).catch(() => {});
    } else {
        await message.reply({ ...payload, allowedMentions: { repliedUser: false } }).catch(() => {});
    }
}

/**
 * Dipanggil di events/messageCreate.js (sudah terpasang).
 */
async function handleRemoveBgMessage(message) {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (message.channelId !== REMOVEBG_CHANNEL_ID) return;

    const images = message.attachments
        .filter((a) => a.contentType?.startsWith("image/") && a.size <= MAX_SIZE)
        .first(MAX_IMAGES_PER_MESSAGE);

    if (images.length === 0) return;

    queue = queue.then(() => processMessage(message, images)).catch(() => {});
}

module.exports = { handleRemoveBgMessage, REMOVEBG_CHANNEL_ID };