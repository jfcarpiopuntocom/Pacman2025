// pacman.js
(() => {
    // Constants Configuration
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
            PACMAN: 2,
            GHOST: 1.8
        }
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
    canvas.tabIndex = 0; // Ensure canvas can receive focus
    document.body.appendChild(canvas);
    canvas.focus(); // Set initial focus

    // Utility Functions
    const Utils = {
        distance(x1, y1, x2, y2) {
            return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        },
        clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        },
        randomDirection() {
            return [0, Math.PI/2, Math.PI, -Math.PI/2][Math.floor(Math.random() * 4)];
        }
    };

    // Audio Module
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
                osc.frequency.setValueAtTime(frequency, this.context.currentTime);
                osc.connect(this.context.destination);
                osc.start();
                osc.stop(this.context.currentTime + duration / 1000);
            } catch (e) {
                console.warn('Audio error:', e);
            }
        }
    }

    // Entity Management
    class EntityManager {
        constructor() {
            this.pacman = {
                x: 13.5 * CONFIG.TILE_SIZE,
                y: 23 * CONFIG.TILE_SIZE,
                speed: CONFIG.SPEEDS.PACMAN,
                direction: 0,
                nextDirection: null, // Changed to null for better control
                radius: 7,
                mouthAngle: 0,
                lives: 3,
                powerMode: false,
                powerTimer: 0
            };

            this.ghosts = CONFIG.COLORS.GHOSTS.map((color, i) => ({
                x: (13 + (i % 2)) * CONFIG.TILE_SIZE,
                y: (11 + Math.floor(i / 2)) * CONFIG.TILE_SIZE,
                color,
                speed: CONFIG.SPEEDS.GHOST,
                direction: Utils.randomDirection()
            }));

            this.dots = [];
            this.powerUps = [];
        }

        reset() {
            this.pacman.x = 13.5 * CONFIG.TILE_SIZE;
            this.pacman.y = 23 * CONFIG.TILE_SIZE;
            this.pacman.direction = 0;
            this.pacman.nextDirection = null;
            this.ghosts.forEach((g, i) => {
                g.x = (13 + (i % 2)) * CONFIG.TILE_SIZE;
                g.y = (11 + Math.floor(i / 2)) * CONFIG.TILE_SIZE;
                g.direction = Utils.randomDirection();
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
            this.loop(performance.now());
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
            const keyMap = {
                'ArrowLeft': Math.PI,
                'ArrowRight': 0,
                'ArrowUp': -Math.PI/2,
                'ArrowDown': Math.PI/2
            };

            // Use canvas for events to ensure focus
            canvas.addEventListener('keydown', (e) => {
                e.preventDefault(); // Prevent scrolling
                if (keyMap[e.key]) {
                    this.keysPressed.add(e.key);
                    this.entities.pacman.nextDirection = keyMap[e.key];
                }
            });

            canvas.addEventListener('keyup', (e) => {
                e.preventDefault();
                this.keysPressed.delete(e.key);
                // If last direction key is released, check for new direction
                if (this.keysPressed.size > 0) {
                    const lastKey = Array.from(this.keysPressed).pop();
                    this.entities.pacman.nextDirection = keyMap[lastKey] || null;
                } else {
                    this.entities.pacman.nextDirection = null;
                }
            });

            // Ensure canvas stays focusable
            canvas.addEventListener('click', () => canvas.focus());
        }

        canMove(x, y, radius = 0) {
            const gridX = Math.floor((x + radius) / CONFIG.TILE_SIZE);
            const gridY = Math.floor((y + radius) / CONFIG.TILE_SIZE);
            const gridX2 = Math.floor((x - radius) / CONFIG.TILE_SIZE);
            const gridY2 = Math.floor((y - radius) / CONFIG.TILE_SIZE);
            
            return (gridX >= 0 && gridX < 28 && gridY >= 0 && gridY < 31 &&
                    gridX2 >= 0 && gridX2 < 28 && gridY2 >= 0 && gridY2 < 31 &&
                    MAZE[gridY][gridX] !== '#' && MAZE[gridY2][gridX2] !== '#');
        }

        update(delta) {
            const pac = this.entities.pacman;
            const speed = pac.speed * delta / 16;

            // Pacman movement
            if (pac.nextDirection !== null && 
                this.canMove(pac.x + Math.cos(pac.nextDirection) * speed,
                           pac.y + Math.sin(pac.nextDirection) * speed, pac.radius)) {
                pac.direction = pac.nextDirection;
            }

            if (pac.direction !== null) {
                const newX = pac.x + Math.cos(pac.direction) * speed;
                const newY = pac.y + Math.sin(pac.direction) * speed;
                if (this.canMove(newX, newY, pac.radius)) {
                    pac.x = newX;
                    pac.y = newY;
                }
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
                    pac.powerTimer = 5000;
                    this.audio.play(CONFIG.AUDIO.POWER);
                    return false;
                }
                return true;
            });

            // Ghost movement
            this.entities.ghosts.forEach(ghost => {
                const dx = pac.x - ghost.x;
                const dy = pac.y - ghost.y;
                const targetAngle = pac.powerMode ? 
                    Utils.randomDirection() : Math.atan2(dy, dx);
                ghost.direction = targetAngle;
                const ghostX = ghost.x + Math.cos(ghost.direction) * ghost.speed * delta / 16;
                const ghostY = ghost.y + Math.sin(ghost.direction) * ghost.speed * delta / 16;
                
                if (this.canMove(ghostX, ghostY, 7)) {
                    ghost.x = ghostX;
                    ghost.y = ghostY;
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

        loop(timestamp) {
            if (!this.lastTime) this.lastTime = timestamp;
            const delta = Utils.clamp(timestamp - this.lastTime, 0, 100);
            this.lastTime = timestamp;

            try {
                if (this.state === 'playing') {
                    this.update(delta);
                }
                this.render(timestamp);
                requestAnimationFrame(t => this.loop(t));
            } catch (error) {
                console.error('Game loop error:', error);
                this.state = 'error';
                ctx.fillStyle = CONFIG.COLORS.TEXT;
                ctx.font = '20px Arial';
                ctx.fillText('Game Crashed! Refresh to retry.', 50, canvas.height/2);
            }
        }
    }

    // Bootstrap with compatibility check
    try {
        if (!canvas.getContext) throw new Error('Canvas not supported');
        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = (callback) => setTimeout(callback, 16);
        }
        new PacmanGame();
    } catch (e) {
        console.error('Initialization failed:', e);
        document.body.textContent = 'Pacman failed to start. Your browser may not be supported.';
    }
})();
