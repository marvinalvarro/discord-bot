const { EmbedBuilder } = require("discord.js");

// Ganti ID channel welcome-goodbye di server kamu (HARUS SAMA dengan guildMemberAdd.js)
const WELCOME_GOODBYE_CHANNEL_ID = "1477885865584885860";

module.exports = {
    name: "guildMemberRemove",

    async execute(member) {
        const channel = member.guild.channels.cache.get(WELCOME_GOODBYE_CHANNEL_ID);

        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription(
                `😢 **${member.user.tag}** baru aja left dari **Game Verse**...\n\n` +
                `Padahal seru-serunya mabar bareng, eh malah cabut duluan. Semoga suatu saat balik lagi ya, pintu Game Verse selalu kebuka buat lu kok 🚪✨`
            )
            .setThumbnail(member.user.displayAvatarURL({ extension: "png", size: 256 }))
            .setFooter({ text: `Sisa member: ${member.guild.memberCount}` })
            .setTimestamp();

        channel.send({ embeds: [embed] });
    }
};