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
            GHOSTS: ['#FF4040', '#FF80FF', '#40FFFF', '#FF8000'], // Softer, cuter colors
            TEXT: '#FFFFFF',
            FRIGHTENED: '#8080FF',
            DEBUG: '#FF00FF'
        },
        SPEEDS: {
            PACMAN: 2.5,
            GHOST: 2
        },
        POWER_DURATION: 5000,
        MODE_SWITCH_INTERVAL: 7000,
        VERSION: 'v2.2',
        MIDI: {
            CHANNEL: 0,
            BACKGROUND_TEMPO: 120, // BPM for background music
            DOT_NOTE: 60, // Middle C
            POWER_NOTE: 64, // E
            DEATH_NOTE: 55, // G#
            MUSIC_NOTES: [60, 62, 64, 67, 69, 71, 74] // PAC-MAN theme notes (C, D, E, G, A, B, D)
        }
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
        document.body.textContent = 'PAC-MAN failed to start: Canvas not supported.';
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

    // MIDI Manager (Fallback if Web MIDI not supported)
    class MidiManager {
        constructor() {
            this.synthesizer = null;
            this.backgroundInterval = null;
            this.isPlaying = false;
            this.init();
        }

        async init() {
            try {
                if (!navigator.requestMIDIAccess) {
                    console.warn('Web MIDI API not supported. Using fallback audio.');
                    this.synthesizer = new FallbackSynthesizer();
                    return;
                }
                const midiAccess = await navigator.requestMIDIAccess();
                const outputs = midiAccess.outputs.values();
                for (let output of outputs) {
                    this.synthesizer = output;
                    break;
                }
                if (!this.synthesizer) throw new Error('No MIDI output found');
                console.log('MIDI initialized successfully');
            } catch (e) {
                console.warn('MIDI initialization failed:', e);
                this.synthesizer = new FallbackSynthesizer();
            }
        }

        playNote(note, duration = 200, velocity = 127) {
            if (!this.synthesizer) return;
            try {
                if (this.synthesizer.send) {
                    // MIDI note on
                    this.synthesizer.send([0x90 + CONFIG.MIDI.CHANNEL, note, velocity]); // Note on
                    setTimeout(() => this.synthesizer.send([0x80 + CONFIG.MIDI.CHANNEL, note, 0]), duration); // Note off
                } else {
                    // Fallback: Use Web Audio API
                    this.synthesizer.play(note, duration);
                }
            } catch (e) {
                console.warn('MIDI note playback failed:', e);
            }
        }

        playBackgroundMusic() {
            if (this.isPlaying || !this.synthesizer) return;
            this.isPlaying = true;
            let noteIndex = 0;
            const tempo = CONFIG.MIDI.BACKGROUND_TEMPO / 60 * 1000; // Convert BPM to ms per beat
            this.backgroundInterval = setInterval(() => {
                const note = CONFIG.MIDI.MUSIC_NOTES[noteIndex % CONFIG.MIDI.MUSIC_NOTES.length];
                this.playNote(note, tempo * 0.5, 64); // Softer volume for background
                noteIndex++;
            }, tempo * 0.5);
        }

        stopBackgroundMusic() {
            if (this.backgroundInterval) {
                clearInterval(this.backgroundInterval);
                this.isPlaying = false;
            }
        }
    }

    // Fallback Synthesizer (Web Audio API for non-MIDI browsers)
    class FallbackSynthesizer {
        constructor() {
            this.context = window.AudioContext || window.webkitAudioContext ?
                new (window.AudioContext || window.webkitAudioContext)() : null;
        }

        play(frequency, duration = 100) {
            if (!this.context) return;
            try {
                const osc = this.context.createOscillator();
                osc.type = 'sine'; // Softer, MIDI-like sound
                osc.frequency.value = frequency;
                osc.connect(this.context.destination);
                osc.start();
                osc.stop(this.context.currentTime + duration / 1000);
            } catch (e) {
                console.warn('Fallback audio failed:', e);
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

    // Pacman Module (Cuter Design)
    class Pacman {
        constructor() {
            this.x = Utils.tileToPixel(13.5);
            this.y = Utils.tileToPixel(23);
            this.speed = CONFIG.SPEEDS.PACMAN;
            this.direction = 0;
            this.nextDirection = 0;
            this.radius = 8; // Slightly larger for cuter look
            this.mouthAngle = 0;
            this.lives = 3;
            this.powerMode = false;
            this.powerTimer = 0;
            this.directionQueue = [];
        }

        move(delta, maze) {
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
                // Ensure proper tunnel alignment
                wrapped = maze.wrapAround(this.x, this.y);
                this.x = wrapped.x;
                this.y = wrapped.y;
            }

            // Process direction queue (classic PAC-MAN style)
            if (this.directionQueue.length > 0) {
                const nextDir = this.directionQueue[0];
                let nextX = this.x + Math.cos(nextDir) * speed;
                let nextY = this.y + Math.sin(nextDir) * speed;
                wrapped = maze.wrapAround(nextX, nextY);
                nextX = wrapped.x;
                nextY = wrapped.y;

                if (maze.canMove(nextX, nextY, this.radius)) {
                    this.direction = nextDir;
                    this.directionQueue.shift(); // Remove processed direction
                }
            }

            // Update nextDirection if valid
            if (this.nextDirection !== this.direction && this.directionQueue.length < 2) {
                this.directionQueue.push(this.nextDirection);
            }
        }

        render(ctx, timestamp) {
            ctx.fillStyle = this.powerMode ? `hsl(${timestamp % 360}, 100%, 50%)` : CONFIG.COLORS.PACMAN;
            this.mouthAngle = Math.sin(timestamp * 0.01) * 0.7 + 0.3; // Smaller mouth for cuter look
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, this.direction + this.mouthAngle, this.direction + 2 * Math.PI - this.mouthAngle);
            ctx.lineTo(this.x, this.y);
            ctx.fill();
            // Cute eyes (small black dot)
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            const eyeOffset = 3;
            ctx.arc(this.x + Math.cos(this.direction) * eyeOffset, this.y + Math.sin(this.direction) * eyeOffset, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        reset() {
            this.x = Utils.tileToPixel(13.5);
            this.y = Utils.tileToPixel(23);
            this.direction = 0;
            this.nextDirection = 0;
            this.directionQueue = [];
            this.powerMode = false;
            this.powerTimer = 0;
        }
    }

    // Ghost Module (Cuter Design)
    class Ghost {
        constructor(color, startX, startY) {
            this.x = startX;
            this.y = startY;
            this.color = color;
            this.speed = CONFIG.SPEEDS.GHOST;
            this.direction = Utils.randomDirection();
            this.mode = 'scatter';
            this.modeTimer = CONFIG.MODE_SWITCH_INTERVAL;
            this.wobble = 0; // For cute wobble animation
        }

        move(delta, pacman, maze) {
            this.modeTimer -= delta;
            if (this.modeTimer <= 0) {
                this.mode = this.mode === 'scatter' ? 'chase' : 'scatter';
                this.modeTimer = CONFIG.MODE_SWITCH_INTERVAL;
            }

            this.wobble += delta * 0.01; // Cute wobble effect

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
        }

        render(ctx, pacman) {
            ctx.fillStyle = pacman.powerMode ? CONFIG.COLORS.FRIGHTENED : this.color;
            ctx.beginPath();
            const wobble = Math.sin(this.wobble) * 2; // Cute wobble
            ctx.arc(this.x, this.y + wobble, 8, 0, Math.PI); // Slightly larger, rounder body
            ctx.lineTo(this.x + 8, this.y + 7 + wobble);
            for (let i = 6; i >= -6; i -= 2) {
                ctx.lineTo(this.x + i, this.y + (Math.abs(i) === 6 ? 7 : 5) + wobble);
            }
            ctx.fill();
            // Cute eyes (larger, sparkly)
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(this.x - 3, this.y - 2 + wobble, 3, 0, Math.PI * 2);
            ctx.arc(this.x + 3, this.y - 2 + wobble, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(this.x - 3, this.y - 2 + wobble, 1, 0, Math.PI * 2);
            ctx.arc(this.x + 3, this.y - 2 + wobble, 1, 0, Math.PI * 2);
            ctx.fill();
        }

        reset() {
            this.x = Utils.tileToPixel(13.5);
            this.y = Utils.tileToPixel(11);
            this.direction = Utils.randomDirection();
            this.mode = 'scatter';
            this.modeTimer = CONFIG.MODE_SWITCH_INTERVAL;
            this.wobble = 0;
        }
    }

    // Game Module
    class Game {
        constructor() {
            this.maze = new Maze();
            this.pacman = new Pacman();
            this.ghosts = CONFIG.COLORS.GHOSTS.map((color, i) => new Ghost(color, Utils.tileToPixel(13 + (i % 2)), Utils.tileToPixel(11 + Math.floor(i / 2))));
            this.audio = new AudioManager();
            this.midi = new MidiManager();
            this.score = 0;
            this.highScore = this.getHighScore() || 0;
            this.state = 'playing';
            this.lastTime = 0;
            this.keysPressed = new Set();
            this.bindControls();
            this.startBackgroundMusic();
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
                e.preventDefault();
                const key = e.key.toLowerCase();
                if (keyMap[key]) {
                    this.keysPressed.add(key);
                    this.pacman.directionQueue = []; // Clear queue for fresh input
                    this.pacman.nextDirection = keyMap[key];
                    console.log(`Key pressed: ${key}, Direction: ${this.pacman.nextDirection}`);
                }
            });

            canvas.addEventListener('keyup', (e) => {
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
            });

            canvas.addEventListener('click', () => {
                canvas.focus();
                console.log('Canvas focused');
            });

            window.addEventListener('blur', () => {
                canvas.focus();
                console.log('Window blurred, refocusing canvas');
            });
        }

        startBackgroundMusic() {
            try {
                this.midi.playBackgroundMusic();
            } catch (e) {
                console.warn('Background music failed to start:', e);
            }
        }

        stopBackgroundMusic() {
            try {
                this.midi.stopBackgroundMusic();
            } catch (e) {
                console.warn('Failed to stop background music:', e);
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
                        this.midi.playNote(CONFIG.MIDI.DOT_NOTE);
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
                        this.midi.playNote(CONFIG.MIDI.POWER_NOTE);
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
                            this.midi.playNote(CONFIG.MIDI.POWER_NOTE, 300); // Extended sound for eating ghost
                        } else {
                            this.pacman.lives--;
                            this.midi.playNote(CONFIG.MIDI.DEATH_NOTE, 300);
                            this.pacman.reset();
                            if (this.pacman.lives <= 0) {
                                this.state = 'gameover';
                                if (this.score > this.highScore) {
                                    this.setHighScore(this.score);
                                    this.highScore = this.score;
                                }
                                this.stopBackgroundMusic();
                            }
                        }
                    }
                });

                if (this.maze.dots.length === 0 && this.maze.powerUps.length === 0) {
                    this.state = 'win';
                    this.stopBackgroundMusic();
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

                // HUD and UI
                ctx.fillStyle = CONFIG.COLORS.TEXT;
                ctx.font = '16px Arial';
                ctx.fillText(`Score: ${this.score}`, 10, 20);
                ctx.fillText(`High: ${this.highScore}`, 150, 20);
                ctx.fillText(`Lives: ${this.pacman.lives}`, 360, 20);
                ctx.fillText(`PAC-MAN ${CONFIG.VERSION}`, CONFIG.CANVAS_WIDTH - 120, 20);

                // Legend (bottom-left)
                ctx.font = '12px Arial';
                ctx.fillText('Legend:', 10, CONFIG.CANVAS_HEIGHT - 80);
                ctx.fillText('• Dots: +10 points', 10, CONFIG.CANVAS_HEIGHT - 60);
                ctx.fillText('• Power Pellets: +50 points, Eat Ghosts', 10, CONFIG.CANVAS_HEIGHT - 40);
                ctx.fillText('• Controls: Arrows or WASD', 10, CONFIG.CANVAS_HEIGHT - 20);

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
            try {
                requestAnimationFrame(loop);
            } catch (e) {
                console.error('Animation frame request failed:', e);
                this.state = 'error';
                ctx.fillStyle = CONFIG.COLORS.TEXT;
                ctx.font = '20px Arial';
                ctx.fillText('Animation not supported. Refresh to retry.', 50, canvas.height / 2);
            }
        }
    }

    // Bootstrap
    try {
        if (!canvas || !ctx) throw new Error('Canvas initialization failed');
        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = (callback) => setTimeout(callback, 16);
            console.warn('requestAnimationFrame not supported, using setTimeout fallback');
        }
        new Game();
    } catch (e) {
        console.error('PAC-MAN initialization failed:', e);
        document.body.textContent = 'PAC-MAN failed to start. Check browser compatibility or console for details.';
    }
})();
