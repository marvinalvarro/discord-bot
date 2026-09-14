const { AttachmentBuilder, EmbedBuilder } = require("discord.js");
const { generateDonationLeaderboard } = require("../donationLeaderboardGenerator");
const { getMonthlyLeaderboard, getMonthLabel, getCurrentMonthKey, attachDonatorAvatars } = require("../donationTracker");

function formatRupiah(amount) {
    return "Rp " + amount.toLocaleString("id-ID");
}

function getRankEmoji(rank) {
    const medals = ["🥇", "🥈", "🥉"];
    if (rank <= 3) return medals[rank - 1];
    const keycaps = { 4: "4️⃣", 5: "5️⃣", 6: "6️⃣", 7: "7️⃣", 8: "8️⃣", 9: "9️⃣", 10: "🔟" };
    return keycaps[rank] || `${rank}.`;
}

module.exports = {
    name: "topdonatur",

    async execute(message) {
        const monthKey = getCurrentMonthKey();
        const leaderboard = getMonthlyLeaderboard(monthKey);

        if (!leaderboard || leaderboard.entries.length === 0) {
            return message.reply({
                content: "Belum ada donasi tercatat bulan ini 😊",
                allowedMentions: { repliedUser: false },
            });
        }

        try {
            const entriesWithAvatars = await attachDonatorAvatars(message.guild, leaderboard.entries);
            const monthLabel = getMonthLabel(monthKey);

            const buffer = await generateDonationLeaderboard({
                monthLabel,
                entries: entriesWithAvatars,
                total: leaderboard.total,
            });

            const attachment = new AttachmentBuilder(buffer, { name: "top_donatur.png" });

            // List rank 4-10 (rank 1-3 udah kelihatan di gambar podium)
            const top10 = entriesWithAvatars.slice(0, 10);
            const listLines = top10.map((entry, i) => {
                const rank = i + 1;
                return `${getRankEmoji(rank)} \`${entry.name}\` : **${formatRupiah(entry.amount)}**`;
            });

            const embed = new EmbedBuilder()
                .setColor(0x22c7de)
                .setTitle("🏆 TOP DONATUR SERVER")
                .setDescription(`**Month : ${monthLabel}**\n\n${listLines.join("\n")}\n\nTotal Donasi: **${formatRupiah(leaderboard.total)}** | Terimakasih kepada semua donatur ❤️`)
                .setImage("attachment://top_donatur.png");

            await message.reply({ embeds: [embed], files: [attachment], allowedMentions: { repliedUser: false } });
        } catch (err) {
            console.error("[topdonatur] Gagal generate leaderboard:", err.message);
            await message.reply({
                content: "Gagal nampilin leaderboard donasi, coba lagi nanti ya.",
                allowedMentions: { repliedUser: false },
            }).catch(() => {});
        }
    },
};