const { EmbedBuilder } = require("discord.js");
const config = require("../config");

// Ganti ID ini sesuai channel vip-logs / info VIP di server kamu
const VIP_LOGS_CHANNEL_ID = "1531039427948843110";

// Command yang gak mau ditampilin di daftar .help (misal command internal/testing/admin)
const HIDDEN_COMMANDS = [
    "testqotd",
    "resetseason",
    "crownvoicechampions",
    "resetinvites",
    "resetallinvites",
    "backfilldonasi",
    "ultah",
    "topdonatur",
    "setultah",
    "panduan",
];

// Command yang udah disebut di section kategori bawah (XP, Streak, Game & Coin, dll),
// jadi gak perlu diulang lagi di daftar command utama biar gak dobel
const CATEGORIZED_COMMANDS = [
    "rank",
    "rankchat",
    "streak",
    "streakleaderboard",
    "tebakangka",
    "trivia",
    "slot",
    "blackjack",
    "tictactoe",
    "balance",
];

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
    invites: "Cek jumlah invite valid kamu (atau orang lain kalau di-tag)",
    season: "Lihat leaderboard voice/chat dari season yang udah lewat",
    streak: "Cek streak harian kamu (atau orang lain kalau di-tag) di channel streak",
    streakleaderboard: "Lihat top 10 user dengan streak harian aktif tertinggi",
    ultah: "Kirim ucapan ulang tahun ke member (khusus admin/mod)",
    setultah: "Daftarin tanggal lahir kamu biar bot otomatis ngucapin pas hari-H",
};

module.exports = {
    name: "help",

    async execute(message, args, client) {
        const commandList = [...client.commands.keys()]
            .filter((name) => !HIDDEN_COMMANDS.includes(name))
            .filter((name) => !CATEGORIZED_COMMANDS.includes(name))
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
                `Semua command di bawah gratis buat **semua member**!\n\n` +
                `${commandList}\n\n` +
                `━━━━━━━━━━━━━━━━━━━\n` +
                `🏆 **XP OTOMATIS** — dapet XP dari voice & chat. Cek pake \`${config.prefix}rank\` / \`${config.prefix}rankchat\`.\n\n` +
                `🔥 **STREAK** — kirim 1 pesan/hari di channel streak biar api gak padam. \`${config.prefix}streak\` • \`${config.prefix}streakleaderboard\`\n\n` +
                `🎮 **GAME & COIN** — \`${config.prefix}tebakangka\` \`${config.prefix}trivia\` \`${config.prefix}slot\` \`${config.prefix}blackjack\` \`${config.prefix}tictactoe\`. Cek saldo: \`${config.prefix}balance\`\n\n` +
                `💬 **AUTO-RESPON** (tanpa prefix) — ketik + tag orangnya: \`hy/hai sayang\`, \`hy ganteng/cantik\`, \`nova pp\`, \`cium\`, \`pap\`\n\n` +
                `🤖 **CHAT SAMA NOVA** — mention bot ini + tulis pertanyaan. 🔒 Khusus **Booster/VIP**. Donasi: saweria.co/marvinalvarro, cek di <#${VIP_LOGS_CHANNEL_ID}>`
            )
            .setFooter({ text: `Total: ${client.commands.size} command tersedia` });

        await message.reply({ embeds: [embed] });
    },
};