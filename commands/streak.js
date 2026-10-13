// commands/streak.js
const { AttachmentBuilder } = require("discord.js");
const { getEffectiveStreak, STREAK_CHANNEL_ID } = require("../streakTracker");
const { generateStreakCard } = require("../streakCardGenerator");

function todayJakarta() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
}

module.exports = {
    name: "streak",

    async execute(message) {
        const target = message.mentions.users.first() || message.author;
        const { count, longest, lastDate } = getEffectiveStreak(target.id);
        const isOwn = target.id === message.author.id;

        let statusText;
        if (count === 0 && !lastDate) {
            statusText = `Belum pernah kirim pesan di <#${STREAK_CHANNEL_ID}> nih. Yuk mulai streak-nya!`;
        } else if (count === 0) {
            statusText = `Streak-nya udah putus 💔 Yuk mulai lagi dengan kirim pesan di <#${STREAK_CHANNEL_ID}> hari ini!`;
        } else {
            statusText = `${isOwn ? "Streakmu" : `Streak **${target.username}**`} sekarang **${count} hari** berturut-turut! Terus kirim pesan tiap hari di <#${STREAK_CHANNEL_ID}> 🎮`;
        }
        statusText += `\n🏆 Rekor terpanjang: **${longest} hari**`;

        try {
            await message.channel.sendTyping();
            const buf = await generateStreakCard({
                user1Name: target.username,
                user1Avatar: target.displayAvatarURL({ extension: "png", size: 256 }),
                days: count,
                user1Badge: lastDate === todayJakarta() ? "done" : "wait",
                label: "HARI",
            });
            return message.reply({
                content: statusText,
                files: [new AttachmentBuilder(buf, { name: "streak.png" })],
                allowedMentions: { repliedUser: false },
            });
        } catch (err) {
            console.log("[streak] gagal bikin kartu:", err);
            return message.reply({ content: statusText, allowedMentions: { repliedUser: false } });
        }
    },
};