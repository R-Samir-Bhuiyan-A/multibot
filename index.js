const mineflayer = require('mineflayer');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder'); // Import mineflayer-pathfinder for navigation
const PlayerAlertModule = require('./alert-on-untrusted-player');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const bots = {}; // Store bot instances here with their IDs

app.use(express.static('public')); // Serve static files (HTML, CSS, JS)
app.use(express.json());

const botMetadata = {};
// Endpoint to create a new bot
const alertModules = {};

app.post('/api/create-bot', (req, res) => {
    const { host, port, username, version, discordWebhookURL } = req.body;
    const botId = Math.floor(Math.random() * 1000000); // Random bot ID

    const bot = mineflayer.createBot({
        host,
        port: parseInt(port),
        username,
        version: version || false, // Use the provided version, or autodetect if not specified
    });


    bot.loadPlugin(pathfinder);
    // Store bot instance with the random bot ID
    bots[botId] = bot;

    botMetadata[botId] = { host, port, version, discordWebhookURL };
    alertModules[botId] = new PlayerAlertModule(bot, discordWebhookURL);
   

    // Handle bot events
    bot.once('spawn', () => {
        console.log(`Bot ${botId} has spawned.`);
        io.emit('bot-spawn', { botId, username });
    });

    bot.on('chat', (username, message) => {
        console.log(`Bot ${botId} received  ${username}: ${message}`);
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

// Endpoint to list running bots with metadata
app.get('/api/bots', (req, res) => {
    const botList = Object.keys(bots).map(botId => ({
        id: botId,
        host: botMetadata[botId]?.host || 'Unknown',  // Retrieve host from botMetadata
        port: botMetadata[botId]?.port || 'Unknown',  // Retrieve port from botMetadata
        version: botMetadata[botId]?.version || 'Unknown',  // Retrieve version from botMetadata
        username: bots[botId].username || 'Unknown' // Retrieve username from the bot instance
    }));
    res.status(200).json(botList);
});

// Endpoint to send a message to selected bots
app.post('/api/send-message', (req, res) => {
    const { botIds, message } = req.body;

    botIds.forEach((id) => {
        if (bots[id]) {
            bots[id].chat(message);
            console.log(` ${id}: ${message}`);
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

/** ---- Added Goto, Follow, and Disconnect Features ---- **/
// Endpoint to follow a player
app.post('/api/follow-player', (req, res) => {
    const botId = req.query.botId;
    const playerName = req.query.playerName;

    if (!botId || !playerName) {
        return res.status(400).json({ message: 'Missing botId or playerName' });
    }

    const bot = bots[botId];
    if (bot) {
        if (bot.pathfinder) {
            // Ensure the bot is connected and player exists
            const player = bot.players[playerName] && bot.players[playerName].entity;
            if (player) {
                bot.pathfinder.setGoal(new goals.GoalFollow(player, 2), true);
                bot.isFollowing = true; // Track that the bot is following
                bot.currentGoal = 'follow'; // Track the current goal
                res.status(200).json({ message: `${botId} is now following ${playerName}` });
            } else {
                res.status(404).json({ message: `Player ${playerName} not found` });
            }
        } else {
            res.status(500).json({ message: 'Pathfinder plugin is not set up' });
        }
    } else {
        res.status(404).json({ message: `${botId} not found` });
    }
});

// Endpoint to go to coordinates
app.post('/api/goto-coordinates', (req, res) => {
    const botId = req.query.botId;
    const { x, y, z } = req.query;

    if (!botId || x === undefined || y === undefined || z === undefined) {
        return res.status(400).json({ message: 'Missing botId, x, y, or z' });
    }

    const bot = bots[botId];
    if (bot) {
        if (bot.pathfinder) {
            bot.pathfinder.setGoal(new goals.GoalBlock(parseInt(x), parseInt(y), parseInt(z)), true);
            bot.isFollowing = false; // Ensure bot is not following when going to coordinates
            bot.currentGoal = 'goto'; // Track the current goal
            res.status(200).json({ message: `${botId} is now heading to coordinates (${x}, ${y}, ${z})` });
        } else {
            res.status(500).json({ message: 'Pathfinder plugin is not set up' });
        }
    } else {
        res.status(404).json({ message: `${botId} not found` });
    }
});

// Endpoint to stop current task
app.post('/api/stop-task', (req, res) => {
    const botId = req.query.botId;

    if (!botId) {
        return res.status(400).json({ message: 'Missing botId' });
    }

    const bot = bots[botId];
    if (bot) {
        if (bot.pathfinder) {
            bot.pathfinder.setGoal(null); // Clear the current goal
            bot.isFollowing = false; // Stop following
            bot.currentGoal = null; // Clear the current goal tracking
            res.status(200).json({ message: ` ${botId} has stopped its current task` });
        } else {
            res.status(500).json({ message: 'Pathfinder plugin is not set up' });
        }
    } else {
        res.status(404).json({ message: `${botId} not found` });
    }
});


// Endpoint to disconnect a bot
app.post('/api/disconnect-bot', (req, res) => {
    const { botId } = req.body;
    const bot = bots[botId];

    if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    bot.end(); // Disconnect the bot
    delete bots[botId]; // Remove the bot instance

    res.status(200).json({ message: 'Bot disconnected and removed' });
});

// Endpoint to stop a bot
app.post('/api/stop-bot', (req, res) => {
    const { botId } = req.body;
    const bot = bots[botId];

    if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    bot.end(); // Disconnect the bot
    delete bots[botId]; // Remove the bot instance

    res.status(200).json({ message: 'Bot stopped and will not reconnect' });
});



// Endpoint to add a trusted player for a specific bot
app.post('/api/add-trusted-player', (req, res) => {
    const { botId, username } = req.body;

    if (!botId || !username) {
        return res.status(400).json({ message: 'Missing botId or username' });
    }

    const alertModule = alertModules[botId];
    if (alertModule) {
        alertModule.addTrustedPlayer(username);
        res.status(200).json({ message: `Player ${username} added to trusted players.` });
    } else {
        res.status(404).json({ message: `Bot ${botId} not found` });
    }
});

// Endpoint to remove a trusted player for a specific bot
app.post('/api/remove-trusted-player', (req, res) => {
    const { botId, username } = req.body;

    if (!botId || !username) {
        return res.status(400).json({ message: 'Missing botId or username' });
    }

    const alertModule = alertModules[botId];
    if (alertModule) {
        alertModule.removeTrustedPlayer(username);
        res.status(200).json({ message: `Player ${username} removed from trusted players.` });
    } else {
        res.status(404).json({ message: `Bot ${botId} not found` });
    }
});



// Route to check if the API is active
app.post('/api/health', (req, res) => {
    res.json('1');
});



