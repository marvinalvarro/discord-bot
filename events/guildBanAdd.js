const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const config = require("../config");
const { generateBannedCard } = require("../bannedCardGenerator");

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

            // ban.reason dari event guildBanAdd sering kosong (keterbatasan Discord API).
            // Alasan asli yang di-set pas member.ban({reason: ...}) baru kebaca akurat
            // kalau kita fetch ulang data ban-nya langsung.
            let reason = ban.reason;
            if (!reason) {
                try {
                    const fetchedBan = await ban.guild.bans.fetch(user.id);
                    reason = fetchedBan.reason;
                } catch (fetchErr) {
                    console.error("[guildBanAdd] Gagal fetch ulang reason ban:", fetchErr.message);
                }
            }
            reason = reason || "Tidak ada alasan diberikan";

            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setAuthor({
                    name: `${user.tag} was banned!`,
                    iconUrl: client.user.displayAvatarURL(),
                })
                .setDescription(`**Reason:** ${reason}\n\n${user} telah diblokir dari ${ban.guild.name}.`)
                .setTimestamp();

            // Coba generate gambar "BANNED" bergaya stamp. Kalau gagal (apapun alasannya),
            // fallback ke avatar polos biar notif tetep terkirim.
            try {
                const imageBuffer = await generateBannedCard(user);
                const attachment = new AttachmentBuilder(imageBuffer, { name: "banned.png" });
                embed.setImage("attachment://banned.png");
                await channel.send({ embeds: [embed], files: [attachment] });
            } catch (genErr) {
                console.error("[guildBanAdd] Gagal generate banned card, fallback ke avatar polos:", genErr.message);
                embed.setImage(user.displayAvatarURL({ extension: "png", size: 1024 }));
                await channel.send({ embeds: [embed] });
            }
        } catch (err) {
            console.error("Gagal kirim notif ban ke #banned:", err);
        }
    },
};