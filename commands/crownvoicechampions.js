const { PermissionsBitField } = require("discord.js");
const { loadData } = require("../voiceXP");

// Ganti/tambah ID di sini buat orang yang boleh crown champions, selain admin server
const CROWN_ADMIN_IDS = ["1015666814325375067"]; // founder

module.exports = {
    name: "crownvoicechampions",
    description: "[ADMIN] Kasih role juara 1/2/3 ke top voice leaderboard sekarang. Format: .crownvoicechampions <roleId1> <roleId2> <roleId3>",
    async execute(message, args, client) {
        const isAdmin = message.member?.permissions.has(PermissionsBitField.Flags.Administrator);
        const isWhitelisted = CROWN_ADMIN_IDS.includes(message.author.id);

        if (!isAdmin && !isWhitelisted) {
            return message.reply("🚫 Command ini cuma buat admin/founder ya!");
        }

        const [role1, role2, role3] = args;

        if (!role1 || !role2 || !role3) {
            return message.reply(
                "Format: `.crownvoicechampions <roleId_juara1> <roleId_juara2> <roleId_juara3>`\n" +
                "Contoh: `.crownvoicechampions 123... 456... 789...`"
            );
        }

        const data = loadData();
        const sorted = Object.entries(data)
            .sort(([, a], [, b]) => b.level - a.level || b.xp - a.xp)
            .slice(0, 3);

        if (sorted.length < 3) {
            return message.reply("Data voice leaderboard belum cukup buat nentuin 3 juara.");
        }

        const roleIds = [role1, role2, role3];
        const medals = ["🥇", "🥈", "🥉"];
        const results = [];

        for (let i = 0; i < 3; i++) {
            const [userId, stats] = sorted[i];
            try {
                const member = await message.guild.members.fetch(userId);
                await member.roles.add(roleIds[i]);
                results.push(`${medals[i]} ${member} — Level ${stats.level} (${stats.xp} XP)`);
            } catch (err) {
                console.error(`[crownvoicechampions] Gagal kasih role ke ${userId}:`, err.message);
                results.push(`${medals[i]} <@${userId}> — ⚠️ gagal kasih role (${err.message})`);
            }
        }

        message.channel.send(
            `👑 **JUARA VOICE SEASON INI!**\n\n${results.join("\n")}\n\n` +
            `Role juara udah dipasang dan bakal TETAP NEMPEL walau nanti \`.resetseason\` dijalanin.`
        );
    },
};