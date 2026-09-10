const { EmbedBuilder } = require("discord.js");
const { getAllStreaks, getEffectiveStreak, STREAK_CHANNEL_ID } = require("../streakTracker");

module.exports = {
    name: "streakleaderboard",

    execute(message) {
        const allData = getAllStreaks();
        const userIds = Object.keys(allData);

        if (userIds.length === 0) {
            return message.reply({
                content: `Belum ada yang punya streak nih. Yuk mulai kirim pesan di <#${STREAK_CHANNEL_ID}>!`,
                allowedMentions: { repliedUser: false },
            });
        }

        // Hitung streak yang masih aktif buat tiap user, urutin dari yang paling tinggi
        const ranked = userIds
            .map((userId) => {
                const { count } = getEffectiveStreak(userId);
                const username = allData[userId].username || "Unknown";
                return { userId, username, count };
            })
            .filter((entry) => entry.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        if (ranked.length === 0) {
            return message.reply({
                content: "Gak ada yang streak-nya masih nyala saat ini 😅 Yuk jadi yang pertama!",
                allowedMentions: { repliedUser: false },
            });
        }

        const medals = ["🥇", "🥈", "🥉"];
        const description = ranked
            .map((entry, i) => {
                const rank = medals[i] || `**${i + 1}.**`;
                return `${rank} <@${entry.userId}> — 🔥 ${entry.count} hari`;
            })
            .join("\n");

        const embed = new EmbedBuilder()
            .setColor(0xFF6B35)
            .setTitle("🔥 Leaderboard Streak Harian")
            .setDescription(description)
            .setFooter({ text: "Game Verse • Streak Harian" })
            .setTimestamp();

        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    },
};