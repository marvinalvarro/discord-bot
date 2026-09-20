const { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    name: "taaruf",

    async execute(message, args, client) {
        const embed = new EmbedBuilder()
            .setColor(0x4fe1ca)
            .setTitle("📋 Bikin CV Ta'aruf Game Verse")
            .setDescription("Klik tombol di bawah buat bikin CV Ta'aruf kamu!");

        const button = new ButtonBuilder()
            .setCustomId("buat_cv_taaruf")
            .setLabel("Buat CV")
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        await message.reply({ embeds: [embed], components: [row] });
    },
};