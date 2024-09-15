class PlayerAlertModule {
    constructor(bot, discordWebhookURL, trustedPlayers = [], alertCooldown = 60000, maxAlertsPerMinute = 3) {
        this.bot = bot;
        this.discordWebhookURL = discordWebhookURL;
        this.trustedPlayers = new Set(trustedPlayers); // Using Set for fast lookups
        this.alertCooldown = alertCooldown; // Cooldown time to prevent spamming alerts
        this.maxAlertsPerMinute = maxAlertsPerMinute; // Max alerts per minute
        this.alertedPlayers = {}; // To track last alert time for each player
        this.alertCount = {}; // To track alert frequency
        this.serverRenderDistance = 2048; // Dynamic alert radius

        // Bind methods to ensure correct `this` context
        this.checkPlayer = this.checkPlayer.bind(this);
        this.sendDiscordAlert = this.sendDiscordAlert.bind(this);
        this.calculateDistance = this.calculateDistance.bind(this);
        this.calculateMovementSpeed = this.calculateMovementSpeed.bind(this);
        this.getMaxAllowedSpeed = this.getMaxAllowedSpeed.bind(this);
        this.setupListeners();
    }

    setupListeners() {
        this.bot.on('entitySpawn', (entity) => {
            if (entity.type === 'player' && entity.username !== this.bot.username) {
                this.checkPlayer(entity);
            }
        });

        this.bot.on('entityMoved', (entity) => {
            if (entity.type === 'player' && entity.username !== this.bot.username) {
                this.checkPlayer(entity);
            }
        });

        this.bot.on('playerArmSwing', (entity) => {
            if (entity.type === 'player' && !this.trustedPlayers.has(entity.username)) {
                this.sendDiscordAlert(entity, `${entity.username} performed a suspicious arm swing.`, this.calculateDistance(entity));
            }
        });

        this.bot.on('playerAttack', (entity) => {
            if (entity.type === 'player' && !this.trustedPlayers.has(entity.username)) {
                this.sendDiscordAlert(entity, `${entity.username} performed a suspicious attack action.`, this.calculateDistance(entity));
            }
        });

        this.bot.on('playerMove', (entity) => {
            if (entity.type === 'player' && !this.trustedPlayers.has(entity.username)) {
                const speed = this.calculateMovementSpeed(entity);
                if (speed > this.getMaxAllowedSpeed()) {
                    this.sendDiscordAlert(entity, `${entity.username} is moving unusually fast (${speed.toFixed(2)} blocks/second).`, this.calculateDistance(entity));
                }
            }
        });
    }

    calculateDistance(entity) {
        return this.bot.entity.position.distanceTo(entity.position);
    }

    calculateMovementSpeed(entity) {
        // Use a placeholder for previous position as a demonstration
        const previousPosition = this.bot.entity.position.clone();
        const currentPosition = entity.position;
        const timeDelta = 1000; // Time in milliseconds between updates
        const distance = previousPosition.distanceTo(currentPosition);
        return distance / (timeDelta / 1000); // Speed in blocks/second
    }

    getMaxAllowedSpeed() {
        return 10; // Max allowed speed in blocks/second
    }

    checkPlayer(entity) {
        const playerUsername = entity.username;

        if (this.trustedPlayers.has(playerUsername) || playerUsername === this.bot.username) return;

        const distance = this.calculateDistance(entity);

        if (distance <= this.serverRenderDistance) {
            const now = Date.now();

            if (!this.alertedPlayers[playerUsername] || now - this.alertedPlayers[playerUsername] > this.alertCooldown) {
                if (!this.alertCount[playerUsername]) {
                    this.alertCount[playerUsername] = { count: 0, timestamp: now };
                }

                if (this.alertCount[playerUsername].count < this.maxAlertsPerMinute || now - this.alertCount[playerUsername].timestamp > 60000) {
                    console.log(`[Bot ${this.bot.username}] Untrusted player detected within ${this.serverRenderDistance} blocks: ${playerUsername}`);
                    this.sendDiscordAlert(entity, `Untrusted player **${playerUsername}** detected within ${this.serverRenderDistance} blocks.`, distance);
                    this.alertedPlayers[playerUsername] = now; // Update last alert time
                    this.alertCount[playerUsername].count += 1;
                    this.alertCount[playerUsername].timestamp = now;
                }
            }
        }
    }

    async sendDiscordAlert(entity, alertMessage, distance = null) {
        const { username, position } = entity;
        const embed = {
            title: '⚠️ **Security Alert**',
            description: alertMessage,
            color: 0xff0000, // Red color for alert
            fields: [
                {
                    name: 'Bot ID',
                    value: `**${this.bot.username}**`,
                    inline: true
                },
                {
                    name: 'Player',
                    value: `**${username}**`,
                    inline: true
                },
                {
                    name: 'Distance',
                    value: `${distance ? distance.toFixed(2) + ' blocks' : 'Unknown'}`,
                    inline: true
                },
                {
                    name: 'Coordinates',
                    value: `X: ${position.x.toFixed(2)}\nY: ${position.y.toFixed(2)}\nZ: ${position.z.toFixed(2)}`,
                    inline: false
                },
                {
                    name: 'Timestamp',
                    value: new Date().toLocaleString(),
                    inline: false
                }
            ],
            footer: {
                text: 'Bot Security System'
            }
        };

        const message = {
            embeds: [embed]
        };

        try {
            const response = await fetch(this.discordWebhookURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message),
            });

            if (!response.ok) {
                throw new Error(`Failed to send webhook: ${response.statusText}`);
            }

            console.log(`[Bot ${this.bot.username}] Alert sent to Discord for player: ${username}`);
        } catch (err) {
            console.error(`[Bot ${this.bot.username}] Error sending Discord webhook: ${err}`);
        }
    }

    // Method to add a trusted player dynamically
    addTrustedPlayer(username) {
        this.trustedPlayers.add(username);
        console.log(`[Bot ${this.bot.username}] Added ${username} to trusted players.`);
    }

    // Method to remove a trusted player dynamically
    removeTrustedPlayer(username) {
        this.trustedPlayers.delete(username);
        console.log(`[Bot ${this.bot.username}] Removed ${username} from trusted players.`);
    }
}

module.exports = PlayerAlertModule;
