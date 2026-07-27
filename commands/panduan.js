const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: "panduan",

    async execute(message, args) {
        // ID channel sesuai server kamu
        const WELCOME_CHANNEL_ID = "1477885865584885860";
        const RULES_CHANNEL_ID = "1526127278621200456";
        const TAKE_ROLE_CHANNEL_ID = "1515853805470613655";
        const GENERAL_CHAT_CHANNEL_ID = "1520226091107618957";
        const TICKET_CHANNEL_ID = "1526183111992283346";
        const GENERAL_VOICE_CHANNEL_ID = "1512558308912009438";

        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle("✅ BUKU PANDUAN WARGA GAME VERSE ✅")
            .setDescription(
                `**• CARA MAIN & NONGKRONG DI SINI**\n` +
                `Di Discord itu intinya cuma dua: Ngetik (Text Channel) atau Ngomong (Voice Channel). Lu bebas mau nongkrong di mana aja sesuai mood.\n\n` +

                `**1. Area Umum (Wajib Cek Dulu)**\n` +
                `Sebelum eksplor lebih jauh, mampir dulu ke sini:\n` +
                `> <#${WELCOME_CHANNEL_ID}>: Tempat lu di-welcome pas join, dan pamer diri kalau mau kenalan.\n` +
                `> <#${RULES_CHANNEL_ID}>: Baca dulu sebelum aktif, biar ga kena banned.\n` +
                `> <#${TAKE_ROLE_CHANNEL_ID}>: **PENTING!** Klik role game yang lu mainin di sini biar channel-channel khusus game itu muncul (GTA V, Valorant, Minecraft, dll). Kalau lu skip ini, channel game favorit lu bakal invisible!\n` +
                `> <#${GENERAL_CHAT_CHANNEL_ID}>: Alun-alun utama, bebas bahas apa aja, asbun juga boleh.\n\n` +

                `**2. Area Ngetik per Game (Text Channels)**\n` +
                `Setelah ambil role di <#${TAKE_ROLE_CHANNEL_ID}>, kategori game yang lu pilih bakal kebuka,\n\n` +

                `**3. Area Ngomong (Voice Channels/VC)**\n` +
                `Kalau lu bosen ngetik dan pengen mabar pake suara asli, langsung aja lompat ke <#${GENERAL_VOICE_CHANNEL_ID}>. Tinggal klik dan masuk, awal-awal malu boleh diem dulu, gapapa kok!\n\n` +

                `**RULES SINGKAT (WAJIB BACA!)**\n` +
                `> **No SARA & Politik**: Kita di sini nyari temen mabar dan tempat santai, bukan buat debat.\n` +
                `> **No NSFW/porno**: Hargain warga lain. Salah kirim link/kata terlarang bisa kena kick/banned.\n` +
                `> **Respect the Staff**: Kalau ditegur Moderator, tolong diturutin ya biar tongkrongan tetep asik.\n\n` +

                `**MASIH BINGUNG?**\n` +
                `Kalau ada yang nggak lu ngerti, mau report orang rusuh, atau butuh bantuan, langsung aja bikin tiket di <#${TICKET_CHANNEL_ID}>. Admin bakal turun tangan bantuin.\n\n` +
                `*have fun and see you in-game!* 🎮`
            );

        await message.reply({ embeds: [embed] });
    },
};