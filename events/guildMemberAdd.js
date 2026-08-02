const { EmbedBuilder } = require("discord.js");

// Ganti ID channel welcome-goodbye di server kamu
const WELCOME_GOODBYE_CHANNEL_ID = "1477885865584885860";

module.exports = {
    name: "guildMemberAdd",

    async execute(member) {
        const channel = member.guild.channels.cache.get(WELCOME_GOODBYE_CHANNEL_ID);

        if (!channel) return;

        // Ganti dua ID di bawah ini sesuai channel di server kamu
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
            .setFooter({ text: `Member ke-${member.guild.memberCount}` })
            .setTimestamp();

        channel.send({ embeds: [embed] });
    }
};