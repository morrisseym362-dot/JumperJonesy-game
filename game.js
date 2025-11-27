// --- INITIAL SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GAME_TITLE = 'JumperJonesy';

// --- GAME STATE VARIABLES ---
// Possible states: 'MENU', 'LEVEL_SELECT', 'LEVEL', 'INFINITE', 'GAME_OVER', 'LEVEL_COMPLETE'
let gameState = 'MENU'; 
let previousGameState = 'INFINITE'; // Stores state before game over (to know what to retry)
let currentLevel = 1;
let score = 0;
let lastTime = 0;
let levelObstacles = [];

// --- PLAYER SPRITE SETUP ---
const playerImg = new Image();
// IMPORTANT: Link to your uploaded image file
playerImg.src = 'Mr Jones.png'; 

// --- GAME OBJECTS ---
const player = {
    x: 0, 
    y: 0,
    width: 0, // Set dynamically in resizeCanvas()
    height: 0, // Set dynamically in resizeCanvas()
    velocityY: 0,
    gravity: 1.5,
    // EDITED: Increased jump strength from -28 to -38 to clear obstacles easily
    jumpStrength: -38, 
    isGrounded: true,
    
    // Hitbox Adjustments to fit the visual sprite better
    hitboxOffsetX: 0.1,      // Start hitbox 10% from the left of the sprite
    hitboxOffsetY: 0.2,      // Start hitbox 20% from the top of the sprite
    hitboxWidthScale: 0.8,   // Hitbox is 80% of the sprite width
    hitboxHeightScale: 0.7   // Hitbox is 70% of the sprite height
};

// Define menu buttons, positions are dynamically calculated in updateMenuButtonPositions()
const menuButtons = {};

// --- GAME FUNCTIONS ---

/**
 * Handles canvas resizing and position updates for responsiveness.
 */
function resizeCanvas() {
    // Set canvas dimensions based on the container size defined in CSS
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Set player size relative to canvas height (e.g., 8% of height)
    player.height = canvas.height * 0.08; 
    player.width = player.height; // Keep it square

    // Update player position based on new canvas size
    player.x = canvas.width * 0.05; // 5% from left
    player.y = canvas.height - player.height - 10; // 10px from bottom edge
    
    updateMenuButtonPositions();
}

/**
 * Calculates and updates positions for all interactive menu elements based on current canvas size.
 */
function updateMenuButtonPositions() {
    const W = canvas.width;
    const H = canvas.height;

    // Main Menu Buttons
    menuButtons.levels = { x: W / 2 - 150, y: H / 2 + 30, width: 140, height: 40, text: 'Levels' };
    menuButtons.infinite = { x: W / 2 + 10, y: H / 2 + 30, width: 140, height: 40, text: 'Infinite' };
    
    // Back Button
    menuButtons.back = { x: 20, y: 20, width: 100, height: 30, text: 'Back' };

    // Common Button Layout for Game Over and Level Complete
    const btnWidth = 200;
    const btnHeight = 50;
    const btnY = H / 2 + 20;
    const margin = 20;
    
    // Game Over Buttons
    menuButtons.gameOverMenu = { x: W / 2 - btnWidth - margin/2, y: btnY, width: btnWidth, height: btnHeight, text: 'Return to Menu' };
    menuButtons.gameOverRetry = { x: W / 2 + margin/2, y: btnY, width: btnWidth, height: btnHeight, text: 'Retry Level' };
    
    // Level Complete Buttons
    menuButtons.levelCompleteMenu = { x: W / 2 - btnWidth - margin/2, y: btnY, width: btnWidth, height: btnHeight, text: 'Return to Menu' };
    menuButtons.levelCompleteLevels = { x: W / 2 + margin/2, y: btnY, width: btnWidth, height: btnHeight, text: 'Select Level' };

    // Level Selection Grid (simplified calculation for storing positions)
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
    resizeCanvas(); // Initial call
    
    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyInput);
    
    // Start the game loop only after the image is loaded
    requestAnimationFrame(gameLoop);
}

playerImg.onload = init;


/**
 * The main game loop, runs every frame.
 * @param {number} timestamp - The current time in milliseconds.
 */
function gameLoop(timestamp) {
    // Prevent running if image hasn't loaded (redundant due to onload check, but safe)
    if (!playerImg.complete) {
        requestAnimationFrame(gameLoop);
        return;
    }

    const deltaTime = (timestamp - lastTime) / 1000; 
    lastTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the ground
    ctx.fillStyle = '#4f3922';
    ctx.fillRect(0, canvas.height - 10, canvas.width, 10); 

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
            // Draw last frame of the game before collision
            drawGame(); 
            drawGameOverScreen();
            break;
        case 'LEVEL_COMPLETE':
            // Draw last frame of the level
            drawGame();
            drawLevelCompleteScreen();
            break;
    }

    requestAnimationFrame(gameLoop);
}

// --- PLAYER LOGIC ---

/**
 * Resets player position and clears obstacles.
 */
function resetPlayerAndObstacles() {
    player.x = canvas.width * 0.05;
    player.y = canvas.height - player.height - 10;
    player.velocityY = 0;
    player.isGrounded = true;
    levelObstacles = [];
}

/**
 * Handles the player's movement and jumping physics.
 */
function updatePlayer() {
    // Apply gravity
    if (!player.isGrounded) {
        player.velocityY += player.gravity;
        player.y += player.velocityY;
    }

    // Check for ground collision
    if (player.y + player.height > canvas.height - 10) {
        player.y = canvas.height - 10 - player.height;
        player.velocityY = 0;
        player.isGrounded = true;
    }
}

/**
 * Makes the player jump if they are grounded.
 */
function jump() {
    if (player.isGrounded) {
        player.isGrounded = false;
        player.velocityY = player.jumpStrength;
    }
}

/**
 * Draws the player sprite.
 */
function drawPlayer() {
    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
}

// --- OBSTACLE LOGIC ---

/**
 * Generates the set of obstacles for the current level or infinite mode.
 * The difficulty increases based on the level number or current score.
 */
function generateObstacles(isInfinite) {
    levelObstacles = [];
    let difficultyFactor = 1;
    let maxDistance = 3000; 

    if (isInfinite) {
        // Difficulty increases slightly the further the score is
        difficultyFactor = 1 + Math.floor(score / 500) * 0.2;
        maxDistance = 1000000; // Essentially infinite
    } else {
        // Difficulty increases based on level number (1-50)
        difficultyFactor = 1 + (currentLevel - 1) * 0.15;
        maxDistance = 800 + (currentLevel * 100); // Levels have a finite length
    }

    let currentX = canvas.width * 0.6; // Start further right
    let totalLength = 0;
    
    // Define obstacle heights relative to the responsive player size
    const baseObstacleHeight = player.height * 0.75; 
    const tallObstacleHeight = player.height * 1.5;  
    const maxObstacleWidth = player.width * 1.5;     
    const minGap = player.width * 3;                 

    // Generate until the total distance is reached
    while (totalLength < maxDistance) {
        // Gap between obstacles (gets smaller with difficulty, respects minGap)
        const gap = Math.max(minGap, 400 - difficultyFactor * 50 + Math.random() * 80); 
        currentX += gap;

        // Obstacle width (gets wider with difficulty, max limited by responsive size)
        const width = Math.min(maxObstacleWidth, baseObstacleHeight / 2 + difficultyFactor * 5 + Math.random() * 10); 
        
        // Obstacle height (gets taller with difficulty, using responsive sizes)
        const height = Math.random() < 0.2 ? tallObstacleHeight + difficultyFactor * 5 : baseObstacleHeight; // 20% chance of a tall obstacle

        levelObstacles.push({
            x: currentX,
            y: canvas.height - 10 - height,
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
    // EDITED: Decreased base speed from 250/300 to 200/250 for smoother flow
    const baseSpeed = gameState === 'LEVEL' ? 200 : 250;
    const speedIncrease = gameState === 'INFINITE' ? Math.floor(score / 100) * 5 : 0;
    const scrollSpeed = baseSpeed + speedIncrease; 
    const distanceToScroll = scrollSpeed * deltaTime;
    
    // Calculate the player's true collision box coordinates
    const pBoxX = player.x + player.width * player.hitboxOffsetX;
    const pBoxY = player.y + player.height * player.hitboxOffsetY;
    const pBoxW = player.width * player.hitboxWidthScale;
    const pBoxH = player.height * player.hitboxHeightScale;

    // FIX: Re-introduced signal for safer state transition
    let levelCompleteSignal = false; 


    for (let i = 0; i < levelObstacles.length; i++) {
        const obs = levelObstacles[i];
        obs.x -= distanceToScroll;

        // Check for collision with player (AABB collision using adjusted hitbox)
        if (
            pBoxX < obs.x + obs.width &&
            pBoxX + pBoxW > obs.x &&
            pBoxY < obs.y + obs.height &&
            pBoxY + pBoxH > obs.y
        ) {
            resetGame(); // Triggers GAME_OVER state
            return; // Exit updateObstacles immediately on death
        }

        // Check for level completion (Set signal if last obstacle has passed)
        if (gameState === 'LEVEL' && obs.x < -obs.width && i === levelObstacles.length - 1) {
            levelCompleteSignal = true; 
        }
    }
    
    // FIX: Handle the state transition AFTER the loop has completed
    if (levelCompleteSignal) {
        gameState = 'LEVEL_COMPLETE'; 
        resetPlayerAndObstacles();
        currentLevel++;
    }
}

/**
 * Draws all active obstacles.
 */
function drawObstacles() {
    ctx.fillStyle = '#ff0000'; // Red
    levelObstacles.forEach(obs => {
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    });
}

// --- GAME STATE AND RENDER ---

/**
 * Runs the physics and logic updates for the active game state.
 */
function updateGame(deltaTime) {
    updatePlayer();
    updateObstacles(deltaTime);
}

/**
 * Draws all game elements for the active game state.
 */
function drawGame() {
    drawPlayer();
    drawObstacles();
    
    // --- TEMPORARY DEBUG DRAWING ---
    // Uncomment this section to see the actual hitbox being used for collision
    /*
    ctx.strokeStyle = '#00FFFF'; // Cyan color for visibility
    ctx.lineWidth = 2;
    ctx.strokeRect(
        player.x + player.width * player.hitboxOffsetX,
        player.y + player.height * player.hitboxOffsetY,
        player.width * player.hitboxWidthScale,
        player.height * player.hitboxHeightScale
    );
    */
}

/**
 * Initiates the GAME OVER state when a collision occurs.
 */
function resetGame() {
    previousGameState = gameState; // Store current game mode (LEVEL or INFINITE)
    
    // Reset player physics variables for the next run (even if on game over screen)
    player.velocityY = 0;
    player.isGrounded = true;

    gameState = 'GAME_OVER';
}

// --- UI RENDERING ---

/**
 * Helper function to draw a standardized menu button.
 */
function drawButton(button) {
    // Background
    ctx.fillStyle = '#4CAF50'; 
    ctx.fillRect(button.x, button.y, button.width, button.height);

    // Text
    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(button.text, button.x + button.width / 2, button.y + button.height / 2 + 7);
}


/**
 * Draws the main title menu.
 */
function drawMenu() {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    
    // Title
    ctx.font = `${canvas.height * 0.15}px Arial`;
    ctx.fillText(GAME_TITLE, canvas.width / 2, canvas.height / 2 - 50);

    // Buttons
    drawButton(menuButtons.levels);
    drawButton(menuButtons.infinite);
}

/**
 * Draws the level selection screen.
 */
function drawLevelSelect() {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    
    // Title
    ctx.font = '30px Arial';
    ctx.fillText('Select a Level', canvas.width / 2, 80);

    // Back Button
    drawButton(menuButtons.back);

    // Level buttons grid (10 rows, 5 columns)
    ctx.font = '16px Arial';

    for (let i = 1; i <= 50; i++) {
        const btn = menuButtons['level_' + i];
        
        // Color based on (mock) progress
        ctx.fillStyle = i <= currentLevel ? '#4CAF50' : '#888'; 
        ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
        
        // Draw button text
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(i.toString(), btn.x + btn.width / 2, btn.y + btn.height / 2 + 5);
    }
}

/**
 * Displays the current level number on the game screen.
 */
function drawLevelIndicator() {
    ctx.fillStyle = '#000';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Level: ${currentLevel}`, 10, 30);
}

/**
 * Updates the score based on distance traveled and draws it.
 */
function updateScore(deltaTime) {
    const speed = 250; // Points per second
    score += speed * deltaTime;
}

/**
 * Draws the current score in the top right.
 */
function drawScore() {
    ctx.fillStyle = '#000';
    ctx.font = '20px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Score: ${score.toFixed(0)}`, canvas.width - 10, 30);
}

/**
 * Draws the Game Over overlay and buttons.
 */
function drawGameOverScreen() {
    // Dark, transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';

    // Title
    ctx.font = '40px Arial';
    ctx.fillText('CRASHED!', canvas.width / 2, canvas.height / 2 - 80);

    // Score/Level Display
    ctx.font = '24px Arial';
    if (previousGameState === 'INFINITE') {
        ctx.fillText(`Final Score: ${score.toFixed(0)}`, canvas.width / 2, canvas.height / 2 - 30);
    } else {
        ctx.fillText(`Level ${currentLevel} Failed`, canvas.width / 2, canvas.height / 2 - 30);
    }
    
    // Draw Buttons
    drawButton(menuButtons.gameOverMenu);
    drawButton(menuButtons.gameOverRetry);
}

/**
 * Draws the Level Complete overlay and buttons.
 */
function drawLevelCompleteScreen() {
    // Light, transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';

    // Title
    ctx.font = '40px Arial';
    ctx.fillText('LEVEL COMPLETE!', canvas.width / 2, canvas.height / 2 - 80);

    // Level Display
    ctx.font = '24px Arial';
    ctx.fillText(`You Cleared Level ${currentLevel - 1}!`, canvas.width / 2, canvas.height / 2 - 30); // currentLevel was already incremented

    // Draw Buttons
    drawButton(menuButtons.levelCompleteMenu);
    drawButton(menuButtons.levelCompleteLevels);
}

// --- INPUT HANDLERS ---

/**
 * Handles mouse clicks for menu navigation.
 */
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
            // Check for level buttons
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
            // Reset everything and go to menu
            resetPlayerAndObstacles();
            score = 0;
            gameState = 'MENU';
        } else if (isButtonClicked(menuButtons.gameOverRetry, mouseX, mouseY)) {
            // Retry the previous mode
            resetPlayerAndObstacles();
            if (previousGameState === 'INFINITE') {
                score = 0;
                generateObstacles(true);
                gameState = 'INFINITE';
            } else if (previousGameState === 'LEVEL') {
                // currentLevel remains the same
                generateObstacles(false);
                gameState = 'LEVEL';
            }
        }
    } else if (gameState === 'LEVEL_COMPLETE') { 
        if (isButtonClicked(menuButtons.levelCompleteMenu, mouseX, mouseY)) {
            // Go to main menu
            gameState = 'MENU';
            score = 0;
        } else if (isButtonClicked(menuButtons.levelCompleteLevels, mouseX, mouseY)) {
            // Go to level select screen
            gameState = 'LEVEL_SELECT';
        }
    }
}

/**
 * Checks if the mouse click is within a button's bounds.
 */
function isButtonClicked(button, mouseX, mouseY) {
    // Only check if button exists and has coordinates
    if (!button) return false;

    return mouseX >= button.x &&
           mouseX <= button.x + button.width &&
           mouseY >= button.y &&
           mouseY <= button.y + button.height;
}

/**
 * Handles keyboard input for jumping.
 */
function handleKeyInput(event) {
    // Allow jumping only in active game modes
    if ((gameState === 'LEVEL' || gameState === 'INFINITE') && (event.code === 'Space' || event.code === 'ArrowUp')) {
        jump();
    }
}
