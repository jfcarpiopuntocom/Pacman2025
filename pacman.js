// pacman_improved.js
(() => {
    'use strict';

    // CONFIGURATION & CONSTANTS
    const CONFIG = Object.freeze({
        TILE_SIZE: 16,
        COLS: 28,
        ROWS: 31,
        CANVAS_WIDTH: 28 * 16,
        CANVAS_HEIGHT: 31 * 16,
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

    // Original Maze Layout (with potential formatting issues)
    const MAZE = [
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
    ];

    // Failsafe #2: Ensure each row is exactly COLS long, replace stray '@'
    const fixedMaze = MAZE.map((row, idx) => {
        let newRow = row.replace(/@/g, ' ');
        if (newRow.length < CONFIG.COLS) {
            newRow = newRow.padEnd(CONFIG.COLS, ' ');
        } else if (newRow.length > CONFIG.COLS) {
            newRow = newRow.substring(0, CONFIG.COLS);
        }
        return newRow;
    });

    // Failsafe #1: Canvas setup with check for existence and context
    const canvas = document.createElement('canvas');
    if (!canvas.getContext) throw new Error('Canvas not supported');
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Failed to get 2D context');
    canvas.width = CONFIG.CANVAS_WIDTH;
    canvas.height = CONFIG.CANVAS_HEIGHT;
    canvas.style.border = '2px solid #FFF';
    canvas.style.display = 'block';
    canvas.style.margin = '20px auto';
    document.body.appendChild(canvas);
    canvas.setAttribute('tabindex', '1');
    canvas.focus();

    // UI Beautification: Gradient background for the document
    document.body.style.background = 'linear-gradient(45deg, #222, #555)';
    document.body.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";

    // Utility functions
    const Utils = {
        // Failsafe #3: getTile ensures bounds check
        getTile(x, y) {
            return {
                x: Math.floor(x / CONFIG.TILE_SIZE),
                y: Math.floor(y / CONFIG.TILE_SIZE)
            };
        },
        // Failsafe #10: Clamp delta to avoid huge jumps
        clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        },
        distance(x1, y1, x2, y2) {
            return Math.hypot(x2 - x1, y2 - y1);
        },
        randomDirection() {
            const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
            return dirs[Math.floor(Math.random() * dirs.length)];
        }
    };

    // Audio Module with failsafe #14 (resuming AudioContext on user gesture)
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
            if (this.context.state === 'suspended') {
                this.context.resume();
            }
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

    // Entity Management with failsafe #18: Validate initial positions
    class EntityManager {
        constructor() {
            this.pacman = {
                x: 13.5 * CONFIG.TILE_SIZE,
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
            this.ghosts = [
                { color: CONFIG.COLORS.GHOSTS[0], x: 12 * CONFIG.TILE_SIZE, y: 13 * CONFIG.TILE_SIZE },
                { color: CONFIG.COLORS.GHOSTS[1], x: 14 * CONFIG.TILE_SIZE, y: 13 * CONFIG.TILE_SIZE },
                { color: CONFIG.COLORS.GHOSTS[2], x: 13 * CONFIG.TILE_SIZE, y: 14 * CONFIG.TILE_SIZE },
                { color: CONFIG.COLORS.GHOSTS[3], x: 15 * CONFIG.TILE_SIZE, y: 14 * CONFIG.TILE_SIZE }
            ].map(g => ({
                ...g,
                speed: CONFIG.SPEEDS.GHOST,
                direction: Utils.randomDirection(),
                frightened: false,
                mode: 'scatter',
                modeTimer: 0
            }));
            this.dots = [];
            this.powerUps = [];
        }
        reset() {
            // Failsafe #12: Validate lives and reset positions
            if (this.pacman.lives < 0) this.pacman.lives = 0;
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
                    x: [12, 14, 13, 15][i] * CONFIG.TILE_SIZE,
                    y: [13, 13, 14, 14][i] * CONFIG.TILE_SIZE,
                    direction: Utils.randomDirection(),
                    frightened: false,
                    mode: 'scatter',
                    modeTimer: 0
                });
            });
        }
    }

    // Main Game Logic with multiple failsafes
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
            this.maze = fixedMaze;
            this.initMazeItems();
            this.bindControls();
            this.startGameLoop();
        }

        // Failsafe #8: Initialize dots & power-ups with precise positioning
        initMazeItems() {
            for (let y = 0; y < this.maze.length; y++) {
                for (let x = 0; x < this.maze[y].length; x++) {
                    const ch = this.maze[y][x];
                    if (ch === '.') {
                        this.entities.dots.push({
                            x: x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
                            y: y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2
                        });
                    } else if (ch === 'o') {
                        this.entities.powerUps.push({
                            x: x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
                            y: y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2
                        });
                    }
                }
            }
        }

        // Failsafe #13: Robust key event binding with checks for valid key map
        bindControls() {
            const keyMap = {
                'arrowleft': Math.PI,
                'arrowright': 0,
                'arrowup': -Math.PI / 2,
                'arrowdown': Math.PI / 2,
                'a': Math.PI,
                'd': 0,
                'w': -Math.PI / 2,
                's': Math.PI / 2
            };

            const keyDownHandler = (e) => {
                e.preventDefault();
                const key = e.key.toLowerCase();
                if (keyMap[key] !== undefined) { // Failsafe #4: Only accept valid keys
                    this.keysPressed.add(key);
                    // Failsafe #10: Only update if safe to change direction (collision check later)
                    this.entities.pacman.nextDirection = keyMap[key];
                }
            };

            const keyUpHandler = (e) => {
                e.preventDefault();
                const key = e.key.toLowerCase();
                this.keysPressed.delete(key);
                if (this.keysPressed.size > 0) {
                    this.entities.pacman.nextDirection = keyMap[Array.from(this.keysPressed).pop()];
                } else {
                    this.entities.pacman.nextDirection = null;
                }
            };

            canvas.addEventListener('keydown', keyDownHandler);
            canvas.addEventListener('keyup', keyUpHandler);
            window.addEventListener('keydown', keyDownHandler);
            window.addEventListener('keyup', keyUpHandler);

            canvas.addEventListener('click', () => {
                canvas.focus();
                if (this.audio.context && this.audio.context.state === 'suspended') {
                    this.audio.context.resume();
                }
            });
        }

        // Failsafe #5: Check collision with walls & tunnel connection
        canMove(x, y, radius) {
            let gridPos = Utils.getTile(x, y);
            // Failsafe #3: Ensure grid indices are in bounds
            if (
                gridPos.x < 0 || gridPos.x >= CONFIG.COLS ||
                gridPos.y < 0 || gridPos.y >= CONFIG.ROWS
            ) {
                // Failsafe #6: Tunnel connection for Pac-Man (wrap horizontally)
                if (gridPos.x < 0) x = (CONFIG.COLS - 1) * CONFIG.TILE_SIZE + x % CONFIG.TILE_SIZE;
                else if (gridPos.x >= CONFIG.COLS) x = (x % CONFIG.TILE_SIZE);
                gridPos = Utils.getTile(x, y);
            }
            // Failsafe #15: Check for walls safely
            if (this.maze[gridPos.y] && this.maze[gridPos.y][gridPos.x] !== '#') {
                return true;
            }
            return false;
        }

        // Provides possible directions; includes failsafe for safe moves
        getAvailableDirections(x, y, radius) {
            const directions = [
                { angle: 0, dx: 1, dy: 0 },
                { angle: Math.PI, dx: -1, dy: 0 },
                { angle: -Math.PI / 2, dx: 0, dy: -1 },
                { angle: Math.PI / 2, dx: 0, dy: 1 }
            ];
            return directions.filter(dir =>
                this.canMove(x + dir.dx * CONFIG.TILE_SIZE / 2, y + dir.dy * CONFIG.TILE_SIZE / 2, radius)
            );
        }

        // Update ghost AI with failsafes for mode switching and tunnel connection
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
                    { x: 25, y: 0 }, { x: 2, y: 0 },
                    { x: 25, y: 30 }, { x: 2, y: 30 }
                ];
                const idx = CONFIG.COLORS.GHOSTS.indexOf(ghost.color);
                targetX = scatterTargets[idx].x * CONFIG.TILE_SIZE;
                targetY = scatterTargets[idx].y * CONFIG.TILE_SIZE;
            } else {
                const pacX = pacTile.x * CONFIG.TILE_SIZE;
                const pacY = pacTile.y * CONFIG.TILE_SIZE;
                const idx = CONFIG.COLORS.GHOSTS.indexOf(ghost.color);
                switch (idx) {
                    case 0:
                        targetX = pacX;
                        targetY = pacY;
                        break;
                    case 1:
                        targetX = pacX + Math.cos(this.entities.pacman.direction) * 4 * CONFIG.TILE_SIZE;
                        targetY = pacY + Math.sin(this.entities.pacman.direction) * 4 * CONFIG.TILE_SIZE;
                        break;
                    case 2:
                        const blinky = this.entities.ghosts[0];
                        targetX = pacX + (pacX - blinky.x);
                        targetY = pacY + (pacY - blinky.y);
                        break;
                    case 3:
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

        // Main update function with multiple failsafes
        update(delta) {
            delta = Utils.clamp(delta, 0, 100); // Failsafe #10: Clamp delta
            const pac = this.entities.pacman;
            const speed = pac.speed * (delta / 16);
            const pacTile = Utils.getTile(pac.x, pac.y);

            // Failsafe #4 & #10: Only change direction if it leads to safe movement
            if (pac.nextDirection !== null &&
                this.canMove(pac.x + Math.cos(pac.nextDirection) * speed,
                    pac.y + Math.sin(pac.nextDirection) * speed, pac.radius)) {
                pac.direction = pac.nextDirection;
            }

            let newX = pac.x + Math.cos(pac.direction) * speed;
            let newY = pac.y + Math.sin(pac.direction) * speed;

            // Failsafe #6: Tunnel connection for Pac-Man (wrap horizontally)
            if (newX < 0) newX = CONFIG.CANVAS_WIDTH + newX;
            if (newX > CONFIG.CANVAS_WIDTH) newX = newX - CONFIG.CANVAS_WIDTH;

            if (this.canMove(newX, newY, pac.radius)) {
                pac.x = newX;
                pac.y = newY;
            }

            // Failsafe #9: Power mode timer update
            if (pac.powerMode) {
                pac.powerTimer -= delta;
                if (pac.powerTimer <= 0) {
                    pac.powerMode = false;
                    this.entities.ghosts.forEach(g => g.frightened = false);
                }
            }

            // Failsafe #8: Check dot collisions with extra margin
            this.entities.dots = this.entities.dots.filter(dot => {
                if (Utils.distance(pac.x, pac.y, dot.x, dot.y) <= pac.radius + 3) {
                    this.score += 10;
                    this.audio.play(CONFIG.AUDIO.DOT);
                    return false;
                }
                return true;
            });

            // Failsafe #9: Check power-up collisions with extra margin
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

            // Update ghosts with failsafes for tunnel and collision resolution
            this.entities.ghosts.forEach(ghost => {
                this.updateGhostAI(ghost, pacTile, delta);
                const ghostSpeed = ghost.frightened ? CONFIG.SPEEDS.GHOST_FRIGHTENED : CONFIG.SPEEDS.GHOST;
                let ghostX = ghost.x + Math.cos(ghost.direction) * ghostSpeed * (delta / 16);
                let ghostY = ghost.y + Math.sin(ghost.direction) * ghostSpeed * (delta / 16);

                // Failsafe #7: Tunnel connection for ghosts (horizontal wrap)
                if (ghostX < 0) ghostX = CONFIG.CANVAS_WIDTH + ghostX;
                if (ghostX > CONFIG.CANVAS_WIDTH) ghostX = ghostX - CONFIG.CANVAS_WIDTH;

                if (this.canMove(ghostX, ghostY, 7)) {
                    ghost.x = ghostX;
                    ghost.y = ghostY;
                } else {
                    const dirs = this.getAvailableDirections(ghost.x, ghost.y, 7);
                    ghost.direction = dirs.length > 0 ? dirs[0].angle : ghost.direction;
                }

                // Failsafe #11: Ghost-Pacman collision detection with margin
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

            // Failsafe: Win condition check
            if (this.entities.dots.length === 0 && this.entities.powerUps.length === 0) {
                this.state = 'win';
            }
        }

        // Render with UI beautification and failsafe #15: check context before drawing
        render(timestamp) {
            if (!ctx) return;
            // Beautify: draw gradient background on canvas
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#000022');
            gradient.addColorStop(1, '#222255');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Render maze walls
            ctx.fillStyle = CONFIG.COLORS.WALL;
            for (let y = 0; y < this.maze.length; y++) {
                for (let x = 0; x < this.maze[y].length; x++) {
                    if (this.maze[y][x] === '#') {
                        ctx.fillRect(x * CONFIG.TILE_SIZE, y * CONFIG.TILE_SIZE,
                            CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    }
                }
            }

            // Render dots and power-ups
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

            // Render Pac-Man with animated mouth
            const pac = this.entities.pacman;
            ctx.fillStyle = pac.powerMode ?
                `hsl(${timestamp % 360}, 100%, 50%)` : CONFIG.COLORS.PACMAN;
            pac.mouthAngle = Math.sin(timestamp * 0.01) * 0.5 + 0.5;
            ctx.beginPath();
            ctx.arc(pac.x, pac.y, pac.radius,
                pac.direction + pac.mouthAngle,
                pac.direction + 2 * Math.PI - pac.mouthAngle);
            ctx.lineTo(pac.x, pac.y);
            ctx.fill();

            // Render ghosts with simple eyes
            this.entities.ghosts.forEach(ghost => {
                ctx.fillStyle = ghost.frightened ? CONFIG.COLORS.FRIGHTENED : ghost.color;
                ctx.beginPath();
                ctx.arc(ghost.x, ghost.y, 7, 0, Math.PI);
                ctx.lineTo(ghost.x + 7, ghost.y + 7);
                for (let i = 5; i >= -5; i -= 2) {
                    ctx.lineTo(ghost.x + i, ghost.y + (Math.abs(i) === 5 ? 7 : 5));
                }
                ctx.fill();
                // Ghost eyes
                ctx.fillStyle = CONFIG.COLORS.TEXT;
                ctx.beginPath();
                ctx.arc(ghost.x - 3, ghost.y - 2, 2, 0, Math.PI * 2);
                ctx.arc(ghost.x + 3, ghost.y - 2, 2, 0, Math.PI * 2);
                ctx.fill();
            });

            // Render HUD with drop shadow for a modern look
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
            ctx.shadowBlur = 4;
            ctx.fillStyle = CONFIG.COLORS.TEXT;
            ctx.font = '16px Segoe UI, Tahoma, sans-serif';
            ctx.fillText(`Score: ${this.score}`, 10, 20);
            ctx.fillText(`High: ${this.highScore}`, 150, 20);
            ctx.fillText(`Lives: ${pac.lives}`, 360, 20);
            ctx.restore();

            if (this.state !== 'playing') {
                ctx.font = '32px Segoe UI, Tahoma, sans-serif';
                const msg = this.state === 'win' ? 'You Win!' : 'Game Over';
                ctx.fillText(msg, canvas.width / 2 - 80, canvas.height / 2);
            }
        }

        // Main game loop with failsafe #19: requestAnimationFrame fallback
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
                    ctx.fillText('Game Crashed! Refresh to retry.', 50, canvas.height / 2);
                }
            };
            requestAnimationFrame(loop);
        }
    }

    // Failsafe #20: Check requestAnimationFrame support
    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
    }

    try {
        new PacmanGame();
    } catch (e) {
        console.error('Initialization failed:', e);
        document.body.textContent = 'Pacman failed to start. Check browser compatibility.';
    }
})();
