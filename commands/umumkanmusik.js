// commands/umumkanmusik.js
// Kirim pengumuman lewat bot (Nova Verse). Khusus founder.
// Pakai: .umumkanmusik            -> kirim di channel tempat kamu mengetik
//        .umumkanmusik #channel   -> kirim ke channel yang di-mention
const ALLOWED_USER_IDS = ["1015666814325375067"]; // founder

const ANNOUNCEMENT =
    "@everyone\n" +
    "📢 **Fitur AFK sudah hadir!** 💤\n\n" +
    "Mau pergi sebentar tanpa ditunggu-tunggu? Ketik `.afk <alasan>`, contoh: `.afk makan`.\n\n" +
    "• Kalau ada yang nge-tag kamu, bot langsung kasih tau kalau kamu lagi AFK beserta alasannya.\n" +
    "• Nickname kamu otomatis jadi `[ AFK ] Makan NamaKamu`.\n" +
    "• Pas kamu chat lagi, AFK otomatis dicabut dan nickname balik seperti semula. 👋\n\n" +
    "Bisa dipakai di semua channel, coba sekarang! 🚀";

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