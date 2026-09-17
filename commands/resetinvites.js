const { PermissionsBitField } = require("discord.js");
const { resetAllInvites } = require("../inviteTracker");

// Ganti/tambah ID di sini buat orang yang boleh reset semua invite, selain admin server
const RESET_ALL_ADMIN_IDS = ["1015666814325375067"]; // founder

module.exports = {
    name: "resetallinvites",
    description: "[ADMIN] Reset invite valid SEMUA member ke 0, cabut semua role tier invite dari semua orang",

    async execute(message) {
        const isAdmin = message.member?.permissions.has(PermissionsBitField.Flags.Administrator);
        const isWhitelisted = RESET_ALL_ADMIN_IDS.includes(message.author.id);

        if (!isAdmin && !isWhitelisted) {
            return message.reply("🚫 Command ini cuma buat admin/founder ya!");
        }

        const confirmMsg = await message.reply(
            `⚠️ **Ini bakal RESET invite SEMUA member ke 0 dan CABUT semua role tier invite (GV Recruiter, GV Scout, dst) dari SEMUA orang.**\n` +
            `Aksi ini gak bisa dibatalin (data invite lama ilang semua).\n\n` +
            `React ✅ dalam 15 detik buat konfirmasi, atau abaikan buat batal.`
        );
        await confirmMsg.react("✅");

        const filter = (reaction, user) => reaction.emoji.name === "✅" && user.id === message.author.id;
        const collected = await confirmMsg.awaitReactions({ filter, max: 1, time: 15000 }).catch(() => null);

        if (!collected || collected.size === 0) {
            return confirmMsg.edit("❌ Reset semua invite dibatalin (gak ada konfirmasi).");
        }

        await confirmMsg.edit("⏳ Lagi proses reset semua invite, mohon tunggu (bisa agak lama kalau member banyak)...");

        try {
            const { strippedCount } = await resetAllInvites(message.guild);
            await confirmMsg.edit(
                `✅ **Semua invite berhasil di-reset ke 0!**\n` +
                `🎭 ${strippedCount} member di-strip role tier invite.`
            );
        } catch (err) {
            console.error("[resetallinvites] Error:", err);
            await confirmMsg.edit("❌ Gagal proses reset, cek log server ya.");
        }
    },
};