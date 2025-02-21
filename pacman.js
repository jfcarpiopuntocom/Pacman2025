// pacman.js
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = 448;  // 28 * 16
canvas.height = 496; // 31 * 16
document.body.appendChild(canvas);

const TILE_SIZE = 16;
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
];

class Game {
    constructor() {
        this.pacman = {
            x: 13.5 * TILE_SIZE,
            y: 23 * TILE_SIZE,
            speed: 2,
            direction: 0,
            nextDirection: 0,
            radius: 7,
            mouthAngle: 0,
            lives: 3
        };
        
        this.ghosts = [
            {x: 13 * TILE_SIZE, y: 11 * TILE_SIZE, color: '#FF0000', speed: 1.8}, // Blinky
            {x: 14 * TILE_SIZE, y: 11 * TILE_SIZE, color: '#FFB8FF', speed: 1.8}, // Pinky
            {x: 13 * TILE_SIZE, y: 14 * TILE_SIZE, color: '#00FFFF', speed: 1.8}, // Inky
            {x: 14 * TILE_SIZE, y: 14 * TILE_SIZE, color: '#FFB852', speed: 1.8}  // Clyde
        ];
        
        this.dots = [];
        this.score = 0;
        this.gameState = 'playing';
        this.setupInput();
        this.initDots();
        this.lastTime = 0;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
    }

    initDots() {
        for (let y = 0; y < MAZE.length; y++) {
            for (let x = 0; x < MAZE[y].length; x++) {
                if (MAZE[y][x] === '.') {
                    this.dots.push({x: x * TILE_SIZE + 8, y: y * TILE_SIZE + 8, big: false});
                } else if (MAZE[y][x] === 'o') {
                    this.dots.push({x: x * TILE_SIZE + 8, y: y * TILE_SIZE + 8, big: true});
                }
            }
        }
    }

    setupInput() {
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowLeft': this.pacman.nextDirection = Math.PI; break;
                case 'ArrowRight': this.pacman.nextDirection = 0; break;
                case 'ArrowUp': this.pacman.nextDirection = -Math.PI/2; break;
                case 'ArrowDown': this.pacman.nextDirection = Math.PI/2; break;
            }
        });
    }

    playSound(frequency, duration) {
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'square';
        oscillator.frequency.value = frequency;
        oscillator.connect(this.audioContext.destination);
        oscillator.start();
        setTimeout(() => oscillator.stop(), duration);
    }

    gameLoop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const delta = timestamp - this.lastTime;
        this.lastTime = timestamp;

        if (this.gameState === 'playing') {
            this.update(delta);
            this.render();
        }
        requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
    }

    update(delta) {
        // Update Pacman
        const speed = this.pacman.speed * delta / 16;
        const newX = this.pacman.x + Math.cos(this.pacman.direction) * speed;
        const newY = this.pacman.y + Math.sin(this.pacman.direction) * speed;

        if (this.canMove(newX, newY)) {
            this.pacman.x = newX;
            this.pacman.y = newY;
        }

        if (this.canMove(this.pacman.x + Math.cos(this.pacman.nextDirection) * speed,
                        this.pacman.y + Math.sin(this.pacman.nextDirection) * speed)) {
            this.pacman.direction = this.pacman.nextDirection;
        }

        // Update mouth animation
        this.pacman.mouthAngle = Math.sin(timestamp * 0.01) * 0.5 + 0.5;

        // Check dot collision
        this.dots = this.dots.filter(dot => {
            const dx = dot.x - this.pacman.x;
            const dy = dot.y - this.pacman.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < this.pacman.radius) {
                this.score += dot.big ? 50 : 10;
                this.playSound(dot.big ? 440 : 220, 100);
                return false;
            }
            return true;
        });

        // Update ghosts
        this.ghosts.forEach(ghost => {
            const dx = this.pacman.x - ghost.x;
            const dy = this.pacman.y - ghost.y;
            const angle = Math.atan2(dy, dx);
            ghost.x += Math.cos(angle) * ghost.speed * delta / 16;
            ghost.y += Math.sin(angle) * ghost.speed * delta / 16;

            // Ghost collision
            if (Math.hypot(ghost.x - this.pacman.x, ghost.y - this.pacman.y) < this.pacman.radius + 5) {
                this.pacman.lives--;
                this.resetPositions();
                if (this.pacman.lives <= 0) this.gameState = 'gameover';
            }
        });

        if (this.dots.length === 0) this.gameState = 'win';
    }

    canMove(x, y) {
        const gridX = Math.floor(x / TILE_SIZE);
        const gridY = Math.floor(y / TILE_SIZE);
        if (gridX < 0 || gridX >= 28 || gridY < 0 || gridY >= 31) return false;
        return MAZE[gridY][gridX] !== '#';
    }

    resetPositions() {
        this.pacman.x = 13.5 * TILE_SIZE;
        this.pacman.y = 23 * TILE_SIZE;
        this.ghosts.forEach((ghost, i) => {
            ghost.x = (13 + (i % 2)) * TILE_SIZE;
            ghost.y = (11 + Math.floor(i / 2)) * TILE_SIZE;
        });
    }

    render() {
        // Clear canvas
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw maze
        ctx.fillStyle = '#0000FF';
        for (let y = 0; y < MAZE.length; y++) {
            for (let x = 0; x < MAZE[y].length; x++) {
                if (MAZE[y][x] === '#') {
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }

        // Draw dots
        this.dots.forEach(dot => {
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, dot.big ? 4 : 2, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
        });

        // Draw Pacman
        ctx.beginPath();
        ctx.arc(this.pacman.x, this.pacman.y, this.pacman.radius, 
                this.pacman.direction + this.pacman.mouthAngle, 
                this.pacman.direction + 2 * Math.PI - this.pacman.mouthAngle);
        ctx.lineTo(this.pacman.x, this.pacman.y);
        ctx.fillStyle = '#FFFF00';
        ctx.fill();

        // Draw ghosts
        this.ghosts.forEach(ghost => {
            ctx.fillStyle = ghost.color;
            ctx.beginPath();
            ctx.arc(ghost.x, ghost.y, 7, 0, Math.PI);
            ctx.lineTo(ghost.x + 7, ghost.y + 7);
            ctx.lineTo(ghost.x + 5, ghost.y + 5);
            ctx.lineTo(ghost.x + 3, ghost.y + 7);
            ctx.lineTo(ghost.x + 1, ghost.y + 5);
            ctx.lineTo(ghost.x - 1, ghost.y + 7);
            ctx.lineTo(ghost.x - 3, ghost.y + 5);
            ctx.lineTo(ghost.x - 5, ghost.y + 7);
            ctx.lineTo(ghost.x - 7, ghost.y + 7);
            ctx.fill();
            
            // Eyes
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(ghost.x - 3, ghost.y - 2, 2, 0, Math.PI * 2);
            ctx.arc(ghost.x + 3, ghost.y - 2, 2, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw UI
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.fillText(`Score: ${this.score}`, 10, 20);
        ctx.fillText(`Lives: ${this.pacman.lives}`, 360, 20);

        if (this.gameState !== 'playing') {
            ctx.fillStyle = 'white';
            ctx.font = '32px Arial';
            ctx.fillText(this.gameState === 'win' ? 'You Win!' : 'Game Over', 
                        canvas.width/2 - 80, canvas.height/2);
        }
    }
}

new Game();
