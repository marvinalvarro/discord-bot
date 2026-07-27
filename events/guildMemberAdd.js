module.exports = {
    name: "guildMemberAdd",

    async execute(member) {
        const channel = member.guild.channels.cache.get("1520226091107618957");

        if (!channel) return;

        // Ganti dua ID di bawah ini sesuai channel di server kamu
        const RULES_CHANNEL_ID = "1526127278621200456";
        const GUIDE_CHANNEL_ID = "1531194725854482544";

        channel.send(
            `Halo, ${member}! 🎮 Welcome to **Game Verse**! Langsung gas gabung ngobrol aja, gausah malu-malu, warga sini asbun dan open semua kok wkwk.\n\n` +
            `Oh iya, biar mabar, nongkrongnya aman dan tentram, tolong dibaca dulu yak <#${1526127278621200456}>. ` +
            `Terus buat lu yang mungkin baru main Discord, bisa cek <#${1531194725854482544}> biar ga bingung. ` +
            `Salken dan enjoy di Game Verse! ✨`
        );
    }
};