module.exports = {
    name: "guildMemberAdd",

    async execute(member) {
        const channel = member.guild.channels.cache.get("1520226091107618957");

        if (!channel) return;

        channel.send(
            `Wih ada muka baru nih! 👋 Welcome to **Game Verse**, ${member}. Coba dong spill dikit, lu mampir ke sini lagi nyari temen mabar, tempat asbun, atau nyari jodoh nih? wkwk 😆`
        );
    }
};