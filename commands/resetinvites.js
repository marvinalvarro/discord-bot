const { PermissionsBitField } = require("discord.js");
const { resetUserInvites } = require("../inviteTracker");

// Ganti/tambah ID di sini buat orang yang boleh reset invite, selain admin server
const RESET_INVITE_ADMIN_IDS = ["1015666814325375067"]; // founder

module.exports = {
    name: "resetinvites",
    description: "[ADMIN] Reset invite valid seseorang ke 0, otomatis cabut role tier invite-nya juga",

    async execute(message, args) {
        const isAdmin = message.member?.permissions.has(PermissionsBitField.Flags.Administrator);
        const isWhitelisted = RESET_INVITE_ADMIN_IDS.includes(message.author.id);

        if (!isAdmin && !isWhitelisted) {
            return message.reply("🚫 Command ini cuma buat admin/founder ya!");
        }

        const user = message.mentions.users.first();

        if (!user) {
            return message.reply({
                content: "Tag dulu orangnya ya, contoh: `.resetinvites @user`",
                allowedMentions: { repliedUser: false },
            });
        }

        try {
            const { previousCount, removedRoles } = await resetUserInvites(message.guild, user.id);

            return message.reply({
                content:
                    `✅ Invite ${user} berhasil di-reset dari **${previousCount}** ke **0**.\n` +
                    (removedRoles
                        ? "🎭 Role tier invite-nya juga udah dicabut."
                        : "ℹ️ User ini gak punya role tier invite buat dicabut."),
                allowedMentions: { repliedUser: false, users: [] },
            });
        } catch (err) {
            console.error("[resetinvites] Error:", err);
            return message.reply({
                content: "❌ Gagal reset invite, cek log server ya.",
                allowedMentions: { repliedUser: false },
            }).catch(() => {});
        }
    },
};