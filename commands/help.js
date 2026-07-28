const { EmbedBuilder } = require("discord.js");
const config = require("../config");

// Ganti ID ini sesuai channel vip-logs / info VIP di server kamu
const VIP_LOGS_CHANNEL_ID = "1531039427948843110";

// Deskripsi manual buat tiap command (opsional, biar help-nya lebih informatif)
// Kalau ada command baru yang belum didaftarin di sini, tetep bakal muncul
// tapi pake deskripsi default.
const commandDescriptions = {
    ping: "Cek kecepatan respon bot (latency)",
    say: "Bikin bot ngomong sesuai teks yang lu kasih",
    avatar: "Nampilin foto profil (avatar)",
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
                `**💬 FUN AUTO-RESPON (tanpa prefix!)**\n` +
                `Ketik langsung salah satu kata di bawah + tag orangnya, gak perlu prefix ${config.prefix}:\n\n` +
                `> **hy/hai/hi/halo sayang** @orang — gombalan manis\n` +
                `> **hy/hai/hi/halo ganteng/cantik** @orang — gombalan manis\n` +
                `> **peluk** @orang — bot peyukin orangnya\n` +
                `> **cium** @orang — bot ciumin orangnya\n` +
                `> **pap / mana pap** @orang — kirim PAP orangnya\n\n` +
                `Contoh: \`hy sayang @moon\`\n\n` +
                `━━━━━━━━━━━━━━━━━━━\n` +
                `**🤖 CHAT SAMA SAYA (NOVA VERSE)**\n` +
                `Mau ngobrol bebas / nanya-nanya ke bot? Tinggal **mention** bot ini terus tulis pertanyaan lu.\n\n` +
                `🔒 Fitur ini khusus buat **Server Booster** atau role **VIP** ya! Kalau lu belum booster/VIP, lu tetep bisa pake command-command di atas kok, cuma chat AI bebasnya aja yang di-lock.\n\n` +
                `Mau akses AI-nya? Boost server ini atau cek cara dapetin role VIP di <#${VIP_LOGS_CHANNEL_ID}> 😉`
            )
            .setFooter({ text: `Total: ${client.commands.size} command tersedia` });

        await message.reply({ embeds: [embed] });
    },
};