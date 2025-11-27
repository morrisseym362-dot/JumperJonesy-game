// --- INITIAL SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GAME_TITLE = 'JumperJonesy';

// --- GAME STATE VARIABLES ---
let gameState = 'MENU';
let previousGameState = 'INFINITE';
let currentLevel = 1;
let score = 0;
let lastTime = 0;
let levelObstacles = [];

// Ground height (responsive) -- will be set in resizeCanvas()
let groundHeight = 10;

// --- PLAYER SPRITE SETUP ---
const playerImg = new Image();
playerImg.src = 'Mr Jones.png';

// --- GAME OBJECTS ---
const player = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    velocityY: 0,
    gravity: 1.5,
    jumpStrength: -28,
    isGrounded: true,

    // Hitbox Adjustments to fit the visual sprite better
    hitboxOffsetX: 0.12,
    hitboxOffsetY: 0.18,
    hitboxWidthScale: 0.76,
    hitboxHeightScale: 0.68,

    // Terminal velocity to prevent extremely fast fall
    terminalVelocity: 2000
};

const menuButtons = {};

/**
 * Handles canvas resizing and position updates for responsiveness.
 */
function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Responsive ground height (use more vertical space)
    groundHeight = Math.max(18, canvas.height * 0.06);

    // Player size relative to canvas height (kept larger)
    player.height = canvas.height * 0.15; // ~15% of screen height
    player.width = player.height;

    // --- Physics tuning that scales with size but cannot launch off-screen ---
    // We choose a gentler jump relative to player height and a gravity proportional
    // to player height. We'll also set a terminal velocity and ensure a ceiling clamp.
    player.jumpStrength = -player.height * 0.95;   // controlled jump (reduced)
    player.gravity = player.height * 0.14;         // stronger gravity to shorten arc
    player.terminalVelocity = Math.max(player.height * 8, canvas.height * 2.5);

    // Position player on ground
    player.x = canvas.width * 0.05;
    player.y = canvas.height - player.height - groundHeight;

    updateMenuButtonPositions();
}

/**
 * Calculates and updates positions for all interactive menu elements based on current canvas size.
 */
function updateMenuButtonPositions() {
    const W = canvas.width;
    const H = canvas.height;

    menuButtons.levels = { x: W / 2 - 150, y: H / 2 + 30, width: 140, height: 40, text: 'Levels' };
    menuButtons.infinite = { x: W / 2 + 10, y: H / 2 + 30, width: 140, height: 40, text: 'Infinite' };
    menuButtons.back = { x: 20, y: 20, width: 100, height: 30, text: 'Back' };

    const btnWidth = 200;
    const btnHeight = 50;
    const btnY = H / 2 + 20;
    const margin = 20;

    menuButtons.gameOverMenu = { x: W / 2 - btnWidth - margin/2, y: btnY, width: btnWidth, height: btnHeight, text: 'Return to Menu' };
    menuButtons.gameOverRetry = { x: W / 2 + margin/2, y: btnY, width: btnWidth, height: btnHeight, text: 'Retry Level' };
    menuButtons.levelCompleteMenu = { x: W / 2 - btnWidth - margin/2, y: btnY, width: btnWidth, height: btnHeight, text: 'Return to Menu' };
    menuButtons.levelCompleteLevels = { x: W / 2 + margin/2, y: btnY, width: btnWidth, height: btnHeight, text: 'Select Level' };

    const startX = W * 0.1;
    const startY = H * 0.25;
    const btnW = 50;
    const btnH = 30;
    const padding = 15;
    const cols = 10;

    for (let i = 1; i <= 50; i++) {
        const col = (i - 1) % cols;
        const row = Math.floor((i - 1) / cols);

        const x = startX + col * (btnW + padding);
        const y = startY + row * (btnH + padding);

        menuButtons['level_' + i] = { x: x, y: y, width: btnW, height: btnH, text: i.toString() };
    }
}

/**
 * Initializes the game and starts the main loop.
 */
function init() {
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyInput);
    requestAnimationFrame(gameLoop);
}

playerImg.onload = init;

/**
 * The main game loop, runs every frame.
 * @param {number} timestamp - The current time in milliseconds.
 */
function gameLoop(timestamp) {
    if (!playerImg.complete) {
        requestAnimationFrame(gameLoop);
        return;
    }

    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw ground with responsive height
    ctx.fillStyle = '#4f3922';
    ctx.fillRect(0, canvas.height - groundHeight, canvas.width, groundHeight);

    switch (gameState) {
        case 'MENU':
            drawMenu();
            break;
        case 'LEVEL_SELECT':
            drawLevelSelect();
            break;
        case 'LEVEL':
        case 'INFINITE':
            updateGame(deltaTime);
            drawGame();
            if (gameState === 'LEVEL') {
                drawLevelIndicator();
            } else {
                updateScore(deltaTime);
                drawScore();
            }
            break;
        case 'GAME_OVER':
            drawGame();
            drawGameOverScreen();
            break;
        case 'LEVEL_COMPLETE':
            drawGame();
            drawLevelCompleteScreen();
            break;
    }

    requestAnimationFrame(gameLoop);
}

// --- PLAYER LOGIC ---

function resetPlayerAndObstacles() {
    player.x = canvas.width * 0.05;
    player.y = canvas.height - player.height - groundHeight;
    player.velocityY = 0;
    player.isGrounded = true;
    levelObstacles = [];
}

/**
 * Handles the player's movement and jumping physics.
 * Includes ceiling clamp and terminal velocity to prevent leaving the screen.
 */
function updatePlayer() {
    // Apply gravity if airborne
    if (!player.isGrounded) {
        player.velocityY += player.gravity;
        // Clamp to terminal velocity
        if (player.velocityY > player.terminalVelocity) {
            player.velocityY = player.terminalVelocity;
        }
        player.y += player.velocityY;
    }

    // Ground collision
    if (player.y + player.height > canvas.height - groundHeight) {
        player.y = canvas.height - groundHeight - player.height;
        player.velocityY = 0;
        player.isGrounded = true;
    }

    // Ceiling clamp: never allow the player's top to go above y = 0
    if (player.y < 0) {
        player.y = 0;
        // If the player hit the ceiling while going up, zero the upward velocity
        if (player.velocityY < 0) {
            player.velocityY = 0;
        }
    }
}

/**
 * Makes the player jump if they are grounded.
 * Small double-check to avoid extremely high jumps if player is nearly at top already.
 */
function jump() {
    if (player.isGrounded) {
        // If the player is too high to jump fully, reduce jump strength proportionally
        const maxAllowedJumpTop = canvas.height * 0.02; // keep at least 2% margin at top
        const spaceAbove = player.y - maxAllowedJumpTop;
        let appliedJump = player.jumpStrength;

        if (-player.jumpStrength > spaceAbove) {
            // Reduce the jump so the player won't instantly overshoot the ceiling
            appliedJump = -Math.max(10, spaceAbove * 0.9);
        }

        player.isGrounded = false;
        player.velocityY = appliedJump;
    }
}

/**
 * Draws the player sprite.
 */
function drawPlayer() {
    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
}

// --- OBSTACLE LOGIC ---

function generateObstacles(isInfinite) {
    levelObstacles = [];
    let difficultyFactor = 1;
    let maxDistance = 3000;

    if (isInfinite) {
        difficultyFactor = 1 + Math.floor(score / 500) * 0.2;
        maxDistance = 1000000;
    } else {
        difficultyFactor = 1 + (currentLevel - 1) * 0.15;
        maxDistance = 800 + (currentLevel * 100);
    }

    let currentX = canvas.width * 0.6;
    let totalLength = 0;

    const baseObstacleHeight = player.height * 1.05;
    const tallObstacleHeight = player.height * 2.0 + difficultyFactor * 4;
    const maxObstacleWidth = player.width * 2.4;
    const minGap = Math.max(player.width * 1.6, 40);

    while (totalLength < maxDistance) {
        const gap = Math.max(minGap, 420 - difficultyFactor * 60 + Math.random() * 100);
        currentX += gap;

        const width = Math.min(maxObstacleWidth, baseObstacleHeight * 0.6 + difficultyFactor * 8 + Math.random() * 18);

        const height = Math.random() < 0.25 ? tallObstacleHeight + difficultyFactor * 6 : baseObstacleHeight;

        levelObstacles.push({
            x: currentX,
            y: canvas.height - groundHeight - height,
            width: width,
            height: height
        });

        currentX += width;
        totalLength = currentX;
    }
}

/**
 * Updates obstacle positions and checks for collision.
 */
function updateObstacles(deltaTime) {
    const baseSpeed = gameState === 'LEVEL' ? 250 : 300;
    const speedIncrease = gameState === 'INFINITE' ? Math.floor(score / 100) * 5 : 0;
    const scrollSpeed = baseSpeed + speedIncrease;
    const distanceToScroll = scrollSpeed * deltaTime;

    const pBoxX = player.x + player.width * player.hitboxOffsetX;
    const pBoxY = player.y + player.height * player.hitboxOffsetY;
    const pBoxW = player.width * player.hitboxWidthScale;
    const pBoxH = player.height * player.hitboxHeightScale;

    let levelCompleteSignal = false;

    for (let i = 0; i < levelObstacles.length; i++) {
        const obs = levelObstacles[i];
        obs.x -= distanceToScroll;

        if (
            pBoxX < obs.x + obs.width &&
            pBoxX + pBoxW > obs.x &&
            pBoxY < obs.y + obs.height &&
            pBoxY + pBoxH > obs.y
        ) {
            resetGame();
            return;
        }

        if (gameState === 'LEVEL' && obs.x < -obs.width && i === levelObstacles.length - 1) {
            levelCompleteSignal = true;
        }
    }

    if (levelCompleteSignal) {
        gameState = 'LEVEL_COMPLETE';
        resetPlayerAndObstacles();
        currentLevel++;
    }
}

function drawObstacles() {
    ctx.fillStyle = '#ff0000';
    levelObstacles.forEach(obs => {
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    });
}

// --- GAME STATE AND RENDER ---

function updateGame(deltaTime) {
    updatePlayer();
    updateObstacles(deltaTime);
}

function drawGame() {
    drawPlayer();
    drawObstacles();

    // Debug hitbox (uncomment if needed)
    /*
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(
        player.x + player.width * player.hitboxOffsetX,
        player.y + player.height * player.hitboxOffsetY,
        player.width * player.hitboxWidthScale,
        player.height * player.hitboxHeightScale
    );
    */
}

function resetGame() {
    previousGameState = gameState;
    player.velocityY = 0;
    player.isGrounded = true;
    gameState = 'GAME_OVER';
}

// --- UI RENDERING ---

function drawButton(button) {
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(button.x, button.y, button.width, button.height);

    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(button.text, button.x + button.width / 2, button.y + button.height / 2 + 7);
}

function drawMenu() {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';

    ctx.font = `${canvas.height * 0.12}px Arial`;
    ctx.fillText(GAME_TITLE, canvas.width / 2, canvas.height / 2 - 50);

    drawButton(menuButtons.levels);
    drawButton(menuButtons.infinite);
}

function drawLevelSelect() {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';

    ctx.font = '30px Arial';
    ctx.fillText('Select a Level', canvas.width / 2, 80);

    drawButton(menuButtons.back);

    ctx.font = '16px Arial';

    for (let i = 1; i <= 50; i++) {
        const btn = menuButtons['level_' + i];

        ctx.fillStyle = i <= currentLevel ? '#4CAF50' : '#888';
        ctx.fillRect(btn.x, btn.y, btn.width, btn.height);

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(i.toString(), btn.x + btn.width / 2, btn.y + btn.height / 2 + 5);
    }
}

function drawLevelIndicator() {
    ctx.fillStyle = '#000';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Level: ${currentLevel}`, 10, 30);
}

function updateScore(deltaTime) {
    const speed = 250;
    score += speed * deltaTime;
}

function drawScore() {
    ctx.fillStyle = '#000';
    ctx.font = '20px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Score: ${score.toFixed(0)}`, canvas.width - 10, 30);
}

function drawGameOverScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';

    ctx.font = '40px Arial';
    ctx.fillText('CRASHED!', canvas.width / 2, canvas.height / 2 - 80);

    ctx.font = '24px Arial';
    if (previousGameState === 'INFINITE') {
        ctx.fillText(`Final Score: ${score.toFixed(0)}`, canvas.width / 2, canvas.height / 2 - 30);
    } else {
        ctx.fillText(`Level ${currentLevel} Failed`, canvas.width / 2, canvas.height / 2 - 30);
    }

    drawButton(menuButtons.gameOverMenu);
    drawButton(menuButtons.gameOverRetry);
}

function drawLevelCompleteScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';

    ctx.font = '40px Arial';
    ctx.fillText('LEVEL COMPLETE!', canvas.width / 2, canvas.height / 2 - 80);

    ctx.font = '24px Arial';
    ctx.fillText(`You Cleared Level ${currentLevel - 1}!`, canvas.width / 2, canvas.height / 2 - 30);

    drawButton(menuButtons.levelCompleteMenu);
    drawButton(menuButtons.levelCompleteLevels);
}

// --- INPUT HANDLERS ---

function handleMouseDown(event) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (gameState === 'MENU') {
        if (isButtonClicked(menuButtons.levels, mouseX, mouseY)) {
            gameState = 'LEVEL_SELECT';
        } else if (isButtonClicked(menuButtons.infinite, mouseX, mouseY)) {
            score = 0;
            resetPlayerAndObstacles();
            generateObstacles(true);
            gameState = 'INFINITE';
        }
    } else if (gameState === 'LEVEL_SELECT') {
        if (isButtonClicked(menuButtons.back, mouseX, mouseY)) {
            gameState = 'MENU';
        } else {
            for (let i = 1; i <= 50; i++) {
                const btn = menuButtons['level_' + i];
                if (isButtonClicked(btn, mouseX, mouseY)) {
                    currentLevel = i;
                    resetPlayerAndObstacles();
                    generateObstacles(false);
                    gameState = 'LEVEL';
                    break;
                }
            }
        }
    } else if (gameState === 'GAME_OVER') {
        if (isButtonClicked(menuButtons.gameOverMenu, mouseX, mouseY)) {
            resetPlayerAndObstacles();
            score = 0;
            gameState = 'MENU';
        } else if (isButtonClicked(menuButtons.gameOverRetry, mouseX, mouseY)) {
            resetPlayerAndObstacles();
            if (previousGameState === 'INFINITE') {
                score = 0;
                generateObstacles(true);
                gameState = 'INFINITE';
            } else if (previousGameState === 'LEVEL') {
                generateObstacles(false);
                gameState = 'LEVEL';
            }
        }
    } else if (gameState === 'LEVEL_COMPLETE') {
        if (isButtonClicked(menuButtons.levelCompleteMenu, mouseX, mouseY)) {
            gameState = 'MENU';
            score = 0;
        } else if (isButtonClicked(menuButtons.levelCompleteLevels, mouseX, mouseY)) {
            gameState = 'LEVEL_SELECT';
        }
    }
}

function isButtonClicked(button, mouseX, mouseY) {
    if (!button) return false;

    return mouseX >= button.x &&
           mouseX <= button.x + button.width &&
           mouseY >= button.y &&
           mouseY <= button.y + button.height;
}

function handleKeyInput(event) {
    if ((gameState === 'LEVEL' || gameState === 'INFINITE') && (event.code === 'Space' || event.code === 'ArrowUp')) {
        jump();
    }
}
