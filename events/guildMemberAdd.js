const { EmbedBuilder } = require("discord.js");

// Ganti ID channel welcome-goodbye di server kamu
const WELCOME_GOODBYE_CHANNEL_ID = "1477885865584885860";

// ID channel general-chat
const GENERAL_CHAT_ID = "1520226091107618957";

// GIF welcome banner
const WELCOME_GIF_URL = "https://cdn.discordapp.com/attachments/1391005977393758218/1397859323455078481/3ee9ac3d-671a-4e2a-98a0-c3d4cf9c5aee.gif";

module.exports = {
    name: "guildMemberAdd",

    async execute(member) {
        console.log("[guildMemberAdd] Event triggered untuk member:", member.user.tag);

        const channel = member.guild.channels.cache.get(WELCOME_GOODBYE_CHANNEL_ID);

        if (channel) {
            const RULES_CHANNEL_ID = "1526127278621200456";
            const GUIDE_CHANNEL_ID = "1531194725854482544";

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setDescription(
                    `🎉 Selamat datang, ${member}! Lu resmi jadi bagian dari **Game Verse** sekarang!\n\n` +
                    `Di sini tempatnya nongkrong, mabar, dan ngobrol bareng warga yang asik-asik. Jangan malu-malu, langsung aja gaskeun ngobrol di channel yang ada 🔥\n\n` +
                    `Sebelum itu, jangan lupa mampir dulu ke <#${RULES_CHANNEL_ID}> biar tau aturan main di sini, sama <#${GUIDE_CHANNEL_ID}> kalau lu masih baru banget pake Discord.\n\n` +
                    `Have fun & enjoy the vibe, warga! ✨`
                )
                .setThumbnail(member.user.displayAvatarURL({ extension: "png", size: 256 }))
                .setImage(WELCOME_GIF_URL)
                .setFooter({ text: `Member ke-${member.guild.memberCount}` })
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
            const RULES_CHANNEL_ID = "1526127278621200456";
            const GUIDE_CHANNEL_ID = "1531194725854482544";

            const casualText =
                `Halo, ${member}! 🎊 Welcome to **Game Verse**! Langsung gas gabung ngobrol aja, gausah malu-malu, warga sini asbun dan open semua kok wkwk.\n\n` +
                `Oh iya, biar mabar, nongkrongnya aman dan tentram, tolong dibaca dulu yak <#${RULES_CHANNEL_ID}>. Terus buat lu yang mungkin baru main Discord, bisa cek <#${GUIDE_CHANNEL_ID}> biar ga bingung. Salken dan enjoy di Game Verse! ✨`;

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