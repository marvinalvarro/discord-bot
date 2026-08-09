const { addCoins } = require("../economy");

const MAX_ATTEMPTS = 7;
const MIN_NUM = 1;
const MAX_NUM = 100;
const REWARD = 30;

module.exports = {
    name: "tebakangka",
    description: "Tebak angka rahasia 1-100, menang dapat coin",
    async execute(message, args, client) {
        const target = Math.floor(Math.random() * (MAX_NUM - MIN_NUM + 1)) + MIN_NUM;
        let attemptsLeft = MAX_ATTEMPTS;

        await message.channel.send(
            `🔢 **Tebak Angka!**\nGue udah milih angka antara **${MIN_NUM}-${MAX_NUM}**. Lu punya **${MAX_ATTEMPTS} kesempatan**. Ketik angkanya di chat!`
        );

        const filter = (m) => m.author.id === message.author.id && !isNaN(m.content.trim());

        const collector = message.channel.createMessageCollector({
            filter,
            time: 60000,
            max: MAX_ATTEMPTS,
        });

        collector.on("collect", async (m) => {
            const guess = parseInt(m.content.trim(), 10);
            attemptsLeft--;

            if (guess === target) {
                const newBalance = addCoins(message.author.id, REWARD);
                await message.channel.send(
                    `🎉 **BENER!** Angkanya emang **${target}**! Lu dapet **+${REWARD} coin** 🪙 (saldo sekarang: ${newBalance})`
                );
                collector.stop("won");
                return;
            }

            if (attemptsLeft <= 0) {
                await message.channel.send(`💥 Kesempatan abis! Angkanya adalah **${target}**. Coba lagi ya!`);
                collector.stop("lost");
                return;
            }

            const hint = guess < target ? "lebih besar 📈" : "lebih kecil 📉";
            await message.channel.send(`Bukan tuh, coba **${hint}**! Sisa kesempatan: **${attemptsLeft}**`);
        });

        collector.on("end", (collected, reason) => {
            if (reason !== "won" && reason !== "lost") {
                message.channel.send(`⏰ Waktu habis! Angkanya adalah **${target}**.`);
            }
        });
    },
};