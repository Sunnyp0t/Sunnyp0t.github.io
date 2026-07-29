const socket = io();

let state = null;
let myId = socket.id;
let currentRoomCode = null;

const $ = (selector) => document.querySelector(selector);

const homeScreen = $("#homeScreen");
const lobbyScreen = $("#lobbyScreen");
const gameScreen = $("#gameScreen");
const createModal = $("#createModal");
const joinModal = $("#joinModal");

function showScreen(screen) {
  [homeScreen, lobbyScreen, gameScreen].forEach((item) => {
    item.classList.add("hidden");
  });

  screen.classList.remove("hidden");
}

function showModal(modal) {
  modal.classList.remove("hidden");
}

function closeModals() {
  createModal.classList.add("hidden");
  joinModal.classList.add("hidden");
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  $("#toastContainer").appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}

function getMyPlayer() {
  return state?.players?.find((player) => player.id === myId);
}

function getPlayerName(id) {
  return state?.players?.find((player) => player.id === id)?.name || "Joueur";
}

socket.on("connect", () => {
  myId = socket.id;
  $("#connectionDot").className = "online";
  $("#connectionText").textContent = "Connecté";
});

socket.on("disconnect", () => {
  $("#connectionDot").className = "offline";
  $("#connectionText").textContent = "Déconnecté";
});

socket.on("app:error", ({ message }) => {
  showToast(message);
});

socket.on("room:created", ({ code }) => {
  currentRoomCode = code;
  closeModals();
  showToast(`Salon ${code} créé.`);
});

socket.on("room:update", (room) => {
  state = room;
  currentRoomCode = room.code;

  if (room.status === "lobby") {
    renderLobby();
    showScreen(lobbyScreen);
  } else {
    renderGame();
    showScreen(gameScreen);
  }
});

$("#showCreateButton").addEventListener("click", () => {
  showModal(createModal);
});

$("#showJoinButton").addEventListener("click", () => {
  showModal(joinModal);
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", closeModals);
});

$("#createRoomButton").addEventListener("click", () => {
  const name = $("#createNameInput").value.trim();

  if (!name) {
    showToast("Veuillez renseigner votre nom.");
    return;
  }

  socket.emit("room:create", {
    name,
    settings: {
      expansion: $("#extensionToggle").checked,
      piratePowers: $("#piratePowersToggle").checked,
      specialRules: $("#specialRulesToggle").checked,
      whale: $("#whaleToggle").checked,
      kraken: $("#krakenToggle").checked,
      loot: $("#lootToggle").checked
    }
  });
});

$("#joinRoomButton").addEventListener("click", () => {
  const name = $("#joinNameInput").value.trim();
  const code = $("#joinCodeInput").value.trim().toUpperCase();

  if (!name || !code) {
    showToast("Veuillez renseigner votre nom et le code.");
    return;
  }

  socket.emit("room:join", { name, code });
});

$("#startGameButton").addEventListener("click", () => {
  socket.emit("game:start");
});

$("#submitBidButton").addEventListener("click", () => {
  socket.emit("game:bid", {
    bid: Number($("#bidSelect").value)
  });
});

$("#nextRoundButton").addEventListener("click", () => {
  socket.emit("game:next-round");
});

$("#copyRoomCodeButton").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentRoomCode);
    showToast("Code copié.");
  } catch {
    showToast(`Code du salon : ${currentRoomCode}`);
  }
});

$("#leaveRoomButton").addEventListener("click", () => {
  window.location.reload();
});

function renderLobby() {
  $("#roomCodeDisplay").textContent = state.code;

  $("#playersList").innerHTML = state.players
    .map(
      (player, index) => `
        <div class="player-row">
          <div class="player-info">
            <div class="player-avatar">${index + 1}</div>
            <span class="player-name">${escapeHtml(player.name)}</span>
          </div>
          <span class="player-badge">
            ${player.id === state.hostId ? "Capitaine" : "Joueur"}
          </span>
        </div>
      `
    )
    .join("");

  const settings = state.settings;

  const chips = [
    ["Extension", settings.expansion],
    ["Pouvoirs des pirates", settings.piratePowers],
    ["Règles spéciales", settings.specialRules],
    ["Baleine blanche", settings.whale && settings.specialRules],
    ["Kraken", settings.kraken && settings.specialRules],
    ["Butin", settings.loot && settings.specialRules]
  ];

  $("#settingsSummary").innerHTML = chips
    .map(
      ([label, enabled]) => `
        <div class="setting-chip">
          <span>${label}</span>
          <strong>${enabled ? "Activé" : "Désactivé"}</strong>
        </div>
      `
    )
    .join("");

  const isHost = state.hostId === myId;

  $("#startGameButton").classList.toggle("hidden", !isHost);
  $("#hostHint").textContent = isHost
    ? "Vous êtes le capitaine de cette partie."
    : "En attente du capitaine...";
}

function renderGame() {
  const game = state.game;
  const me = getMyPlayer();

  $("#gameRoomCode").textContent = state.code;
  $("#roundDisplay").textContent = `${game.round} / 10`;

  renderGamePlayers();
  renderGameLog();
  renderPhase(game, me);
  renderBidding(game, me);
  renderTrick(game);
  renderHand(me);
  renderRoundPanels(game);
}

function renderGamePlayers() {
  $("#gamePlayersList").innerHTML = [...state.players]
    .sort((a, b) => b.score - a.score)
    .map(
      (player, index) => `
        <div class="game-player-row">
          <div class="player-info">
            <div class="player-avatar">${index + 1}</div>
            <div>
              <div class="player-name">${escapeHtml(player.name)}</div>
              <small class="muted">
                Mise : ${player.bid === null ? "—" : player.bid}
                · Plis : ${player.tricks}
              </small>
            </div>
          </div>

          <span class="score-badge">${player.score} pts</span>
        </div>
      `
    )
    .join("");
}

function renderGameLog() {
  $("#gameLog").innerHTML =
    state.game.log
      .map(
        (item) => `
          <div class="log-item">
            <span class="log-time">${item.time}</span>
            <div class="log-message">${escapeHtml(item.message)}</div>
          </div>
        `
      )
      .join("") || `<span class="muted">Aucun événement.</span>`;
}

function renderPhase(game, me) {
  const currentName = getPlayerName(game.currentPlayerId);
  let text = "";

  if (game.phase === "bidding") {
    text =
      me.bid === null
        ? "À vous d’annoncer votre nombre de plis."
        : "Les joueurs annoncent leurs mises...";
  } else if (game.phase === "playing") {
    text =
      game.currentPlayerId === myId
        ? "C’est votre tour de jouer."
        : `C’est au tour de ${currentName}.`;
  } else if (game.phase === "round-finished") {
    text = "La manche est terminée.";
  } else {
    text = "La partie est terminée.";
  }

  $("#phaseBanner").textContent = text;
}

function renderBidding(game, me) {
  const panel = $("#biddingPanel");

  if (game.phase !== "bidding") {
    panel.classList.add("hidden");
    return;
  }

  panel.classList.remove("hidden");

  const select = $("#bidSelect");
  select.innerHTML = "";

  for (let i = 0; i <= game.round; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `${i} pli${i > 1 ? "s" : ""}`;
    select.appendChild(option);
  }

  const alreadyBid = me.bid !== null;
  select.disabled = alreadyBid;
  $("#submitBidButton").disabled = alreadyBid;

  if (alreadyBid) {
    select.value = me.bid;
  }
}

function renderTrick(game) {
  $("#trickTitle").textContent =
    game.trick.length === 0
      ? "Aucune carte jouée"
      : `${game.trick.length} carte(s) sur ${state.players.length}`;

  if (game.trick.length === 0) {
    $("#trickCards").className = "trick-cards empty-state";
    $("#trickCards").textContent = "Aucune carte jouée.";
    return;
  }

  $("#trickCards").className = "trick-cards";

  $("#trickCards").innerHTML = game.trick
    .map(
      ({ playerId, card }) => `
        <div class="played-card">
          <span class="card-owner">${escapeHtml(getPlayerName(playerId))}</span>
          <span class="card-name">${escapeHtml(card.name)}</span>
        </div>
      `
    )
    .join("");
}

function renderHand(me) {
  const game = state.game;
  const hand = state.hand || [];
  const myTurn = game.currentPlayerId === myId && game.phase === "playing";

  $("#handTitle").textContent = `${hand.length} carte(s)`;
  $("#turnIndicator").textContent = myTurn ? "À VOUS DE JOUER" : "";

  $("#playerHand").innerHTML = hand
    .map((card) => {
      const playable = myTurn && isCardPlayable(card);

      return `
        <button
          class="card ${card.color || ""} ${card.type !== "number" ? "special" : ""}"
          data-card-id="${card.id}"
          ${playable ? "" : "disabled"}
        >
          <span class="card-number">
            ${card.type === "number" ? card.value : "★"}
          </span>

          <span class="card-symbol">
            ${card.type === "number" ? getSymbol(card.color) : getSpecialIcon(card.type)}
          </span>

          <span class="card-name">${escapeHtml(card.name)}</span>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-card-id]").forEach((button) => {
    button.addEventListener("click", () => {
      socket.emit("game:play-card", {
        cardId: button.dataset.cardId
      });
    });
  });
}

function renderRoundPanels(game) {
  $("#roundFinishedPanel").classList.toggle(
    "hidden",
    game.phase !== "round-finished"
  );

  $("#finishedPanel").classList.toggle(
    "hidden",
    game.phase !== "finished"
  );

  $("#nextRoundButton").classList.toggle(
    "hidden",
    state.hostId !== myId
  );
}

function isCardPlayable(card) {
  const game = state.game;

  if (!game.leadColor) return true;
  if (card.type !== "number") return true;

  const hasLeadColor = state.hand.some(
    (handCard) =>
      handCard.type === "number" &&
      handCard.color === game.leadColor
  );

  if (!hasLeadColor) return true;

  return card.color === game.leadColor;
}

function getSymbol(color) {
  return {
    red: "◆",
    yellow: "☀",
    green: "♣",
    purple: "☾"
  }[color] || "★";
}

function getSpecialIcon(type) {
  return {
    pirate: "⚔",
    "skull-king": "☠",
    mermaid: "♆",
    escape: "↗",
    tigress: "🐅",
    kraken: "🐙",
    whale: "🐋",
    loot: "✦"
  }[type] || "★";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}