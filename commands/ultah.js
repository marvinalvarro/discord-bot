const { PermissionsBitField } = require("discord.js");
const { sendBirthdayMessage } = require("../birthdaySender");

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

        const sentMessage = await sendBirthdayMessage(message.channel, user);

        if (!sentMessage) {
            return message.reply({
                content: "Gagal kirim ucapan, kemungkinan bot gak punya izin 'Send Messages'/'Embed Links' di channel ini 😥",
                allowedMentions: { repliedUser: false },
            }).catch(() => {});
        }

        return sentMessage;
    },
};