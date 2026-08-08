const { AttachmentBuilder } = require("discord.js");
const { loadData, getUser, xpNeededForLevel } = require("../chatXP");
const { generateRankCard } = require("../rankCard");

function getLeaderboardRank(data, userId) {
    const sorted = Object.entries(data).sort(
        ([, a], [, b]) => b.level - a.level || b.xp - a.xp
    );
    const index = sorted.findIndex(([id]) => id === userId);
    return index === -1 ? sorted.length + 1 : index + 1;
}

module.exports = {
    name: "rankchat",
    description: "Cek level & XP chat kamu atau orang lain",
    async execute(message, args, client) {
        const target = message.mentions.users.first() || message.author;

        const data = loadData();
        const user = getUser(data, target.id);
        const needed = xpNeededForLevel(user.level);
        const rank = getLeaderboardRank(data, target.id);

        const buffer = await generateRankCard({
            username: target.username,
            tag: `#${target.id.slice(-4)}`,
            avatarURL: target.displayAvatarURL({ extension: "png", size: 256 }),
            rank,
            level: user.level,
            xp: user.xp,
            xpNeeded: needed,
            accentColor: "#9B59B6",
        });

        const attachment = new AttachmentBuilder(buffer, { name: "rank-chat.png" });
        message.channel.send({ files: [attachment] });
    },
};