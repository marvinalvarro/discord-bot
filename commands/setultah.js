const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, AttachmentBuilder } = require("discord.js");
const { generateSetultahCard } = require("../setultahCardGenerator");

module.exports = {
    name: "setultah",

    async execute(message) {
        const button = new ButtonBuilder()
            .setCustomId("buat_ultah_daftar")
            .setLabel("📅 Daftar Ulang Tahun")
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        try {
            const cardBuffer = generateSetultahCard();
            const attachment = new AttachmentBuilder(cardBuffer, { name: "setultah_card.png" });

            const embed = new EmbedBuilder()
                .setColor(0x4C6EF5)
                .setImage("attachment://setultah_card.png");

            await message.reply({ embeds: [embed], files: [attachment], components: [row] });
        } catch (err) {
            console.error("[setultah] Gagal generate poster daftar ultah:", err.message);
            await message.reply({
                content: "🎂 **Daftar Ulang Tahun Kamu**\nKlik tombol di bawah buat daftarin tanggal lahir kamu.",
                components: [row],
            }).catch(() => {});
        }
    },
};