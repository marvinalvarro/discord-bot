const fs = require("fs");
const path = require("path");
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, AttachmentBuilder } = require("discord.js");
const { generateBirthdayCard } = require("./birthdayCardGenerator");

// Pesan ucapan ulang tahun
const BIRTHDAY_MESSAGE = "Semoga di umur yang baru ini kamu selalu diberikan kesehatan, kebahagiaan, dan keberuntungan.\nSemoga semua yang kamu harapkan dan perjuangkan bisa perlahan terwujud. Tetap jadi versi terbaik dari diri kamu, dan semoga tahun ini membawa banyak hal baik buat kamu. 🤍✨";

// GIF ulang tahun disimpan sebagai FILE di folder "birthdayGifs" (sejajar file ini),
// bukan link Discord CDN, karena link CDN bisa kedaluwarsa. Taruh 1 atau lebih file
// (.gif/.png/.jpg/.webp) di situ, nanti dipilih random tiap kirim ucapan.
const GIF_DIR = path.join(__dirname, "birthdayGifs");

function pickRandomGif() {
    try {
        const list = fs.readdirSync(GIF_DIR).filter((f) => /\.(gif|png|jpe?g|webp)$/i.test(f));
        if (list.length === 0) return null;
        const file = list[Math.floor(Math.random() * list.length)];
        return { filePath: path.join(GIF_DIR, file), ext: path.extname(file).toLowerCase() };
    } catch (err) {
        return null; // folder belum ada
    }
}

/**
 * Kirim pesan ulang tahun lengkap (kartu + GIF + tombol interaktif + thread) ke sebuah channel.
 * Dipakai oleh command manual `.ultah` maupun sistem penjadwalan otomatis.
 *
 * @param {import("discord.js").TextChannel} channel - channel tujuan pesan dikirim
 * @param {import("discord.js").User} user - user yang lagi ulang tahun
 * @returns {Promise<import("discord.js").Message|null>}
 */
async function sendBirthdayMessage(channel, user) {
    const embeds = [];
    const files = [];

    // ===============================
    // KARTU UCAPAN ULANG TAHUN (gambar custom, style cute)
    // ===============================
    try {
        const cardBuffer = await generateBirthdayCard({
            username: user.username,
            avatarURL: user.displayAvatarURL({ extension: "png", size: 512 }),
            message: BIRTHDAY_MESSAGE,
            userId: user.id,
        });

        files.push({ attachment: cardBuffer, name: "birthday_card.png" });

        const cardEmbed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setImage("attachment://birthday_card.png");

        embeds.push(cardEmbed);
    } catch (err) {
        console.error("[birthdaySender] Gagal generate kartu ucapan:", err.message);
        // Kalau gagal generate gambar, tetap lanjut kirim GIF + teks sederhana
        embeds.push(
            new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle("🎂 Happy Birthday!")
                .setDescription(`Happy birthday yaa, ${user}! 🥳🎉\n\n${BIRTHDAY_MESSAGE}\n\n— Dari seluruh warga Game Verse🎮`)
        );
    }

    // Embed kedua khusus buat GIF (di-upload dari file lokal, jadi gak bisa kedaluwarsa)
    const gif = pickRandomGif();
    if (gif) {
        const gifName = `birthday_gif${gif.ext}`;
        files.push(new AttachmentBuilder(gif.filePath, { name: gifName }));
        embeds.push(
            new EmbedBuilder()
                .setColor(0xFFD700)
                .setImage(`attachment://${gifName}`)
        );
    } else {
        console.log("[birthdaySender] Folder birthdayGifs kosong / belum ada, pesan dikirim tanpa GIF.");
    }

    // Tombol interaktif: Ikut Rayain (counter) + Kirim Ucapan Juga (modal)
    const rayainButton = new ButtonBuilder()
        .setCustomId(`ultah_rayain|${user.id}`)
        .setLabel("🎉 Ikut Rayain! (0)")
        .setStyle(ButtonStyle.Primary);

    const ucapanButton = new ButtonBuilder()
        .setCustomId(`ultah_ucapan|${user.id}`)
        .setLabel("💌 Kirim Ucapan Juga")
        .setStyle(ButtonStyle.Secondary);

    const buttonRow = new ActionRowBuilder().addComponents(rayainButton, ucapanButton);

    try {
        const sentMessage = await channel.send({
            content: `${user}`,
            embeds,
            files,
            components: [buttonRow],
            allowedMentions: { users: [user.id] },
        });

        // Auto react emoji rame-rame biar kesan makin meriah
        const celebrationEmojis = ["🎉", "🥳", "❤️", "🎂"];
        for (const emoji of celebrationEmojis) {
            await sentMessage.react(emoji).catch(() => {});
        }

        // Bikin thread khusus biar semua ucapan dari "Kirim Ucapan Juga" ngumpul rapi
        try {
            await sentMessage.startThread({
                name: `🎉 Ucapan buat ${user.username}`,
                autoArchiveDuration: 1440, // auto-archive setelah 1 hari gak ada aktivitas
            });
        } catch (err) {
            console.log("[birthdaySender] Gagal bikin thread ucapan:", err.message);
        }

        return sentMessage;
    } catch (err) {
        console.error("[birthdaySender] Gagal kirim pesan ulang tahun:", err.message);
        return null;
    }
}

module.exports = { sendBirthdayMessage };