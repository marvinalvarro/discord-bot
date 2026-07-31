const { EmbedBuilder } = require("discord.js");
const config = require("../config");

// Catatan: file ini kirim notif ke #banned untuk SEMUA jenis ban (manual maupun
// auto-ban dari trap channel). Counter "Bans count" di trap channel dihandle
// terpisah oleh banCounter.js, dipanggil langsung dari messageCreate.js.

// ==== KONFIGURASI ====
const BANNED_CHANNEL_ID = "1529908043783864434"; // ID channel #banned

module.exports = {
    name: "guildBanAdd",

    async execute(ban, client) {
        // "ban" adalah object GuildBan, isinya: ban.user, ban.reason, ban.guild
        try {
            const channel = ban.guild.channels.cache.get(BANNED_CHANNEL_ID);
            if (!channel) {
                console.log("Channel #banned tidak ditemukan, cek BANNED_CHANNEL_ID.");
                return;
            }

            const user = ban.user;
            const reason = ban.reason || "Tidak ada alasan diberikan";

            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setAuthor({
                    name: `${user.tag} was banned!`,
                    iconUrl: client.user.displayAvatarURL(),
                })
                .setDescription(`**Reason:** ${reason}\n\n${user} telah diblokir dari ${ban.guild.name}.`)
                .setImage(user.displayAvatarURL({ extension: "png", size: 1024 }))
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error("Gagal kirim notif ban ke #banned:", err);
        }
    },
};