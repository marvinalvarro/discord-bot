const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");

module.exports = {
    name: "setultah",

    async execute(message) {
        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle("🎂 Daftar Ulang Tahun Kamu")
            .setDescription(
                "Klik tombol di bawah buat daftarin tanggal lahir kamu.\n\n" +
                "Nanti pas hari ulang tahun kamu tiba, bot bakal otomatis ngucapin di channel ulang tahun server ini! 🎉"
            );

        const button = new ButtonBuilder()
            .setCustomId("buat_ultah_daftar")
            .setLabel("📅 Daftar Ulang Tahun")
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        await message.reply({ embeds: [embed], components: [row] });
    },
};