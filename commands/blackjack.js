const { addCoins, hasEnough, getBalance } = require("../economy");

const DEFAULT_BET = 20;
const MAX_BET = 500;
const HIT_EMOJI = "🇭";
const STAND_EMOJI = "🇸";

function drawCard() {
    const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11]; // J/Q/K = 10, A = 11 (disederhanakan)
    return values[Math.floor(Math.random() * values.length)];
}

function handTotal(hand) {
    let total = hand.reduce((sum, c) => sum + c, 0);
    let aces = hand.filter((c) => c === 11).length;
    while (total > 21 && aces > 0) {
        total -= 10; // ace jadi 1 kalau kebobolan
        aces--;
    }
    return total;
}

module.exports = {
    name: "blackjack",
    description: "Main blackjack sederhana lawan bot, taruhan coin",
    async execute(message, args, client) {
        const bet = args[0] ? parseInt(args[0], 10) : DEFAULT_BET;

        if (isNaN(bet) || bet <= 0) {
            return message.reply(`Format: \`.blackjack <jumlah_taruhan>\`. Contoh: \`.blackjack 20\``);
        }
        if (bet > MAX_BET) {
            return message.reply(`Taruhan maksimal **${MAX_BET} coin** ya!`);
        }
        if (!hasEnough(message.author.id, bet)) {
            return message.reply(`Saldo lu gak cukup! Saldo sekarang: **${getBalance(message.author.id)} coin** 🪙`);
        }

        let playerHand = [drawCard(), drawCard()];
        let dealerHand = [drawCard(), drawCard()];

        const renderState = (revealDealer = false) => {
            const dealerDisplay = revealDealer
                ? `${dealerHand.join(" + ")} = **${handTotal(dealerHand)}**`
                : `${dealerHand[0]} + ❓`;
            return (
                `🃏 **Blackjack** (taruhan: ${bet} coin)\n\n` +
                `Dealer: ${dealerDisplay}\n` +
                `Kamu: ${playerHand.join(" + ")} = **${handTotal(playerHand)}**\n\n` +
                `React ${HIT_EMOJI} buat Hit, ${STAND_EMOJI} buat Stand`
            );
        };

        const gameMsg = await message.channel.send(renderState());
        await gameMsg.react(HIT_EMOJI).catch(() => {});
        await gameMsg.react(STAND_EMOJI).catch(() => {});

        const finish = async (resultText, net) => {
            const newBalance = addCoins(message.author.id, net);
            await gameMsg.edit(
                `${renderState(true)}\n\n${resultText} Saldo sekarang: **${newBalance}** 🪙`
            );
            collector.stop("done");
        };

        const filter = (reaction, user) =>
            [HIT_EMOJI, STAND_EMOJI].includes(reaction.emoji.name) && user.id === message.author.id;

        const collector = gameMsg.createReactionCollector({ filter, time: 45000 });

        collector.on("collect", async (reaction, user) => {
            await reaction.users.remove(user.id).catch(() => {});

            if (reaction.emoji.name === HIT_EMOJI) {
                playerHand.push(drawCard());
                const total = handTotal(playerHand);

                if (total > 21) {
                    return finish(`💥 **BUST!** Kamu kalah.`, -bet);
                }

                await gameMsg.edit(renderState());
                return;
            }

            // Stand — giliran dealer
            while (handTotal(dealerHand) < 17) {
                dealerHand.push(drawCard());
            }

            const playerTotal = handTotal(playerHand);
            const dealerTotal = handTotal(dealerHand);

            if (dealerTotal > 21 || playerTotal > dealerTotal) {
                return finish(`🎉 **MENANG!** +${bet} coin.`, bet);
            } else if (playerTotal === dealerTotal) {
                return finish(`🤝 **SERI**, taruhan dikembalikan.`, 0);
            } else {
                return finish(`😢 **KALAH.**`, -bet);
            }
        });

        collector.on("end", (collected, reason) => {
            if (reason !== "done") {
                gameMsg.edit(`${renderState(true)}\n\n⏰ Waktu habis, game dibatalin (gak ada coin hilang).`).catch(() => {});
            }
        });
    },
};