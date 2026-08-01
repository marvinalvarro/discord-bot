const { ActivityType } = require("discord.js");
const config = require("../config");
const { ensureBanCounterMessage } = require("../banCounter");
const { scheduleQOTD } = require("../qotd");

// ID channel trap, HARUS SAMA PERSIS dengan TRAP_CHANNEL_ID di events/messageCreate.js
const TRAP_CHANNEL_ID = "1532607922431987805";

module.exports = {
    name: "clientReady",
    once: true,
    execute(client) {
        console.log(`${client.user.tag} berhasil online!`);

        // Pastikan pesan pembuka "JANGAN MENGIRIM PESAN..." + Bans count ada di trap channel
        (async () => {
            try {
                const trapChannel = await client.channels.fetch(TRAP_CHANNEL_ID);
                if (trapChannel) {
                    await ensureBanCounterMessage(trapChannel);
                    console.log("Ban counter message dicek/dikirim ke trap channel.");
                } else {
                    console.log("Trap channel tidak ditemukan, cek TRAP_CHANNEL_ID di ready.js.");
                }
            } catch (err) {
                console.error("Gagal ensure ban counter message:", err);
            }
        })();

        // Jadwalin QOTD (Question of the Day) tiap jam 6 pagi
        scheduleQOTD(client);

        function greeting() {
            const hour = new Date().getHours();
            if (hour >= 5 && hour < 12) return "🌅 Good Morning";
            if (hour >= 12 && hour < 18) return "☀️ Good Afternoon";
            if (hour >= 18 && hour < 22) return "🌇 Good Evening";
            return "🌙 Good Night";
        }

        function uptime() {
            const total = Math.floor(process.uptime());
            const d = Math.floor(total / 86400);
            const h = Math.floor((total % 86400) / 3600);
            const m = Math.floor((total % 3600) / 60);
            if (d > 0) return `${d}D ${h}H`;
            if (h > 0) return `${h}H ${m}M`;
            return `${m}M`;
        }

        let index = 0;
        const updatePresence = () => {
            let members = 0;
            client.guilds.cache.forEach(guild => {
                members += guild.memberCount;
            });

            const activities = [
                { type: ActivityType.Watching, name: `${client.guilds.cache.size} Servers` },
                { type: ActivityType.Watching, name: `${members.toLocaleString()} Members` },
                { type: ActivityType.Watching, name: `${client.commands.size} Commands` },
                { type: ActivityType.Watching, name: `Ping ${client.ws.ping}ms` },
                { type: ActivityType.Watching, name: `Uptime ${uptime()}` },
                { type: ActivityType.Listening, name: `${config.prefix}help` },
                { type: ActivityType.Playing, name: "Game Verse" },
                { type: ActivityType.Competing, name: "GAME VERSE Tournament" },
                { type: ActivityType.Watching, name: "discord.gg/gameverse" },
                { type: ActivityType.Playing, name: greeting() },
            ];

            client.user.setActivity(activities[index]);
            index++;
            if (index >= activities.length) index = 0;
        };

        updatePresence();
        setInterval(updatePresence, 5000);
    },
};