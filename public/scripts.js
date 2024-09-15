document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    const botsList = document.getElementById('bots-list');
    const messageInput = document.getElementById('message');
    const logDiv = document.getElementById('log');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const followPlayerInput = document.getElementById('follow-player');
    const gotoCoordinatesForm = document.getElementById('goto-coordinates-form');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const stopBtn = document.getElementById('stopBtn');

    const trusteduserInput = document.getElementById('trusteduser');
    const messageElement = document.getElementById('message');
    const addTrustedPlayerBtn = document.getElementById('addTrustedPlayerBtn');
    const removeTrustedPlayerBtn = document.getElementById('removeTrustedPlayerBtn');

    let selectedBots = [];

    document.getElementById('create-bot-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const host = document.getElementById('host').value;
        const port = document.getElementById('port').value;
        const username = document.getElementById('username').value;
        const version = document.getElementById('version').value;
        const discordWebhookURL = document.getElementById('discordWebhookURL').value;

        fetch('/api/create-bot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, port, username, version, discordWebhookURL })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Bot created with ID:', data.botId);
            updateBotsList();  // Update bots list after creation
        });
    });

    async function updateBotsList() {
        try {
            const response = await fetch('/api/bots');
            const bots = await response.json();
    
            botsList.innerHTML = '';  // Clear the list before updating
            bots.forEach(bot => {
                // Create a container for the bot entry
                const botEntry = document.createElement('div');
                botEntry.className = 'bot-entry';
    
                // Create an image element for the bot avatar
                const avatarImg = document.createElement('img');
                avatarImg.src = `https://mc-heads.net/avatar/${bot.username}/25`;  // Adjust size as needed
                avatarImg.alt = `${bot.username}'s avatar`;
                avatarImg.style.width = '25px';  // Fixed width for the avatar image
                avatarImg.style.height = '25px';  // Fixed height for the avatar image
                avatarImg.style.borderRadius = '4%';  // Make the avatar circular
    
                // Create a label for the bot entry
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" value="${bot.id}">ID: ${bot.id}, name: ${bot.username}, IP: ${bot.host}`;
                
                // Append the avatar and label to the bot entry
                botEntry.appendChild(avatarImg);
                botEntry.appendChild(label);
                
                // Append the bot entry to the bots list
                botsList.appendChild(botEntry);
            });
    
            // Update selected bots
            botsList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const botId = e.target.value;
                    if (e.target.checked) {
                        selectedBots.push(botId);
                    } else {
                        selectedBots = selectedBots.filter(id => id !== botId);
                    }
                });
            });
        } catch (error) {
            console.error('Error fetching bots list:', error);
        }
    }
    
    // Send message
    sendMessageBtn.addEventListener('click', async () => {
        const message = messageInput.value;
        if (!message || selectedBots.length === 0) {
            alert('Please select bots and enter a message');
            return;
        }

        const response = await fetch('/api/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ botIds: selectedBots, message })
        });

        const data = await response.json();
        console.log('Messages sent to:', selectedBots, 'Message:', message);
        logMessage(`Message sent to bots: ${selectedBots.join(', ')} - Message: ${message}`);
        messageInput.value = '';
    });

    // Follow player
    document.getElementById('follow-player-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const playerName = followPlayerInput.value;

        if (!playerName || selectedBots.length === 0) {
            alert('Please select bots and enter a player name');
            return;
        }

        try {
            for (const botId of selectedBots) {
                const response = await fetch(`/api/follow-player?botId=${botId}&playerName=${playerName}`, {
                    method: 'POST'
                });

                const data = await response.json();
                console.log(`Bot ${botId} is now following player: ${playerName}`);
                logMessage(`Bot ${botId} is now following player: ${playerName}`);
            }
        } catch (error) {
            console.error('Error following player:', error);
            logMessage('Error following player');
        }
    });

    // Go to coordinates
    gotoCoordinatesForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const x = parseInt(document.getElementById('x-coordinate').value, 10);
        const y = parseInt(document.getElementById('y-coordinate').value, 10);
        const z = parseInt(document.getElementById('z-coordinate').value, 10);

        if (isNaN(x) || isNaN(y) || isNaN(z) || selectedBots.length === 0) {
            alert('Please select bots and enter valid coordinates');
            return;
        }

        try {
            for (const botId of selectedBots) {
                const response = await fetch(`/api/goto-coordinates?botId=${botId}&x=${x}&y=${y}&z=${z}`, {
                    method: 'POST'
                });

                const data = await response.json();
                console.log(`Bot ${botId} is now heading to coordinates (${x}, ${y}, ${z})`);
                logMessage(`Bot ${botId} is now heading to coordinates (${x}, ${y}, ${z})`);
            }
        } catch (error) {
            console.error('Error going to coordinates:', error);
            logMessage('Error going to coordinates');
        }
    });

    // Disconnect bot
    disconnectBtn.addEventListener('click', async () => {
        if (selectedBots.length === 0) {
            alert('Please select a bot to disconnect');
            return;
        }

        try {
            for (const botId of selectedBots) {
                const response = await fetch('/api/disconnect-bot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ botId })
                });

                const data = await response.json();
                console.log(`Bot ${botId} has been disconnected`);
                logMessage(`Bot ${botId} has been disconnected`);
            }
        } catch (error) {
            console.error('Error disconnecting bot:', error);
            logMessage('Error disconnecting bot');
        }
    });

    // Stop task
    stopBtn.addEventListener('click', async () => {
        if (selectedBots.length === 0) {
            alert('Please select a bot to stop');
            return;
        }

        try {
            for (const botId of selectedBots) {
                const response = await fetch(`/api/stop-task?botId=${botId}`, {
                    method: 'POST'
                });

                const data = await response.json();
                console.log(`Bot ${botId} has stopped its current task`);
                logMessage(`Bot ${botId} has stopped its current task`);
            }
        } catch (error) {
            console.error('Error stopping task:', error);
            logMessage('Error stopping task');
        }
    });

    // Log messages
    function logMessage(message) {
        const logEntry = document.createElement('div');
        logEntry.textContent = message;
        logDiv.appendChild(logEntry);
        logDiv.scrollTop = logDiv.scrollHeight;
    }

// Add trusted player
addTrustedPlayerBtn.addEventListener('click', async () => {
    const username = trusteduserInput.value;
    if (selectedBots.length === 0) {
        alert('Please select a bot');
        return;
    }

    try {
        for (const botId of selectedBots) {
            const response = await fetch('/api/add-trusted-player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ botId, username })
            });

            const result = await response.json();
            if (response.ok) {
                alert(result.message); // Show alert with the result message
                messageElement.textContent = result.message;
                messageElement.className = 'message success';
            } else {
                alert(result.message); // Show alert with the result message
                messageElement.textContent = result.message;
                messageElement.className = 'message error';
            }
        }
    } catch (error) {
        alert('An error occurred. Please try again.'); // Show alert for errors
        messageElement.textContent = 'An error occurred. Please try again.';
        messageElement.className = 'message error';
    }
});

// Remove trusted player
removeTrustedPlayerBtn.addEventListener('click', async () => {
    const username = trusteduserInput.value;
    if (selectedBots.length === 0) {
        alert('Please select a bot');
        return;
    }

    try {
        for (const botId of selectedBots) {
            const response = await fetch('/api/remove-trusted-player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ botId, username })
            });

            const result = await response.json();
            if (response.ok) {
                alert(result.message); // Show alert with the result message
                messageElement.textContent = result.message;
                messageElement.className = 'message success';
            } else {
                alert(result.message); // Show alert with the result message
                messageElement.textContent = result.message;
                messageElement.className = 'message error';
            }
        }
    } catch (error) {
        alert('An error occurred. Please try again.'); // Show alert for errors
        messageElement.textContent = 'An error occurred. Please try again.';
        messageElement.className = 'message error';
    }
});

// Update the bots list on page load
updateBotsList();
});