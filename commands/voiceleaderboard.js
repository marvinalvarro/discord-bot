const { loadData } = require("../voiceXP");

module.exports = {
    name: "voiceleaderboard",
    description: "Lihat top 10 user dengan level voice tertinggi",
    execute(message, args, client) {
        const data = loadData();

        const sorted = Object.entries(data)
            .sort(([, a], [, b]) => b.level - a.level || b.xp - a.xp)
            .slice(0, 10);

        if (sorted.length === 0) {
            return message.channel.send("Belum ada data XP voice sama sekali.");
        }

        const lines = sorted.map(([userId, u], i) => {
            return `**${i + 1}.** <@${userId}> — Level ${u.level} (${u.xp} XP)`;
        });

        message.channel.send(`🏆 **Leaderboard Voice XP**\n\n${lines.join("\n")}`);
    },
};