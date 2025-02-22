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
            FRIGHTENED: '#000080',
            DEBUG: '#FF00FF'
        },
        SPEEDS: {
            PACMAN: 2.5,
            GHOST: 2
        },
        POWER_DURATION: 5000,
        MODE_SWITCH_INTERVAL: 7000,
        VERSION: 'v1.9'
    });

    const MAZE = Object.freeze([
        "############################",
        "#............##............#",
        "#.####.#####.##.#####.####.#",
        "#o##.##.#####.##.#####.##o##",
        "#.##.##.#####.##.#####.##.##",
        "#.............##.............#",
        "#.####.#####.##.#####.####.##",
        "#.####.#####.##.#####.####.##",
        "#......##....##....##......##",
        "######.#####.##.#####.######",
        "     #.#####.##.#####.#     ",
        "     #.##          ##.#     ",
        "     #.## ###==### ##.#     ",
        "######.## #      # ##.######",
        "      .   #      #   .      ",
        "######.## #      # ##.######",
        "     #.## ########## ##.#     ",
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
    let canvas = null;
    let ctx = null;
    try {
        canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Canvas 2D context not supported');
        canvas.width = CONFIG.CANVAS_WIDTH;
        canvas.height = CONFIG.CANVAS_HEIGHT;
        canvas.tabIndex = 0;
        document.body.appendChild(canvas);
        canvas.focus();
    } catch (e) {
        console.error('PAC-MAN Canvas initialization failed:', e);
        displayError('Canvas not supported', 'Ensure you’re using a modern browser (Firefox, Brave, or Chrome). <a href="https://www.mozilla.org/firefox/" target="_blank">Get Firefox</a> or <a href="https://brave.com/" target="_blank">Get Brave</a>.');
        return;
    }

    // Utilities
    const Utils = {
        distance(x1, y1, x2, y2) {
            return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        },
        clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        },
        randomDirection() {
            return [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(Math.random() * 4)];
        },
        tileToPixel(tile) {
            return tile * CONFIG.TILE_SIZE;
        },
        pixelToTile(pixel) {
            return Math.floor(pixel / CONFIG.TILE_SIZE);
        }
    };

    // Error Display Function
    function displayError(message, details = '') {
        document.body.innerHTML = `
            <div style="color: ${CONFIG.COLORS.TEXT}; background: ${CONFIG.COLORS.BACKGROUND}; padding: 20px; font-family: Arial; text-align: center; max-width: 600px; margin: 0 auto;">
                <h1>PAC-MAN Error</h1>
                <p>${message}</p>
                <p>${details}</p>
                <p>Check the console (F12) for more details or try refreshing the page.</p>
            </div>
        `;
    }

    // Audio Manager
    class AudioManager {
        constructor() {
            this.context = null;
            try {
                this.context = window.AudioContext || window.webkitAudioContext ?
                    new (window.AudioContext || window.webkitAudioContext)() : null;
                if (!this.context) throw new Error('Web Audio API not supported');
                console.log('AudioManager initialized successfully');
            } catch (e) {
                console.warn('Web Audio API initialization failed:', e);
                this.context = null; // Disable audio if unsupported
            }
        }

        play(frequency, duration = 100) {
            if (!this.context) return;
            try {
                const osc = this.context.createOscillator();
                osc.type = 'square';
                osc.frequency.value = frequency;
                osc.connect(this.context.destination);
                osc.start();
                osc.stop(this.context.currentTime + duration / 1000);
            } catch (e) {
                console.warn('Audio playback failed:', e);
            }
        }
    }

    // Maze Module
    class Maze {
        constructor() {
            this.width = 28;
            this.height = 31;
            this.dots = [];
            this.powerUps = [];
            this.initItems();
        }

        initItems() {
            for (let y = 0; y < MAZE.length; y++) {
                for (let x = 0; x < MAZE[y].length; x++) {
                    if (MAZE[y][x] === '.') {
                        this.dots.push({ x: Utils.tileToPixel(x) + CONFIG.TILE_SIZE / 2, y: Utils.tileToPixel(y) + CONFIG.TILE_SIZE / 2 });
                    } else if (MAZE[y][x] === 'o') {
                        this.powerUps.push({ x: Utils.tileToPixel(x) + CONFIG.TILE_SIZE / 2, y: Utils.tileToPixel(y) + CONFIG.TILE_SIZE / 2 });
                    }
                }
            }
        }

        render(ctx) {
            try {
                ctx.fillStyle = CONFIG.COLORS.WALL;
                for (let y = 0; y < MAZE.length; y++) {
                    for (let x = 0; x < MAZE[y].length; x++) {
                        if (MAZE[y][x] === '#') {
                            ctx.fillRect(x * CONFIG.TILE_SIZE, y * CONFIG.TILE_SIZE, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                        }
                    }
                }
                ctx.fillStyle = CONFIG.COLORS.TEXT;
                this.dots.forEach(dot => {
                    ctx.beginPath();
                    ctx.arc(dot.x, dot.y, 2, 0, Math.PI * 2);
                    ctx.fill();
                });
                this.powerUps.forEach(power => {
                    ctx.beginPath();
                    ctx.arc(power.x, power.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                });
            } catch (e) {
                console.error('Maze render failed:', e);
            }
        }

        canMove(x, y, radius) {
            let gridX = Utils.pixelToTile(x);
            let gridY = Utils.pixelToTile(y);
            if (gridX < 0) gridX = this.width - 1;
            if (gridX >= this.width) gridX = 0;
            if (gridY < 0 || gridY >= this.height) return false;
            return MAZE[gridY][gridX] !== '#';
        }

        wrapAround(x, y) {
            if (x < 0) x = CONFIG.CANVAS_WIDTH - CONFIG.TILE_SIZE;
            if (x >= CONFIG.CANVAS_WIDTH) x = 0;
            if (y < 0 || y >= CONFIG.CANVAS_HEIGHT) y = Math.max(0, Math.min(y, CONFIG.CANVAS_HEIGHT - CONFIG.TILE_SIZE));
            return { x, y };
        }
    }

    // Pacman Module
    class Pacman {
        constructor() {
            this.x = Utils.tileToPixel(13.5);
            this.y = Utils.tileToPixel(23);
            this.speed = CONFIG.SPEEDS.PACMAN;
            this.direction = 0;
            this.nextDirection = 0;
            this.radius = 7;
            this.mouthAngle = 0;
            this.lives = 3;
            this.powerMode = false;
            this.powerTimer = 0;
            this.directionQueue = []; // Queue for direction changes, learned from v2.x
        }

        move(delta, maze) {
            try {
                const speed = this.speed * delta / 16;
                let newX = this.x + Math.cos(this.direction) * speed;
                let newY = this.y + Math.sin(this.direction) * speed;
                let wrapped = maze.wrapAround(newX, newY);
                newX = wrapped.x;
                newY = wrapped.y;

                if (maze.canMove(newX, newY, this.radius)) {
                    this.x = newX;
                    this.y = newY;
                } else {
                    // Align to nearest valid position if stuck
                    const tileX = Utils.pixelToTile(this.x);
                    const tileY = Utils.pixelToTile(this.y);
                    const centerX = Utils.tileToPixel(tileX) + CONFIG.TILE_SIZE / 2;
                    const centerY = Utils.tileToPixel(tileY) + CONFIG.TILE_SIZE / 2;
                    if (!maze.canMove(this.x, this.y, this.radius)) {
                        this.x = centerX;
                        this.y = centerY;
                    }
                    wrapped = maze.wrapAround(this.x, this.y);
                    this.x = wrapped.x;
                    this.y = wrapped.y;
                }

                // Process direction queue (learned from v2.x for smooth control)
                if (this.directionQueue.length > 0) {
                    const nextDir = this.directionQueue[0];
                    let nextX = this.x + Math.cos(nextDir) * speed;
                    let nextY = this.y + Math.sin(nextDir) * speed;
                    wrapped = maze.wrapAround(nextX, nextY);
                    nextX = wrapped.x;
                    nextY = wrapped.y;

                    if (maze.canMove(nextX, nextY, this.radius)) {
                        this.direction = nextDir;
                        this.directionQueue.shift();
                    }
                }

                // Update nextDirection if valid
                if (this.nextDirection !== this.direction && this.directionQueue.length < 2) {
                    this.directionQueue.push(this.nextDirection);
                }
            } catch (e) {
                console.error('Pacman move failed:', e);
            }
        }

        render(ctx, timestamp) {
            try {
                ctx.fillStyle = this.powerMode ? `hsl(${timestamp % 360}, 100%, 50%)` : CONFIG.COLORS.PACMAN;
                this.mouthAngle = Math.sin(timestamp * 0.01) * 0.5 + 0.5;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, this.direction + this.mouthAngle, this.direction + 2 * Math.PI - this.mouthAngle);
                ctx.lineTo(this.x, this.y);
                ctx.fill();
            } catch (e) {
                console.error('Pacman render failed:', e);
            }
        }

        reset() {
            try {
                this.x = Utils.tileToPixel(13.5);
                this.y = Utils.tileToPixel(23);
                this.direction = 0;
                this.nextDirection = 0;
                this.directionQueue = [];
                this.powerMode = false;
                this.powerTimer = 0;
            } catch (e) {
                console.error('Pacman reset failed:', e);
            }
        }
    }

    // Ghost Module
    class Ghost {
        constructor(color, startX, startY) {
            this.x = startX;
            this.y = startY;
            this.color = color;
            this.speed = CONFIG.SPEEDS.GHOST;
            this.direction = Utils.randomDirection();
            this.mode = 'scatter';
            this.modeTimer = CONFIG.MODE_SWITCH_INTERVAL;
        }

        move(delta, pacman, maze) {
            try {
                this.modeTimer -= delta;
                if (this.modeTimer <= 0) {
                    this.mode = this.mode === 'scatter' ? 'chase' : 'scatter';
                    this.modeTimer = CONFIG.MODE_SWITCH_INTERVAL;
                }

                let targetAngle;
                if (pacman.powerMode) {
                    targetAngle = Utils.randomDirection(); // Flee
                } else if (this.mode === 'chase') {
                    const dx = pacman.x - this.x;
                    const dy = pacman.y - this.y;
                    targetAngle = Math.atan2(dy, dx);
                } else {
                    targetAngle = Utils.randomDirection(); // Scatter
                }

                const speed = this.speed * delta / 16;
                let newX = this.x + Math.cos(targetAngle) * speed;
                let newY = this.y + Math.sin(targetAngle) * speed;
                let wrapped = maze.wrapAround(newX, newY);
                newX = wrapped.x;
                newY = wrapped.y;

                if (maze.canMove(newX, newY, 7)) {
                    this.x = newX;
                    this.y = newY;
                    this.direction = targetAngle;
                } else {
                    for (let attempt = 0; attempt < 4; attempt++) {
                        this.direction = Utils.randomDirection();
                        newX = this.x + Math.cos(this.direction) * speed;
                        newY = this.y + Math.sin(this.direction) * speed;
                        wrapped = maze.wrapAround(newX, newY);
                        newX = wrapped.x;
                        newY = wrapped.y;
                        if (maze.canMove(newX, newY, 7)) {
                            this.x = newX;
                            this.y = newY;
                            break;
                        }
                    }
                }
            } catch (e) {
                console.error('Ghost move failed:', e);
            }
        }

        render(ctx, pacman) {
            try {
                ctx.fillStyle = pacman.powerMode ? CONFIG.COLORS.FRIGHTENED : this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, 7, 0, Math.PI);
                ctx.lineTo(this.x + 7, this.y + 7);
                for (let i = 5; i >= -5; i -= 2) {
                    ctx.lineTo(this.x + i, this.y + (Math.abs(i) === 5 ? 7 : 5));
                }
                ctx.fill();
                ctx.fillStyle = CONFIG.COLORS.TEXT;
                ctx.beginPath();
                ctx.arc(this.x - 3, this.y - 2, 2, 0, Math.PI * 2);
                ctx.arc(this.x + 3, this.y - 2, 2, 0, Math.PI * 2);
                ctx.fill();
            } catch (e) {
                console.error('Ghost render failed:', e);
            }
        }

        reset() {
            try {
                this.x = Utils.tileToPixel(13.5);
                this.y = Utils.tileToPixel(11);
                this.direction = Utils.randomDirection();
                this.mode = 'scatter';
                this.modeTimer = CONFIG.MODE_SWITCH_INTERVAL;
            } catch (e) {
                console.error('Ghost reset failed:', e);
            }
        }
    }

    // Game Module
    class Game {
        constructor() {
            this.maze = new Maze();
            this.pacman = new Pacman();
            this.ghosts = CONFIG.COLORS.GHOSTS.map((color, i) => new Ghost(color, Utils.tileToPixel(13 + (i % 2)), Utils.tileToPixel(11 + Math.floor(i / 2))));
            this.audio = new AudioManager();
            this.score = 0;
            this.highScore = this.getHighScore() || 0;
            this.state = 'playing';
            this.lastTime = 0;
            this.keysPressed = new Set();
            this.bindControls();
            this.startGameLoop();
        }

        getHighScore() {
            try {
                return parseInt(localStorage.getItem('pacmanHigh') || '0');
            } catch (e) {
                console.warn('LocalStorage access failed:', e);
                return 0;
            }
        }

        setHighScore(score) {
            try {
                localStorage.setItem('pacmanHigh', score);
            } catch (e) {
                console.warn('Failed to save high score:', e);
            }
        }

        bindControls() {
            try {
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

                canvas.addEventListener('keydown', (e) => {
                    try {
                        e.preventDefault();
                        const key = e.key.toLowerCase();
                        if (keyMap[key]) {
                            this.keysPressed.add(key);
                            this.pacman.nextDirection = keyMap[key];
                            console.log(`Key pressed: ${key}, Direction: ${this.pacman.nextDirection}`);
                        }
                    } catch (e) {
                        console.error('Keydown error:', e);
                        this.pacman.nextDirection = this.pacman.direction; // Fallback to maintain movement
                    }
                });

                canvas.addEventListener('keyup', (e) => {
                    try {
                        e.preventDefault();
                        const key = e.key.toLowerCase();
                        this.keysPressed.delete(key);
                        if (this.keysPressed.size > 0) {
                            const lastKey = Array.from(this.keysPressed).pop();
                            this.pacman.nextDirection = keyMap[lastKey];
                            console.log(`Key released, new direction: ${this.pacman.nextDirection}`);
                        } else {
                            this.pacman.nextDirection = this.pacman.direction; // Maintain current direction
                        }
                    } catch (e) {
                        console.error('Keyup error:', e);
                    }
                });

                canvas.addEventListener('click', () => {
                    try {
                        canvas.focus();
                        console.log('Canvas focused');
                    } catch (e) {
                        console.error('Click handler error:', e);
                    }
                });

                window.addEventListener('blur', () => {
                    try {
                        canvas.focus();
                        console.log('Window blurred, refocusing canvas');
                    } catch (e) {
                        console.error('Blur handler error:', e);
                    }
                });
            } catch (e) {
                console.error('Controls binding failed:', e);
                this.state = 'error';
            }
        }

        update(delta) {
            try {
                this.pacman.move(delta, this.maze);
                this.ghosts.forEach(ghost => ghost.move(delta, this.pacman, this.maze));

                // Collect dots
                this.maze.dots = this.maze.dots.filter(dot => {
                    if (Utils.distance(this.pacman.x, this.pacman.y, dot.x, dot.y) < this.pacman.radius) {
                        this.score += 10;
                        if (this.audio.context) {
                            this.audio.play(220); // Dot sound
                        }
                        return false;
                    }
                    return true;
                });

                // Collect power-ups
                this.maze.powerUps = this.maze.powerUps.filter(power => {
                    if (Utils.distance(this.pacman.x, this.pacman.y, power.x, power.y) < this.pacman.radius) {
                        this.score += 50;
                        this.pacman.powerMode = true;
                        this.pacman.powerTimer = CONFIG.POWER_DURATION;
                        if (this.audio.context) {
                            this.audio.play(440); // Power pellet sound
                        }
                        return false;
                    }
                    return true;
                });

                // Power mode timer
                if (this.pacman.powerMode) {
                    this.pacman.powerTimer -= delta;
                    if (this.pacman.powerTimer <= 0) this.pacman.powerMode = false;
                }

                // Ghost collision
                this.ghosts.forEach(ghost => {
                    if (Utils.distance(ghost.x, ghost.y, this.pacman.x, this.pacman.y) < this.pacman.radius + 7) {
                        if (this.pacman.powerMode) {
                            ghost.reset();
                            this.score += 200;
                        } else {
                            this.pacman.lives--;
                            if (this.audio.context) {
                                this.audio.play(110, 300); // Death sound
                            }
                            this.pacman.reset();
                            if (this.pacman.lives <= 0) {
                                this.state = 'gameover';
                                if (this.score > this.highScore) {
                                    this.setHighScore(this.score);
                                    this.highScore = this.score;
                                }
                            }
                        }
                    }
                });

                if (this.maze.dots.length === 0 && this.maze.powerUps.length === 0) {
                    this.state = 'win';
                }
            } catch (e) {
                console.error('Update error:', e);
                this.state = 'error';
            }
        }

        render(timestamp) {
            try {
                ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                this.maze.render(ctx);
                this.pacman.render(ctx, timestamp);
                this.ghosts.forEach(ghost => ghost.render(ctx, this.pacman));

                // HUD
                ctx.fillStyle = CONFIG.COLORS.TEXT;
                ctx.font = '16px Arial';
                ctx.fillText(`Score: ${this.score}`, 10, 20);
                ctx.fillText(`High: ${this.highScore}`, 150, 20);
                ctx.fillText(`Lives: ${this.pacman.lives}`, 360, 20);
                ctx.fillText(`PAC-MAN ${CONFIG.VERSION}`, CONFIG.CANVAS_WIDTH - 120, 20);

                if (this.state !== 'playing') {
                    ctx.font = '32px Arial';
                    ctx.fillText(this.state === 'win' ? 'You Win!' : 'Game Over', canvas.width / 2 - 80, canvas.height / 2);
                }

                // Debug: Show direction (remove in production)
                if (process.env.NODE_ENV !== 'production') {
                    ctx.fillStyle = CONFIG.COLORS.DEBUG;
                    ctx.font = '12px Arial';
                    ctx.fillText(`Dir: ${this.pacman.direction.toFixed(2)}`, this.pacman.x - 20, this.pacman.y - 10);
                }
            } catch (e) {
                console.error('Render error:', e);
                this.state = 'error';
                ctx.fillStyle = CONFIG.COLORS.TEXT;
                ctx.font = '20px Arial';
                ctx.fillText('Rendering failed. Refresh to retry.', 50, canvas.height / 2);
            }
        }

        startGameLoop() {
            try {
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
                        ctx.fillText('Game Crashed! Refresh to retry.', 50, canvas.height / 2);
                    }
                };
                if (!window.requestAnimationFrame) {
                    console.warn('requestAnimationFrame not supported, using setTimeout fallback');
                    window.requestAnimationFrame = (callback) => setTimeout(callback, 16);
                }
                requestAnimationFrame(loop);
            } catch (e) {
                console.error('Game loop initialization failed:', e);
                this.state = 'error';
                ctx.fillStyle = CONFIG.COLORS.TEXT;
                ctx.font = '20px Arial';
                ctx.fillText('Animation not supported. Refresh to retry.', 50, canvas.height / 2);
            }
        }
    }

    // Bootstrap
    try {
        console.log('Starting PAC-MAN v1.9 initialization...');
        if (!canvas || !ctx) throw new Error('Canvas initialization failed');
        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = (callback) => setTimeout(callback, 16);
            console.warn('requestAnimationFrame not supported, using setTimeout fallback');
        }
        // Audio failsafe
        let audioSupported = !!(window.AudioContext || window.webkitAudioContext);
        if (!audioSupported) {
            console.warn('Web Audio API not supported. Audio will be disabled.');
        }
        // Keyboard event failsafe
        try {
            document.createEvent('KeyboardEvent'); // Test keyboard event support
        } catch (e) {
            console.warn('Keyboard events may not be supported. Controls might fail.');
        }
        // Local storage failsafe
        try {
            localStorage.setItem('test', '1');
            localStorage.removeItem('test');
        } catch (e) {
            console.warn('LocalStorage not supported. High scores will not persist.');
        }
        new Game();
        console.log('PAC-MAN v1.9 initialized successfully');
    } catch (e) {
        console.error('PAC-MAN initialization failed:', e);
        displayError(`PAC-MAN failed to start: ${e.message}`, `
            <p>Troubleshooting:</p>
            <ul style="list-style: none; padding: 0;">
                <li>1. Use a modern browser (Firefox, Brave, or Chrome).</li>
                <li>2. Ensure Web Audio API is enabled (required for sounds).</li>
                <li>3. Serve files via a local server (not file:// protocol).</li>
                <li>4. Check console (F12) for detailed errors.</li>
                <li>5. Ensure no browser extensions are blocking JavaScript.</li>
            </ul>
            <p><a href="https://www.mozilla.org/firefox/" target="_blank">Get Firefox</a> or <a href="https://brave.com/" target="_blank">Get Brave</a>.</p>
        `);
    }
})();
