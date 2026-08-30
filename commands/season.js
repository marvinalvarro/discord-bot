const { EmbedBuilder } = require("discord.js");
const { getArchivedLeaderboard, getCurrentSeason } = require("../seasonManager");

module.exports = {
    name: "season",
    description: "Lihat leaderboard voice/chat dari season yang udah lewat. Contoh: .season 1 voice",
    async execute(message, args, client) {
        const currentSeason = getCurrentSeason();
        const seasonNumber = parseInt(args[0], 10);
        const type = (args[1] || "voice").toLowerCase();

        if (isNaN(seasonNumber)) {
            return message.reply(
                `Format: \`.season <nomor> <voice/chat>\`. Contoh: \`.season 1 voice\`\n` +
                `Season sekarang: **${currentSeason}** (season yang udah selesai: 1-${currentSeason - 1})`
            );
        }

        if (!["voice", "chat"].includes(type)) {
            return message.reply("Tipe harus 'voice' atau 'chat' ya! Contoh: `.season 1 voice`");
        }

        const data = getArchivedLeaderboard(type, seasonNumber);

        if (!data) {
            return message.reply(`Data Season ${seasonNumber} (${type}) gak ketemu. Pastiin nomor season-nya bener.`);
        }

        const sorted = Object.entries(data)
            .sort(([, a], [, b]) => b.level - a.level || b.xp - a.xp)
            .slice(0, 10);

        if (sorted.length === 0) {
            return message.reply(`Gak ada data di Season ${seasonNumber} (${type}).`);
        }

        const medals = ["🥇", "🥈", "🥉"];
        const lines = sorted.map(([userId, u], i) => {
            const rankLabel = medals[i] || `**${i + 1}.**`;
            return `${rankLabel} <@${userId}> — Level **${u.level}** (${u.xp} XP)`;
        });

        const embed = new EmbedBuilder()
            .setColor(type === "voice" ? 0x1ABC9C : 0x9B59B6)
            .setTitle(`🏆 Leaderboard Season ${seasonNumber} — ${type === "voice" ? "Voice" : "Chat"}`)
            .setDescription(lines.join("\n"))
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    },
};