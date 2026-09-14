const { PermissionsBitField } = require("discord.js");
const { handleDonationMessage, DONATION_CHANNEL_ID } = require("../donationTracker");

// Ganti/tambah ID di sini buat orang yang boleh backfill, selain admin server
const BACKFILL_ADMIN_IDS = ["1015666814325375067"]; // founder

module.exports = {
    name: "backfilldonasi",
    description: "[ADMIN] Scan history pesan donasi Saweria yang lama, masukin ke data leaderboard",

    async execute(message) {
        const isAdmin = message.member?.permissions.has(PermissionsBitField.Flags.Administrator);
        const isWhitelisted = BACKFILL_ADMIN_IDS.includes(message.author.id);

        if (!isAdmin && !isWhitelisted) {
            return message.reply("🚫 Command ini cuma buat admin/founder ya!");
        }

        const channel = message.guild.channels.cache.get(DONATION_CHANNEL_ID);

        if (!channel) {
            return message.reply("❌ Channel donasi gak ketemu, cek DONATION_CHANNEL_ID di donationTracker.js.");
        }

        const statusMsg = await message.reply("⏳ Lagi scan history pesan donasi, mohon tunggu...");

        let lastId = null;
        let totalScanned = 0;
        let totalCounted = 0;
        let keepGoing = true;
        const MAX_BATCHES = 30; // safety limit: 30 x 100 = 3000 pesan
        let batchCount = 0;

        try {
            while (keepGoing && batchCount < MAX_BATCHES) {
                const options = { limit: 100 };
                if (lastId) options.before = lastId;

                const batch = await channel.messages.fetch(options);

                if (batch.size === 0) {
                    keepGoing = false;
                    break;
                }

                for (const msg of batch.values()) {
                    totalScanned++;
                    const result = handleDonationMessage(msg);
                    if (result) totalCounted++;
                }

                lastId = batch.last().id;
                batchCount++;

                if (batch.size < 100) {
                    keepGoing = false; // udah abis, gak ada pesan lagi sebelum ini
                }
            }

            await statusMsg.edit(
                `✅ **Backfill selesai!**\n` +
                `📨 Total pesan di-scan: ${totalScanned}\n` +
                `💰 Donasi baru yang berhasil dimasukin: ${totalCounted}\n\n` +
                `Cek hasilnya pakai \`.topdonatur\``
            );
        } catch (err) {
            console.error("[backfilldonasi] Error:", err);
            await statusMsg.edit("❌ Gagal proses backfill, cek log server ya.");
        }
    },
};