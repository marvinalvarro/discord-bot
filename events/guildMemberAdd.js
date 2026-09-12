const { EmbedBuilder } = require("discord.js");
const { handleMemberJoin } = require("../inviteTracker");

// Ganti ID channel welcome-goodbye di server kamu
const WELCOME_GOODBYE_CHANNEL_ID = "1477885865584885860";

// ID channel general-chat
const GENERAL_CHAT_ID = "1520226091107618957";

// ID channel verification
const VERIFICATION_CHANNEL_ID = "1532578680818237602";

// GIF welcome banner
const WELCOME_GIF_URL = "https://cdn.discordapp.com/attachments/1391005977393758218/1397859323455078481/3ee9ac3d-671a-4e2a-98a0-c3d4cf9c5aee.gif";

module.exports = {
    name: "guildMemberAdd",

    async execute(member) {
        console.log("[guildMemberAdd] Event triggered untuk member:", member.user.tag);

        // Deteksi invite mana yang kepake, tambahin +1 invite valid ke pengundang
        handleMemberJoin(member).catch((err) => console.error("[inviteTracker] Error:", err));

        const channel = member.guild.channels.cache.get(WELCOME_GOODBYE_CHANNEL_ID);

        if (channel) {
            const RULES_GUIDE_CHANNEL_ID = "1544265708920242236"; // udah digabung, peraturan + panduan jadi satu channel
            const ANNOUNCEMENT_CHANNEL_ID = "1529480671800852500"; // channel pengumuman, tempat daftar ultah
            const STREAK_CHANNEL_ID = "1531194725854482544";
            const ULTAH_CHANNEL_ID = "1531332595336482917";
            const KTP_CHANNEL_ID = "1534281400826728448";

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setDescription(
                    `Selamat datang, ${member}! Lu resmi jadi bagian dari **Game Verse** sekarang! 🎉`
                )
                .addFields(
                    { name: "📖 Panduan Bermain Discord & Rules", value: `<#${RULES_GUIDE_CHANNEL_ID}>`, inline: false },
                    { name: "🎂 Daftar Ultah", value: `<#${ANNOUNCEMENT_CHANNEL_ID}>`, inline: false },
                    { name: "🎁 Sambutan Ultah", value: `<#${ULTAH_CHANNEL_ID}>`, inline: false },
                    { name: "🔥 Streak Harian", value: `<#${STREAK_CHANNEL_ID}>`, inline: false },
                    { name: "🪪 Bikin KTP", value: `<#${KTP_CHANNEL_ID}>`, inline: false }
                )
                .setThumbnail(member.user.displayAvatarURL({ extension: "png", size: 256 }))
                .setImage(WELCOME_GIF_URL)
                .setFooter({ text: `Member ke-${member.guild.memberCount} • Have fun & enjoy the vibe!` })
                .setTimestamp();

            try {
                await channel.send({ embeds: [embed] });
                console.log("[guildMemberAdd] Berhasil kirim embed ke welcome-goodbye.");
            } catch (err) {
                console.log(`[guildMemberAdd] Gagal kirim pesan welcome ke channel ${WELCOME_GOODBYE_CHANNEL_ID}:`, err.message);
            }
        } else {
            console.log("[guildMemberAdd] Channel welcome-goodbye TIDAK DITEMUKAN, cek ID:", WELCOME_GOODBYE_CHANNEL_ID);
        }

        // Pesan teks santai ke general-chat
        const generalChannel = member.guild.channels.cache.get(GENERAL_CHAT_ID);
        console.log("[guildMemberAdd] Cek generalChannel:", generalChannel ? generalChannel.name : "TIDAK DITEMUKAN");

        if (generalChannel) {
            const casualText =
                `Welcome, ${member}! Ada muka baru nih di sini. Spill dikit dong, ampir ke sini mau cari temen mabar, tempat ngobrol, atau sekadar nyari jodoh kwkwk.🤣`;

            try {
                await generalChannel.send(casualText);
                console.log("[guildMemberAdd] Berhasil kirim pesan santai ke general-chat.");
            } catch (err) {
                console.log(`[guildMemberAdd] Gagal kirim pesan santai ke general-chat ${GENERAL_CHAT_ID}:`, err.message);
            }
        } else {
            console.log("[guildMemberAdd] Channel general-chat TIDAK DITEMUKAN, cek ID:", GENERAL_CHAT_ID);
        }
    }
};