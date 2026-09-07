const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
const { generateBirthdayCard } = require("./birthdayCardGenerator");

// Pesan ucapan ulang tahun
const BIRTHDAY_MESSAGE = "Semoga di umur yang baru ini kamu selalu diberikan kesehatan, kebahagiaan, dan keberuntungan.\nSemoga semua yang kamu harapkan dan perjuangkan bisa perlahan terwujud. Tetap jadi versi terbaik dari diri kamu, dan semoga tahun ini membawa banyak hal baik buat kamu. 🤍✨";

// Beberapa GIF ulang tahun, dipilih random biar gak monoton
// Catatan: link Discord CDN di bawah ini punya masa berlaku (ada parameter ?ex=...),
// jadi kalau suatu saat GIF-nya berhenti muncul, upload ulang dan ganti link-nya.
const BIRTHDAY_GIFS = [
    "https://cdn.discordapp.com/attachments/1477893248226820188/1546348992441487370/download.gif?ex=6a9f7539&is=6a9e23b9&hm=398a0995e48cbf632bf3118afdbd49b297f676ef12bf4c28f36e80ac79743536&",
];

/**
 * Kirim pesan ulang tahun lengkap (kartu + GIF + tombol interaktif + thread) ke sebuah channel.
 * Dipakai oleh command manual `.ultah` maupun sistem penjadwalan otomatis.
 *
 * @param {import("discord.js").TextChannel} channel - channel tujuan pesan dikirim
 * @param {import("discord.js").User} user - user yang lagi ulang tahun
 * @returns {Promise<import("discord.js").Message|null>}
 */
async function sendBirthdayMessage(channel, user) {
    const randomGif = BIRTHDAY_GIFS[Math.floor(Math.random() * BIRTHDAY_GIFS.length)];

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

    // Embed kedua khusus buat GIF
    embeds.push(
        new EmbedBuilder()
            .setColor(0xFFD700)
            .setImage(randomGif)
    );

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