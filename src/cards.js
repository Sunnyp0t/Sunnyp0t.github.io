const COLORS = ["red", "yellow", "green", "purple"];

const COLOR_LABELS = {
  red: "Rouge",
  yellow: "Jaune",
  green: "Vert",
  purple: "Violet"
};

function createCard(type, options = {}) {
  return {
    id: options.id || `${type}-${Math.random().toString(36).slice(2, 10)}`,
    type,
    value: options.value ?? null,
    color: options.color ?? null,
    name: options.name || type,
    power: options.power || null
  };
}

function createDeck(settings) {
  const deck = [];

  for (const color of COLORS) {
    const max = settings.expansion ? 14 : 13;

    for (let value = 1; value <= max; value++) {
      deck.push(
        createCard("number", {
          color,
          value,
          name: `${COLOR_LABELS[color]} ${value}`
        })
      );
    }
  }

  deck.push(
    createCard("pirate", {
      name: "Pirate",
      power: "pirate"
    })
  );

  deck.push(
    createCard("skull-king", {
      name: "Skull King",
      power: "skull-king"
    })
  );

  deck.push(
    createCard("mermaid", {
      name: "Sirène",
      power: "mermaid"
    })
  );

  for (let i = 0; i < 5; i++) {
    deck.push(
      createCard("escape", {
        name: "Fuite",
        power: "escape"
      })
    );
  }

  if (settings.expansion) {
    deck.push(
      createCard("pirate", {
        name: "Pirate navigateur",
        power: "navigator"
      })
    );

    deck.push(
      createCard("pirate", {
        name: "Pirate charmeur",
        power: "charming"
      })
    );

    deck.push(
      createCard("tigress", {
        name: "Tigresse",
        power: "tigress"
      })
    );

    if (settings.specialRules && settings.kraken) {
      deck.push(
        createCard("kraken", {
          name: "Kraken",
          power: "kraken"
        })
      );
    }

    if (settings.specialRules && settings.whale) {
      deck.push(
        createCard("whale", {
          name: "Baleine blanche",
          power: "whale"
        })
      );
    }

    if (settings.specialRules && settings.loot) {
      deck.push(
        createCard("loot", {
          name: "Butin",
          power: "loot"
        })
      );

      deck.push(
        createCard("loot", {
          name: "Butin",
          power: "loot"
        })
      );
    }
  }

  return deck;
}

function shuffle(cards) {
  const result = [...cards];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

module.exports = {
  COLORS,
  COLOR_LABELS,
  createDeck,
  shuffle
};