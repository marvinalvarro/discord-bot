const cron = require("node-cron");
const { AttachmentBuilder } = require("discord.js");
const { generateDonationLeaderboard } = require("./donationLeaderboardGenerator");
const {
    getMonthlyLeaderboard,
    getMonthLabel,
    getPreviousMonthKey,
    attachDonatorAvatars,
    DONATION_CHANNEL_ID,
} = require("./donationTracker");

async function postMonthlyRecap(client) {
    const prevMonthKey = getPreviousMonthKey();
    const leaderboard = getMonthlyLeaderboard(prevMonthKey);

    if (!leaderboard || leaderboard.entries.length === 0) {
        console.log(`[donationScheduler] Gak ada data donasi buat bulan ${prevMonthKey}, skip posting.`);
        return;
    }

    try {
        const channel = await client.channels.fetch(DONATION_CHANNEL_ID);
        if (!channel) {
            console.log("[donationScheduler] Channel donasi tidak ditemukan.");
            return;
        }

        const entriesWithAvatars = await attachDonatorAvatars(channel.guild, leaderboard.entries);

        const buffer = await generateDonationLeaderboard({
            monthLabel: getMonthLabel(prevMonthKey),
            entries: entriesWithAvatars,
            total: leaderboard.total,
        });

        const attachment = new AttachmentBuilder(buffer, { name: "top_donatur.png" });

        await channel.send({
            content: "📊 **Rekap Top Donatur Bulan Lalu!**",
            files: [attachment],
        });

        console.log(`[donationScheduler] Berhasil posting rekap donasi bulan ${prevMonthKey}.`);
    } catch (err) {
        console.error("[donationScheduler] Gagal posting rekap donasi:", err.message);
    }
}

/**
 * Jalankan ini sekali di index.js setelah bot ready:
 * const { startDonationScheduler } = require("./donationScheduler");
 * startDonationScheduler(client);
 */
function startDonationScheduler(client) {
    // Jalan tanggal 1 tiap bulan, jam 00:05 waktu Jakarta
    cron.schedule("5 0 1 * *", () => {
        postMonthlyRecap(client);
    }, {
        timezone: "Asia/Jakarta",
    });

    console.log("[donationScheduler] Rekap donasi bulanan dijadwalkan tiap tanggal 1 jam 00:05 (Asia/Jakarta).");
}

module.exports = { startDonationScheduler, postMonthlyRecap };