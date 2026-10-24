// commands/umumkanmusik.js
// Kirim pengumuman bot musik lewat bot (Nova Verse). Khusus founder.
// Pakai: .umumkanmusik            -> kirim di channel tempat kamu mengetik
//        .umumkanmusik #channel   -> kirim ke channel yang di-mention
const ALLOWED_USER_IDS = ["1015666814325375067"]; // founder

const ANNOUNCEMENT =
    "@everyone\n" +
    "📢 **Bot Musik Game Verse sudah hadir!** 🎶 " +
    "Masuk ke voice channel, ketik `2p judul lagu` atau tempel link **YouTube/Spotify**, " +
    "dan salah satu dari 3 bot musik akan otomatis datang. " +
    "Skip pakai `2s`, selesai pakai `2stop`, dan `2help` buat daftar perintah lengkap. 🎧";

module.exports = {
    name: "umumkanmusik",
    async execute(message, args, client) {
        if (!ALLOWED_USER_IDS.includes(message.author.id)) {
            return message.reply("Command ini khusus founder.").catch(() => {});
        }

        const target = message.mentions.channels.first() || message.channel;

        const perms = target.permissionsFor(client.user);
        if (!perms || !perms.has("SendMessages")) {
            return message.reply(`Bot gak punya izin kirim pesan di ${target}.`).catch(() => {});
        }

        try {
            await target.send({
                content: ANNOUNCEMENT,
                allowedMentions: { parse: ["everyone"] },
            });
        } catch (err) {
            console.error("[umumkanmusik] Gagal kirim pengumuman:", err.message);
            return message.reply("Gagal kirim pengumuman, cek izin bot.").catch(() => {});
        }

        // Rapikan: hapus pesan perintahnya kalau di channel yang sama
        if (target.id === message.channel.id) {
            message.delete().catch(() => {});
        } else {
            message.reply(`✅ Pengumuman terkirim ke ${target}.`).catch(() => {});
        }
    },
};