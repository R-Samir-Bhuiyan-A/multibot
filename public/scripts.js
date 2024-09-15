document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    const botsList = document.getElementById('bots-list');
    const messageInput = document.getElementById('message');
    const logDiv = document.getElementById('log');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    let selectedBots = [];

    document.getElementById('create-bot-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const host = document.getElementById('host').value;
        const port = document.getElementById('port').value;
        const username = document.getElementById('username').value;
        const version = document.getElementById('version').value;

        fetch('/api/create-bot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, port, username, version })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Bot created with ID:', data.botId);
            updateBotsList();  // Update bots list after creation
        });
    });

    // Fetch and update bots list
    async function updateBotsList() {
        const response = await fetch('/api/bots');
        const bots = await response.json();

        botsList.innerHTML = '';  // Clear the list before updating
        bots.forEach(bot => {
            const li = document.createElement('li');
            li.innerHTML = `<input type="checkbox" value="${bot.id}"> Bot ID: ${bot.id}, Username: ${bot.username}`;
            botsList.appendChild(li);
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

    // Log messages
    function logMessage(message) {
        const logEntry = document.createElement('div');
        logEntry.textContent = message;
        logDiv.appendChild(logEntry);
        logDiv.scrollTop = logDiv.scrollHeight;
    }

    // Update the bots list on page load
    updateBotsList();
});
