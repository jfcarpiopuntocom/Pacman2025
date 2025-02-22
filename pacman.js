// pacman.js
(() => {
    // Configuration
    const CONFIG = Object.freeze({
        TILE_SIZE: 16,
        CANVAS_WIDTH: 448,  // 28 * 16
        CANVAS_HEIGHT: 496, // 31 * 16
        COLORS: {
            BACKGROUND: '#000000',
            WALL: '#0000FF',
            PACMAN: '#FFFF00',
            GHOSTS: ['#FF0000', '#FFB8FF', '#00FFFF', '#FFB852'],
            TEXT: '#FFFFFF',
            FRIGHTENED: '#000080'
        },
        SPEEDS: {
            PACMAN: 2.5,
            GHOST: 2
        },
        POWER_DURATION: 5000,
        MODE_SWITCH_INTERVAL: 7000,
        VERSION: 'v2.0'
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
            return [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(Math.random() * 4)];
        },
        tileToPixel(tile) {
            return tile * CONFIG.TILE_SIZE;
        },
        pixelToTile(pixel) {
            return Math.floor(pixel / CONFIG.TILE_SIZE);
        }
    };

    // Audio Manager
    class AudioManager {
        constructor() {
            this.context = null;
            try {
                this.context = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('Web Audio API not supported:', e);
                this.context = null;
            }
        }

        play(frequency, duration = 100) {
            if (!this.context) return;
            try {
                const osc = this.context.createOscillator();
                osc.type = 'square';
                osc.frequency.value = frequency;
                osc
