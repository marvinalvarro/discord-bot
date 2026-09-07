const { PermissionsBitField, EmbedBuilder } = require("discord.js");

// Pesan ucapan ulang tahun
const BIRTHDAY_MESSAGE = "Semoga di umur yang baru ini kamu selalu diberikan kesehatan, kebahagiaan, dan dimudahkan dalam segala urusan. Semoga semua hal yang kamu semogakan bisa satu-satu terwujud. Jangan lupa tetap jadi diri kamu sendiri, and enjoy your special day! 🤍✨";

// Beberapa GIF ulang tahun, dipilih random biar gak monoton
// Catatan: link Discord CDN di bawah ini punya masa berlaku (ada parameter ?ex=...),
// jadi kalau suatu saat GIF-nya berhenti muncul, upload ulang dan ganti link-nya.
const BIRTHDAY_GIFS = [
    "https://cdn.discordapp.com/attachments/1477893248226820188/1546348992441487370/download.gif?ex=6a9f7539&is=6a9e23b9&hm=398a0995e48cbf632bf3118afdbd49b297f676ef12bf4c28f36e80ac79743536&",
];

module.exports = {
    name: "ultah",

    async execute(message) {
        // Cuma admin/mod yang boleh pakai command ini
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply({
                content: "Command ini cuma buat admin/mod ya 😊",
                allowedMentions: { repliedUser: false },
            });
        }

        const user = message.mentions.users.first();

        if (!user) {
            return message.reply({
                content: "Tag dulu orang yang ulang tahun ya, contoh: `.ultah @user` 🎂",
                allowedMentions: { repliedUser: false },
            });
        }

        const randomGif = BIRTHDAY_GIFS[Math.floor(Math.random() * BIRTHDAY_GIFS.length)];

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle("🎂 Happy Birthday!")
            .setDescription(`Happy birthday yaa, ${user}! 🥳\n\n━━━━━━━━━━━━━━━\n\n${BIRTHDAY_MESSAGE}`)
            .setThumbnail(user.displayAvatarURL({ extension: "jpg", size: 512 }))
            .setImage(randomGif)
            .setFooter({ text: `Dari seluruh warga Game Verse untuk ${user.username}` })
            .setTimestamp();

        try {
            return await message.channel.send({
                embeds: [embed],
                allowedMentions: { users: [user.id] },
            });
        } catch (err) {
            console.error("[ultah] Gagal kirim pesan ulang tahun:", err.message);
            return message.reply({
                content: "Gagal kirim ucapan, kemungkinan bot gak punya izin 'Send Messages'/'Embed Links' di channel ini 😥",
                allowedMentions: { repliedUser: false },
            }).catch(() => {});
        }
    },
};