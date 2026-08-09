const { addCoins, hasEnough, getBalance } = require("../economy");

const SYMBOLS = ["🍒", "🍋", "🍇", "🍉", "⭐", "💎"];
const DEFAULT_BET = 10;
const MAX_BET = 500;

module.exports = {
    name: "slot",
    description: "Main slot machine, taruhan coin buat menang lebih banyak",
    async execute(message, args, client) {
        const bet = args[0] ? parseInt(args[0], 10) : DEFAULT_BET;

        if (isNaN(bet) || bet <= 0) {
            return message.reply(`Format: \`.slot <jumlah_taruhan>\`. Contoh: \`.slot 20\``);
        }

        if (bet > MAX_BET) {
            return message.reply(`Taruhan maksimal **${MAX_BET} coin** ya!`);
        }

        if (!hasEnough(message.author.id, bet)) {
            return message.reply(`Saldo lu gak cukup! Saldo sekarang: **${getBalance(message.author.id)} coin** 🪙`);
        }

        const spin = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        const result = [spin(), spin(), spin()];

        let payout = 0;
        if (result[0] === result[1] && result[1] === result[2]) {
            payout = result[0] === "💎" ? bet * 10 : bet * 5; // jackpot 💎 lebih gede
        } else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
            payout = bet * 2;
        }

        const net = payout - bet;
        const newBalance = addCoins(message.author.id, net);

        const resultLine = `🎰 [ ${result.join(" | ")} ]`;

        if (payout > 0) {
            message.channel.send(
                `${resultLine}\n🎉 **MENANG!** Dapat **${payout} coin** (untung +${net}) 🪙\nSaldo sekarang: **${newBalance}**`
            );
        } else {
            message.channel.send(
                `${resultLine}\n💸 Kalah, coin lu berkurang **${bet}**.\nSaldo sekarang: **${newBalance}**`
            );
        }
    },
};