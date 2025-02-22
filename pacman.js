// pacman.js
(() => {
    'use strict';

    // Constants Configuration
    const CONFIG = Object.freeze({
        TILE_SIZE: 16,
        CANVAS_WIDTH: 448,  // 28 * 16
        CANVAS_HEIGHT: 496, // 31 * 16 (adjusted to fit 28x31 maze)
        COLORS: Object.freeze({
            BACKGROUND: '#000000',
            WALL: '#0000FF',
            PACMAN: '#FFFF00',
            GHOSTS: ['#FF0000', '#FFB8FF', '#00FFFF', '#FFB852'],
            TEXT: '#FFFFFF',
            FRIGHTENED: '#000080'
        }),
        AUDIO: Object.freeze({
            DOT: 220,
            POWER: 440,
            DEATH: 110,
            DURATION: 100
        }),
        SPEEDS: Object.freeze({
            PACMAN: 2,
            GHOST: 1.8,
            GHOST_FRIGHTENED: 0.9
        }),
        GHOST_MODES: Object.freeze({
            SCATTER_DURATION: 20000,
            CHASE_DURATION: 20000
        })
    });

    // Maze from your code, converted to character format
    // 1 = '#', 0 = '.', 3 = 'o', 2 = '@', 4 = ' '
    const MAZE = Object.freeze([
        "############################",
        "#............##............#",
        "#.####.#####.##.#####.####.#",
        "#o####.#####.##.#####.####o#",
        "#.####.#####.##.#####.####.#",
        "#..........................#",
        "#.####.##.########.##.####.#",
        "#.####.##.########.##.####.#",
        "#......##....##....##......#",
        "######.##### ## #####.######",
        "#     .##### ## #####.     #",
        "#     .##          ##.     #",
        "#     .## ###@@### ##.     #",
        "       ## #      # ##       ",
        "       ## #      # ##       ",
        "       ## #      # ##       ",
        "#.....## ########## ##.....#",
        "#.####.##          ##.####.#",
        "#.####.##          ##.####.#",
        "#......## ########## ##.....#",
        "#.####.## ########## ##.####.#",
        "#.####.##          ##.####.#",
        "#o..##...          ...##..o#",
        "#####.## ########## ##.#####",
        "#.... ## ########## ## ....#",
        "#.####.##############.####.#",
        "#.####.##############.####.#",
        "#..........................#",
        "#.####.#####.##.#####.####.#",
        "#.####.#####.##.#####.####.#",
        "#............##............#",
        "############################"
    ]);

    // Canvas Setup
    const canvas = document.createElement('canvas');
    if (!canvas.getContext) throw new Error('Canvas not supported');
    const ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = CONFIG.CANVAS_WIDTH;
    canvas.height = CONFIG.CANVAS_HEIGHT;
    canvas.tabIndex = 0;
    document.body.appendChild(canvas);
    canvas.focus();

    // Utility Functions
    const Utils = {
        distance(x1, y1, x2, y2) {
            return Math.hypot(x2 - x1, y2 - y1);
        },
        clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        },
        randomDirection() {
            return [0, Math.PI/2, Math.PI, -Math.PI/2][Math.floor(Math.random() * 4)];
        },
        getTile(x, y) {
            return {
                x: Math.floor(x / CONFIG.TILE_SIZE),
                y: Math.floor(y / CONFIG.TILE_SIZE)
            };
        }
    };

    // Audio Module
    class AudioManager {
        constructor() {
            this.context = null;
            try {
                this.context = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('AudioContext unavailable:', e);
            }
        }

        play(frequency, duration = CONFIG.AUDIO.DURATION) {
            if (!this.context) return;
            const osc = this.context.createOscillator();
            osc.type = 'square';
            osc.frequency.value = frequency;
            osc.connect(this.context.destination);
            osc.start();
            setTimeout(() => {
                osc.stop();
                osc.disconnect();
            }, duration);
        }
    }

    // Entity Management
    class EntityManager {
        constructor() {
            this.pacman = {
                x: 13.5 * CONFIG.TILE_SIZE, // Starting at index 490 adjusted
                y: 23 * CONFIG.TILE_SIZE,
                speed: CONFIG.SPEEDS.PACMAN,
                direction: 0,
                nextDirection: null,
                radius: 7,
                mouthAngle: 0,
                lives: 3,
                powerMode: false,
                powerTimer: 0
            };

            this.ghosts = CONFIG.COLORS.GHOSTS.map((color, i) => ({
                x: (i === 0 ? 12 : i === 1 ? 14 : i === 2 ? 12 : 14) * CONFIG.TILE_SIZE, // Adjusted from your ghost start indices
                y: (i < 2 ? 13 : 14) * CONFIG.TILE_SIZE,
                color,
                speed: CONFIG.SPEEDS.GHOST,
                direction: Utils.randomDirection(),
                frightened: false,
                targetTile: null,
                mode: 'scatter',
                modeTimer: 0
            }));

            this.dots = [];
            this.powerUps = [];
        }

        reset() {
            Object.assign(this.pacman, {
                x: 13.5 * CONFIG.TILE_SIZE,
                y: 23 * CONFIG.TILE_SIZE,
                direction: 0,
                nextDirection: null,
                powerMode: false,
                powerTimer: 0
            });
            this.ghosts.forEach((g, i) => {
                Object.assign(g, {
                    x: (i === 0 ? 12 : i === 1 ? 14 : i === 2 ? 12 : 14) * CONFIG.TILE_SIZE,
                    y: (i < 2 ? 13 : 14) * CONFIG.TILE_SIZE,
                    direction: Utils.randomDirection(),
                    frightened: false,
                    mode: 'scatter',
                    modeTimer: 0
                });
            });
        }
    }

    // Game Logic
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
            this.initMazeItems();
            this.bindControls();
            this.startGameLoop();
        }

        initMazeItems() {
            for (let y = 0; y < MAZE.length; y++) {
                for (let x = 0; x < MAZE[y].length; x++) {
                    if (MAZE[y][x] === '.') {
                        this.entities.dots.push({
                            x: x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2,
                            y: y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2
                        });
                    } else if (MAZE[y][x] === 'o') {
                        this.entities.powerUps.push({
                            x: x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2,
                            y: y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2
                        });
                    }
                }
            }
        }

        bindControls() {
            const keyMap = Object.freeze({
                'arrowleft': Math.PI,
                'arrowright': 0,
                'arrowup': -Math.PI/2,
                'arrowdown': Math.PI/2,
                'a': Math.PI,
                'd': 0,
                'w': -Math.PI/2,
                's': Math.PI/2
            });

            canvas.addEventListener('keydown', (e) => {
                e.preventDefault();
                const key = e.key.toLowerCase();
                if (keyMap[key]) {
                    this.keysPressed.add(key);
                    this.entities.pacman.nextDirection = keyMap[key];
                }
            });

            canvas.addEventListener('keyup', (e) => {
                e.preventDefault();
                const key = e.key.toLowerCase();
                this.keysPressed.delete(key);
                if (this.keysPressed.size > 0) {
                    this.entities.pacman.nextDirection = keyMap[Array.from(this.keysPressed).pop()];
                } else {
                    this.entities.pacman.nextDirection = null;
                }
            });

            canvas.addEventListener('click', () => canvas.focus());
        }

        canMove(x, y, radius) {
            const gridX1 = Math.floor((x + radius) / CONFIG.TILE_SIZE);
            const gridY1 = Math.floor((y + radius) / CONFIG.TILE_SIZE);
            const gridX2 = Math.floor((x - radius) / CONFIG.TILE_SIZE);
            const gridY2 = Math.floor((y - radius) / CONFIG.TILE_SIZE);
            return (gridX1 >= 0 && gridX1 < 28 && gridY1 >= 0 && gridY1 < 31 &&
                    gridX2 >= 0 && gridX2 < 28 && gridY2 >= 0 && gridY2 < 31 &&
                    MAZE[gridY1][gridX1] !== '#' && MAZE[gridY2][gridX2] !== '#');
        }

        getAvailableDirections(x, y, radius) {
            const directions = [
                { angle: 0, dx: 1, dy: 0 },
                { angle: Math.PI, dx: -1, dy: 0 },
                { angle: -Math.PI/2, dx: 0, dy: -1 },
                { angle: Math.PI/2, dx: 0, dy: 1 }
            ];
            return directions.filter(dir => 
                this.canMove(x + dir.dx * CONFIG.TILE_SIZE/2, 
                           y + dir.dy * CONFIG.TILE_SIZE/2, radius));
        }

        updateGhostAI(ghost, pacTile, delta) {
            const ghostTile = Utils.getTile(ghost.x, ghost.y);
            const availableDirs = this.getAvailableDirections(ghost.x, ghost.y, 7);
            if (availableDirs.length === 0) return;

            ghost.modeTimer += delta;
            this.globalModeTimer += delta;
            const modeDuration = ghost.mode === 'scatter' ? 
                CONFIG.GHOST_MODES.SCATTER_DURATION : CONFIG.GHOST_MODES.CHASE_DURATION;
            if (ghost.modeTimer > modeDuration) {
                ghost.mode = ghost.mode === 'scatter' ? 'chase' : 'scatter';
                ghost.modeTimer = 0;
            }

            let targetX, targetY;
            if (ghost.frightened) {
                targetX = ghostTile.x * CONFIG.TILE_SIZE + (Math.random() - 0.5) * CONFIG.CANVAS_WIDTH;
                targetY = ghostTile.y * CONFIG.TILE_SIZE + (Math.random() - 0.5) * CONFIG.CANVAS_HEIGHT;
            } else if (ghost.mode === 'scatter') {
                const scatterTargets = [
                    { x: 25, y: 0 }, { x: 2, y: 0 }, { x: 25, y: 30 }, { x: 2, y: 30 }
                ];
                const idx = CONFIG.COLORS.GHOSTS.indexOf(ghost.color);
                targetX = scatterTargets[idx].x * CONFIG.TILE_SIZE;
                targetY = scatterTargets[idx].y * CONFIG.TILE_SIZE;
            } else {
                const pacX = pacTile.x * CONFIG.TILE_SIZE;
                const pacY = pacTile.y * CONFIG.TILE_SIZE;
                const idx = CONFIG.COLORS.GHOSTS.indexOf(ghost.color);
                switch (idx) {
                    case 0: // Blinky
                        targetX = pacX;
                        targetY = pacY;
                        break;
                    case 1: // Pinky
                        targetX = pacX + Math.cos(this.entities.pacman.direction) * 4 * CONFIG.TILE_SIZE;
                        targetY = pacY + Math.sin(this.entities.pacman.direction) * 4 * CONFIG.TILE_SIZE;
                        break;
                    case 2: // Inky
                        const blinky = this.entities.ghosts[0];
                        targetX = pacX + (pacX - blinky.x);
                        targetY = pacY + (pacY - blinky.y);
                        break;
                    case 3: // Clyde
                        const dist = Utils.distance(ghost.x, ghost.y, pacX, pacY);
                        targetX = dist > 8 * CONFIG.TILE_SIZE ? pacX : 2 * CONFIG.TILE_SIZE;
                        targetY = dist > 8 * CONFIG.TILE_SIZE ? pacY : 30 * CONFIG.TILE_SIZE;
                        break;
                }
            }

            let bestDir = availableDirs[0].angle;
            let minDist = Infinity;
            availableDirs.forEach(dir => {
                const newX = ghost.x + dir.dx * CONFIG.TILE_SIZE;
                const newY = ghost.y + dir.dy * CONFIG.TILE_SIZE;
                const dist = Utils.distance(newX, newY, targetX, targetY);
                if (dist < minDist) {
                    minDist = dist;
                    bestDir = dir.angle;
                }
            });
            ghost.direction = bestDir;
        }

        update(delta) {
            const pac = this.entities.pacman;
            const speed = pac.speed * (delta / 16);
            const pacTile = Utils.getTile(pac.x, pac.y);

            // Pacman movement
            if (pac.nextDirection !== null && 
                this.canMove(pac.x + Math.cos(pac.nextDirection) * speed,
                           pac.y + Math.sin(pac.nextDirection) * speed, pac.radius)) {
                pac.direction = pac.nextDirection;
            }

            const newX = pac.x + Math.cos(pac.direction) * speed;
            const newY = pac.y + Math.sin(pac.direction) * speed;
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
            this.entities.dots = this.entities.dots.filter(dot => {
                if (Utils.distance(pac.x, pac.y, dot.x, dot.y) <= pac.radius + 2) {
                    this.score += 10;
                    this.audio.play(CONFIG.AUDIO.DOT);
                    return false;
                }
                return true;
            });

            this.entities.powerUps = this.entities.powerUps.filter(power => {
                if (Utils.distance(pac.x, pac.y, power.x, power.y) <= pac.radius + 4) {
                    this.score += 50;
                    pac.powerMode = true;
                    pac.powerTimer = 5000;
                    this.entities.ghosts.forEach(g => g.frightened = true);
                    this.audio.play(CONFIG.AUDIO.POWER);
                    return false;
                }
                return true;
            });

            // Ghost movement
            this.entities.ghosts.forEach(ghost => {
                this.updateGhostAI(ghost, pacTile, delta);
                const ghostSpeed = ghost.frightened ? 
                    CONFIG.SPEEDS.GHOST_FRIGHTENED : CONFIG.SPEEDS.GHOST;
                const ghostX = ghost.x + Math.cos(ghost.direction) * ghostSpeed * (delta / 16);
                const ghostY = ghost.y + Math.sin(ghost.direction) * ghostSpeed * (delta / 16);
                
                if (this.canMove(ghostX, ghostY, 7)) {
                    ghost.x = ghostX;
                    ghost.y = ghostY;
                } else {
                    ghost.direction = this.getAvailableDirections(ghost.x, ghost.y, 7)[0]?.angle || ghost.direction;
                }

                if (Utils.distance(ghost.x, ghost.y, pac.x, pac.y) < pac.radius + 7) {
                    if (pac.powerMode) {
                        ghost.x = 13.5 * CONFIG.TILE_SIZE;
                        ghost.y = 11 * CONFIG.TILE_SIZE;
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

            if (this.entities.dots.length === 0 && this.entities.powerUps.length === 0) {
                this.state = 'win';
            }
        }

        render(timestamp) {
            const pac = this.entities.pacman;
            ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = CONFIG.COLORS.WALL;
            for (let y = 0; y < MAZE.length; y++) {
                for (let x = 0; x < MAZE[y].length; x++) {
                    if (MAZE[y][x] === '#') {
                        ctx.fillRect(x * CONFIG.TILE_SIZE, y * CONFIG.TILE_SIZE,
                                   CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    }
                }
            }

            ctx.fillStyle = CONFIG.COLORS.TEXT;
            this.entities.dots.forEach(dot => {
                ctx.beginPath();
                ctx.arc(dot.x, dot.y, 2, 0, Math.PI * 2);
                ctx.fill();
            });
            this.entities.powerUps.forEach(power => {
                ctx.beginPath();
                ctx.arc(power.x, power.y, 4, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.fillStyle = pac.powerMode ? 
                `hsl(${timestamp % 360}, 100%, 50%)` : CONFIG.COLORS.PACMAN;
            pac.mouthAngle = Math.sin(timestamp * 0.01) * 0.5 + 0.5;
            ctx.beginPath();
            ctx.arc(pac.x, pac.y, pac.radius, 
                   pac.direction + pac.mouthAngle, 
                   pac.direction + 2 * Math.PI - pac.mouthAngle);
            ctx.lineTo(pac.x, pac.y);
            ctx.fill();

            this.entities.ghosts.forEach(ghost => {
                ctx.fillStyle = ghost.frightened ? CONFIG.COLORS.FRIGHTENED : ghost.color;
                ctx.beginPath();
                ctx.arc(ghost.x, ghost.y, 7, 0, Math.PI);
                ctx.lineTo(ghost.x + 7, ghost.y + 7);
                for (let i = 5; i >= -5; i -= 2) {
                    ctx.lineTo(ghost.x + i, ghost.y + (Math.abs(i) === 5 ? 7 : 5));
                }
                ctx.fill();

                ctx.fillStyle = CONFIG.COLORS.TEXT;
                ctx.beginPath();
                ctx.arc(ghost.x - 3, ghost.y - 2, 2, 0, Math.PI * 2);
                ctx.arc(ghost.x + 3, ghost.y - 2, 2, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.fillStyle = CONFIG.COLORS.TEXT;
            ctx.font = '16px Arial';
            ctx.fillText(`Score: ${this.score}`, 10, 20);
            ctx.fillText(`High: ${this.highScore}`, 150, 20);
            ctx.fillText(`Lives: ${pac.lives}`, 360, 20);

            if (this.state !== 'playing') {
                ctx.font = '32px Arial';
                ctx.fillText(this.state === 'win' ? 'You Win!' : 'Game Over',
                           canvas.width/2 - 80, canvas.height/2);
            }
        }

        startGameLoop() {
            const loop = (timestamp) => {
                const delta = Utils.clamp(timestamp - this.lastTime, 0, 100);
                this.lastTime = timestamp;

                try {
                    if (this.state === 'playing') {
                        this.update(delta);
                    }
                    this.render(timestamp);
                    requestAnimationFrame(loop);
                } catch (error) {
                    console.error('Game loop error:', error);
                    this.state = 'error';
                    ctx.fillStyle = CONFIG.COLORS.TEXT;
                    ctx.font = '20px Arial';
                    ctx.fillText('Game Crashed! Refresh to retry.', 50, canvas.height/2);
                }
            };
            requestAnimationFrame(loop);
        }
    }

    // Bootstrap
    try {
        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = cb => setTimeout(cb, 16);
        }
        new PacmanGame();
    } catch (e) {
        console.error('Initialization failed:', e);
        document.body.textContent = 'Pacman failed to start. Check browser compatibility.';
    }
})();
