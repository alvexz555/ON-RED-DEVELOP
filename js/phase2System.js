/*
 * ON RED — PHASE 2 FOUNDATION
 *
 * Isolated state model for Phase 2.
 * This file intentionally does not modify or hook into Phase 1.
 * Unspecified gameplay values remain configurable instead of being guessed.
 */
(function (root) {
    "use strict";

    const FIXED = Object.freeze({
        maxHP: 80,
        totalLives: 4,
        maxEnergy: 100,
        playerStartColor: "#FF6B70",
        playerChargedColor: "#FFFFFF",
        hazardColor: "#168BFF",
        textColor: "#FFFFFF"
    });

    const state = {
        status: "IDLE",
        hp: FIXED.maxHP,
        maxHP: FIXED.maxHP,
        lives: FIXED.totalLives,
        maxLives: FIXED.totalLives,
        energy: 0,
        maxEnergy: FIXED.maxEnergy,
        score: 0,
        boss: null
    };

    function snapshot() {
        return {
            ...state,
            boss: state.boss ? { ...state.boss } : null,
            playerColor: getPlayerColor()
        };
    }

    function reset() {
        state.status = "IDLE";
        state.hp = FIXED.maxHP;
        state.maxHP = FIXED.maxHP;
        state.lives = FIXED.totalLives;
        state.maxLives = FIXED.totalLives;
        state.energy = 0;
        state.maxEnergy = FIXED.maxEnergy;
        state.score = 0;
        state.boss = null;
        return snapshot();
    }

    function start() {
        if (state.status === "PLAYING") return { applied: false, reason: "already_playing", state: snapshot() };
        reset();
        state.status = "PLAYING";
        return { applied: true, state: snapshot() };
    }

    function addScore(amount) {
        if (state.status !== "PLAYING" || !Number.isFinite(amount) || amount <= 0) {
            return { applied: false, state: snapshot() };
        }
        state.score += amount;
        return { applied: true, score: state.score, state: snapshot() };
    }

    function applyDamage(amount) {
        if (state.status !== "PLAYING") return { applied: false, reason: "not_playing", state: snapshot() };
        if (!Number.isFinite(amount) || amount <= 0) return { applied: false, reason: "invalid_damage", state: snapshot() };

        const previousHP = state.hp;
        state.hp = Math.max(0, state.hp - amount);
        const applied = previousHP - state.hp;
        let lifeLost = false;

        if (state.hp === 0) {
            state.lives = Math.max(0, state.lives - 1);
            lifeLost = true;
            if (state.lives > 0) state.hp = state.maxHP;
            else state.status = "DEFEAT";
        }

        return { applied: applied > 0, damage: applied, lifeLost, state: snapshot() };
    }

    function heal(amount) {
        if (state.status !== "PLAYING") return { applied: false, reason: "not_playing", state: snapshot() };
        if (!Number.isFinite(amount) || amount <= 0) return { applied: false, reason: "invalid_heal", state: snapshot() };
        const previousHP = state.hp;
        state.hp = Math.min(state.maxHP, state.hp + amount);
        return { applied: state.hp > previousHP, healed: state.hp - previousHP, state: snapshot() };
    }

    function addEnergy(amount) {
        if (state.status !== "PLAYING") return { applied: false, reason: "not_playing", state: snapshot() };
        if (!Number.isFinite(amount) || amount <= 0) return { applied: false, reason: "invalid_energy", state: snapshot() };
        const previous = state.energy;
        state.energy = Math.min(state.maxEnergy, state.energy + amount);
        return { applied: state.energy > previous, added: state.energy - previous, ready: state.energy >= state.maxEnergy, state: snapshot() };
    }

    function setEnergy(value) {
        if (!Number.isFinite(value) || value < 0 || value > FIXED.maxEnergy) return false;
        state.energy = value;
        return true;
    }

    function getPlayerColor() {
        const from = [255, 107, 112];
        const ratio = Math.max(0, Math.min(1, state.energy / FIXED.maxEnergy));
        const channels = from.map(channel => Math.round(channel + (255 - channel) * ratio));
        return "#" + channels.map(channel => channel.toString(16).padStart(2, "0")).join("").toUpperCase();
    }

    function isElectricallyReady() {
        return state.energy >= FIXED.maxEnergy;
    }

    function setBoss(hp) {
        if (!Number.isFinite(hp) || hp <= 0 || state.status !== "PLAYING") return false;
        state.boss = { hp, maxHP: hp, defeated: false };
        state.status = "BOSS";
        return true;
    }

    function damageBoss(amount) {
        if (state.status !== "BOSS" || !state.boss || state.boss.defeated) {
            return { applied: false, reason: "boss_not_active", state: snapshot() };
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            return { applied: false, reason: "invalid_damage", state: snapshot() };
        }
        state.boss.hp = Math.max(0, state.boss.hp - amount);
        if (state.boss.hp === 0) {
            state.boss.defeated = true;
            state.status = "VICTORY";
        }
        return { applied: true, damage: amount, defeated: state.boss.defeated, state: snapshot() };
    }

    function getFixedRules() {
        return { ...FIXED };
    }

    function getState() {
        return snapshot();
    }

    const api = {
        reset,
        start,
        addScore,
        applyDamage,
        heal,
        addEnergy,
        setEnergy,
        getPlayerColor,
        isElectricallyReady,
        setBoss,
        damageBoss,
        getFixedRules,
        getState
    };

    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (root) root.ONREDPhase2 = api;
})(typeof window !== "undefined" ? window : globalThis);
