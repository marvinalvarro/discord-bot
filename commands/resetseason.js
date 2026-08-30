const { PermissionsBitField } = require("discord.js");
const { startNewSeason, getCurrentSeason } = require("../seasonManager");

// Ganti/tambah ID di sini buat orang yang boleh reset season, selain admin server
const SEASON_ADMIN_IDS = ["1015666814325375067"]; // founder

module.exports = {
    name: "resetseason",
    description: "[ADMIN] Arsipin season sekarang, mulai season baru dari nol",
    async execute(message, args, client) {
        const isAdmin = message.member?.permissions.has(PermissionsBitField.Flags.Administrator);
        const isWhitelisted = SEASON_ADMIN_IDS.includes(message.author.id);

        if (!isAdmin && !isWhitelisted) {
            return message.reply("🚫 Command ini cuma buat admin/founder ya!");
        }

        const currentSeason = getCurrentSeason();

        // Konfirmasi dulu biar gak ke-pencet gak sengaja
        const confirmMsg = await message.reply(
            `⚠️ **Ini bakal ARSIPIN Season ${currentSeason} dan mulai Season ${currentSeason + 1} dari NOL.**\n` +
            `Semua role tier chat/voice bakal dicopot dari semua member.\n\n` +
            `React ✅ dalam 15 detik buat konfirmasi, atau abaikan buat batal.`
        );
        await confirmMsg.react("✅");

        const filter = (reaction, user) => reaction.emoji.name === "✅" && user.id === message.author.id;
        const collected = await confirmMsg.awaitReactions({ filter, max: 1, time: 15000 }).catch(() => null);

        if (!collected || collected.size === 0) {
            return confirmMsg.edit("❌ Reset season dibatalin (gak ada konfirmasi).");
        }

        await confirmMsg.edit("⏳ Lagi proses reset season, mohon tunggu (bisa agak lama kalau member banyak)...");

        try {
            const { archivedSeason, newSeason, strippedCount } = await startNewSeason(message.guild);
            await confirmMsg.edit(
                `✅ **Season ${archivedSeason} berhasil diarsipkan!**\n` +
                `🆕 **Season ${newSeason} dimulai dari nol.**\n` +
                `🎭 ${strippedCount} member di-strip role tier lama.\n\n` +
                `Cek leaderboard season lalu pakai \`.season ${archivedSeason}\``
            );
        } catch (err) {
            console.error("[resetseason] Error:", err);
            await confirmMsg.edit("❌ Gagal proses reset season, cek log server ya.");
        }
    },
};