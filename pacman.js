// pacman.js
(() => {
    // Configuration
    const CONFIG = Object.freeze({
        TILE_SIZE: 16,
        CANVAS_WIDTH: 448,
        CANVAS_HEIGHT: 496,
        COLORS: {
            BACKGROUND: '#000000',
            WALL: '#0000FF',
            PACMAN: '#FFFF00',
            GHOSTS: ['#FF0000', '#FFB8FF', '#00FFFF', '#FFB852'],
            TEXT: '#FFFFFF',
            FRIGHTENED: '#000080'
        },
        AUDIO: {
            DOT: 220,
            POWER: 440,
            DEATH: 110,
            DURATION: 100
        },
        SPEEDS: {
            PACMAN: 2.5,
            GHOST: 2
        },
        POWER_DURATION: 5000
    });

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
        "     #.##### ## #####.#     ",
        "     #.##    @     ##.#     ",
        "     #.## ###==### ##.#     ",
        "######.## #      # ##.######",
        "      .   #      #   .      ",
        "######.## #      # ##.######",
        "#.....## ########## ##.....#",
        "#.####.## ########## ##.####.#",
        "#.####.##            ##.####.#",
        "#......## ########## ##......#",
        "#.####.## ########## ##.####.#",
        "#.####.##            ##.####.#",
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
    const ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = CONFIG.CANVAS_WIDTH;
    canvas.height = CONFIG.CANVAS_HEIGHT;
    canvas.tabIndex = 0;
    document.body.appendChild(canvas);
    canvas.focus();

    // Utilities
    const Utils = {
        distance(x1, y1, x2, y2) {
            return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        },
        clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        },
        randomDirection() {
            return [0, Math.PI/2, Math.PI, -Math.PI/2][Math.floor(Math.random() * 4)];
        },
        tileToPixel(tile) {
            return tile * CONFIG.TILE_SIZE;
        }
    };

    // Audio Manager
    class AudioManager {
        constructor() {
            this.context = window.AudioContext || window.webkitAudioContext ?
                new (window.AudioContext || window.webkitAudioContext)() : null;
        }

        play(frequency, duration = CONFIG.AUDIO.DURATION) {
            if (!this.context) return;
            try {
                const osc = this.context.createOscillator();
                osc.type = 'square';
                osc.frequency.value = frequency;
                osc.connect(this.context.destination);
                osc.start();
                osc.stop(this.context.currentTime + duration / 1000);
            } catch (e) {
                console.warn('Audio error:', e);
            }
        }
    }

    // Entity Manager
    class EntityManager {
        constructor() {
            this.pacman = {
                x: Utils.tileToPixel(13.5),
                y: Utils.tileToPixel(23),
                speed: CONFIG.SPEEDS.PACMAN,
                direction: 0,
                nextDirection: 0,
                radius: 7,
                mouthAngle: 0,
                lives: 3,
                powerMode: false,
                powerTimer: 0
            };

            this.ghosts = CONFIG.COLORS.GHOSTS.map((color, i) => ({
                x: Utils.tileToPixel(13 + (i % 2)),
                y: Utils.tileToPixel(11 + Math.floor(i / 2)),
                color,
                speed: CONFIG.SPEEDS.GHOST,
                direction: Utils.randomDirection(),
                mode: 'scatter',
                modeTimer: 0
            }));

            this.dots = [];
            this.powerUps = [];
        }

        reset() {
            this.pacman.x = Utils.tileToPixel(13.5);
            this.pacman.y = Utils.tileToPixel(23);
            this.pacman.direction = 0;
            this.pacman.nextDirection = 0;
            this.pacman.powerMode = false;
            this.pacman.powerTimer = 0;
            this.ghosts.forEach((g, i) => {
                g.x = Utils.tileToPixel(13 + (i % 2));
                g.y = Utils.tileToPixel(11 + Math.floor(i / 2));
                g.direction = Utils.randomDirection();
                g.mode = 'scatter';
                g.modeTimer = 0;
            });
        }
    }

    // Game Logic
    class PacmanGame {
        constructor() {
            this.entities = new EntityManager();
            this.audio = new AudioManager();
            this.score = 0;
            this.highScore = parseInt(localStorage.getItem('pacmanHigh') || '0');
            this.state = 'playing';
            this.lastTime = 0;
            this.keysPressed = new Set();
            this.initMazeItems();
            this.bindControls();
            this.startGameLoop();
        }

        initMazeItems() {
            for (let y = 0; y < MAZE.length; y++) {
                for (let x = 0; x < MAZE[y].length; x++) {
                    if (MAZE[y][x] === '.') {
                        this.entities.dots.push({
                            x: Utils.tileToPixel(x) + CONFIG.TILE_SIZE/2,
                            y: Utils.tileToPixel(y) + CONFIG.TILE_SIZE/2
                        });
                    } else if (MAZE[y][x] === 'o') {
                        this.entities.powerUps.push({
                            x: Utils.tileToPixel(x) + CONFIG.TILE_SIZE/2,
                            y: Utils.tileToPixel(y) + CONFIG.TILE_SIZE/2
                        });
                    }
                }
            }
        }

        bindControls() {
            const keyMap = {
                'arrowleft': Math.PI,
                'arrowright': 0,
                'arrowup': -Math.PI/2,
                'arrowdown': Math.PI/2,
                'a': Math.PI,
                'd': 0,
                'w': -Math.PI/2,
                's': Math.PI/2
            };

            canvas.addEventListener('keydown', (e) => {
                e.preventDefault();
                const key = e.key.toLowerCase();
                if (keyMap[key]) {
                    this.keysPressed.add(key);
                    this.entities.pacman.nextDirection = keyMap[key];
                    console.log('Key down:', key, 'Direction:', this.entities.pacman.nextDirection);
                }
            });

            canvas.addEventListener('keyup', (e) => {
                e.preventDefault();
                const key = e.key.toLowerCase();
                this.keysPressed.delete(key);
                if (this.keysPressed.size > 0) {
                    const lastKey = Array.from(this.keysPressed).pop();
                    this.entities.pacman.nextDirection = keyMap[lastKey];
                    console.log('Key up, new direction:', this.entities.pacman.nextDirection);
                }
            });

            canvas.addEventListener('click', () => {
                canvas.focus();
                console.log('Canvas focused');
            });
        }

        canMove(x, y, radius) {
            const gridX = Math.floor((x + radius) / CONFIG.TILE_SIZE);
            const gridY = Math.floor((y + radius) / CONFIG.TILE_SIZE);
            const gridX2 = Math.floor((x - radius) / CONFIG.TILE_SIZE);
            const gridY2 = Math.floor((y - radius) / CONFIG.TILE_SIZE);

            return (gridX >= 0 && gridX < 28 && gridY >= 0 && gridY < 31 &&
                    gridX2 >= 0 && gridX2 < 28 && gridY2 >= 0 && gridY2 < 31 &&
                    MAZE[gridY][gridX] !== '#' && MAZE[gridY2][gridX2] !== '#');
        }

        updateGhostAI(ghost, pacman, delta) {
            ghost.modeTimer -= delta;
            if (ghost.modeTimer <= 0) {
                ghost.mode = ghost.mode === 'scatter' ? 'chase' : 'scatter';
                ghost.modeTimer = 7000; // Switch every 7 seconds
            }

            const dx = pacman.x - ghost.x;
            const dy = pacman.y - ghost.y;
            let targetAngle;
            if (pacman.powerMode) {
                targetAngle = Utils.randomDirection(); // Flee
            } else if (ghost.mode === 'chase') {
                targetAngle = Math.atan2(dy, dx);
            } else {
                targetAngle = Utils.randomDirection(); // Scatter
            }

            const speed = ghost.speed * delta / 16;
            const newX = ghost.x + Math.cos(targetAngle) * speed;
            const newY = ghost.y + Math.sin(targetAngle) * speed;

            if (this.canMove(newX, newY, 7)) {
                ghost.x = newX;
                ghost.y = newY;
                ghost.direction = targetAngle;
            } else {
                ghost.direction = Utils.randomDirection();
            }
        }

        update(delta) {
            const pac = this.entities.pacman;
            const speed = pac.speed * delta / 16;

            // Pacman movement
            const newX = pac.x + Math.cos(pac.direction) * speed;
            const newY = pac.y + Math.sin(pac.direction) * speed;

            if (this.canMove(newX, newY, pac.radius)) {
                pac.x = newX;
                pac.y = newY;
            }

            if (this.canMove(pac.x + Math.cos(pac.nextDirection) * speed,
                           pac.y + Math.sin(pac.nextDirection) * speed, pac.radius)) {
                pac.direction = pac.nextDirection;
            }

            // Power mode
            if (pac.powerMode) {
                pac.powerTimer -= delta;
                if (pac.powerTimer <= 0) pac.powerMode = false;
            }

            // Collectibles
            this.entities.dots = this.entities.dots.filter(dot => {
                if (Utils.distance(pac.x, pac.y, dot.x, dot.y) < pac.radius) {
                    this.score += 10;
                    this.audio.play(CONFIG.AUDIO.DOT);
                    return false;
                }
                return true;
            });

            this.entities.powerUps = this.entities.powerUps.filter(power => {
                if (Utils.distance(pac.x, pac.y, power.x, power.y) < pac.radius) {
                    this.score += 50;
                    pac.powerMode = true;
                    pac.powerTimer = CONFIG.POWER_DURATION;
                    this.audio.play(CONFIG.AUDIO.POWER);
                    return false;
                }
                return true;
            });

            // Ghost movement
            this.entities.ghosts.forEach(ghost => {
                this.updateGhostAI(ghost, pac, delta);

                if (Utils.distance(ghost.x, ghost.y, pac.x, pac.y) < pac.radius + 7) {
                    if (pac.powerMode) {
                        ghost.x = Utils.tileToPixel(13.5);
                        ghost.y = Utils.tileToPixel(11);
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

            // Maze
            ctx.fillStyle = CONFIG.COLORS.WALL;
            for (let y = 0; y < MAZE.length; y++) {
                for (let x = 0; x < MAZE[y].length; x++) {
                    if (MAZE[y][x] === '#') {
                        ctx.fillRect(x * CONFIG.TILE_SIZE, y * CONFIG.TILE_SIZE,
                                   CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    }
                }
            }

            // Dots and Power-ups
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

            // Pacman
            ctx.fillStyle = pac.powerMode ? 
                `hsl(${timestamp % 360}, 100%, 50%)` : CONFIG.COLORS.PACMAN;
            pac.mouthAngle = Math.sin(timestamp * 0.01) * 0.5 + 0.5;
            ctx.beginPath();
            ctx.arc(pac.x, pac.y, pac.radius, 
                   pac.direction + pac.mouthAngle, 
                   pac.direction + 2 * Math.PI - pac.mouthAngle);
            ctx.lineTo(pac.x, pac.y);
            ctx.fill();

            // Ghosts
            this.entities.ghosts.forEach(ghost => {
                ctx.fillStyle = pac.powerMode ? CONFIG.COLORS.FRIGHTENED : ghost.color;
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

            // HUD
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
                if (!this.lastTime) this.lastTime = timestamp;
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
        if (!canvas.getContext) throw new Error('Canvas not supported');
        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
        }
        new PacmanGame();
    } catch (e) {
        console.error('Initialization failed:', e);
        document.body.textContent = 'Pacman failed to start. Check browser compatibility.';
    }
})();
