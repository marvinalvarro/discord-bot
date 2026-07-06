const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Melihat ping bot"),

    async execute(interaction) {
        await interaction.reply(`🏓 Pong! ${interaction.client.ws.ping}ms`);
    },
};
