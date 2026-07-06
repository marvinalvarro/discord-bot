<<<<<<< HEAD
require("dotenv").config();

console.log("TOKEN:", process.env.TOKEN);
console.log("PREFIX:", process.env.PREFIX);

module.exports = {
    token: process.env.TOKEN,
    prefix: process.env.PREFIX,
    clientId: process.env.CLIENT_ID,
=======
require("dotenv").config();

module.exports = {
    token: process.env.TOKEN,
    prefix: process.env.PREFIX,
    clientId: process.env.CLIENT_ID,
>>>>>>> 95a57b2088df19726c4d831d6ae1699863e90c31
};