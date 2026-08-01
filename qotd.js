const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const { EmbedBuilder } = require("discord.js");
const questions = require("./qotdQuestions");

// ==== KONFIGURASI ====
const QOTD_CHANNEL_ID = "1532591715389804635"; // channel tempat QOTD dikirim
const CRON_TIME = "0 20 * * *"; // jam 8 malam tiap hari
const TIMEZONE = "Asia/Jakarta";

const DATA_FILE = path.join(__dirname, "qotdData.json");

function loadData() {
    try {
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        return JSON.parse(raw);
    } catch (err) {
        return { lastIndex: -1 };
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Pilih pertanyaan random, hindari pertanyaan yang sama persis kayak hari sebelumnya
function pickQuestion() {
    const data = loadData();
    let index;
    do {
        index = Math.floor(Math.random() * questions.length);
    } while (index === data.lastIndex && questions.length > 1);

    data.lastIndex = index;
    saveData(data);
    return questions[index];
}

function formatTanggal(date) {
    return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
    });
}

async function sendQOTD(client) {
    try {
        const channel = await client.channels.fetch(QOTD_CHANNEL_ID);
        if (!channel) {
            console.log("QOTD channel tidak ditemukan, cek QOTD_CHANNEL_ID.");
            return;
        }

        const question = pickQuestion();
        const tanggal = formatTanggal(new Date());

        const embed = new EmbedBuilder()
            .setColor(0xF1A33C)
            .setDescription(
                `🎮 **Quest Harian Game Verse**\n\n` +
                `Gas push, Verser! Udah masuk hari **${tanggal}** nih, saatnya isi quest harian biar makin akrab sama sesama gamer di sini. Share jawaban lu di *thread* bawah ini ya 🔥\n\n` +
                `» **${question}**\n\n` +
                `Drop jawaban lu di thread 👇`
            );

        const sentMessage = await channel.send({ embeds: [embed] });

        await sentMessage.startThread({
            name: `🎮 Quest Harian - ${tanggal}`,
            autoArchiveDuration: 1440, // 24 jam
        });

        console.log(`QOTD terkirim: "${question}"`);
    } catch (err) {
        console.error("Gagal kirim QOTD:", err);
    }
}

// Dipanggil sekali dari ready.js buat mulai jadwal
function scheduleQOTD(client) {
    cron.schedule(
        CRON_TIME,
        () => {
            sendQOTD(client);
        },
        { timezone: TIMEZONE }
    );
    console.log(`QOTD dijadwalkan tiap jam 00.00 (${TIMEZONE}).`);
}

module.exports = { scheduleQOTD, sendQOTD };