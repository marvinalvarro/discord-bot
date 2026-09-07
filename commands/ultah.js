const { PermissionsBitField, EmbedBuilder } = require("discord.js");
const { generateBirthdayCard } = require("../birthdayCardGenerator");

// Pesan ucapan ulang tahun
const BIRTHDAY_MESSAGE = "Semoga di umur yang baru ini kamu selalu diberikan kesehatan, kebahagiaan, dan keberuntungan.\nSemoga semua yang kamu harapkan dan perjuangkan bisa perlahan terwujud. Tetap jadi versi terbaik dari diri kamu, dan semoga tahun ini membawa banyak hal baik buat kamu. 🤍✨";

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

        const embeds = [];
        const files = [];

        // ===============================
        // KARTU UCAPAN ULANG TAHUN (gambar custom, style cute)
        // ===============================
        try {
            const cardBuffer = await generateBirthdayCard({
                username: user.username,
                avatarURL: user.displayAvatarURL({ extension: "png", size: 512 }),
                message: BIRTHDAY_MESSAGE,
                userId: user.id,
            });

            files.push({ attachment: cardBuffer, name: "birthday_card.png" });

            const cardEmbed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setImage("attachment://birthday_card.png");

            embeds.push(cardEmbed);
        } catch (err) {
            console.error("[ultah] Gagal generate kartu ucapan:", err.message);
            // Kalau gagal generate gambar, tetap lanjut kirim GIF + teks sederhana
            embeds.push(
                new EmbedBuilder()
                    .setColor(0xFFD700)
                    .setTitle("🎂 Happy Birthday!")
                    .setDescription(`Happy birthday yaa, ${user}! 🥳🎉\n\n${BIRTHDAY_MESSAGE}\n\n— Dari seluruh warga Game Verse🎮`)
            );
        }

        // Embed kedua khusus buat GIF
        embeds.push(
            new EmbedBuilder()
                .setColor(0xFFD700)
                .setImage(randomGif)
        );

        try {
            return await message.channel.send({
                content: `${user}`,
                embeds,
                files,
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