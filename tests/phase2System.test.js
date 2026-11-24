const test = require("node:test");
const assert = require("node:assert/strict");
const phase2 = require("../js/phase2System.js");

test("Fase 2 começa com 80 HP, quatro vidas e energia zerada", () => {
    const state = phase2.reset();
    assert.equal(state.maxHP, 80);
    assert.equal(state.hp, 80);
    assert.equal(state.maxLives, 4);
    assert.equal(state.lives, 4);
    assert.equal(state.energy, 0);
    assert.equal(state.status, "IDLE");
});

test("iniciar partida muda apenas o estado isolado da Fase 2", () => {
    const result = phase2.start();
    assert.equal(result.applied, true);
    assert.equal(result.state.status, "PLAYING");
    assert.equal(result.state.hp, 80);
});

test("dano reduz HP e consome uma vida quando HP chega a zero", () => {
    phase2.start();
    const result = phase2.applyDamage(80);
    assert.equal(result.lifeLost, true);
    assert.equal(result.state.lives, 3);
    assert.equal(result.state.hp, 80);
    assert.equal(result.state.status, "PLAYING");
});

test("quarta derrota encerra a Fase 2 sem vidas negativas", () => {
    phase2.start();
    for (let i = 0; i < 4; i++) phase2.applyDamage(80);
    const state = phase2.getState();
    assert.equal(state.lives, 0);
    assert.equal(state.hp, 0);
    assert.equal(state.status, "DEFEAT");
});

test("cura respeita o limite de 80 HP", () => {
    phase2.start();
    phase2.applyDamage(30);
    assert.equal(phase2.heal(50).state.hp, 80);
    assert.equal(phase2.heal(10).healed, 0);
});

test("energia acumula até 100 e não ultrapassa o limite", () => {
    phase2.start();
    phase2.addEnergy(70);
    const result = phase2.addEnergy(50);
    assert.equal(result.state.energy, 100);
    assert.equal(result.ready, true);
    assert.equal(result.added, 30);
});

test("cor do jogador clareia gradualmente até branco com 100% de energia", () => {
    phase2.start();
    assert.equal(phase2.getPlayerColor(), "#FF6B70");
    phase2.addEnergy(50);
    assert.notEqual(phase2.getPlayerColor(), "#FF6B70");
    phase2.addEnergy(50);
    assert.equal(phase2.getPlayerColor(), "#FFFFFF");
    assert.equal(phase2.isElectricallyReady(), true);
});

test("pontuação só é alterada durante uma partida ativa", () => {
    phase2.reset();
    assert.equal(phase2.addScore(100).applied, false);
    phase2.start();
    assert.equal(phase2.addScore(100).score, 100);
});

test("Boss só pode ser ativado durante a partida e termina em vitória", () => {
    phase2.start();
    assert.equal(phase2.setBoss(500), true);
    assert.equal(phase2.getState().status, "BOSS");
    const hit = phase2.damageBoss(500);
    assert.equal(hit.defeated, true);
    assert.equal(hit.state.status, "VICTORY");
});

test("parâmetros inválidos não alteram HP, energia ou Boss", () => {
    phase2.start();
    assert.equal(phase2.applyDamage(-10).applied, false);
    assert.equal(phase2.addEnergy(Infinity).applied, false);
    assert.equal(phase2.setEnergy(101), false);
    assert.equal(phase2.setBoss(0), false);
    assert.equal(phase2.getState().hp, 80);
    assert.equal(phase2.getState().energy, 0);
});
