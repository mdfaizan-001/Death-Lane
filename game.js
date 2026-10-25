const startScreen = document.getElementById("startScreen");
const gameScreen = document.getElementById("gameScreen");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const gameOverScreen = document.getElementById("gameOverScreen");
const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("highScore");
const finalScoreEl = document.getElementById("finalScore");
const newHighScoreText = document.getElementById("newHighScoreText");
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
let gameRunning = false;
let currentSpeed = 5;
let score = 0;
let highScore = localStorage.getItem("death_lane_highscore") || 0;
let roadOffsetY = 0;
let speedTimer = null;
let particles = [];
highScoreEl.innerText = highScore;
// Player Car Configuration
const player = {
  x: canvas.width / 2 - 18,
  y: canvas.height - 100,
  width: 36,
  height: 64,
  speed: 6.5,
  dx: 0,
  color: "#ff2a3b"
};
let traffic = [];
const carColors = ["#00d2ff", "#ffb703", "#06d6a0", "#9d4edd", "#e0e1dd"];
// --- AUDIO SYNTHESIZER ---
let audioCtx = null;
let engineOsc = null;
let engineGain = null;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}
function startEngineSound() {
  initAudio();
  stopEngineSound();
  engineOsc = audioCtx.createOscillator();
  engineGain = audioCtx.createGain();
  engineOsc.type = "sawtooth";
  engineOsc.frequency.setValueAtTime(55, audioCtx.currentTime);
  engineGain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  engineOsc.connect(engineGain);
  engineGain.connect(audioCtx.destination);
  engineOsc.start();
}
function updateEnginePitch() {
  if (engineOsc && audioCtx) {
    let freq = 55 + (currentSpeed - 5) * 12;
    engineOsc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.1);
  }
}
function stopEngineSound() {
  if (engineOsc) {
    try {
      engineOsc.stop();
      engineOsc.disconnect();
    } catch(e) {}
    engineOsc = null;
  }
}
function playStartSound() {
  initAudio();
  let osc = audioCtx.createOscillator();
  let gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(220, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.4);
  gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.4);
}
function playCrashSound() {
  initAudio();
  let bufferSize = audioCtx.sampleRate * 0.6;
  let buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  let data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  let noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  let filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(800, audioCtx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.6);
  let gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start();
}
// --- CONTROLS ---
startBtn.addEventListener("click", () => {
  startScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  startGame();
});
restartBtn.addEventListener("click", () => {
  gameOverScreen.classList.add("hidden");
  startGame();
});
document.addEventListener("keydown", (e) => {
  if (!gameRunning) return;
  if (e.key === "ArrowLeft" || e.key === "a") player.dx = -player.speed;
  if (e.key === "ArrowRight" || e.key === "d") player.dx = player.speed;
});
document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "a" || e.key === "d") {
    player.dx = 0;
  }
});
// Mobile Controls
leftBtn.addEventListener("touchstart", (e) => { e.preventDefault(); player.dx = -player.speed; });
leftBtn.addEventListener("touchend", () => { player.dx = 0; });
rightBtn.addEventListener("touchstart", (e) => { e.preventDefault(); player.dx = player.speed; });
rightBtn.addEventListener("touchend", () => { player.dx = 0; });
leftBtn.addEventListener("mousedown", () => { player.dx = -player.speed; });
leftBtn.addEventListener("mouseup", () => { player.dx = 0; });
rightBtn.addEventListener("mousedown", () => { player.dx = player.speed; });
rightBtn.addEventListener("mouseup", () => { player.dx = 0; });
// --- GAME CORE ---
function startGame() {
  traffic = [];
  particles = [];
  score = 0;
  currentSpeed = 5;
  scoreEl.innerText = score;
  player.x = canvas.width / 2 - player.width / 2;
  player.dx = 0;
  gameRunning = true;
  playStartSound();
  startEngineSound();
  if (speedTimer) clearInterval(speedTimer);
  speedTimer = setInterval(() => {
    if (gameRunning) {
      currentSpeed += 0.8;
      updateEnginePitch();
    }
  }, 10000);

  gameLoop();
}
function spawnTraffic() {
  const lanes = [20, 100, 180, 260];
  const randomLane = lanes[Math.floor(Math.random() * lanes.length)];
  const randomColor = carColors[Math.floor(Math.random() * carColors.length)];
  const tooClose = traffic.some(car => car.x === randomLane && car.y < 120);
  if (!tooClose) {
    traffic.push({
      x: randomLane,
      y: -80,
      width: 36,
      height: 64,
      speed: currentSpeed - (Math.random() * 1.5),
      color: randomColor
    });
  }
}
function update() {
  if (!gameRunning) return;
  roadOffsetY += currentSpeed;
  if (roadOffsetY > 40) roadOffsetY = 0;
  player.x += player.dx;
  if (player.x < 12) player.x = 12;
  if (player.x + player.width > canvas.width - 12) player.x = canvas.width - 12 - player.width;
  if (Math.random() < 0.6) {
    particles.push({
      x: player.x + player.width / 2 + (Math.random() * 6 - 3),
      y: player.y + player.height,
      size: Math.random() * 3 + 2,
      vy: currentSpeed * 0.5,
      alpha: 0.8
    });
  }
  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    p.y += p.vy;
    p.alpha -= 0.04;
    if (p.alpha <= 0) {
      particles.splice(i, 1);
      i--;
    }
  }
  if (Math.random() < 0.028) {
    spawnTraffic();
  }
  for (let i = 0; i < traffic.length; i++) {
    let car = traffic[i];
    car.y += currentSpeed;
    if (
      player.x < car.x + car.width - 4 &&
      player.x + player.width > car.x + 4 &&
      player.y < car.y + car.height - 4 &&
      player.y + player.height > car.y + 4
    ) {
      endGame();
    }
    if (car.y > canvas.height) {
      traffic.splice(i, 1);
      score += 10;
      scoreEl.innerText = score;
      i--;
    }
  }
}
function drawRoad() {
  ctx.fillStyle = "#22222b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#d00000";
  ctx.fillRect(0, 0, 10, canvas.height);
  ctx.fillRect(canvas.width - 10, 0, 10, canvas.height);
  ctx.fillStyle = "#ffffff";
  for (let y = (roadOffsetY % 20) - 20; y < canvas.height; y += 20) {
    ctx.fillRect(0, y, 10, 10);
    ctx.fillRect(canvas.width - 10, y, 10, 10);
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 3;
  ctx.setLineDash([25, 25]);
  ctx.lineDashOffset = -roadOffsetY;
  for (let x of [90, 170, 250]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}
function drawCar(car, isPlayer = false) {
  if (isPlayer) {
    let beamGrad = ctx.createLinearGradient(0, car.y, 0, car.y - 100);
    beamGrad.addColorStop(0, "rgba(255, 255, 255, 0.35)");
    beamGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(car.x + 4, car.y);
    ctx.lineTo(car.x - 12, car.y - 100);
    ctx.lineTo(car.x + car.width + 12, car.y - 100);
    ctx.lineTo(car.x + car.width - 4, car.y);
    ctx.closePath();
    ctx.fill();
  }
  let bodyGrad = ctx.createLinearGradient(car.x, car.y, car.x + car.width, car.y);
  bodyGrad.addColorStop(0, car.color);
  bodyGrad.addColorStop(0.5, "#ffffff");
  bodyGrad.addColorStop(1, car.color);
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(car.x, car.y, car.width, car.height);
  ctx.fillStyle = "#111116";
  ctx.fillRect(car.x + 3, car.y + 14, car.width - 6, 18);
  ctx.fillRect(car.x + 3, car.y + 44, car.width - 6, 10);
  ctx.fillStyle = car.color;
  ctx.fillRect(car.x - 2, car.y + 18, 2, 6);
  ctx.fillRect(car.x + car.width, car.y + 18, 2, 6);
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(car.x - 2, car.y + 9, 2, 12);
  ctx.fillRect(car.x + car.width, car.y + 9, 2, 12);
  ctx.fillRect(car.x - 2, car.y + 43, 2, 12);
  ctx.fillRect(car.x + car.width, car.y + 43, 2, 12);
  if (isPlayer) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(car.x + 2, car.y + 1, 6, 3);
    ctx.fillRect(car.x + car.width - 8, car.y + 1, 6, 3);
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(car.x + 2, car.y + car.height - 2, 6, 2);
    ctx.fillRect(car.x + car.width - 8, car.y + car.height - 2, 6, 2);
  } else {
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(car.x + 2, car.y + car.height - 3, 6, 3);
    ctx.fillRect(car.x + car.width - 8, car.y + car.height - 3, 6, 3);
  }
}
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawRoad();
  particles.forEach(p => {
    ctx.fillStyle = `rgba(200, 200, 200, ${p.alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  drawCar(player, true);
  traffic.forEach(car => drawCar(car, false));
}
function gameLoop() {
  if (!gameRunning) return;
  update();
  draw();
  requestAnimationFrame(gameLoop);
}
function endGame() {
  gameRunning = false;
  stopEngineSound();
  playCrashSound();
  clearInterval(speedTimer);
  finalScoreEl.innerText = score;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("death_lane_highscore", highScore);
    highScoreEl.innerText = highScore;
    newHighScoreText.classList.remove("hidden");
  } else {
    newHighScoreText.classList.add("hidden");
  }
  gameOverScreen.classList.remove("hidden");
}
