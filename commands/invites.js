const { loadData, getUser, getTierForCount } = require("../inviteTracker");

module.exports = {
    name: "invites",
    description: "Cek jumlah invite valid kamu atau orang lain",
    execute(message, args, client) {
        const target = message.mentions.users.first() || message.author;

        const data = loadData();
        const user = getUser(data, target.id);
        const tier = getTierForCount(user.validInvites);

        message.channel.send(
            `📨 **Invite — ${target.username}**\n` +
            `Total invite valid: **${user.validInvites}**\n` +
            `Rank sekarang: **${tier ? tier.title : "Belum ada rank"}**`
        );
    },
};