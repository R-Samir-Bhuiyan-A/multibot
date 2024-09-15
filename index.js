const mineflayer = require('mineflayer');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const bots = {}; // Store bot instances here with their IDs

app.use(express.static('public')); // Serve static files (HTML, CSS, JS)
app.use(express.json());

// Endpoint to create a new bot
app.post('/api/create-bot', (req, res) => {
    const { host, port, username, version } = req.body;
    const botId = Math.floor(Math.random() * 1000000); // Random bot ID

    const bot = mineflayer.createBot({
        host,
        port: parseInt(port),
        username,
        version: version || false, // Use the provided version, or autodetect if not specified
    });

    // Store bot instance with the random bot ID
    bots[botId] = bot;

    // Handle bot events
    bot.once('spawn', () => {
        console.log(`Bot ${botId} has spawned.`);
        io.emit('bot-spawn', { botId, username });
    });

    bot.on('chat', (username, message) => {
        console.log(`Bot ${botId} received message from ${username}: ${message}`);
        io.emit('bot-chat', { botId, username, message });
    });

    bot.on('end', () => {
        console.log(`Bot ${botId} has disconnected.`);
        io.emit('bot-disconnect', { botId });
        delete bots[botId]; // Remove bot when disconnected
    });

    bot.on('error', (err) => {
        console.error(`Bot ${botId} encountered an error: ${err}`);
        io.emit('bot-error', { botId, error: err.toString() });
    });

    res.status(200).json({ botId, message: 'Bot created successfully' });
});

// Endpoint to list running bots
app.get('/api/bots', (req, res) => {
    const botList = Object.keys(bots).map(botId => ({ id: botId, username: bots[botId].username || 'Unknown' }));
    res.status(200).json(botList);
});

// Endpoint to send a message to selected bots
app.post('/api/send-message', (req, res) => {
    const { botIds, message } = req.body;

    botIds.forEach((id) => {
        if (bots[id]) {
            bots[id].chat(message);
            console.log(`Message sent to bot ${id}: ${message}`);
        }
    });

    res.status(200).json({ message: 'Message sent to selected bots' });
});

io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('send-message', (data) => {
        const { botIds, message } = data;

        botIds.forEach((id) => {
            if (bots[id]) {
                bots[id].chat(message); // Send the message through each selected bot
            }
        });

        socket.emit('message-status', 'Message sent');
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start the server
server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
