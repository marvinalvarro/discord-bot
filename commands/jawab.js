// commands/jawab.js
// Bot yang "menjawab" atas nama Nova Verse, lalu pesan perintahmu dihapus otomatis.
// Khusus user yang ada di ALLOWED_USER_IDS.
//
// Pakai:
//   .jawab teks jawabannya              -> bot mengirim teks itu di channel ini
//   (reply ke pesan orang) .jawab teks  -> bot membalas pesan orang itu
//   .jawab teks + lampiran gambar       -> lampiran ikut dikirim bot
const ALLOWED_USER_IDS = ["1015666814325375067"]; // founder. Tambah ID lain di sini kalau perlu.

module.exports = {
    name: "jawab",
    async execute(message, args, client) {
        if (!ALLOWED_USER_IDS.includes(message.author.id)) {
            return message.reply("Command ini khusus founder.").catch(() => {});
        }

        const text = args.join(" ").trim();
        const files = [...message.attachments.values()].map((a) => a.url);

        if (!text && files.length === 0) {
            return message
                .reply("Tulis jawabannya dulu ya. Contoh: `.jawab halo, selamat datang!`")
                .catch(() => {});
        }

        const perms = message.channel.permissionsFor(client.user);
        if (!perms || !perms.has("SendMessages")) {
            return message.reply("Bot gak punya izin kirim pesan di channel ini.").catch(() => {});
        }

        const payload = {
            allowedMentions: { parse: ["users"], repliedUser: false }, // @everyone dan @role gak akan ke-ping
        };
        if (text) payload.content = text;
        if (files.length > 0) payload.files = files;

        try {
            let sent = false;

            // Kalau perintah ini di-reply ke pesan orang, bot membalas pesan itu
            if (message.reference && message.reference.messageId) {
                try {
                    const target = await message.fetchReference();
                    await target.reply(payload);
                    sent = true;
                } catch (err) {
                    // pesan aslinya sudah terhapus / gak bisa diambil -> kirim biasa
                }
            }

            if (!sent) await message.channel.send(payload);
        } catch (err) {
            console.error("[jawab] Gagal kirim jawaban:", err.message);
            return message.reply("Gagal kirim jawaban, cek izin bot di channel ini.").catch(() => {});
        }

        // Hapus pesan perintahmu (dilakukan SETELAH terkirim supaya lampiran sempat terunduh)
        message.delete().catch(() => {});
    },
};