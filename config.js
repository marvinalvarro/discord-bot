require("dotenv").config();

console.log("TOKEN:", process.env.TOKEN);
console.log("PREFIX:", process.env.PREFIX);

module.exports = {
    token: process.env.TOKEN,
    prefix: process.env.PREFIX,
    clientId: process.env.CLIENT_ID,
};
