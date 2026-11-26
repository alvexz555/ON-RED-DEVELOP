/*
 * ON RED · MENU PRINCIPAL
 * Navegação, fases, recordes, instruções e preferências.
 */
(() => {
    "use strict";
    const $ = id => document.getElementById(id);
    const panels = ["phasesPanel", "recordsPanel", "instructionsPanel", "settingsPanel"].map($).filter(Boolean);
    const home = $("menuHome");
    const container = $("mainMenu");
    const bestScore = $("bestScore");
    const recordsBestScore = $("recordsBestScore");
    const volumeSlider = $("volumeSlider");
    const volumeValue = $("volumeValue");
    const joystickSideSelect = $("joystickSide");
    const VOLUME_KEY = "onRedVolume";
    const JOYSTICK_SIDE_KEY = "onRedJoystickSide";

    function readBestScore() {
        try {
            const value = Number(localStorage.getItem("onRedBestScore") || 0);
            return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
        } catch (error) {
            console.warn("[ON RED] Não foi possível ler o recorde.", error);
            return 0;
        }
    }
    function formatScore(value) { return String(value).padStart(6, "0"); }
    function refreshRecords() {
        const score = formatScore(readBestScore());
        if (bestScore) bestScore.textContent = score;
        if (recordsBestScore) recordsBestScore.textContent = score;
    }
    function readVolume() {
        try {
            const saved = Number(localStorage.getItem(VOLUME_KEY));
            return Number.isFinite(saved) ? Math.max(0, Math.min(100, saved)) : 70;
        } catch (error) { return 70; }
    }

    let masterVolume = readVolume() / 100;
    let masterGainNode = null;
    function applyVolume() {
        document.querySelectorAll("audio, video").forEach(media => { media.volume = masterVolume; });
        if (masterGainNode && masterGainNode.gain) masterGainNode.gain.value = masterVolume;
        document.dispatchEvent(new Event("onred:volume-change"));
        if (volumeSlider) volumeSlider.value = String(Math.round(masterVolume * 100));
        if (volumeValue) volumeValue.textContent = Math.round(masterVolume * 100) + "%";
    }
    window.ONREDVolume = {
        get: () => masterVolume,
        set: value => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return;
            masterVolume = Math.max(0, Math.min(1, numeric));
            try { localStorage.setItem(VOLUME_KEY, String(Math.round(masterVolume * 100))); } catch (error) {}
            applyVolume();
        },
        connectGainNode: node => {
            if (!node || !node.gain) return false;
            masterGainNode = node;
            applyVolume();
            return true;
        }
    };

    function closePanels() {
        panels.forEach(panel => panel.classList.add("hidden"));
        if (home) home.classList.remove("hidden");
    }
    function openPanel(id) {
        if (home) home.classList.add("hidden");
        panels.forEach(panel => panel.classList.toggle("hidden", panel.id !== id));
        refreshRecords();
    }
    function showMenu() {
        if (container) container.classList.remove("hidden");
        closePanels();
        refreshRecords();
        applyVolume();
    }
    function hideMenu() { if (container) container.classList.add("hidden"); }
    function showRuntimeError(message) {
        showMenu();
        let notice = $("runtimeErrorNotice");
        if (!notice && home) {
            notice = document.createElement("p");
            notice.id = "runtimeErrorNotice";
            notice.setAttribute("role", "alert");
            notice.style.cssText = "margin:14px auto 0;padding:12px;border:1px solid #FF3948;border-radius:8px;color:#FFD8DC;background:rgba(255,57,72,.12);font:12px/1.5 Arial,sans-serif;max-width:420px;overflow-wrap:anywhere;";
            home.appendChild(notice);
        }
        if (notice) notice.textContent = "NÃO FOI POSSÍVEL INICIAR A FASE. " + message;
    }
    window.addEventListener("error", event => {
        if (!String(event.filename || "").includes("phase2Game.js")) return;
        console.error("[ON RED] Erro no runtime da Fase 2:", event.error || event.message);
        try { window.ONREDPhase2Game?.exit(); } catch (exitError) {
            console.error("[ON RED] Falha ao encerrar o runtime:", exitError);
        }
        showRuntimeError(event.message || "Erro ao carregar ou executar a Fase 2.");
    });
    function startMode(mode, phase) {
        const runtime = phase === 2 ? window.ONREDPhase2Game : null;
        if (phase === 2 && (!runtime || typeof runtime.start !== "function")) {
            showRuntimeError("O código da Fase 2 não foi carregado. Atualize a página e tente novamente.");
            console.error("[ON RED] Runtime da Fase 2 não encontrado.");
            return;
        }
        if (phase === 1 && typeof window.startONREDGame !== "function") {
            showRuntimeError("O código da Fase 1 não foi carregado. Atualize a página e tente novamente.");
            console.error("[ON RED] Runtime da Fase 1 não encontrado.");
            return;
        }
        window.ONREDGameMode = { mode, phase };
        hideMenu();
        try {
            if (phase === 2) runtime.start();
            else window.startONREDGame();
        } catch (error) {
            console.error("[ON RED] Falha ao iniciar a fase:", error);
            showRuntimeError(error && error.message ? error.message : "Falha inesperada ao iniciar.");
        }
    }

    function handlePhaseVictory(phase) {
        const selected = window.ONREDGameMode || { mode: "original", phase: 1 };
        const nextPhase = selected.mode === "training"
            ? phase
            : (phase === 1 ? 2 : 1);
        if (phase === 1 && window.ONREDMainGame) window.ONREDMainGame.exit();
        if (phase === 2 && window.ONREDPhase2Game) window.ONREDPhase2Game.exit();
        startMode(selected.mode, nextPhase);
        return true;
    }
    function initialize() {
        if (!container || !home) {
            console.error("[ON RED] Estrutura do menu não encontrada.");
            return;
        }
        $("playButton")?.addEventListener("click", () => startMode("original", 1));
        $("phaseOneOriginalButton")?.addEventListener("click", () => startMode("original", 1));
        $("phaseOneTrainingButton")?.addEventListener("click", () => startMode("training", 1));
        $("phaseTwoOriginalButton")?.addEventListener("click", () => startMode("original", 2));
        $("phaseTwoTrainingButton")?.addEventListener("click", () => startMode("training", 2));
        $("phasesButton")?.addEventListener("click", () => openPanel("phasesPanel"));
        $("recordsButton")?.addEventListener("click", () => openPanel("recordsPanel"));
        $("instructionsButton")?.addEventListener("click", () => openPanel("instructionsPanel"));
        $("settingsButton")?.addEventListener("click", () => openPanel("settingsPanel"));
        document.querySelectorAll("[data-menu-back]").forEach(button => button.addEventListener("click", closePanels));
        if (volumeSlider) volumeSlider.addEventListener("input", event => window.ONREDVolume.set(Number(event.target.value) / 100));
        if (joystickSideSelect) {
            let savedSide = "left";
            try {
                savedSide = localStorage.getItem(JOYSTICK_SIDE_KEY) === "right" ? "right" : "left";
            } catch (error) {}
            joystickSideSelect.value = savedSide;
            joystickSideSelect.addEventListener("change", event => {
                const side = event.target.value === "right" ? "right" : "left";
                try { localStorage.setItem(JOYSTICK_SIDE_KEY, side); } catch (error) {}
                window.dispatchEvent(new CustomEvent("onred:joystick-side-change", { detail: { side } }));
            });
        }
        showMenu();
    }
    window.ONREDModeManager = { handlePhaseVictory, startMode };
    window.ONREDMenu = { initialize, showMenu, hideMenu, refreshRecords };
    initialize();
})();
