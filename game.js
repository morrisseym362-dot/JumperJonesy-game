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

let groundHeight = 10;

// --- PLAYER SPRITE SETUP ---
const playerImg = new Image();
playerImg.src = 'Mr Jones.png';

// --- PLAYER OBJECT ---
const player = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    velocityY: 0,
    gravity: 0,
    jumpStrength: 0,
    isGrounded: true,

    // Hitbox relative values
    hitboxOffsetX: 0.12,
    hitboxOffsetY: 0.18,
    hitboxWidthScale: 0.76,
    hitboxHeightScale: 0.68,

    terminalVelocity: 0
};

const menuButtons = {};

// *****************************************************************************************
// RESIZE + RESPONSIVE SCALING
// *****************************************************************************************

function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Floor height (responsive, visible)
    groundHeight = Math.max(18, canvas.height * 0.06);

    // Player is ~15% of screen height
    player.height = canvas.height * 0.15;
    player.width = player.height;

    // === SMOOTH GD-LIKE PHYSICS (Final tuned values) ===
    // These values produce short, snappy jumps and smooth movement on 1536px height.
    player.gravity = canvas.height * 0.0055;       // smoother gravity (~8.4 at 1536px)
    player.jumpStrength = -(canvas.height * 0.015); // short jump (~-23 at 1536px)
    player.terminalVelocity = canvas.height * 2.5; // controlled fast fall

    // Place player on ground
    player.x = canvas.width * 0.05;
    player.y = canvas.height - groundHeight - player.height;

    updateMenuButtonPositions();
}

// *****************************************************************************************
// UI BUTTON POSITIONING
// *****************************************************************************************

function updateMenuButtonPositions() {
    const W = canvas.width;
    const H = canvas.height;

    menuButtons.levels = { x: W/2 -150, y: H/2+30, width: 140, height: 40, text:'Levels' };
    menuButtons.infinite = { x: W/2 +10, y: H/2+30, width: 140, height: 40, text:'Infinite' };
    menuButtons.back = { x:20, y:20, width: 100, height: 30, text:'Back' };

    const bw = 200, bh = 50, by = H/2+20, margin = 20;

    menuButtons.gameOverMenu = { x: W/2 - bw - margin/2, y: by, width:bw, height:bh, text:'Return to Menu' };
    menuButtons.gameOverRetry = { x: W/2 + margin/2, y: by, width:bw, height:bh, text:'Retry Level' };

    menuButtons.levelCompleteMenu = { x: W/2 - bw - margin/2, y: by, width:bw, height:bh, text:'Return to Menu' };
    menuButtons.levelCompleteLevels = { x: W/2 + margin/2, y: by, width:bw, height:bh, text:'Select Level' };

    const startX = W*0.1, startY = H*0.25, btnW = 50, btnH = 30, pad = 15, cols = 10;

    for (let i = 1; i <= 50; i++) {
        const col = (i-1) % cols;
        const row = Math.floor((i-1)/cols);
        menuButtons['level_'+i] = {
            x: startX + col*(btnW+pad),
            y: startY + row*(btnH+pad),
            width: btnW,
            height: btnH,
            text: String(i)
        };
    }
}

// *****************************************************************************************
// INIT
// *****************************************************************************************

function init() {
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyInput);

    requestAnimationFrame(gameLoop);
}

playerImg.onload = init;

// *****************************************************************************************
// GAME LOOP
// *****************************************************************************************

function gameLoop(timestamp) {
    if (!playerImg.complete) {
        requestAnimationFrame(gameLoop);
        return;
    }

    const delta = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // Clear
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Draw ground
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
            updateGame(delta);
            drawGame();
            if (gameState === 'LEVEL') drawLevelIndicator();
            else { updateScore(delta); drawScore(); }
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

// *****************************************************************************************
// PLAYER PHYSICS
// *****************************************************************************************

function resetPlayerAndObstacles() {
    player.x = canvas.width * 0.05;
    player.y = canvas.height - groundHeight - player.height;
    player.velocityY = 0;
    player.isGrounded = true;
    levelObstacles = [];
}

function updatePlayer() {
    if (!player.isGrounded) {
        // integrate velocity
        player.velocityY += player.gravity;

        // clamp terminal velocity
        if (player.velocityY > player.terminalVelocity) {
            player.velocityY = player.terminalVelocity;
        }

        // apply movement
        player.y += player.velocityY;
    }

    // Ground collision
    if (player.y + player.height > canvas.height - groundHeight) {
        player.y = canvas.height - groundHeight - player.height;
        player.velocityY = 0;
        player.isGrounded = true;
    }

    // Ceiling hard clamp (never go above 5% from top)
    const ceilingLimit = canvas.height * 0.05;
    if (player.y < ceilingLimit) {
        player.y = ceilingLimit;
        if (player.velocityY < 0) player.velocityY = 0;
    }

    // Small sub-pixel smoothing to reduce jitter on high-DPI screens:
    // We round to 2 decimal places to avoid tiny fractional jitter while keeping smoothness.
    player.y = Math.round(player.y * 100) / 100;
}

function jump() {
    if (player.isGrounded) {
        player.isGrounded = false;

        // safety: if player is very close to ceiling, reduce jump so it doesn't collide immediately
        const ceilingLimit = canvas.height * 0.05;
        const availableSpace = player.y - ceilingLimit;
        const desiredJump = player.jumpStrength; // negative value
        const maxJumpDistance = Math.abs(desiredJump);

        if (availableSpace < maxJumpDistance * 1.1) {
            // Reduce the jump to fit available space but always keep a minimal jump
            const safeJump = -Math.max(8, availableSpace * 0.9);
            player.velocityY = safeJump;
        } else {
            player.velocityY = desiredJump;
        }
    }
}

function drawPlayer() {
    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
}

// *****************************************************************************************
// OBSTACLES
// *****************************************************************************************

function generateObstacles(isInfinite) {
    levelObstacles = [];
    let difficulty = isInfinite ? 1 + Math.floor(score/500)*0.2 : 1 + (currentLevel-1)*0.15;
    let maxDist = isInfinite ? 999999999 : 800 + currentLevel * 100;

    let x = canvas.width * 0.6;
    let total = 0;

    const baseH = player.height * 1.05;
    const tallH = player.height * 2.0 + difficulty * 4;
    const maxW = player.width * 2.0; // slightly reduced width to balance spacing
    const minGap = Math.max(player.width * 1.8, 48); // increase min gap for smoother clearance

    while (total < maxDist) {
        const gap = Math.max(minGap, 320 - difficulty * 40 + Math.random() * 80); // slightly denser but reasonable
        x += gap;

        const w = Math.min(maxW, baseH * 0.7 + difficulty * 8 + Math.random() * 18);
        const h = Math.random() < 0.25 ? tallH + difficulty * 6 : baseH;

        levelObstacles.push({
            x: x,
            y: canvas.height - groundHeight - h,
            width: w,
            height: h
        });

        x += w;
        total = x;
    }
}

function updateObstacles(delta) {
    // FINAL tuned forward speed for smooth GD feel
    const baseSpeed = gameState === 'LEVEL' ? 330 : 340;
    const speedUp = (gameState === 'INFINITE') ? Math.floor(score / 100) * 5 : 0;
    const scroll = baseSpeed + speedUp;
    const dx = scroll * delta;

    // Player collision box
    const pX = player.x + player.width * player.hitboxOffsetX;
    const pY = player.y + player.height * player.hitboxOffsetY;
    const pW = player.width * player.hitboxWidthScale;
    const pH = player.height * player.hitboxHeightScale;

    let levelDone = false;

    for (let i = 0; i < levelObstacles.length; i++) {
        const o = levelObstacles[i];
        o.x -= dx;

        // AABB collision
        if (
            pX < o.x + o.width &&
            pX + pW > o.x &&
            pY < o.y + o.height &&
            pY + pH > o.y
        ) {
            resetGame();
            return;
        }

        // level completion
        if (gameState === 'LEVEL' && o.x < -o.width && i === levelObstacles.length - 1) {
            levelDone = true;
        }
    }

    if (levelDone) {
        gameState = 'LEVEL_COMPLETE';
        resetPlayerAndObstacles();
        currentLevel++;
    }

    // Remove off-screen obstacles periodically to keep array small
    if (levelObstacles.length > 0 && levelObstacles[0].x + levelObstacles[0].width < -1000) {
        // drop distant negative items
        levelObstacles = levelObstacles.filter(o => o.x + o.width > -1000);
    }
}

function drawObstacles() {
    ctx.fillStyle = '#ff0000';
    levelObstacles.forEach(o => {
        ctx.fillRect(o.x, o.y, o.width, o.height);
    });
}

// *****************************************************************************************
// GAME UPDATE + RENDER
// *****************************************************************************************

function updateGame(delta) {
    updatePlayer();
    updateObstacles(delta);
}

function drawGame() {
    drawPlayer();
    drawObstacles();

    // Debug: draw hitbox if needed
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

// *****************************************************************************************
// GAME STATE HANDLING
// *****************************************************************************************

function resetGame() {
    previousGameState = gameState;
    player.velocityY = 0;
    player.isGrounded = true;
    gameState = 'GAME_OVER';
}

// *****************************************************************************************
// UI SCREENS
// *****************************************************************************************

function drawButton(btn) {
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(btn.x, btn.y, btn.width, btn.height);

    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(btn.text, btn.x + btn.width / 2, btn.y + btn.height / 2 + 7);
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
        const b = menuButtons['level_' + i];
        ctx.fillStyle = i <= currentLevel ? '#4CAF50' : '#888';
        ctx.fillRect(b.x, b.y, b.width, b.height);

        ctx.fillStyle = '#fff';
        ctx.fillText(i, b.x + b.width / 2, b.y + b.height / 2 + 5);
    }
}

function drawLevelIndicator() {
    ctx.fillStyle = '#000';
    ctx.font = '20px Arial';
    ctx.fillText(`Level: ${currentLevel}`, 10, 30);
}

function updateScore(delta) {
    score += 250 * delta;
}

function drawScore() {
    ctx.fillStyle = '#000';
    ctx.font = '20px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Score: ${score.toFixed(0)}`, canvas.width - 10, 30);
}

function drawGameOverScreen() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
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
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL COMPLETE!', canvas.width / 2, canvas.height / 2 - 80);

    ctx.font = '24px Arial';
    ctx.fillText(`You Cleared Level ${currentLevel - 1}!`, canvas.width / 2, canvas.height / 2 - 30);

    drawButton(menuButtons.levelCompleteMenu);
    drawButton(menuButtons.levelCompleteLevels);
}

// *****************************************************************************************
// INPUT HANDLING
// *****************************************************************************************

function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (gameState === 'MENU') {
        if (isButtonClicked(menuButtons.levels, x, y)) gameState = 'LEVEL_SELECT';
        else if (isButtonClicked(menuButtons.infinite, x, y)) {
            score = 0;
            resetPlayerAndObstacles();
            generateObstacles(true);
            gameState = 'INFINITE';
        }
    } else if (gameState === 'LEVEL_SELECT') {
        if (isButtonClicked(menuButtons.back, x, y)) gameState = 'MENU';
        else {
            for (let i = 1; i <= 50; i++) {
                const b = menuButtons['level_' + i];
                if (isButtonClicked(b, x, y)) {
                    currentLevel = i;
                    resetPlayerAndObstacles();
                    generateObstacles(false);
                    gameState = 'LEVEL';
                    break;
                }
            }
        }
    } else if (gameState === 'GAME_OVER') {
        if (isButtonClicked(menuButtons.gameOverMenu, x, y)) {
            resetPlayerAndObstacles();
            score = 0;
            gameState = 'MENU';
        } else if (isButtonClicked(menuButtons.gameOverRetry, x, y)) {
            resetPlayerAndObstacles();
            if (previousGameState === 'INFINITE') {
                score = 0;
                generateObstacles(true);
                gameState = 'INFINITE';
            } else {
                generateObstacles(false);
                gameState = 'LEVEL';
            }
        }
    } else if (gameState === 'LEVEL_COMPLETE') {
        if (isButtonClicked(menuButtons.levelCompleteMenu, x, y)) {
            gameState = 'MENU';
            score = 0;
        } else if (isButtonClicked(menuButtons.levelCompleteLevels, x, y)) {
            gameState = 'LEVEL_SELECT';
        }
    }
}

function isButtonClicked(btn, x, y) {
    if (!btn) return false;
    return (x >= btn.x && x <= btn.x + btn.width && y >= btn.y && y <= btn.y + btn.height);
}

function handleKeyInput(e) {
    if ((gameState === 'LEVEL' || gameState === 'INFINITE') && (e.code === 'Space' || e.code === 'ArrowUp')) {
        jump();
    }
}
