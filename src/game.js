const {
  createDeck,
  shuffle
} = require("./cards");

const MAX_PLAYERS = 6;
const MIN_PLAYERS = 2;
const TOTAL_ROUNDS = 10;

function createRoom(code, hostId, hostName, settings) {
  return {
    code,
    hostId,
    status: "lobby",
    players: [
      createPlayer(hostId, hostName)
    ],
    settings: {
      expansion: Boolean(settings?.expansion),
      piratePowers: Boolean(settings?.piratePowers),
      specialRules: Boolean(settings?.specialRules),
      whale: Boolean(settings?.whale),
      kraken: Boolean(settings?.kraken),
      loot: Boolean(settings?.loot)
    },
    game: null
  };
}

function createPlayer(id, name) {
  return {
    id,
    name: name?.trim()?.slice(0, 24) || "Pirate",
    score: 0,
    roundScore: 0,
    hand: [],
    bid: null,
    tricks: 0,
    connected: true
  };
}

function addPlayer(room, id, name) {
  if (room.players.length >= MAX_PLAYERS) {
    throw new Error("La partie est complète.");
  }

  if (room.status !== "lobby") {
    throw new Error("La partie a déjà commencé.");
  }

  if (room.players.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("Ce nom est déjà utilisé dans la partie.");
  }

  room.players.push(createPlayer(id, name));
}

function removePlayer(room, id) {
  room.players = room.players.filter((player) => player.id !== id);

  if (room.hostId === id && room.players.length > 0) {
    room.hostId = room.players[0].id;
  }
}

function startGame(room) {
  if (room.players.length < MIN_PLAYERS) {
    throw new Error(`Il faut au moins ${MIN_PLAYERS} joueurs.`);
  }

  room.status = "playing";

  room.game = {
    round: 0,
    currentPlayerIndex: 0,
    trick: [],
    trickNumber: 0,
    leadColor: null,
    log: [],
    lastWinnerId: null,
    phase: "bidding"
  };

  for (const player of room.players) {
    player.score = 0;
  }

  startRound(room);
}

function startRound(room) {
  const game = room.game;

  game.round += 1;
  game.trick = [];
  game.trickNumber = 0;
  game.leadColor = null;
  game.phase = "bidding";
  game.currentPlayerIndex = (game.round - 1) % room.players.length;

  const deck = shuffle(createDeck(room.settings));
  const cardsPerPlayer = game.round;

  for (const player of room.players) {
    player.hand = [];
    player.bid = null;
    player.tricks = 0;
    player.roundScore = 0;
  }

  for (let i = 0; i < cardsPerPlayer; i++) {
    for (const player of room.players) {
      const card = deck.pop();

      if (card) {
        player.hand.push(card);
      }
    }
  }

  addLog(room, `Manche ${game.round} : distribution de ${cardsPerPlayer} carte(s).`);
}

function submitBid(room, playerId, bid) {
  if (room.game.phase !== "bidding") {
    throw new Error("Les enchères sont terminées.");
  }

  const player = getPlayer(room, playerId);

  if (player.bid !== null) {
    throw new Error("Vous avez déjà annoncé votre mise.");
  }

  const numericBid = Number(bid);

  if (
    !Number.isInteger(numericBid) ||
    numericBid < 0 ||
    numericBid > room.game.round
  ) {
    throw new Error("Mise invalide.");
  }

  player.bid = numericBid;

  addLog(room, `${player.name} annonce ${numericBid} pli(s).`);

  if (room.players.every((p) => p.bid !== null)) {
    room.game.phase = "playing";
    room.game.currentPlayerIndex = (room.game.round - 1) % room.players.length;
    addLog(room, "Toutes les mises sont annoncées. Le premier joueur commence.");
  }
}

function playCard(room, playerId, cardId) {
  const game = room.game;

  if (game.phase !== "playing") {
    throw new Error("Ce n'est pas le moment de jouer une carte.");
  }

  const currentPlayer = room.players[game.currentPlayerIndex];

  if (currentPlayer.id !== playerId) {
    throw new Error("Ce n'est pas votre tour.");
  }

  const player = getPlayer(room, playerId);
  const cardIndex = player.hand.findIndex((card) => card.id === cardId);

  if (cardIndex === -1) {
    throw new Error("Carte introuvable.");
  }

  const card = player.hand[cardIndex];

  if (!canPlayCard(player.hand, card, game.leadColor)) {
    throw new Error("Vous devez respecter la couleur demandée.");
  }

  player.hand.splice(cardIndex, 1);

  if (game.trick.length === 0 && card.type === "number") {
    game.leadColor = card.color;
  }

  game.trick.push({
    playerId,
    card
  });

  addLog(room, `${player.name} joue ${card.name}.`);

  if (game.trick.length === room.players.length) {
    resolveTrick(room);
  } else {
    game.currentPlayerIndex =
      (game.currentPlayerIndex + 1) % room.players.length;
  }
}

function canPlayCard(hand, card, leadColor) {
  if (!leadColor) return true;
  if (card.type !== "number") return true;

  const hasLeadColor = hand.some(
    (handCard) =>
      handCard.type === "number" &&
      handCard.color === leadColor
  );

  if (!hasLeadColor) return true;

  return card.color === leadColor;
}

function resolveTrick(room) {
  const game = room.game;
  const trick = game.trick;

  const winnerEntry = determineWinner(trick, room.settings);
  const winner = getPlayer(room, winnerEntry.playerId);

  winner.tricks += 1;
  game.lastWinnerId = winner.id;

  addLog(room, `${winner.name} remporte le pli.`);

  game.trickNumber += 1;
  game.trick = [];
  game.leadColor = null;
  game.currentPlayerIndex = room.players.findIndex(
    (player) => player.id === winner.id
  );

  const hasCards = room.players.some((player) => player.hand.length > 0);

  if (!hasCards) {
    finishRound(room);
  }
}

function determineWinner(trick, settings) {
  if (
    settings.specialRules &&
    settings.kraken &&
    trick.some((entry) => entry.card.type === "kraken")
  ) {
    return trick[trick.length - 1];
  }

  if (
    settings.specialRules &&
    settings.whale &&
    trick.some((entry) => entry.card.type === "whale")
  ) {
    const numbers = trick.filter((entry) => entry.card.type === "number");

    if (numbers.length > 0) {
      return numbers.reduce((best, current) => {
        return current.card.value > best.card.value ? current : best;
      });
    }
  }

  const skullKing = trick.find(
    (entry) => entry.card.type === "skull-king"
  );

  const mermaid = trick.find(
    (entry) => entry.card.type === "mermaid"
  );

  if (skullKing && mermaid) return mermaid;
  if (skullKing) return skullKing;

  const pirates = trick.filter(
    (entry) =>
      entry.card.type === "pirate" ||
      entry.card.type === "tigress"
  );

  if (pirates.length > 0) return pirates[0];

  const numbers = trick.filter(
    (entry) => entry.card.type === "number"
  );

  if (numbers.length > 0) {
    const leadColor = numbers[0].card.color;
    const sameColor = numbers.filter(
      (entry) => entry.card.color === leadColor
    );

    return sameColor.reduce((best, current) => {
      return current.card.value > best.card.value ? current : best;
    });
  }

  return trick[trick.length - 1];
}

function finishRound(room) {
  const game = room.game;

  for (const player of room.players) {
    const bid = player.bid || 0;
    const tricks = player.tricks || 0;

    if (bid === tricks) {
      player.roundScore = bid === 0 ? 10 * game.round : bid * 20;
    } else {
      player.roundScore = -Math.abs(bid - tricks) * 10;
    }

    player.score += player.roundScore;
  }

  addLog(room, `La manche ${game.round} est terminée.`);

  if (game.round >= TOTAL_ROUNDS) {
    room.status = "finished";
    game.phase = "finished";
    addLog(room, "La partie est terminée !");
    return;
  }

  game.phase = "round-finished";
}

function nextRound(room) {
  if (room.game.phase !== "round-finished") {
    throw new Error("La manche actuelle n'est pas terminée.");
  }

  startRound(room);
}

function getPlayer(room, playerId) {
  const player = room.players.find((item) => item.id === playerId);

  if (!player) {
    throw new Error("Joueur introuvable.");
  }

  return player;
}

function addLog(room, message) {
  room.game.log.unshift({
    id: `${Date.now()}-${Math.random()}`,
    message,
    time: new Date().toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit"
    })
  });

  room.game.log = room.game.log.slice(0, 30);
}

function serializeRoom(room, viewerId) {
  const viewer = room.players.find((player) => player.id === viewerId);

  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    settings: room.settings,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      roundScore: player.roundScore,
      bid: player.bid,
      tricks: player.tricks,
      handCount: player.hand.length,
      connected: player.connected
    })),
    game: room.game
      ? {
          round: room.game.round,
          phase: room.game.phase,
          trickNumber: room.game.trickNumber,
          currentPlayerId:
            room.players[room.game.currentPlayerIndex]?.id || null,
          leadColor: room.game.leadColor,
          trick: room.game.trick,
          lastWinnerId: room.game.lastWinnerId,
          log: room.game.log
        }
      : null,
    hand: viewer?.hand || []
  };
}

module.exports = {
  createRoom,
  addPlayer,
  removePlayer,
  startGame,
  submitBid,
  playCard,
  nextRound,
  serializeRoom
};