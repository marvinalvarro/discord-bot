const { PermissionsBitField, EmbedBuilder } = require("discord.js");

// Pesan ucapan ulang tahun, dipilih random tiap kali command dipakai
const BIRTHDAY_MESSAGES = [
    "Semoga panjang umur, sehat selalu, murah rezeki, dan segala urusannya dilancarkan.",
    "Semoga di usia yang baru ini diberikan kesehatan, keberkahan, dan kesuksesan dalam segala hal.",
    "Selamat menempuh usia baru, semoga sehat selalu, panjang umur, dan murah rezeki.",
    "Semoga senantiasa diberikan kesehatan, kebahagiaan, dan kelancaran rezeki di tahun ini.",
];

// Beberapa GIF ulang tahun, dipilih random biar gak monoton
const BIRTHDAY_GIFS = [
    "https://media.tenor.com/On7kvXhzml4AAAAC/happy-birthday.gif",
    "https://media.tenor.com/6b5jyKpUp7wAAAAC/birthday-happy-birthday.gif",
    "https://media.tenor.com/1zXFwYlz6mgAAAAC/happy-birthday-to-you.gif",
    "https://media.tenor.com/lE4rIeAJ3lIAAAAC/birthday.gif",
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

        const randomMessage = BIRTHDAY_MESSAGES[Math.floor(Math.random() * BIRTHDAY_MESSAGES.length)];
        const randomGif = BIRTHDAY_GIFS[Math.floor(Math.random() * BIRTHDAY_GIFS.length)];

        // ===============================
        // TODO: Bonus coin otomatis buat yang ulang tahun
        // (menunggu isi economy.js biar cara nambah coin-nya konsisten)
        // ===============================

        const embed = new EmbedBuilder()
            .setColor(0xFF7AC6)
            .setTitle("🎂 Happy Birthday! 🎉")
            .setDescription(`Selamat ulang tahun, ${user}!\n\n${randomMessage}`)
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