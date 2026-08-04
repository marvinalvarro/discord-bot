const { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    name: "ktp",

    async execute(message, args, client) {
        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle("🪪 Bikin KTP Digital Game Verse")
            .setDescription("Klik tombol di bawah buat bikin KTP digital kamu!");

        const button = new ButtonBuilder()
            .setCustomId("buat_ktp")
            .setLabel("Buat KTP")
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        await message.reply({ embeds: [embed], components: [row] });
    },
};