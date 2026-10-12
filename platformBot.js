// platformBot.js: bot "Game Verse Platform" yang jalan satu proses dengan Nova Verse
require("dotenv").config();
const { Client, GatewayIntentBits, ActivityType, Events } = require("discord.js");

const STATUS_TEXT = process.env.PLATFORM_STATUS_TEXT || "discord.gg/gameverse";

// Format lama nyala bot, misal "2h 5m" atau "1d 3h"
function uptime() {
  const s = Math.floor(process.uptime());
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Jam sekarang (0-23) di zona waktu Jakarta
function getJakartaHour() {
  return parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
    10
  );
}

function greeting() {
  const hour = getJakartaHour();
  if (hour >= 5 && hour < 12) return "🌅 Selamat pagi!";
  if (hour >= 12 && hour < 18) return "☀️ Selamat siang!";
  if (hour >= 18 && hour < 22) return "🌇 Selamat sore!";
  return "🌙 Selamat malam!";
}

function startPlatformBot() {
  const token = process.env.PLATFORM_TOKEN;
  if (!token) {
    console.log("[Platform] PLATFORM_TOKEN belum diisi di .env, bot Platform dilewati.");
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  let statusIndex = 0;

  function getActivities() {
    const members = client.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0);

    const list = [
      { type: ActivityType.Playing, name: "Marvin Handsome" },
      { type: ActivityType.Watching, name: `${client.guilds.cache.size} Servers` },
      { type: ActivityType.Watching, name: `${members.toLocaleString()} Members` },
      { type: ActivityType.Watching, name: `Uptime ${uptime()}` },
      { type: ActivityType.Playing, name: "Game Verse" },
      { type: ActivityType.Watching, name: STATUS_TEXT },
      { type: ActivityType.Playing, name: greeting() },
    ];

    // ping bisa -1 sesaat setelah bot nyala, jadi dicek dulu
    if (client.ws.ping >= 0) {
      list.splice(3, 0, { type: ActivityType.Watching, name: `Ping ${client.ws.ping}ms` });
    }

    return list;
  }

  function setStatus() {
    const activities = getActivities();
    const activity = activities[statusIndex % activities.length];
    statusIndex++;

    client.user.setPresence({
      status: "online",
      activities: [activity],
    });
  }

  client.once(Events.ClientReady, () => {
    console.log("[Platform] Online sebagai " + client.user.tag);
    setStatus();
    setInterval(setStatus, 5 * 1000);
  });

  client.on(Events.Error, (err) => console.error("[Platform] Error:", err));

  // Kalau login gagal (misal token salah), cukup di-log. Nova Verse tetap jalan.
  client.login(token).catch((err) => console.error("[Platform] Gagal login:", err.message));
}

startPlatformBot();