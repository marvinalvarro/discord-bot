<<<<<<< HEAD
module.exports = {
    name: "say",

    execute(message, args) {

        const text = args.join(" ");

        if (!text)
            return message.reply("Masukkan pesan.");

        message.channel.send(text);
    },
=======
module.exports = {
    name: "say",

    execute(message, args) {

        const text = args.join(" ");

        if (!text)
            return message.reply("Masukkan pesan.");

        message.channel.send(text);
    },
>>>>>>> 95a57b2088df19726c4d831d6ae1699863e90c31
};