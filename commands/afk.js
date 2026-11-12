// commands/afk.js
// Pakai: .afk            -> AFK tanpa alasan
//        .afk makan      -> AFK dengan alasan "makan"
// Pencabutan AFK dan notifikasi mention ditangani afkSystem.js (lewat events/messageCreate.js).
const { setAfk, applyAfkNickname, buildSetEmbeds, NO_PING } = require("../afkSystem");

module.exports = {
    name: "afk",
    async execute(message, args) {
        if (!message.guild) return;
        const reason = setAfk(message.guild.id, message.author.id, args.join(" "));
        const nickIssue = await applyAfkNickname(message.member); // ganti nickname jadi "[ AFK ] ..." (null = berhasil)
        await message
            .reply({ embeds: buildSetEmbeds(message.author.id, reason, nickIssue), allowedMentions: NO_PING })
            .catch(() => {});
    },
};