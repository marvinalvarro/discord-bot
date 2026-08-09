const { addCoins } = require("../economy");

const NUMBERS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
const REWARD = 40;

function renderBoard(board) {
    const symbols = board.map((cell, i) => (cell === null ? NUMBERS[i] : cell));
    return (
        `${symbols[0]} ${symbols[1]} ${symbols[2]}\n` +
        `${symbols[3]} ${symbols[4]} ${symbols[5]}\n` +
        `${symbols[6]} ${symbols[7]} ${symbols[8]}`
    );
}

function checkWinner(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6],
    ];
    for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    if (board.every((cell) => cell !== null)) return "draw";
    return null;
}

module.exports = {
    name: "tictactoe",
    description: "Main tic-tac-toe 1v1 lawan orang lain (tag orangnya)",
    async execute(message, args, client) {
        const opponent = message.mentions.users.first();
        if (!opponent || opponent.bot || opponent.id === message.author.id) {
            return message.reply("Tag lawan main lu dulu ya! Contoh: `.tictactoe @teman`");
        }

        const players = { X: message.author, O: opponent };
        let board = Array(9).fill(null);
        let turn = "X";

        const gameMsg = await message.channel.send(
            `🎮 **Tic-Tac-Toe**\n${players.X} (❌) vs ${players.O} (⭕)\n\n${renderBoard(board)}\n\nGiliran: ${players[turn]} (${turn === "X" ? "❌" : "⭕"})`
        );

        for (const emoji of NUMBERS) {
            await gameMsg.react(emoji).catch(() => {});
        }

        const filter = (reaction, user) => {
            return NUMBERS.includes(reaction.emoji.name) && user.id === players[turn].id;
        };

        const collector = gameMsg.createReactionCollector({ filter, time: 120000 });

        collector.on("collect", async (reaction, user) => {
            const index = NUMBERS.indexOf(reaction.emoji.name);

            if (board[index] !== null) {
                await reaction.users.remove(user.id).catch(() => {});
                return;
            }

            board[index] = turn === "X" ? "❌" : "⭕";
            await reaction.users.remove(user.id).catch(() => {});

            const winner = checkWinner(board);

            if (winner === "draw") {
                await gameMsg.edit(`🎮 **Tic-Tac-Toe**\n\n${renderBoard(board)}\n\n🤝 Seri! Gak ada yang menang.`);
                collector.stop("draw");
                return;
            }

            if (winner) {
                const winnerUser = winner === "❌" ? players.X : players.O;
                const newBalance = addCoins(winnerUser.id, REWARD);
                await gameMsg.edit(
                    `🎮 **Tic-Tac-Toe**\n\n${renderBoard(board)}\n\n🏆 **${winnerUser.username} MENANG!** +${REWARD} coin 🪙 (saldo: ${newBalance})`
                );
                collector.stop("win");
                return;
            }

            turn = turn === "X" ? "O" : "X";
            await gameMsg.edit(
                `🎮 **Tic-Tac-Toe**\n${players.X} (❌) vs ${players.O} (⭕)\n\n${renderBoard(board)}\n\nGiliran: ${players[turn]} (${turn === "X" ? "❌" : "⭕"})`
            );
        });

        collector.on("end", (collected, reason) => {
            if (reason !== "win" && reason !== "draw") {
                gameMsg.edit(`🎮 **Tic-Tac-Toe**\n\n${renderBoard(board)}\n\n⏰ Waktu habis, game dibatalin.`).catch(() => {});
            }
        });
    },
};