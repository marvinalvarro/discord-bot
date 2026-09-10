const { EmbedBuilder } = require("discord.js");
const { getEffectiveStreak, STREAK_CHANNEL_ID } = require("../streakTracker");

module.exports = {
    name: "streak",

    execute(message) {
        const target = message.mentions.users.first() || message.author;
        const { count, longest, lastDate } = getEffectiveStreak(target.id);

        const isOwnStreak = target.id === message.author.id;
        const title = isOwnStreak ? "🔥 Streak Kamu" : `🔥 Streak ${target.username}`;

        let statusText;
        if (count === 0 && !lastDate) {
            statusText = `Belum pernah kirim pesan di <#${STREAK_CHANNEL_ID}> nih. Yuk mulai streak-nya!`;
        } else if (count === 0) {
            statusText = `Streak-nya udah putus 💔 Yuk mulai lagi dari 0 dengan kirim pesan di <#${STREAK_CHANNEL_ID}> hari ini!`;
        } else {
            statusText = `Lagi jalan **${count} hari** berturut-turut! Terus kirim pesan tiap hari di <#${STREAK_CHANNEL_ID}> biar api-nya gak padam 🔥`;
        }

        const embed = new EmbedBuilder()
            .setColor(0xFF6B35)
            .setTitle(title)
            .setThumbnail(target.displayAvatarURL({ extension: "png", size: 256 }))
            .setDescription(statusText)
            .addFields(
                { name: "🔥 Streak Sekarang", value: `${count} hari`, inline: true },
                { name: "🏆 Rekor Terpanjang", value: `${longest} hari`, inline: true }
            )
            .setFooter({ text: "Game Verse • Streak Harian" });

        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    },
};