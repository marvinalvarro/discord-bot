require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Client, Collection, GatewayIntentBits } = require("discord.js");
const config = require("./config");
const { startVoiceXPLoop } = require("./voiceXP");
const { startBackupLoop } = require("./dataBackup");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildInvites, // <-- WAJIB buat sistem invite tracking // <-- WAJIB ditambah supaya game trivia/tictactoe/blackjack bisa deteksi klik reaction
    ],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(".js"));

for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    client.on(event.name, (...args) => event.execute(...args, client));
}

// Mulai loop pemberian XP voice setelah bot online
client.once("ready", () => {
    startVoiceXPLoop(client, config);
    startBackupLoop();
});

client.login(config.token);