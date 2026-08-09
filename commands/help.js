const { EmbedBuilder } = require("discord.js");
const config = require("../config");

// Ganti ID ini sesuai channel vip-logs / info VIP di server kamu
const VIP_LOGS_CHANNEL_ID = "1531039427948843110";

// Command yang gak mau ditampilin di daftar .help (misal command internal/testing)
const HIDDEN_COMMANDS = ["testqotd"];

// Deskripsi manual buat tiap command (opsional, biar help-nya lebih informatif)
// Kalau ada command baru yang belum didaftarin di sini, tetep bakal muncul
// tapi pake deskripsi default.
const commandDescriptions = {
    ping: "Cek kecepatan respon bot (latency)",
    say: "Bikin bot ngomong sesuai teks yang lu kasih",
    avatar: "Nampilin foto profil (avatar)",
    panduan: "Buku panduan lengkap seputar server Game Verse",
    help: "Nampilin daftar command ini",
    rank: "Cek level & XP voice kamu (atau orang lain kalau di-tag)",
    rankchat: "Cek level & XP chat kamu (atau orang lain kalau di-tag)",
    voiceleaderboard: "Lihat top 10 user dengan level voice tertinggi",
    balance: "Cek saldo coin kamu (atau orang lain kalau di-tag)",
    tebakangka: "Tebak angka rahasia 1-100 lewat chat, menang dapat coin",
    trivia: "Jawab kuis seputar game pakai reaction, bener dapat coin",
    slot: "Main slot machine, taruhan coin buat menang lebih banyak",
    blackjack: "Main blackjack lawan bot (dealer), taruhan coin",
    tictactoe: "Main tic-tac-toe 1v1 lawan orang lain (tag orangnya)",
    ktp: "Bikin KTP warga Game Verse kamu sendiri",
};

module.exports = {
    name: "help",

    async execute(message, args, client) {
        const commandList = [...client.commands.keys()]
            .filter((name) => !HIDDEN_COMMANDS.includes(name))
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
                `**🏆 SISTEM LEVEL & XP**\n` +
                `Kamu **otomatis** dapat XP tanpa perlu command apapun:\n\n` +
                `> 🎙️ **Voice XP** — dapet XP tiap menit selama kamu ada di voice channel\n` +
                `> 💬 **Chat XP** — dapet XP tiap kirim pesan (ada jeda dikit biar gak spam)\n\n` +
                `Pas level kamu naik, bakal ada notif otomatis muncul di channel khusus. Cek progress kapan aja pake \`${config.prefix}rank\` (voice) atau \`${config.prefix}rankchat\` (chat).\n\n` +
                `━━━━━━━━━━━━━━━━━━━\n` +
                `**🎮 GAME & COIN**\n` +
                `Main game buat ngumpulin **coin** (dimulai dari 100 coin gratis):\n\n` +
                `> 🔢 **${config.prefix}tebakangka** — tebak angka lewat chat\n` +
                `> 🧠 **${config.prefix}trivia** — kuis seputar game\n` +
                `> 🎰 **${config.prefix}slot [taruhan]** — spin buat untung-untungan\n` +
                `> 🃏 **${config.prefix}blackjack [taruhan]** — lawan dealer bot\n` +
                `> 🎯 **${config.prefix}tictactoe @lawan** — 1v1 lawan temen\n\n` +
                `Cek saldo kapan aja pake \`${config.prefix}balance\`. Semua game cuma bisa dimainkan di channel game ya!\n\n` +
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
                `Mau akses AI-nya? Boost server ini, **atau** donasi VIP di https://saweria.co/marvinalvarro (link juga ada di bio founder @marvinalvarro). Abis transfer, bisa di lihat di <#${VIP_LOGS_CHANNEL_ID}> ya, nanti role VIP bakal di-assign manual sama admin 😉`
            )
            .setFooter({ text: `Total: ${client.commands.size} command tersedia` });

        await message.reply({ embeds: [embed] });
    },
};