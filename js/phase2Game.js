/* ON RED · FASE 2
 * Runtime isolado para playtest.
 * Reutiliza padrões visuais da Fase 1, com regras próprias da Fase 2.
 * REGRA ZERO: nenhum arquivo ou sistema da Fase 1 é alterado.
 */
(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");

  const TUNING = Object.freeze({
    maxHP: 80,
    startingLives: 1,
    maxLives: 4,
    energyPerZone: 25,
    maxEnergy: 100,
    dashCost: 25,
    dashDuration: 0.22,
    dashCooldown: 1.15,
    playerSpeed: 245,
    playerRadius: 12,
    initialSaws: 6,
    maxSaws: 10,
    sawRadius: 22,
    sawDamage: 20,
    laserWarning: 0.95,
    laserActive: 0.78,
    laserInterval: 4.35,
    laserDamage: 20,
    laserGap: 100,
    mergeHeal: 25,
    mergeScore: 1000,
    mergeInterval: 7,
    bossTriggerSeconds: 105,
    bossHP: 1200,
    bossDashDamage: 200,
    bossNormalDashDamage: 40,
    chargedDashReach: 48,
    bossDashWarning: 0.85,
    bossDashCooldown: 3.8,
    bossDashSpeed: 1050,
    bossKnockback: 720,
    sawKnockback: 420,
    gravityDuration: 5,
    ghostDuration: 5,
    inversionDuration: 3,
    freezeDuration: 3,
    pingPongDamage: 50,
    pingPongSpeed: 2600
  });

  const keys = new Set();
  const hasTouchInput = typeof navigator !== "undefined" &&
    (navigator.maxTouchPoints > 0 || "ontouchstart" in window);
  const joystick = {
    baseX: 115, baseY: 0, knobX: 115, knobY: 0,
    radius: 55, knobRadius: 22, x: 0, y: 0,
    active: false, pointerId: null, side: "left"
  };
  const button = { size: 64, margin: 28, x: 0, y: 0, flash: 0 };
  const ui = {
    mainMenu: document.getElementById("mainMenu"),
    pauseButton: document.getElementById("pauseButton"),
    pauseScreen: document.getElementById("pauseScreen"),
    resumeButton: document.getElementById("resumeButton"),
    pauseRestartButton: document.getElementById("pauseRestartButton"),
    pauseMenuButton: document.getElementById("pauseMenuButton"),
    gameOverScreen: document.getElementById("gameOverScreen"),
    finalScore: document.getElementById("finalScore"),
    bestScoreGameOver: document.getElementById("bestScoreGameOver"),
    reviveButton: document.getElementById("reviveButton"),
    reviveUnavailable: document.getElementById("reviveUnavailable"),
    retryButton: document.getElementById("retryButton"),
    gameOverMenuButton: document.getElementById("gameOverMenuButton"),
    victoryScreen: document.getElementById("victoryScreen"),
    victoryFinalScore: document.getElementById("victoryFinalScore"),
    victoryBestScore: document.getElementById("victoryBestScore"),
    victoryRetryButton: document.getElementById("victoryRetryButton"),
    victoryMenuButton: document.getElementById("victoryMenuButton")
  };
  const state = {
    active: false, paused: false, over: false, victory: false,
    time: 0, score: 0, hp: TUNING.maxHP, lives: TUNING.startingLives,
    energy: 0, dashCooldown: 0, dashTime: 0, dashCharged: false, bossDashHit: false,
    effects: { gravity: 0, ghost: 0, invert: 0, freeze: 0 },
    gravityPoint: null, pingPongs: [],
    invuln: 0, x: 0, y: 0, vx: 0, vy: 0, knockbackTime: 0, dashEffectRolled: false, shieldHitsRemaining: 0, last: 0,
    saws: [], zones: [], merges: [], lasers: [], laserTimer: 3.2,
    sawSpawnTimer: 0, sawRestTimer: 0, zoneTimer: 1, mergeTimer: 3,
    boss: null, pointer: null, pointerId: null,
    revivesUsed: 0, bossDefeated: false, postBoss: false,
    gameOverShown: false, victoryShown: false,
    message: "", messageTimer: 0, best: 0
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const circleHit = (a, ar, b, br) => dist(a, b) <= ar + br;

  function updateJoystickPosition() {
    let side = "left";
    try { side = localStorage.getItem("onRedJoystickSide") === "right" ? "right" : "left"; } catch (_) {}
    joystick.side = side;
    joystick.baseX = side === "right" ? innerWidth - 115 : 115;
    joystick.baseY = innerHeight - 115;
    if (!joystick.active) {
      joystick.knobX = joystick.baseX;
      joystick.knobY = joystick.baseY;
    }
  }

  function updateButtonPosition() {
    button.x = joystick.side === "right"
      ? button.margin
      : innerWidth - button.margin - button.size;
    button.y = innerHeight - button.margin - button.size;
  }

  function getCanvasPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (innerWidth / (rect.width || innerWidth)),
      y: (event.clientY - rect.top) * (innerHeight / (rect.height || innerHeight))
    };
  }

  function updateJoystick(event) {
    const pos = getCanvasPosition(event);
    const dx = pos.x - joystick.baseX;
    const dy = pos.y - joystick.baseY;
    const distance = Math.hypot(dx, dy);
    const limitedDistance = Math.min(distance, joystick.radius);
    if (distance > 0) {
      const angle = Math.atan2(dy, dx);
      joystick.knobX = joystick.baseX + Math.cos(angle) * limitedDistance;
      joystick.knobY = joystick.baseY + Math.sin(angle) * limitedDistance;
      const strength = Math.min(distance / joystick.radius, 1);
      joystick.x = (dx / distance) * strength;
      joystick.y = (dy / distance) * strength;
    } else {
      joystick.x = 0;
      joystick.y = 0;
      joystick.knobX = joystick.baseX;
      joystick.knobY = joystick.baseY;
    }
  }

  function resetJoystick() {
    const activePointerId = joystick.pointerId;
    if (activePointerId !== null &&
        typeof canvas.hasPointerCapture === "function" &&
        canvas.hasPointerCapture(activePointerId)) {
      try { canvas.releasePointerCapture(activePointerId); } catch (_) {}
    }
    joystick.x = 0;
    joystick.y = 0;
    joystick.knobX = joystick.baseX;
    joystick.knobY = joystick.baseY;
    joystick.active = false;
    joystick.pointerId = null;
  }

  function reset() {
    state.active = true;
    state.paused = false;
    state.over = false;
    state.victory = false;
    state.revivesUsed = 0;
    state.bossDefeated = false;
    state.postBoss = false;
    state.gameOverShown = false;
    state.victoryShown = false;
    state.time = 0;
    state.score = 0;
    state.hp = TUNING.maxHP;
    state.lives = TUNING.startingLives;
    state.energy = 0;
    state.effects = { gravity: 0, ghost: 0, invert: 0, freeze: 0 };
    state.gravityPoint = null;
    state.pingPongs = [];
    state.dashCooldown = 0;
    state.dashTime = 0;
    state.dashCharged = false;
    state.bossDashHit = false;
    state.invuln = 1.2;
    state.shieldHitsRemaining = 0;
    state.x = innerWidth / 2;
    state.y = innerHeight / 2;
    state.vx = 0;
    state.vy = 0;
    state.knockbackTime = 0;
    state.saws = [];
    state.zones = [];
    state.merges = [];
    state.lasers = [];
    state.laserTimer = 3.2;
    state.sawSpawnTimer = 0;
    state.sawRestTimer = 0;
    state.zoneTimer = 1;
    state.mergeTimer = 3;
    state.boss = null;
    state.pointer = null;
    state.pointerId = null;
    resetJoystick();
    state.message = "CARREGUE ENERGIA. SOBREVIVA.";
    state.messageTimer = 2.5;
    button.flash = 0;
    updateButtonPosition();
    for (let i = 0; i < TUNING.initialSaws; i++) spawnSaw();
    try {
      state.best = Number(localStorage.getItem("onRedPhase2Best") || 0) || 0;
    } catch (_) {
      state.best = 0;
    }
    state.last = 0;
    hideScreen(ui.pauseScreen);
    hideScreen(ui.gameOverScreen);
    hideScreen(ui.victoryScreen);
    if (ui.pauseButton) ui.pauseButton.style.display = "flex";
    updateReviveOffer();
  }

  function hideScreen(element) {
    if (!element) return;
    element.classList.remove("active");
    element.setAttribute("aria-hidden", "true");
  }

  function showScreen(element) {
    if (!element) return;
    element.classList.add("active");
    element.setAttribute("aria-hidden", "false");
  }

  function hideAllScreens() {
    hideScreen(ui.pauseScreen);
    hideScreen(ui.gameOverScreen);
    hideScreen(ui.victoryScreen);
  }

  function saveBestScore() {
    const score = Math.floor(state.score);
    if (score <= state.best) return;
    state.best = score;
    try { localStorage.setItem("onRedPhase2Best", String(score)); } catch (_) {}
  }

  function updateReviveOffer() {
    const available = state.revivesUsed < 1 ||
      (state.bossDefeated && state.revivesUsed < 2);
    if (ui.reviveButton) {
      ui.reviveButton.hidden = !available;
      ui.reviveButton.textContent = state.revivesUsed === 0
        ? "REVIVER GRATUITAMENTE"
        : "REVIVER · 2ª CHANCE";
    }
    if (ui.reviveUnavailable) {
      ui.reviveUnavailable.hidden = available;
      ui.reviveUnavailable.textContent = state.bossDefeated
        ? "AS DUAS CONTINUAÇÕES FORAM UTILIZADAS · FIM DE JOGO"
        : "CONTINUAÇÃO UTILIZADA · VENÇA O BOSS PARA DESBLOQUEAR A SEGUNDA";
    }
  }

  function triggerGameOver() {
    if (state.gameOverShown) return;
    state.gameOverShown = true;
    resetJoystick();
    saveBestScore();
    updateReviveOffer();
    if (ui.pauseButton) ui.pauseButton.style.display = "none";
    hideScreen(ui.pauseScreen);
    if (ui.finalScore) ui.finalScore.textContent = String(Math.floor(state.score)).padStart(6, "0");
    if (ui.bestScoreGameOver) ui.bestScoreGameOver.textContent = String(state.best).padStart(6, "0");
    showScreen(ui.gameOverScreen);
    if (window.ONREDAudio) {
      window.ONREDAudio.stopMusic();
      window.ONREDAudio.play("gameOver");
    }
    if (window.ONREDPlaygama &&
        typeof window.ONREDPlaygama.showInterstitialAtNaturalBreak === "function") {
      window.ONREDPlaygama.showInterstitialAtNaturalBreak();
    }
  }

  function triggerVictory() {
    if (state.victoryShown) return;
    state.victoryShown = true;
    saveBestScore();
    if (ui.pauseButton) ui.pauseButton.style.display = "none";
    hideScreen(ui.pauseScreen);
    if (ui.victoryFinalScore) ui.victoryFinalScore.textContent = String(Math.floor(state.score)).padStart(6, "0");
    if (ui.victoryBestScore) ui.victoryBestScore.textContent = String(state.best).padStart(6, "0");
    const label = ui.victoryScreen?.querySelector(".game-over-label");
    const title = ui.victoryScreen?.querySelector(".victory-title");
    const copy = ui.victoryScreen?.querySelector(".victory-copy strong");
    if (label) label.textContent = "FASE 2 CONCLUÍDA";
    if (title) title.textContent = "VOCÊ DERROTOU A SERRA GIGANTE.";
    if (copy) copy.textContent = "FASE 3 DESBLOQUEADA · CONTINUE A SOBREVIVÊNCIA";
    showScreen(ui.victoryScreen);
    if (window.ONREDAudio) {
      window.ONREDAudio.stopMusic();
      window.ONREDAudio.play("victory");
    }
  }

  function pauseGame() {
    if (!state.active || state.paused || state.over || state.victory) return false;
    state.paused = true;
    keys.clear();
    resetJoystick();
    state.vx = 0;
    state.vy = 0;
    state.last = 0;
    if (ui.pauseButton) ui.pauseButton.style.display = "none";
    showScreen(ui.pauseScreen);
    if (window.ONREDAudio && typeof window.ONREDAudio.pauseMusic === "function") {
      window.ONREDAudio.pauseMusic();
    }
    return true;
  }

  function resumeGame() {
    if (!state.active || !state.paused) return false;
    state.paused = false;
    keys.clear();
    resetJoystick();
    state.vx = 0;
    state.vy = 0;
    state.last = 0;
    hideScreen(ui.pauseScreen);
    if (ui.pauseButton) ui.pauseButton.style.display = "flex";
    if (window.ONREDAudio && typeof window.ONREDAudio.resumeMusic === "function") {
      window.ONREDAudio.resumeMusic();
    }
    return true;
  }

  function reviveGame() {
    const available = state.revivesUsed < 1 ||
      (state.bossDefeated && state.revivesUsed < 2);
    if (!state.active || !state.over || !available) return false;
    state.revivesUsed += 1;
    state.over = false;
    state.gameOverShown = false;
    state.paused = false;
    state.lives = 1;
    state.hp = Math.min(50, TUNING.maxHP);
    state.invuln = 2;
    state.x = clamp(innerWidth / 2, TUNING.playerRadius, innerWidth - TUNING.playerRadius);
    state.y = clamp(innerHeight / 2, TUNING.playerRadius, innerHeight - TUNING.playerRadius);
    state.vx = 0;
    state.vy = 0;
    state.knockbackTime = 0;
    resetJoystick();
    state.dashTime = 0;
    keys.clear();
    state.last = 0;
    updateReviveOffer();
    hideScreen(ui.gameOverScreen);
    if (ui.pauseButton) ui.pauseButton.style.display = "flex";
    if (window.ONREDAudio) {
      window.ONREDAudio.play("revive");
      window.ONREDAudio.playMusic(state.boss && state.bossDefeated ? "boss" : "gameplay");
    }
    return true;
  }

  function continueAfterBoss() {
    if (!state.active || !state.victory || !state.bossDefeated) return false;
    state.victory = false;
    state.victoryShown = false;
    state.postBoss = true;
    state.boss = null;
    state.saws = [];
    state.lasers = [];
    state.pingPongs = [];
    state.sawRestTimer = 4;
    state.sawSpawnTimer = 0;
    state.laserTimer = 2.5;
    state.invuln = 1.5;
    state.last = 0;
    hideScreen(ui.victoryScreen);
    updateReviveOffer();
    if (window.ONREDAudio) window.ONREDAudio.playMusic("gameplay");
    return true;
  }

  function exit() {
    state.active = false;
    state.paused = false;
    keys.clear();
    resetJoystick();
    state.vx = 0;
    state.vy = 0;
    hideAllScreens();
    if (ui.pauseButton) ui.pauseButton.style.display = "none";
    if (window.ONREDAudio && typeof window.ONREDAudio.stopMusic === "function") {
      window.ONREDAudio.stopMusic();
    }
    if (ui.mainMenu) ui.mainMenu.classList.remove("hidden");
  }

  function spawnSaw() {
    const side = Math.floor(Math.random() * 4);
    const pad = TUNING.sawRadius + 8;
    const x = side === 0 ? pad : side === 1 ? innerWidth - pad : rand(pad, innerWidth - pad);
    const y = side === 2 ? pad : side === 3 ? innerHeight - pad : rand(pad, innerHeight - pad);
    state.saws.push({
      x, y, r: TUNING.sawRadius + rand(-2, 3),
      angle: rand(0, Math.PI * 2), speed: rand(58, 86), hp: 1, stun: 0
    });
  }

  function desiredSawCount() {
    if (state.time >= 48) return TUNING.maxSaws;
    if (state.time >= 22) return 8;
    return TUNING.initialSaws;
  }

  function spawnZone() {
    const margin = 48;
    state.zones.push({
      x: rand(margin, Math.max(margin, innerWidth - margin)),
      y: rand(85, Math.max(85, innerHeight - 75)),
      r: 22, life: 10, pulse: rand(0, 6.28)
    });
    if (state.zones.length > 4) state.zones.shift();
  }

  function spawnMerge() {
    const margin = 45;
    state.merges.push({
      x: rand(margin, Math.max(margin, innerWidth - margin)),
      y: rand(80, Math.max(80, innerHeight - 55)),
      r: 9, life: 13, pulse: rand(0, 6.28)
    });
    if (state.merges.length > 3) state.merges.shift();
  }

  function spawnLaser() {
    const maxLasers = state.time >= 55 ? 3 : state.time >= 20 ? 2 : 1;
    if (state.lasers.length >= maxLasers) return;
    const moving = Math.hypot(state.vx, state.vy) > 35;
    const leadTime = 0.62;
    const projectedX = clamp(state.x + (moving ? state.vx * leadTime : 0), 24, innerWidth - 24);
    const projectedY = clamp(state.y + (moving ? state.vy * leadTime : 0), 24, innerHeight - 24);
    // O feixe aparece à frente do deslocamento dominante do jogador.
    const axis = moving
      ? (Math.abs(state.vx) >= Math.abs(state.vy) ? "v" : "h")
      : (Math.random() < 0.5 ? "h" : "v");
    const span = axis === "h" ? innerWidth : innerHeight;
    const at = axis === "h"
      ? clamp(projectedY, 70, innerHeight - 70)
      : clamp(projectedX, 70, innerWidth - 70);
    // A brecha fica deslocada da trajetória prevista, exigindo uma mudança de rota.
    const safeOffset = Math.min(175, span * 0.22);
    const side = Math.random() < 0.5 ? -1 : 1;
    const projectedAlong = axis === "h" ? projectedX : projectedY;
    const gapCenter = clamp(projectedAlong + safeOffset * side, 55, span - 55);
    state.lasers.push({
      axis, at, gapCenter, gap: TUNING.laserGap,
      phase: "warning", t: TUNING.laserWarning,
      id: Math.random().toString(36).slice(2)
    });
  }

  function activateRandomEffect() {
    // 10% para o efeito negativo raro. Os outros 90% são divididos entre os cinco efeitos escolhidos.
    const roll = Math.random();
    if (roll < 0.10) {
      const side = Math.floor(Math.random() * 4);
      const targetX = state.x, targetY = state.y;
      let x = 0, y = 0;
      if (side === 0) { x = -18; y = rand(0, innerHeight); }
      else if (side === 1) { x = innerWidth + 18; y = rand(0, innerHeight); }
      else if (side === 2) { x = rand(0, innerWidth); y = -18; }
      else { x = rand(0, innerWidth); y = innerHeight + 18; }
      const dx = targetX - x, dy = targetY - y;
      const length = Math.hypot(dx, dy) || 1;
      state.pingPongs.push({ x, y, vx: dx / length * TUNING.pingPongSpeed,
        vy: dy / length * TUNING.pingPongSpeed, r: 9, life: 2.5 });
      state.message = "PING PONG FANTASMA · PERIGO";
      state.messageTimer = 1.4;
      return "pingpong";
    }

    const effects = ["gravity", "ghost", "invert", "freeze"];
    const chosen = effects[Math.floor(Math.random() * effects.length)];
    if (chosen === "gravity") {
      state.effects.gravity = TUNING.gravityDuration;
      state.gravityPoint = { x: rand(innerWidth * 0.25, innerWidth * 0.75),
        y: rand(innerHeight * 0.25, innerHeight * 0.75) };
      state.message = "GRAVIDADE · SERRAS ATRAÍDAS";
    } else if (chosen === "ghost") {
      state.effects.ghost = TUNING.ghostDuration;
      state.message = "FANTASMA · SERRAS NÃO CAUSAM DANO";
    } else if (chosen === "invert") {
      state.effects.invert = TUNING.inversionDuration;
      state.message = "INVERSÃO · CONTROLES ALTERADOS";
    } else if (chosen === "freeze") {
      state.effects.freeze = TUNING.freezeDuration;
      state.message = "TEMPO CONGELADO";
    }
    state.messageTimer = 1.4;
    return chosen;
  }

  function segmentDistanceSquared(px, py, ax, ay, bx, by) {
    const abx = bx - ax, aby = by - ay;
    const lengthSq = abx * abx + aby * aby;
    const t = lengthSq > 0 ? clamp(((px - ax) * abx + (py - ay) * aby) / lengthSq, 0, 1) : 0;
    const dx = px - (ax + abx * t), dy = py - (ay + aby * t);
    return dx * dx + dy * dy;
  }

  function updatePingPongs(dt) {
    if (state.effects.freeze > 0) return;
    for (const ball of state.pingPongs) {
      const oldX = ball.x, oldY = ball.y;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.life -= dt;
      const hitRadius = ball.r + TUNING.playerRadius;
      if (segmentDistanceSquared(state.x, state.y, oldX, oldY, ball.x, ball.y) <= hitRadius * hitRadius) {
        damage(TUNING.pingPongDamage, "PING PONG FANTASMA · -50 HP", true);
        ball.life = 0;
      }
    }
    state.pingPongs = state.pingPongs.filter(ball => ball.life > 0 &&
      ball.x > -40 && ball.x < innerWidth + 40 && ball.y > -40 && ball.y < innerHeight + 40);
  }

  function damage(amount, message = "IMPACTO", bypassInvulnerability = false) {
    if ((!bypassInvulnerability && state.invuln > 0) || state.over || state.victory || amount <= 0) return false;
    if (state.shieldHitsRemaining > 0) {
      state.shieldHitsRemaining -= 1;
      state.invuln = 0.9;
      state.message = state.shieldHitsRemaining > 0
        ? "ESCUDO · " + state.shieldHitsRemaining + "/3 GOLPES"
        : "ESCUDO DESTRUÍDO";
      state.messageTimer = 0.9;
      return true;
    }
    state.hp = Math.max(0, state.hp - amount);
    state.invuln = 0.9;
    state.message = message;
    state.messageTimer = 0.65;
    if (state.hp <= 0) {
      state.lives = Math.max(0, state.lives - 1);
      if (state.lives <= 0) {
        state.over = true;
        state.message = "GAME OVER";
        triggerGameOver();
      } else {
        state.hp = TUNING.maxHP;
        state.invuln = 1.8;
        // A perda de uma vida não teleporta o jogador: preserva a posição
        // exata do impacto e interrompe somente o movimento.
        state.vx = 0;
        state.vy = 0;
        state.knockbackTime = 0;
        resetJoystick();
        keys.clear();
        state.dashTime = 0;
        state.dashCharged = false;
        state.dashCooldown = 0;
        state.energy = 0;
        state.last = 0;
        state.message = "VIDA PERDIDA";
        state.messageTimer = 1.5;
      }
    }
    return true;
  }

  function startDash() {
    if (!state.active || state.paused || state.over || state.victory ||
        state.dashCooldown > 0 || state.energy < TUNING.dashCost) return false;

    state.dashCharged = state.energy >= TUNING.maxEnergy;
    state.bossDashHit = false;
    state.energy = Math.max(0, state.energy - TUNING.dashCost);
    state.dashTime = TUNING.dashDuration;
    state.dashCooldown = TUNING.dashCooldown;
    button.flash = 0.25;

    // O DASH cancela o empurrão recebido: não reutiliza a velocidade do knockback.
    const wasKnockedBack = state.knockbackTime > 0;
    state.knockbackTime = 0;
    state.dashEffectRolled = false;
    if (wasKnockedBack) {
      state.vx = 0;
      state.vy = 0;
    }
    const length = Math.hypot(state.vx, state.vy);
    if (length > 0) {
      state.vx = state.vx / length * 760;
      state.vy = state.vy / length * 760;
    } else {
      state.vx = 0;
      state.vy = -760;
    }
    state.invuln = Math.max(state.invuln, TUNING.dashDuration + 0.08);
    return true;
  }

  function beginBoss() {
    if (state.boss) return;
    state.boss = {
      x: innerWidth / 2,
      y: Math.max(105, innerHeight * 0.24),
      r: 76,
      hp: TUNING.bossHP,
      maxHP: TUNING.bossHP,
      angle: 0,
      speed: 19,
      dashState: "chase",
      dashTimer: 2.2,
      dashX: 0,
      dashY: 0,
      dashVX: 0,
      dashVY: 0,
      dashHit: false
    };
    state.saws = [];
    state.lasers = [];
    state.message = "SERRA GIGANTE · DASH COM 100% DE ENERGIA";
    state.messageTimer = 4;
  }

  function updateLasers(dt) {
    if (state.effects.freeze > 0) return;
    state.laserTimer -= dt;
    if (state.laserTimer <= 0) {
      spawnLaser();
      state.laserTimer = state.time >= 55 ? 1.15 : state.time >= 20 ? 2.1 : TUNING.laserInterval;
    }

    if (state.effects.freeze > 0) return;

    for (const laser of state.lasers) {
      laser.t -= dt;
      if (laser.t <= 0 && laser.phase === "warning") {
        laser.phase = "active";
        laser.t = TUNING.laserActive;
      }
    }
    state.lasers = state.lasers.filter(laser => laser.t > 0);

    for (const laser of state.lasers) {
      if (laser.phase !== "active") continue;
      const along = laser.axis === "h" ? state.x : state.y;
      const across = laser.axis === "h" ? state.y : state.x;
      const inSafeGap = Math.abs(along - laser.gapCenter) <= laser.gap / 2 + TUNING.playerRadius;
      const onBeam = Math.abs(across - laser.at) <= 9 + TUNING.playerRadius;
      if (onBeam && !inSafeGap) {
        damage(TUNING.laserDamage, "LASER · -20 HP");
        break;
      }
    }
  }

  function applyKnockback(sourceX, sourceY, force) {
    if (state.dashTime > 0) return;
    const dx = state.x - sourceX, dy = state.y - sourceY;
    const length = Math.hypot(dx, dy) || 1;
    state.vx = dx / length * force;
    state.vy = dy / length * force;
    state.knockbackTime = 0.22;
  }

  function updateSaws(dt, previousPlayerX, previousPlayerY, dashActiveThisFrame) {
    if (state.effects.freeze > 0) return;
    const desired = desiredSawCount();

    if (!state.boss && state.saws.length === 0) {
      if (state.sawRestTimer <= 0) state.sawRestTimer = 8;
      state.sawRestTimer = Math.max(0, state.sawRestTimer - dt);
      if (state.sawRestTimer === 0) {
        for (let i = 0; i < desired; i++) spawnSaw();
        state.sawSpawnTimer = 6;
      }
      return;
    }

    state.sawRestTimer = 0;
    state.sawSpawnTimer -= dt;
    if (!state.boss && state.saws.length < desired && state.sawSpawnTimer <= 0) {
      spawnSaw();
      state.sawSpawnTimer = 6;
    }

    let sawKillsThisFrame = 0;
    for (const saw of state.saws) {
      if (saw.hp <= 0) continue;
      const previousSawX = saw.x;
      const previousSawY = saw.y;
      saw.angle += dt * 5.2;
      saw.stun = Math.max(0, saw.stun - dt);
      if (saw.stun <= 0) {
        const target = state.effects.gravity > 0 && state.gravityPoint ? state.gravityPoint : state;
        const dx = target.x - saw.x;
        const dy = target.y - saw.y;
        const length = Math.hypot(dx, dy) || 1;
        saw.x += dx / length * saw.speed * dt;
        saw.y += dy / length * saw.speed * dt;
      }
      const collisionRadius = saw.r + TUNING.playerRadius +
        (dashActiveThisFrame && state.dashCharged ? TUNING.chargedDashReach : 0);
      const sweptDashHit = dashActiveThisFrame &&
        segmentDistanceSquared(
          0, 0,
          previousPlayerX - previousSawX,
          previousPlayerY - previousSawY,
          state.x - saw.x,
          state.y - saw.y
        ) <= collisionRadius * collisionRadius;
      const touchingPlayer = dashActiveThisFrame
        ? sweptDashHit
        : circleHit(saw, saw.r, state, TUNING.playerRadius);
      if (touchingPlayer) {
        // DASH sempre destrói a serra no contato, inclusive durante o efeito ghost.
        // Ghost só evita dano no movimento normal; não pode cancelar o ataque.
        if (dashActiveThisFrame) {
          saw.hp = 0;
          state.message = "SERRA DESTRUÍDA";
          state.messageTimer = 0.8;
          sawKillsThisFrame++;
        } else if (state.effects.ghost > 0) {
          continue;
        } else {
          if (state.invuln <= 0) applyKnockback(saw.x, saw.y, TUNING.sawKnockback);
          damage(TUNING.sawDamage, "SERRA · -20 HP");
        }
      }
    }

    // Separação simples para evitar que as dez serras virem uma única pilha.
    for (let i = 0; i < state.saws.length; i++) {
      for (let j = i + 1; j < state.saws.length; j++) {
        const a = state.saws[i], b = state.saws[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const length = Math.hypot(dx, dy) || 0.001;
        const min = a.r + b.r + 5;
        if (length < min) {
          const push = (min - length) * 0.5;
          const nx = dx / length, ny = dy / length;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        }
      }
    }

    // Uma única rolagem por evento de DASH, mesmo destruindo várias serras.
    if (sawKillsThisFrame > 0 && !state.dashEffectRolled) {
      state.dashEffectRolled = true;
      activateRandomEffect();
    }
    const beforeFilter = state.saws.length;
    state.saws = state.saws.filter(saw => saw.hp > 0);
    if (beforeFilter > 0 && state.saws.length === 0 && !state.boss) {
      state.hp = TUNING.maxHP;
      if (state.lives < TUNING.maxLives) state.lives += 1;
      state.shieldHitsRemaining = 3;
      state.message = "ONDA CONCLUÍDA · +1 VIDA · HP RESTAURADO · ESCUDO 3 GOLPES";
      state.messageTimer = 2.8;
    }
  }

  function updateBoss(dt, previousPlayerX, previousPlayerY, dashActiveThisFrame) {
    if (!state.boss) return;
    const boss = state.boss;
    boss.angle += dt * 1.15;
    const dx = state.x - boss.x;
    const dy = state.y - boss.y;
    const length = Math.hypot(dx, dy) || 1;

    if (boss.dashState === "warning") {
      boss.dashTimer -= dt;
      if (boss.dashTimer <= 0) {
        boss.dashState = "charging";
        boss.dashTimer = 0.42;
        boss.dashVX = boss.dashX * TUNING.bossDashSpeed;
        boss.dashVY = boss.dashY * TUNING.bossDashSpeed;
        boss.dashHit = false;
      }
    } else if (boss.dashState === "charging") {
      boss.x += boss.dashVX * dt;
      boss.y += boss.dashVY * dt;
      boss.dashTimer -= dt;
      if (!boss.dashHit && circleHit(boss, boss.r, state, TUNING.playerRadius)) {
        boss.dashHit = true;
        if (state.dashTime <= 0) {
          applyKnockback(boss.x, boss.y, TUNING.bossKnockback);
          damage(30, "IMPACTO DO BOSS · -30 HP");
        }
      }
      if (boss.dashTimer <= 0 || boss.x < -boss.r || boss.x > innerWidth + boss.r ||
          boss.y < -boss.r || boss.y > innerHeight + boss.r) {
        boss.dashState = "recovery";
        boss.dashTimer = 0.72;
        boss.x = clamp(boss.x, boss.r, innerWidth - boss.r);
        boss.y = clamp(boss.y, boss.r, innerHeight - boss.r);
      }
    } else if (boss.dashState === "recovery") {
      boss.dashTimer -= dt;
      if (boss.dashTimer <= 0) {
        boss.dashState = "chase";
        boss.dashTimer = TUNING.bossDashCooldown;
      }
    } else {
      boss.x += dx / length * boss.speed * dt;
      boss.y += dy / length * boss.speed * dt;
      boss.dashTimer -= dt;
      if (boss.dashTimer <= 0) {
        boss.dashState = "warning";
        boss.dashTimer = TUNING.bossDashWarning;
        boss.dashX = dx / length;
        boss.dashY = dy / length;
        state.message = "BOSS PREPARANDO DASH · DESVIE!";
        state.messageTimer = TUNING.bossDashWarning;
      }
    }

    if (boss.dashState !== "charging" && circleHit(boss, boss.r, state, TUNING.playerRadius)) {
      if (state.dashTime <= 0) {
        if (state.invuln <= 0) applyKnockback(boss.x, boss.y, TUNING.bossKnockback);
        damage(25, "BOSS · -25 HP");
      }
    }

    // Colisão contínua: verifica todo o trajeto da bola neste frame,
    // evitando que um DASH rápido atravesse o boss sem registrar impacto.
    const sweptBossHit = dashActiveThisFrame && segmentDistanceSquared(
      0, 0,
      previousPlayerX - boss.x,
      previousPlayerY - boss.y,
      state.x - boss.x,
      state.y - boss.y
    ) <= Math.pow(boss.r + TUNING.playerRadius +
      (state.dashCharged ? TUNING.chargedDashReach : 0), 2);

    if (sweptBossHit && !state.bossDashHit) {
      state.bossDashHit = true;
      const charged = state.dashCharged;
      const dealt = charged ? TUNING.bossDashDamage : TUNING.bossNormalDashDamage;
      boss.hp = Math.max(0, boss.hp - dealt);
      if (charged) {
        state.dashCharged = false;
        state.energy = 0;
        state.message = "DASH 100% · IMPACTO AMPLIADO · -" + dealt + " BOSS HP";
      } else {
        state.message = "DASH · -" + dealt + " BOSS HP";
      }
      state.messageTimer = 1.2;
      if (boss.hp <= 0) {
        state.bossDefeated = true;
        state.victory = true;
        state.message = "FASE 2 CONCLUÍDA";
        state.messageTimer = 3;
        state.boss = null;
        state.saws = [];
        state.lasers = [];
        try { localStorage.setItem("onRedPhase3Unlocked", "true"); } catch (_) {}
        triggerVictory();
      }
    }
  }

  function update(dt) {
    if (!state.active || state.paused || state.over || state.victory) return;
    state.time += dt;
    state.score += dt * 100;
    state.invuln = Math.max(0, state.invuln - dt);
    state.dashCooldown = Math.max(0, state.dashCooldown - dt);
    // Snapshot no início do frame: não perder a colisão no último frame
    // quando o contador do DASH chega a zero durante este dt.
    const dashActiveThisFrame = state.dashTime > 0;
    state.dashTime = Math.max(0, state.dashTime - dt);
    button.flash = Math.max(0, button.flash - dt);
    state.messageTimer = Math.max(0, state.messageTimer - dt);
    for (const key of Object.keys(state.effects)) state.effects[key] = Math.max(0, state.effects[key] - dt);
    if (state.effects.gravity <= 0) state.gravityPoint = null;

    const previousPlayerX = state.x;
    const previousPlayerY = state.y;
    let ix = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) -
             (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
    let iy = (keys.has("ArrowDown") || keys.has("KeyS") ? 1 : 0) -
             (keys.has("ArrowUp") || keys.has("KeyW") ? 1 : 0);
    if (hasTouchInput) {
      ix += joystick.x;
      iy += joystick.y;
    }
    if (state.effects.invert > 0) { ix *= -1; iy *= -1; }
    const inputLength = Math.hypot(ix, iy) || 1;
    if (!dashActiveThisFrame && state.knockbackTime <= 0) {
      state.vx = (ix / inputLength) * TUNING.playerSpeed;
      state.vy = (iy / inputLength) * TUNING.playerSpeed;
    }
    state.x = clamp(state.x + state.vx * dt, TUNING.playerRadius, innerWidth - TUNING.playerRadius);
    state.y = clamp(state.y + state.vy * dt, TUNING.playerRadius, innerHeight - TUNING.playerRadius);
    if (!dashActiveThisFrame) {
      if (state.knockbackTime > 0) {
        state.knockbackTime = Math.max(0, state.knockbackTime - dt);
        const damping = Math.pow(0.035, dt);
        state.vx *= damping;
        state.vy *= damping;
      } else {
        state.vx *= Math.pow(0.001, dt);
        state.vy *= Math.pow(0.001, dt);
      }
    }

    state.zoneTimer -= dt;
    if (state.zoneTimer <= 0) {
      spawnZone();
      state.zoneTimer = 5.7;
    }
    state.mergeTimer -= dt;
    if (state.mergeTimer <= 0) {
      spawnMerge();
      state.mergeTimer = TUNING.mergeInterval;
    }

    for (const zone of state.zones) {
      zone.life -= dt;
      zone.pulse += dt * 3;
      if (circleHit(zone, zone.r, state, TUNING.playerRadius)) {
        state.energy = clamp(state.energy + TUNING.energyPerZone, 0, TUNING.maxEnergy);
        zone.life = 0;
        state.message = "ENERGIA +25%";
        state.messageTimer = 0.8;
      }
    }
    state.zones = state.zones.filter(zone => zone.life > 0);

    for (const orb of state.merges) {
      orb.life -= dt;
      orb.pulse += dt * 3.2;
      if (circleHit(orb, orb.r, state, TUNING.playerRadius)) {
        const healed = Math.min(TUNING.mergeHeal, TUNING.maxHP - state.hp);
        if (healed > 0) {
          state.hp += healed;
          state.score += TUNING.mergeScore;
          state.message = "MERGE · +" + healed + " HP · +1000";
        } else {
          state.message = "MERGE · HP COMPLETO";
        }
        orb.life = 0;
        state.messageTimer = 1.1;
      }
    }
    state.merges = state.merges.filter(orb => orb.life > 0);

    updatePingPongs(dt);
    updateSaws(dt, previousPlayerX, previousPlayerY, dashActiveThisFrame);
    updateLasers(dt);
    if (!state.bossDefeated && !state.boss && state.time >= TUNING.bossTriggerSeconds) beginBoss();
    if (state.effects.freeze <= 0) updateBoss(dt, previousPlayerX, previousPlayerY, dashActiveThisFrame);
  }

  function drawSawShape(x, y, radius, angle, teeth = 24, boss = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = "#168BFF";
    ctx.strokeStyle = boss ? "#D5F0FF" : "#9BD8FF";
    ctx.lineWidth = boss ? 4 : 2;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a = i * Math.PI / teeth;
      const r = i % 2 === 0 ? radius : radius * 0.78;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = "#0B2340";
    ctx.fill();
    ctx.strokeStyle = "#B9E6FF";
    ctx.lineWidth = boss ? 3 : 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawMerge(orb) {
    const pulse = 1 + Math.sin(orb.pulse) * 0.12;
    const radius = orb.r * pulse;
    ctx.save();
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,48,63,.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#FF303F";
    ctx.shadowColor = "#FF303F";
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(orb.x - radius * 0.3, orb.y - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.fill();
    ctx.restore();
  }

  function drawLaser(laser) {
    const warning = laser.phase === "warning";
    const halfGap = laser.gap / 2;
    const start = laser.gapCenter - halfGap;
    const end = laser.gapCenter + halfGap;
    ctx.save();
    ctx.strokeStyle = warning ? "rgba(255,57,72,.58)" : "#FF3948";
    ctx.lineWidth = warning ? 2 : 15;
    ctx.setLineDash(warning ? [8, 8] : []);
    ctx.beginPath();
    if (laser.axis === "h") {
      ctx.moveTo(0, laser.at); ctx.lineTo(start, laser.at);
      ctx.moveTo(end, laser.at); ctx.lineTo(innerWidth, laser.at);
    } else {
      ctx.moveTo(laser.at, 0); ctx.lineTo(laser.at, start);
      ctx.moveTo(laser.at, end); ctx.lineTo(laser.at, innerHeight);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawHealthHUD() {
    const x = 22;
    const y = 64;
    const lifeRadius = 7;
    const spacing = 23;
    for (let i = 0; i < TUNING.maxLives; i++) {
      const lifeX = x + lifeRadius + i * spacing;
      ctx.beginPath();
      ctx.arc(lifeX, y, lifeRadius, 0, Math.PI * 2);
      if (i < state.lives) {
        ctx.shadowColor = "#FF303F";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#FF303F";
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(lifeX, y - lifeRadius * 0.35, lifeRadius * 0.24, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,.7)";
        ctx.fill();
      } else {
        ctx.fillStyle = "#54232B";
        ctx.fill();
      }
    }

    const barX = x;
    const barY = y + 25;
    const barWidth = 125;
    const barHeight = 9;
    const ratio = clamp(state.hp / TUNING.maxHP, 0, 1);
    ctx.fillStyle = "#303743";
    ctx.fillRect(barX, barY, barWidth, barHeight);
    if (ratio > 0) {
      ctx.shadowColor = "#FF303F";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#FF303F";
      ctx.fillRect(barX, barY, barWidth * ratio, barHeight);
      ctx.shadowBlur = 0;
    }
    ctx.strokeStyle = "rgba(255,255,255,.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("HP", barX, barY + 19);
    ctx.textAlign = "right";
    ctx.fillText(Math.ceil(state.hp) + "/80", barX + barWidth, barY + 19);
    ctx.textAlign = "left";
    ctx.fillStyle = "#AAB4C3";
    ctx.fillText("ENERGIA " + Math.floor(state.energy) + "%", barX, barY + 35);
    ctx.fillStyle = "#303743";
    ctx.fillRect(barX, barY + 42, barWidth, 5);
    ctx.fillStyle = "#168BFF";
    ctx.fillRect(barX, barY + 42, barWidth * state.energy / TUNING.maxEnergy, 5);
  }

  // Mesmo quadrado preenchido por carga usado pelo Perfect Timing da Fase 1.
  // Na Fase 2, a carga representa a recarga do DASH.
  function drawJoystick() {
    if (!hasTouchInput) return;
    ctx.beginPath();
    ctx.arc(joystick.baseX, joystick.baseY, joystick.radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(180,180,180,0.3)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(joystick.knobX, joystick.knobY, joystick.knobRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
  }

  function drawDashButton() {
    const x = button.x, y = button.y, size = button.size;
    const padding = 5;
    const innerSize = size - padding * 2;
    const charge = 1 - clamp(state.dashCooldown / TUNING.dashCooldown, 0, 1);
    const fillHeight = innerSize * charge;

    ctx.fillStyle = "#101820";
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = charge >= 1 ? "#168BFF" : "#07539C";
    ctx.fillRect(x + padding, y + size - padding - fillHeight, innerSize, fillHeight);
    ctx.strokeStyle = button.flash > 0 ? "#FFFFFF" : "#168BFF";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, size, size);

    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 11px Arial";
    let label;
    if (state.dashCooldown > 0) label = state.dashCooldown.toFixed(1) + "s";
    else if (state.energy >= TUNING.dashCost) label = "DASH";
    else label = "ENERGY";
    ctx.fillText(label, x + size / 2, y + size / 2 - 1);
    if (state.dashCooldown <= 0 && state.energy < TUNING.dashCost) {
      ctx.font = "bold 9px Arial";
      ctx.fillText(state.energy + "/" + TUNING.dashCost, x + size / 2, y + size / 2 + 13);
    }
  }

  function draw() {
    const w = innerWidth, h = innerHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#080B12";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(60,145,210,.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 36) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 36) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    for (const zone of state.zones) {
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.r + Math.sin(zone.pulse) * 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(22,139,255,.18)";
      ctx.fill();
      ctx.strokeStyle = "#58BFFF";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 10px Arial";
      ctx.textAlign = "center";
      ctx.fillText("+25", zone.x, zone.y + 4);
    }

    state.merges.forEach(drawMerge);
    state.lasers.forEach(drawLaser);
    for (const ball of state.pingPongs) {
      ctx.save();
      ctx.strokeStyle = "#FF3948";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ball.x - ball.vx * 0.018, ball.y - ball.vy * 0.018);
      ctx.lineTo(ball.x, ball.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.shadowColor = "#FF3948";
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.restore();
    }
    state.saws.forEach(saw => drawSawShape(saw.x, saw.y, saw.r, saw.angle));

    if (state.boss) {
      const boss = state.boss;
      if (boss.dashState === "warning") {
        ctx.save();
        ctx.strokeStyle = "rgba(255,48,63,.9)";
        ctx.lineWidth = 5;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.moveTo(boss.x, boss.y);
        ctx.lineTo(boss.x + boss.dashX * Math.max(w, h) * 1.4,
          boss.y + boss.dashY * Math.max(w, h) * 1.4);
        ctx.stroke();
        ctx.restore();
      }
      drawSawShape(boss.x, boss.y, boss.r, boss.angle, 32, true);
      ctx.fillStyle = "#263648";
      ctx.fillRect(w * 0.2, 20, w * 0.6, 8);
      ctx.fillStyle = "#168BFF";
      ctx.fillRect(w * 0.2, 20, w * 0.6 * (boss.hp / boss.maxHP), 8);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.fillText("SERRA GIGANTE", w / 2, 15);
    }

    ctx.beginPath();
    ctx.arc(state.x, state.y, TUNING.playerRadius, 0, Math.PI * 2);
    const colorRatio = clamp(state.energy / TUNING.maxEnergy, 0, 1);
    ctx.fillStyle = state.shieldHitsRemaining > 0 ? "#168BFF" : "rgb(255," +
      Math.round(107 + (255 - 107) * colorRatio) + "," +
      Math.round(112 + (255 - 112) * colorRatio) + ")";
    ctx.shadowColor = state.shieldHitsRemaining > 0 ? "#58BFFF" : ctx.fillStyle;
    ctx.shadowBlur = state.shieldHitsRemaining > 0 ? 22 : (state.dashTime > 0 ? 24 : 10);
    ctx.fill();
    if (state.shieldHitsRemaining > 0) {
      ctx.beginPath();
      ctx.arc(state.x, state.y, TUNING.playerRadius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(88,191,255,.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    if (state.invuln > 0 && Math.floor(state.time * 16) % 2 === 0) {
      ctx.beginPath();
      ctx.arc(state.x, state.y, TUNING.playerRadius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,.65)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(String(Math.floor(state.score)).padStart(6, "0"), w / 2, 18);
    drawHealthHUD();
    drawJoystick();
    drawDashButton();

    if (state.messageTimer > 0) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 13px Arial";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(state.message, w / 2, h * 0.17);
    }

    if (state.paused || state.over || state.victory) {
      ctx.fillStyle = "rgba(0,0,0,.76)";
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 28px Arial";
      ctx.fillText(state.paused ? "PAUSADO" : state.victory ? "FASE 2 CONCLUÍDA" : "GAME OVER", w / 2, h / 2 - 28);
      ctx.font = "bold 13px Arial";
      ctx.fillStyle = "#58BFFF";
      ctx.fillText("Toque para " + (state.paused ? "continuar" : "reiniciar"), w / 2, h / 2 + 8);
      ctx.fillText("ESC para voltar ao menu", w / 2, h / 2 + 32);
    }
  }

  function frame(ts) {
    if (!state.active) return;
    const dt = state.last ? Math.min((ts - state.last) / 1000, 0.04) : 0;
    state.last = ts;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function syncCanvasForPhaseTwo() {
    // Mantém o mesmo referencial de viewport usado pela Fase 1.
    // Em mobile, a área CSS deve acompanhar innerHeight em pixels,
    // não 100vh, que pode incluir a área recolhida das barras do navegador.
    if (window.ONREDWorld && typeof window.ONREDWorld.resize === "function") {
      window.ONREDWorld.resize();
    }

    const dpr = Number(window.devicePixelRatio) || 1;
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);

    canvas.style.position = "fixed";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.zIndex = "0";
    canvas.style.pointerEvents = "auto";
    canvas.style.display = "block";
    canvas.style.margin = "0";
    canvas.style.padding = "0";
    // Igual à Fase 1: dimensões explícitas da viewport, sem 100vw/100vh.
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function launch() {
    const startLoop = !state.active;
    syncCanvasForPhaseTwo();
    reset();
    hideAllScreens();
    if (ui.mainMenu) ui.mainMenu.classList.add("hidden");
    if (ui.pauseButton) ui.pauseButton.style.display = "flex";
    if (window.ONREDAudio) window.ONREDAudio.playMusic("gameplay");
    if (startLoop) requestAnimationFrame(frame);
  }

  document.getElementById("phaseTwoButton")?.addEventListener("click", launch);

  if (ui.pauseButton) {
    ui.pauseButton.addEventListener("click", event => {
      if (!state.active) return;
      event.preventDefault();
      pauseGame();
    });
  }
  // Estes botões são compartilhados com a Fase 1. Capturamos o clique
  // antes dos listeners do runtime principal para impedir ações duplicadas.
  function bindPhaseTwoAction(element, action) {
    if (!element) return;
    element.addEventListener("click", event => {
      if (!state.active) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      action();
    }, true);
  }
  bindPhaseTwoAction(ui.resumeButton, resumeGame);
  bindPhaseTwoAction(ui.pauseRestartButton, launch);
  bindPhaseTwoAction(ui.pauseMenuButton, exit);
  bindPhaseTwoAction(ui.reviveButton, reviveGame);
  bindPhaseTwoAction(ui.retryButton, launch);
  bindPhaseTwoAction(ui.gameOverMenuButton, exit);
  bindPhaseTwoAction(ui.victoryRetryButton, continueAfterBoss);
  bindPhaseTwoAction(ui.victoryMenuButton, exit);

  // O botão é compartilhado com a Fase 1. A checagem por coordenada
  // mantém o comportamento correto mesmo quando o canvas captura outro toque.
  document.addEventListener("pointerdown", event => {
    if (!state.active || state.paused || state.over || state.victory || !ui.pauseButton) return;
    const rect = ui.pauseButton.getBoundingClientRect();
    const x = event.clientX, y = event.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    pauseGame();
  }, true);

  // Captura antes do listener global da Fase 1, sem alterar o runtime dela.
  window.addEventListener("keydown", event => {
    if (!state.active) return;
    if (event.code === "Escape" || event.code === "KeyP") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (state.over || state.victory) {
        if (event.code === "Escape") exit();
      } else if (state.paused) {
        resumeGame();
      } else {
        pauseGame();
      }
      return;
    }
    if (state.paused || state.over || state.victory) {
      if (event.code === "Enter" && state.over) launch();
      else if (event.code === "Enter" && state.victory) continueAfterBoss();
      return;
    }
    keys.add(event.code);
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") startDash();
  }, true);
  window.addEventListener("keyup", event => keys.delete(event.code));

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.active && !state.paused && !state.over && !state.victory) {
      pauseGame();
    }
  });

  canvas.addEventListener("pointerdown", event => {
    if (!state.active || state.paused || state.over || state.victory) return;
    const pos = getCanvasPosition(event);
    const hitPadding = 12;
    const onDashButton =
      pos.x >= button.x - hitPadding && pos.x <= button.x + button.size + hitPadding &&
      pos.y >= button.y - hitPadding && pos.y <= button.y + button.size + hitPadding;
    if (onDashButton) {
      event.preventDefault();
      startDash();
      return;
    }
    if (!hasTouchInput || joystick.active ||
        (event.pointerType !== "touch" && event.pointerType !== "pen")) return;
    if (Math.hypot(pos.x - joystick.baseX, pos.y - joystick.baseY) > 90) return;
    event.preventDefault();
    joystick.active = true;
    joystick.pointerId = event.pointerId;
    try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
    updateJoystick(event);
  });

  canvas.addEventListener("pointermove", event => {
    if (!state.active || !joystick.active || joystick.pointerId !== event.pointerId) return;
    event.preventDefault();
    updateJoystick(event);
  });

  const releaseJoystick = event => {
    if (joystick.pointerId === event.pointerId) resetJoystick();
  };
  canvas.addEventListener("pointerup", releaseJoystick);
  canvas.addEventListener("pointercancel", releaseJoystick);

  window.addEventListener("onred:joystick-side-change", () => {
    resetJoystick();
    updateJoystickPosition();
    updateButtonPosition();
  });

  window.addEventListener("resize", () => {
    if (state.active) syncCanvasForPhaseTwo();
    state.x = clamp(state.x || innerWidth / 2, TUNING.playerRadius, innerWidth - TUNING.playerRadius);
    state.y = clamp(state.y || innerHeight / 2, TUNING.playerRadius, innerHeight - TUNING.playerRadius);
    resetJoystick();
    updateJoystickPosition();
    updateButtonPosition();
  });

  updateJoystickPosition();
  updateButtonPosition();
  window.ONREDPhase2Game = {
    start: launch,
    exit,
    getState: () => ({
      ...state,
      saws: state.saws.length,
      revivesUsed: state.revivesUsed,
      bossDefeated: state.bossDefeated,
      postBoss: state.postBoss,
      effects: { ...state.effects },
      pingPongs: state.pingPongs.length,
      zones: state.zones.length,
      merges: state.merges.length,
      lasers: state.lasers.length
    })
  };
})();
