const { addCoins } = require("../economy");
const questions = require("../triviaQuestions");

const OPTION_EMOJIS = ["🇦", "🇧", "🇨", "🇩"];
const REWARD = 25;
const TIME_LIMIT_MS = 20000;

module.exports = {
    name: "trivia",
    description: "Jawab kuis seputar game, bener dapat coin",
    async execute(message, args, client) {
        const q = questions[Math.floor(Math.random() * questions.length)];

        const optionsText = q.options
            .map((opt, i) => `${OPTION_EMOJIS[i]} ${opt}`)
            .join("\n");

        const quizMsg = await message.channel.send(
            `🧠 **TRIVIA TIME!**\n\n**${q.question}**\n\n${optionsText}\n\nReact jawaban lu dalam ${TIME_LIMIT_MS / 1000} detik!`
        );

        for (let i = 0; i < q.options.length; i++) {
            await quizMsg.react(OPTION_EMOJIS[i]).catch(() => {});
        }

        const answeredUsers = new Set();
        const correctEmoji = OPTION_EMOJIS[q.answer];

        const filter = (reaction, user) => OPTION_EMOJIS.includes(reaction.emoji.name) && !user.bot;

        const collector = quizMsg.createReactionCollector({ filter, time: TIME_LIMIT_MS });

        collector.on("collect", async (reaction, user) => {
            if (answeredUsers.has(user.id)) return;
            answeredUsers.add(user.id);

            if (reaction.emoji.name === correctEmoji) {
                const newBalance = addCoins(user.id, REWARD);
                message.channel.send(
                    `✅ **${user.username} jawab bener!** Jawabannya **${q.options[q.answer]}**. +${REWARD} coin 🪙 (saldo: ${newBalance})`
                );
                collector.stop("answered");
            }
        });

        collector.on("end", (collected, reason) => {
            if (reason !== "answered") {
                message.channel.send(`⏰ Waktu habis! Jawaban yang bener adalah **${q.options[q.answer]}**.`);
            }
        });
    },
};