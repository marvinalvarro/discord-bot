const { EmbedBuilder } = require("discord.js");
const { getBalance } = require("../economy");

module.exports = {
    name: "balance",
    description: "Cek saldo coin kamu",
    execute(message, args, client) {
        const target = message.mentions.users.first() || message.author;
        const balance = getBalance(target.id);

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setDescription(`🪙 **${target.username}** punya **${balance.toLocaleString()} coin**`);

        message.channel.send({ embeds: [embed] });
    },
};