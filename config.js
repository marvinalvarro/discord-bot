require("dotenv").config();

console.log("PREFIX:", process.env.PREFIX);

module.exports = {
    token: process.env.TOKEN,
    prefix: process.env.PREFIX,
    clientId: process.env.CLIENT_ID,
};