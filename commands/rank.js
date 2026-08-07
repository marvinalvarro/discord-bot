const { loadData, getUser, xpNeededForLevel } = require("../voiceXP");

module.exports = {
    name: "rank",
    description: "Cek level & XP voice kamu atau orang lain",
    execute(message, args, client) {
        const target = message.mentions.users.first() || message.author;

        const data = loadData();
        const user = getUser(data, target.id);
        const needed = xpNeededForLevel(user.level);

        message.channel.send(
            `📊 **Rank Voice — ${target.username}**\n` +
            `Level: **${user.level}**\n` +
            `XP: **${user.xp} / ${needed}**\n` +
            `Total waktu voice tercatat: **${Math.round(user.voiceMinutes)} menit**`
        );
    },
};