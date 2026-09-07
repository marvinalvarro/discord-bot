const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, AttachmentBuilder } = require("discord.js");
const { generateCakeIcon } = require("../cakeIconGenerator");

module.exports = {
    name: "setultah",

    async execute(message) {
        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle("🎂 Daftar Ulang Tahun Kamu")
            .setDescription(
                "Daftarin tanggal lahir kamu sekali aja, dan biarkan bot yang inget-inget buat kamu! 🎉\n\n" +
                "Pas hari ulang tahun kamu tiba, bot bakal otomatis kirim kartu ucapan + GIF spesial ke channel ulang tahun server ini."
            )
            .addFields(
                { name: "📋 Cara Daftar", value: "Klik tombol **Daftar Ulang Tahun** di bawah, lalu isi form yang muncul.", inline: false },
                { name: "📅 Format Tanggal", value: "`DD-MM-YYYY`\ncontoh: `17-08-2005`", inline: false }
            )
            .setThumbnail("attachment://cake_icon.png")
            .setFooter({ text: "Game Verse • Sistem Ulang Tahun Otomatis" })
            .setTimestamp();

        const button = new ButtonBuilder()
            .setCustomId("buat_ultah_daftar")
            .setLabel("📅 Daftar Ulang Tahun")
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        let files = [];
        try {
            const iconBuffer = generateCakeIcon();
            files = [new AttachmentBuilder(iconBuffer, { name: "cake_icon.png" })];
        } catch (err) {
            console.log("[setultah] Gagal generate ikon kue, lanjut tanpa thumbnail:", err.message);
            embed.setThumbnail(null);
        }

        await message.reply({ embeds: [embed], components: [row], files });
    },
};