const { EmbedBuilder } = require("discord.js");
const config = require("../config");

// Deskripsi manual buat tiap command (opsional, biar help-nya lebih informatif)
// Kalau ada command baru yang belum didaftarin di sini, tetep bakal muncul
// tapi pake deskripsi default.
const commandDescriptions = {
    ping: "Cek kecepatan respon bot (latency)",
    say: "Bikin bot ngomong sesuai teks yang lu kasih",
    avatar: "Nampilin foto profil (avatar) member",
    panduan: "Buku panduan lengkap seputar server Game Verse",
    help: "Nampilin daftar command ini",
};

module.exports = {
    name: "help",

    async execute(message, args, client) {
        const commandList = [...client.commands.keys()]
            .sort()
            .map((name) => {
                const desc = commandDescriptions[name] || "Belum ada deskripsi";
                return `> **${config.prefix}${name}** — ${desc}`;
            })
            .join("\n");

        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle("📖 DAFTAR COMMAND GAME VERSE BOT")
            .setDescription(
                `Semua command di bawah ini bisa dipake **semua member**, gratis tanpa syarat apa-apa!\n\n` +
                `${commandList}\n\n` +
                `━━━━━━━━━━━━━━━━━━━\n` +
                `**🤖 CHAT SAMA AI (Gemini)**\n` +
                `Mau ngobrol bebas / nanya-nanya ke bot? Tinggal **mention** bot ini terus tulis pertanyaan lu.\n\n` +
                `🔒 Fitur ini khusus buat **Server Booster** atau role **VIP** ya! Kalau lu belum booster/VIP, lu tetep bisa pake command-command di atas kok, cuma chat AI bebasnya aja yang di-lock.\n\n` +
                `Mau akses AI-nya? Boost server ini atau support server ini di logs-vip 😉`
            )
            .setFooter({ text: `Total: ${client.commands.size} command tersedia` });

        await message.reply({ embeds: [embed] });
    },
};