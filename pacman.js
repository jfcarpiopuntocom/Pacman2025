// pacman.js
(() => {
    'use strict';

    // **Configuration Constants** - Immutable settings for consistency
    const CONFIG = Object.freeze({
        TILE_SIZE: 16,
        CANVAS_WIDTH: 448,  // 28 * 16
        CANVAS_HEIGHT: 496, // 31 * 16
        COLORS: Object.freeze({
            BACKGROUND: '#000000',
            WALL: '#1E90FF', // Dodger Blue for walls
            PACMAN: '#FFFF00',
            GHOSTS: ['#FF4500', '#FF69B4', '#00CED1', '#FFA500'], // Vibrant ghost colors
            TEXT: '#F0F8FF', // Alice Blue for text
            FRIGHTENED: '#483D8B', // Dark Slate Blue for frightened ghosts
            DOT: '#FFD700', // Gold for dots
            POWER: '#FFFFFF' // White for power pellets
        }),
        AUDIO: Object.freeze({
            DOT: 220,
            POWER: 440,
            DEATH: 110,
            DURATION: 120
        }),
        SPEEDS: Object.freeze({
            PACMAN: 2.2,
            GHOST: 2,
            GHOST_FRIGHTENED: 1
        }),
        GHOST_MODES: Object.freeze({
            SCATTER_DURATION: 20000,
            CHASE_DURATION: 25000
        }),
        TUNNEL_Y: 14 * 16,
        PACMAN_START: { x: 13.5 * 16, y: 26 * 16 }
    });

    // **Maze Layout** - Authentic 28x31 Pac-Man arcade maze
    const MAZE_TEMPLATE = [
        "############################",
        "#............##............#",
        "#.####.#####.##.#####.####.#",
        "#.####.#####.##.#####.####.#",
        "#.####.#####.##.#####.####.#",
        "#..........................#",
        "#.####.##.########.##.####.#",
        "#.####.##.########.##.####.#",
        "#......##....##....##......#",
        "######.##### ## #####.######",
        "     #.##### ## #####.#     ",
        "     #.##          ##.#     ",
        "     #.## ###@@### ##.#     ",
        "     #.## #      # ##.#     ",
        "      .   #      #   .      ",
        "     #.## #      # ##.#     ",
        "     #.## ######## ##.#     ",
        "     #.##          ##.#     ",
        "#.....## ########## ##.....#",
        "#.####.##          ##.####.#",
        "#.####.##          ##.####.#",
        "#o....## ########## ##....o#",
        "######.## ########## ##.#####",
        "#......##          ##......#",
        "#.####.## ########## ##.####.#",
        "#.####.## ########## ##.####.#",
        "#......##          ##......#",
        "#.####.#####.##.#####.####.#",
        "#.####.#####.##.#####.####.#",
        "#o....#####.##.#####....o#",
        "############################"
    ];

    // Normalize maze rows to 28 characters
    const MAZE = Object.freeze(MAZE_TEMPLATE.map(row => 
        row.replace(/@/g, ' ').padEnd(28, ' ').substring(0, 28)
    ));

    // **Canvas Initialization** - Early validation
    const canvas = document.createElement('canvas');
    if (!canvas.getContext) throw new Error('Canvas not supported');
    const ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = CONFIG.CANVAS_WIDTH;
    canvas.height = CONFIG.CANVAS_HEIGHT;
    canvas.setAttribute('tabindex', '1');
    document.body.appendChild(canvas);
    canvas.focus();

    // **Utility Functions** - Reusable helpers
    const Utils = {
        distance(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
        clamp(value, min, max) { return Math.max(min, Math.min(max, value)); },
        randomDirection() {
            const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
            return dirs[Math.floor(Math.random() * dirs.length)];
        },
        getTile(x, y) {
            return { x: Math.floor(x / CONFIG.TILE_SIZE), y: Math.floor(y / CONFIG.TILE_SIZE) };
        }
    };

    // **Audio Manager** - Robust sound handling
    class AudioManager {
        constructor() {
            try {
                this.context = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('AudioContext unavailable:', e);
                this.context = null;
            }
        }
        play(frequency, duration = CONFIG.AUDIO.DURATION) {
            if (!this.context) return;
            if (this.context.state === 'suspended') this.context.resume();
            const osc = this.context.createOscillator();
            osc.type = 'square';
            osc.frequency.value = frequency;
            osc.connect(this.context.destination);
            osc.start();
            setTimeout(() => osc.stop(), duration);
        }
    }

    // **Entity Manager** - Centralized entity state
    class EntityManager {
        constructor() {
            this.pacman = {
                x: CONFIG.PACMAN_START.x,
                y: CONFIG.PACMAN_START.y,
                speed: CONFIG.SPEEDS.PACMAN,
                direction: 0,
                nextDirection: null,
                radius: 7,
                mouthAngle: 0,
                lives: 3,
                powerMode: false,
                powerTimer: 0
            };
            this.ghosts = [
                { color: CONFIG.COLORS.GHOSTS[0], x: 13 * 16, y: 11 * 16 }, // Blinky
                { color: CONFIG.COLORS.GHOSTS[1], x: 14 * 16, y: 13 * 16 }, // Pinky
                { color: CONFIG.COLORS.GHOSTS[2], x: 12 * 16, y: 14 * 16 }, // Inky
                { color: CONFIG.COLORS.GHOSTS[3], x: 15 * 16, y: 14 * 16 }  // Clyde
            ].map(g => ({
                ...g, speed: CONFIG.SPEEDS.GHOST, direction: Utils.randomDirection(),
                frightened: false, mode: 'scatter', modeTimer: 0
            }));
            this.dots = [];
            this.powerUps = [];
        }
        reset() {
            Object.assign(this.pacman, {
                x: CONFIG.PACMAN_START.x, y: CONFIG.PACMAN_START.y,
                direction: 0, nextDirection: null, powerMode: false, powerTimer: 0
            });
            this.ghosts.forEach((g, i) => {
                Object.assign(g, {
                    x: [13, 14, 12, 15][i] * 16,
                    y: [11, 13, 14, 14][i] * 16,
                    direction: Utils.randomDirection(),
                    frightened: false, mode: 'scatter', modeTimer: 0
                });
            });
        }
    }

    // **Game Logic** - Core mechanics
    class PacmanGame {
        constructor() {
            this.entities = new EntityManager();
            this.audio = new AudioManager();
            this.score = 0;
            this.highScore = parseInt(localStorage.getItem('pacmanHigh') || '0', 10);
            this.state = 'playing';
            this.lastTime = performance.now();
            this.keysPressed = new Set();
            this.globalModeTimer = 0;
            this.maze = MAZE;
            this.initMazeItems();
            this.bindControls();
            this.startGameLoop();
        }

        initMazeItems() {
            for (let y = 0; y < this.maze.length; y++) {
                for (let x = 0; x < this.maze[y].length; x++) {
                    if (this.maze[y][x] === '.') {
                        this.entities.dots.push({ x: x * 16 + 8, y: y * 16 + 8 });
                    } else if (this.maze[y][x] === 'o') {
                        this.entities.powerUps.push({ x: x * 16 + 8, y: y * 16 + 8 });
                    }
                }
            }
        }

        bindControls() {
            const keyMap = Object.freeze({
                'arrowleft': Math.PI, 'arrowright': 0,
                'arrowup': -Math.PI / 2, 'arrowdown': Math.PI / 2,
                'a': Math.PI, 'd': 0, 'w': -Math.PI / 2, 's': Math.PI / 2
            });
            const handleKeyDown = (e) => {
                e.preventDefault();
                const dir = keyMap[e.key.toLowerCase()];
                if (dir !== undefined) {
                    this.keysPressed.add(e.key.toLowerCase());
                    this.entities.pacman.nextDirection = dir;
                }
            };
            const handleKeyUp = (e) => {
                e.preventDefault();
                this.keysPressed.delete(e.key.toLowerCase());
                this.entities.pacman.nextDirection = this.keysPressed.size > 0 ?
                    keyMap[Array.from(this.keysPressed).pop()] : null;
            };
            canvas.addEventListener('keydown', handleKeyDown);
            canvas.addEventListener('keyup', handleKeyUp);
            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('keyup', handleKeyUp);
            canvas.addEventListener('click', () => {
                canvas.focus();
                if (this.audio.context?.state === 'suspended') this.audio.context.resume();
            });
        }

        canMove(x, y, radius) {
            const corners = [
                [x + radius, y + radius], [x - radius, y + radius],
                [x + radius, y - radius], [x - radius, y - radius]
            ];
            return corners.every(([cx, cy]) => {
                const gx = Math.floor(cx / CONFIG.TILE_SIZE);
                const gy = Math.floor(cy / CONFIG.TILE_SIZE);
                return gx >= 0 && gx < 28 && gy >= 0 && gy < 31 && this.maze[gy][gx] !== '#';
            });
        }

        getAvailableDirections(x, y, radius) {
            const dirs = [
                { angle: 0, dx: 1, dy: 0 }, { angle: Math.PI, dx: -1, dy: 0 },
                { angle: -Math.PI / 2, dx: 0, dy: -1 }, { angle: Math.PI / 2, dx: 0, dy: 1 }
            ];
            return dirs.filter(d => this.canMove(x + d.dx * 8, y + d.dy * 8, radius));
        }

        updateGhostAI(ghost, pacTile, delta) {
            const available = this.getAvailableDirections(ghost.x, ghost.y, 7);
            if (!available.length) return;

            ghost.modeTimer += delta;
            if (ghost.modeTimer > (ghost.mode === 'scatter' ?
                CONFIG.GHOST_MODES.SCATTER_DURATION : CONFIG.GHOST_MODES.CHASE_DURATION)) {
                ghost.mode = ghost.mode === 'scatter' ? 'chase' : 'scatter';
                ghost.modeTimer = 0;
            }

            const target = ghost.frightened ?
                { x: Math.random() * CONFIG.CANVAS_WIDTH, y: Math.random() * CONFIG.CANVAS_HEIGHT } :
                ghost.mode === 'scatter' ?
                    [{ x: 25, y: 0 }, { x: 2, y: 0 }, { x: 25, y: 30 }, { x: 2, y: 30 }][
                        CONFIG.COLORS.GHOSTS.indexOf(ghost.color)] :
                    this.getChaseTarget(ghost, pacTile);

            ghost.direction = available.reduce((best, dir) => {
                const dist = Utils.distance(ghost.x + dir.dx * 16, ghost.y + dir.dy * 16,
                    target.x * 16, target.y * 16);
                return dist < Utils.distance(ghost.x + best.dx * 16, ghost.y + best.dy * 16,
                    target.x * 16, target.y * 16) ? dir : best;
            }, available[0]).angle;
        }

        getChaseTarget(ghost, pacTile) {
            const pacX = pacTile.x, pacY = pacTile.y;
            const idx = CONFIG.COLORS.GHOSTS.indexOf(ghost.color);
            switch (idx) {
                case 0: return { x: pacX, y: pacY }; // Blinky
                case 1: return { x: pacX + Math.cos(this.entities.pacman.direction) * 4,
                                y: pacY + Math.sin(this.entities.pacman.direction) * 4 }; // Pinky
                case 2: const blinky = Utils.getTile(this.entities.ghosts[0].x, this.entities.ghosts[0].y);
                        return { x: pacX + (pacX - blinky.x), y: pacY + (pacY - blinky.y) }; // Inky
                case 3: return Utils.distance(ghost.x, ghost.y, pacX * 16, pacY * 16) > 128 ?
                        { x: pacX, y: pacY } : { x: 2, y: 30 }; // Clyde
            }
        }

        update(delta) {
            const pac = this.entities.pacman;
            const speed = pac.speed * (delta / 16);
            const pacTile = Utils.getTile(pac.x, pac.y);

            // Direction and movement
            if (pac.nextDirection !== null && this.canMove(
                pac.x + Math.cos(pac.nextDirection) * speed,
                pac.y + Math.sin(pac.nextDirection) * speed, pac.radius)) {
                pac.direction = pac.nextDirection;
            }
            let newX = pac.x + Math.cos(pac.direction) * speed;
            let newY = pac.y + Math.sin(pac.direction) * speed;

            // Tunnel failsafe
            if (pacTile.y === 14) {
                if (newX < -8) newX = CONFIG.CANVAS_WIDTH - 8;
                else if (newX > CONFIG.CANVAS_WIDTH - 8) newX = -8;
            }
            if (this.canMove(newX, newY, pac.radius)) {
                pac.x = newX;
                pac.y = newY;
            }

            // Power mode
            if (pac.powerMode) {
                pac.powerTimer -= delta;
                if (pac.powerTimer <= 0) {
                    pac.powerMode = false;
                    this.entities.ghosts.forEach(g => g.frightened = false);
                }
            }

            // Collectibles
            this.entities.dots = this.entities.dots.filter(d => {
                if (Utils.distance(pac.x, pac.y, d.x, d.y) < pac.radius + 3) {
                    this.score += 10;
                    this.audio.play(CONFIG.AUDIO.DOT);
                    return false;
                }
                return true;
            });
            this.entities.powerUps = this.entities.powerUps.filter(p => {
                if (Utils.distance(pac.x, pac.y, p.x, p.y) < pac.radius + 5) {
                    this.score += 50;
                    pac.powerMode = true;
                    pac.powerTimer = 6000;
                    this.entities.ghosts.forEach(g => g.frightened = true);
                    this.audio.play(CONFIG.AUDIO.POWER);
                    return false;
                }
                return true;
            });

            // Ghost updates
            this.entities.ghosts.forEach(g => {
                this.updateGhostAI(g, pacTile, delta);
                const gSpeed = g.frightened ? CONFIG.SPEEDS.GHOST_FRIGHTENED : CONFIG.SPEEDS.GHOST;
                let gx = g.x + Math.cos(g.direction) * gSpeed * (delta / 16);
                let gy = g.y + Math.sin(g.direction) * gSpeed * (delta / 16);
                if (Utils.getTile(g.x, g.y).y === 14) {
                    if (gx < -8) gx = CONFIG.CANVAS_WIDTH - 8;
                    else if (gx > CONFIG.CANVAS_WIDTH - 8) gx = -8;
                }
                if (this.canMove(gx, gy, 7)) {
                    g.x = gx;
                    g.y = gy;
                }
                if (Utils.distance(g.x, g.y, pac.x, pac.y) < 14) {
                    if (pac.powerMode) {
                        g.x = 13.5 * 16;
                        g.y = 11 * 16;
                        this.score += 200;
                    } else {
                        pac.lives--;
                        this.audio.play(CONFIG.AUDIO.DEATH, 300);
                        this.entities.reset();
                        if (pac.lives <= 0) {
                            this.state = 'gameover';
                            if (this.score > this.highScore) {
                                this.highScore = this.score;
                                localStorage.setItem('pacmanHigh', this.highScore);
                            }
                        }
                    }
                }
            });

            if (!this.entities.dots.length && !this.entities.powerUps.length) this.state = 'win';
        }

        render(timestamp) {
            ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Maze with glow effect
            ctx.fillStyle = CONFIG.COLORS.WALL;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#1E90FF';
            for (let y = 0; y < this.maze.length; y++) {
                for (let x = 0; x < this.maze[y].length; x++) {
                    if (this.maze[y][x] === '#') {
                        ctx.fillRect(x * 16, y * 16, 16, 16);
                    }
                }
            }
            ctx.shadowBlur = 0;

            // Dots and power-ups
            ctx.fillStyle = CONFIG.COLORS.DOT;
            this.entities.dots.forEach(d => {
                ctx.beginPath();
                ctx.arc(d.x, d.y, 3, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.fillStyle = CONFIG.COLORS.POWER;
            this.entities.powerUps.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5 + Math.sin(timestamp * 0.005), 0, Math.PI * 2);
                ctx.fill();
            });

            // Pacman with animation
            ctx.fillStyle = pac.powerMode ? `hsl(${timestamp % 360}, 100%, 50%)` : CONFIG.COLORS.PACMAN;
            const pac = this.entities.pacman;
            pac.mouthAngle = Math.sin(timestamp * 0.015) * 0.6 + 0.6;
            ctx.beginPath();
            ctx.arc(pac.x, pac.y, pac.radius, pac.direction + pac.mouthAngle,
                pac.direction + 2 * Math.PI - pac.mouthAngle);
            ctx.lineTo(pac.x, pac.y);
            ctx.fill();

            // Ghosts with eyes
            this.entities.ghosts.forEach(g => {
                ctx.fillStyle = g.frightened ? CONFIG.COLORS.FRIGHTENED : g.color;
                ctx.beginPath();
                ctx.arc(g.x, g.y, 7, 0, Math.PI);
                ctx.lineTo(g.x + 7, g.y + 7);
                for (let i = 5; i >= -5; i -= 2) {
                    ctx.lineTo(g.x + i, g.y + (Math.abs(i) === 5 ? 7 : 5));
                }
                ctx.fill();
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(g.x - 3, g.y - 3, 2, 4);
                ctx.fillRect(g.x + 1, g.y - 3, 2, 4);
            });

            // HUD
            ctx.fillStyle = CONFIG.COLORS.TEXT;
            ctx.font = '18px "Press Start 2P", Arial';
            ctx.fillText(`Score: ${this.score}`, 10, 30);
            ctx.fillText(`High: ${this.highScore}`, 160, 30);
            ctx.fillText(`Lives: ${pac.lives}`, 320, 30);

            if (this.state !== 'playing') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = CONFIG.COLORS.TEXT;
                ctx.font = '36px "Press Start 2P", Arial';
                ctx.fillText(this.state === 'win' ? 'YOU WIN!' : 'GAME OVER',
                    canvas.width / 2 - 130, canvas.height / 2);
            }
        }

        startGameLoop() {
            const loop = (timestamp) => {
                const delta = Utils.clamp(timestamp - this.lastTime, 0, 100);
                this.lastTime = timestamp;
                try {
                    if (this.state === 'playing') this.update(delta);
                    this.render(timestamp);
                    requestAnimationFrame(loop);
                } catch (e) {
                    console.error('Game loop error:', e);
                    this.state = 'error';
                    ctx.fillStyle = CONFIG.COLORS.TEXT;
                    ctx.fillText('Game Crashed!', 100, canvas.height / 2);
                }
            };
            requestAnimationFrame(loop);
        }
    }

    // **Bootstrap**
    try {
        if (!window.requestAnimationFrame) window.requestAnimationFrame = cb => setTimeout(cb, 16);
        new PacmanGame();
    } catch (e) {
        console.error('Failed to start:', e);
        document.body.textContent = 'Pacman failed to load. Please refresh.';
    }
})();
