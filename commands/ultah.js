const { PermissionsBitField } = require("discord.js");

// Pesan ucapan ulang tahun, dipilih random tiap kali command dipakai
const BIRTHDAY_MESSAGES = [
    "Semoga panjang umur, sehat selalu, murah rezeki, dan segala urusannya dilancarkan. 🎂🙏",
    "Semoga di usia yang baru ini diberikan kesehatan, keberkahan, dan kesuksesan dalam segala hal. ✨🎉",
    "Selamat menempuh usia baru, semoga sehat selalu, panjang umur, dan murah rezeki. 🎊🙏",
    "Semoga senantiasa diberikan kesehatan, kebahagiaan, dan kelancaran rezeki di tahun ini. 💐🎂",
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

        try {
            return await message.channel.send({
                content: `Selamat ulang tahun, ${user}! 🎂 ${randomMessage}`,
                files: [user.displayAvatarURL({ extension: "jpg", size: 1024 })],
                allowedMentions: { users: [user.id] },
            });
        } catch (err) {
            console.error("[ultah] Gagal kirim pesan ulang tahun:", err.message);
            return message.reply({
                content: "Gagal kirim ucapan, kemungkinan bot gak punya izin 'Send Messages' di channel ini 😥",
                allowedMentions: { repliedUser: false },
            }).catch(() => {});
        }
    },
};