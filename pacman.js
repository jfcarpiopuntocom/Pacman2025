// pacman.js
document.addEventListener("DOMContentLoaded", () => {
    "use strict"; // 1. Strict Mode

    // Constants - 2. Immutable Config
    const CONFIG = Object.freeze({
        WIDTH: 28,
        TILE_SIZE: 20, // For CSS scaling
        GHOST_SPEEDS: Object.freeze({
            BLINKY: 250,
            PINKY: 400,
            INKY: 300,
            CLYDE: 500
        }),
        WIN_SCORE: 274
    });

    // Atari-accurate Maze with Proper Tunnels - 3. Single Source of Truth
    const layout = Object.freeze([
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,
        1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1,
        1,3,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,3,1,
        1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
        1,0,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,0,1,
        1,0,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,0,1,
        1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,1,
        1,1,1,1,1,1,0,1,1,4,1,1,0,1,1,0,1,1,4,1,1,0,1,1,1,1,1,1,
        1,1,1,1,1,1,0,1,1,4,1,1,0,1,1,0,1,1,4,1,1,0,1,1,1,1,1,1,
        1,1,1,1,1,1,0,1,1,4,4,4,4,4,4,4,4,4,4,1,1,0,1,1,1,1,1,1,
        4,4,4,4,4,4,0,1,1,4,1,1,1,2,2,1,1,1,4,1,1,0,4,4,4,4,4,4,
        0,0,0,0,0,0,0,0,0,4,1,1,2,2,2,2,1,1,4,0,0,0,0,0,0,0,0,0,
        4,4,4,4,4,4,0,1,1,4,1,1,1,1,1,1,1,1,4,1,1,0,4,4,4,4,4,4,
        1,1,1,1,1,1,0,1,1,4,4,4,4,4,4,4,4,4,4,1,1,0,1,1,1,1,1,1,
        1,1,1,1,1,1,0,1,1,4,1,1,1,1,1,1,1,1,4,1,1,0,1,1,1,1,1,1,
        1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,
        1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1,
        1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1,
        1,3,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,3,1,
        1,1,1,0,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,0,1,1,1,
        1,1,1,0,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,0,1,1,1,
        1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,1,
        1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,0,1,
        1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,0,1,
        1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1
    ]);

    // 0 - pac-dots, 1 - wall, 2 - ghost-lair, 3 - power-pellet, 4 - empty

    // DOM Elements - 4. Early Validation
    const scoreDisplay = document.getElementById("score") || 
        document.createElement("div"); // 5. Fallback
    scoreDisplay.id = "score";
    const grid = document.querySelector(".grid") || 
        document.body.appendChild(document.createElement("div")); // 6. Robust DOM
    grid.classList.add("grid");

    // Game State - 7. Centralized State
    let score = 0;
    const squares = [];
    let pacmanCurrentIndex = 490;
    const ghosts = [];

    // Utility Functions - 8. Pure Functions, 9. DRY
    const Utils = {
        isValidMove(index) { // 10. Clear Naming
            return index >= 0 && 
                   index < CONFIG.WIDTH * CONFIG.WIDTH && 
                   !squares[index].classList.contains("wall") && 
                   !squares[index].classList.contains("ghost-lair");
        },
        wrapTunnel(index) { // 11. Encapsulation
            if (index === 363) return 391; // Left tunnel
            if (index === 392) return 364; // Right tunnel
            return index;
        }
    };

    // Board Creation - 12. Modular Design
    function createBoard() {
        grid.style.cssText = `width: ${CONFIG.WIDTH * CONFIG.TILE_SIZE}px; ` +
                           `display: grid; grid-template-columns: repeat(${CONFIG.WIDTH}, ${CONFIG.TILE_SIZE}px);`;
        for (let i = 0; i < layout.length; i++) {
            const square = document.createElement("div");
            square.id = i; // 13. Unique Identifiers
            grid.appendChild(square);
            squares.push(square);

            switch (layout[i]) { // 14. Switch over If-Else
                case 0: square.classList.add("pac-dot"); break;
                case 1: square.classList.add("wall"); break;
                case 2: square.classList.add("ghost-lair"); break;
                case 3: square.classList.add("power-pellet"); break;
            }
        }
    }

    // Ghost Constructor - 15. Object-Oriented
    class Ghost {
        constructor(className, startIndex, speed) {
            this.className = className;
            this.startIndex = startIndex;
            this.speed = speed;
            this.currentIndex = startIndex;
            this.isScared = false;
            this.timerId = null; // 16. Null over NaN
        }

        reset() { // 17. Consistent State
            squares[this.currentIndex].classList.remove(this.className, "ghost", "scared-ghost");
            this.currentIndex = this.startIndex;
            this.isScared = false;
            squares[this.currentIndex].classList.add(this.className, "ghost");
        }
    }

    // Game Logic - 18. Centralized Logic
    class Game {
        constructor() {
            scoreDisplay.textContent = "0";
            createBoard();
            this.initCharacters();
            this.bindControls(); // 19. Event Delegation
        }

        initCharacters() {
            squares[pacmanCurrentIndex].classList.add("pac-man");
            ghosts.push(
                new Ghost("blinky", 348, CONFIG.GHOST_SPEEDS.BLINKY),
                new Ghost("pinky", 376, CONFIG.GHOST_SPEEDS.PINKY),
                new Ghost("inky", 351, CONFIG.GHOST_SPEEDS.INKY),
                new Ghost("clyde", 379, CONFIG.GHOST_SPEEDS.CLYDE)
            );
            ghosts.forEach(ghost => {
                squares[ghost.currentIndex].classList.add(ghost.className, "ghost");
                this.moveGhost(ghost);
            });
        }

        bindControls() {
            const keyMap = Object.freeze({ // 20. Immutable Mapping
                "ArrowLeft": -1,
                "ArrowRight": 1,
                "ArrowUp": -CONFIG.WIDTH,
                "ArrowDown": CONFIG.WIDTH,
                "a": -1,
                "d": 1,
                "w": -CONFIG.WIDTH,
                "s": CONFIG.WIDTH
            });

            document.addEventListener("keydown", (e) => { // 21. Keydown for Responsiveness
                e.preventDefault(); // 22. Prevent Default
                const move = keyMap[e.key];
                if (move) this.movePacman(move);
            });
        }

        movePacman(direction) { // 23. Single Responsibility
            squares[pacmanCurrentIndex].classList.remove("pac-man");
            const newIndex = Utils.wrapTunnel(pacmanCurrentIndex + direction);
            
            if (Utils.isValidMove(newIndex)) {
                pacmanCurrentIndex = newIndex;
            }

            squares[pacmanCurrentIndex].classList.add("pac-man");
            this.pacDotEaten();
            this.powerPelletEaten();
            this.checkForGameOver();
            this.checkForWin();
        }

        pacDotEaten() { // 24. Precise Detection
            if (squares[pacmanCurrentIndex].classList.contains("pac-dot")) {
                score++;
                scoreDisplay.textContent = score;
                squares[pacmanCurrentIndex].classList.remove("pac-dot");
            }
        }

        powerPelletEaten() { // 25. State Management
            if (squares[pacmanCurrentIndex].classList.contains("power-pellet")) {
                score += 10;
                scoreDisplay.textContent = score;
                ghosts.forEach(ghost => ghost.isScared = true);
                setTimeout(() => ghosts.forEach(ghost => ghost.isScared = false), 10000);
                squares[pacmanCurrentIndex].classList.remove("power-pellet");
            }
        }

        moveGhost(ghost) { // 26. Robust AI
            const directions = [-1, 1, CONFIG.WIDTH, -CONFIG.WIDTH];
            let direction = directions[Math.floor(Math.random() * directions.length)];

            ghost.timerId = setInterval(() => {
                const nextIndex = ghost.currentIndex + direction;
                if (Utils.isValidMove(nextIndex) && 
                    !squares[nextIndex].classList.contains("ghost")) {
                    squares[ghost.currentIndex].classList.remove(ghost.className, "ghost", "scared-ghost");
                    ghost.currentIndex = nextIndex;
                    squares[ghost.currentIndex].classList.add(ghost.className, "ghost");
                } else {
                    direction = directions[Math.floor(Math.random() * directions.length)];
                }

                if (ghost.isScared) {
                    squares[ghost.currentIndex].classList.add("scared-ghost");
                }

                if (ghost.isScared && squares[ghost.currentIndex].classList.contains("pac-man")) {
                    squares[ghost.currentIndex].classList.remove(ghost.className, "ghost", "scared-ghost");
                    ghost.currentIndex = ghost.startIndex;
                    score += 100;
                    scoreDisplay.textContent = score;
                    squares[ghost.currentIndex].classList.add(ghost.className, "ghost");
                    ghost.isScared = false;
                }

                this.checkForGameOver();
            }, ghost.speed);
        }

        checkForGameOver() { // 27. Early Exit
            if (squares[pacmanCurrentIndex].classList.contains("ghost") && 
                !squares[pacmanCurrentIndex].classList.contains("scared-ghost")) {
                ghosts.forEach(ghost => clearInterval(ghost.timerId));
                document.removeEventListener("keydown", this.movePacman);
                setTimeout(() => alert("Game Over"), 500); // 28. User Feedback
            }
        }

        checkForWin() { // 29. Clear Win Condition
            if (score >= CONFIG.WIN_SCORE) {
                ghosts.forEach(ghost => clearInterval(ghost.timerId));
                document.removeEventListener("keydown", this.movePacman);
                setTimeout(() => alert("You have WON!"), 500);
            }
        }
    }

    // Bootstrap - 30. Error Handling, 31. Graceful Degradation
    try {
        new Game();
    } catch (e) {
        console.error("Game initialization failed:", e);
        document.body.textContent = "Pacman failed to load. Check console.";
    }

    // CSS Injection - 32. Centralized Styling
    const style = document.createElement("style");
    style.textContent = `
        .grid { margin: 20px auto; max-width: ${CONFIG.WIDTH * CONFIG.TILE_SIZE}px; }
        .grid div { width: ${CONFIG.TILE_SIZE}px; height: ${CONFIG.TILE_SIZE}px; }
        .wall { background-color: blue; }
        .pac-dot { background-color: yellow; border-radius: 50%; width: 8px; height: 8px; margin: 6px; }
        .power-pellet { background-color: yellow; border-radius: 50%; width: 12px; height: 12px; margin: 4px; }
        .pac-man { background-color: yellow; border-radius: 50%; }
        .ghost { position: relative; }
        .blinky { background-color: red; }
        .pinky { background-color: pink; }
        .inky { background-color: cyan; }
        .clyde { background-color: orange; }
        .scared-ghost { background-color: darkblue; }
        #score { font-size: 24px; text-align: center; margin: 10px; }
    `;
    document.head.appendChild(style);
});
