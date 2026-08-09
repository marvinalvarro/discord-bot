const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "economyData.json");
const STARTING_BALANCE = 100;

function loadData() {
    if (!fs.existsSync(DATA_PATH)) {
        fs.writeFileSync(DATA_PATH, JSON.stringify({}, null, 2));
    }
    try {
        return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    } catch (err) {
        console.error("[economy] Gagal membaca economyData.json:", err);
        return {};
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function getUser(data, userId) {
    if (!data[userId]) {
        data[userId] = { balance: STARTING_BALANCE };
    }
    return data[userId];
}

function getBalance(userId) {
    const data = loadData();
    return getUser(data, userId).balance;
}

/** amount bisa negatif buat ngurangin saldo (misal taruhan) */
function addCoins(userId, amount) {
    const data = loadData();
    const user = getUser(data, userId);
    user.balance = Math.max(0, user.balance + amount);
    saveData(data);
    return user.balance;
}

function hasEnough(userId, amount) {
    return getBalance(userId) >= amount;
}

module.exports = {
    loadData,
    saveData,
    getUser,
    getBalance,
    addCoins,
    hasEnough,
    STARTING_BALANCE,
};