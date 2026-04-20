const DATA_PATHS = {
  pokemon: "./data/pokemon.json",
  traits: "./data/traits.json",
  pokemonTraits: "./data/pokemon_traits.json",
  matchups: "./data/matchups.json"
};

let pokemonList = [];
let traitsList = [];
let pokemonTraits = [];
let matchups = [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  createPickSelectors();
  bindEvents();
});

async function loadData() {
  const [pokemonRes, traitsRes, pokemonTraitsRes, matchupsRes] = await Promise.all([
    fetch(DATA_PATHS.pokemon),
    fetch(DATA_PATHS.traits),
    fetch(DATA_PATHS.pokemonTraits),
    fetch(DATA_PATHS.matchups)
  ]);

  pokemonList = await pokemonRes.json();
  traitsList = await traitsRes.json();
  pokemonTraits = await pokemonTraitsRes.json();
  matchups = await matchupsRes.json();
}

function createPickSelectors() {
  const allyContainer = document.getElementById("ally-picks");
  const enemyContainer = document.getElementById("enemy-picks");

  for (let i = 1; i <= 5; i++) {
    allyContainer.appendChild(createPickSlot(`ally-${i}`, `味方${i}`));
    enemyContainer.appendChild(createPickSlot(`enemy-${i}`, `相手${i}`));
  }
}

function createPickSlot(id, labelText) {
  const wrapper = document.createElement("div");
  wrapper.className = "pick-slot";

  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = labelText;

  const select = document.createElement("select");
  select.id = id;

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "未選択";
  select.appendChild(defaultOption);

  pokemonList.forEach((pokemon) => {
    const option = document.createElement("option");
    option.value = pokemon.id;
    option.textContent = pokemon.name;
    select.appendChild(option);
  });

  wrapper.appendChild(label);
  wrapper.appendChild(select);

  return wrapper;
}

function bindEvents() {
  document.getElementById("calculate-btn").addEventListener("click", calculateResults);
  document.getElementById("reset-btn").addEventListener("click", resetAll);
}

function getSelectedPokemonIds() {
  const allyIds = [];
  const enemyIds = [];

  for (let i = 1; i <= 5; i++) {
    const allyValue = document.getElementById(`ally-${i}`).value;
    const enemyValue = document.getElementById(`enemy-${i}`).value;

    if (allyValue) allyIds.push(Number(allyValue));
    if (enemyValue) enemyIds.push(Number(enemyValue));
  }

  return { allyIds, enemyIds };
}

function getPokemonTraitsByPokemonId(pokemonId) {
  return pokemonTraits.filter((item) => item.pokemonId === pokemonId);
}

function getTraitName(traitId) {
  const trait = traitsList.find((t) => t.id === traitId);
  return trait ? trait.name : "不明";
}

function getMatchup(attackerTraitId, defenderTraitId) {
  return matchups.find(
    (m) =>
      m.attackerTraitId === attackerTraitId &&
      m.defenderTraitId === defenderTraitId
  );
}

function calculateResults() {
  const { allyIds, enemyIds } = getSelectedPokemonIds();
  const selectedIds = [...allyIds, ...enemyIds];

  const candidates = pokemonList.filter((pokemon) => !selectedIds.includes(pokemon.id));
  const results = candidates.map((candidate) =>
    calculatePokemonScore(candidate, allyIds, enemyIds)
  );

  results.sort((a, b) => b.totalScore - a.totalScore);
  renderResults(results);
}

function calculatePokemonScore(candidate, allyIds, enemyIds) {
  const candidateTraits = getPokemonTraitsByPokemonId(candidate.id);
  let totalScore = candidate.baseScore || 0;
  const reasons = [];

  enemyIds.forEach((enemyId) => {
    const enemyTraits = getPokemonTraitsByPokemonId(enemyId);

    candidateTraits.forEach((myTrait) => {
      enemyTraits.forEach((enemyTrait) => {
        const matchup = getMatchup(myTrait.traitId, enemyTrait.traitId);

        if (!matchup) return;

        const scoreGain =
          myTrait.weight * enemyTrait.weight * matchup.score;

        totalScore += scoreGain;

        reasons.push({
          text: `${getTraitName(myTrait.traitId)} → ${getTraitName(enemyTrait.traitId)}: ${matchup.reason}`,
          value: scoreGain
        });
      });
    });
  });

  allyIds.forEach((allyId) => {
    const allyTraits = getPokemonTraitsByPokemonId(allyId);

    candidateTraits.forEach((myTrait) => {
      allyTraits.forEach((allyTrait) => {
        if (myTrait.traitId === allyTrait.traitId) {
          totalScore += 3;
          reasons.push({
            text: `${getTraitName(myTrait.traitId)} が味方と役割共有しやすい`,
            value: 3
          });
        }
      });
    });
  });

  reasons.sort((a, b) => b.value - a.value);

  return {
    pokemonName: candidate.name,
    totalScore,
    tier: convertScoreToTier(totalScore),
    reasons: reasons.slice(0, 5)
  };
}

function convertScoreToTier(score) {
  if (score >= 120) return "S";
  if (score >= 70) return "A";
  if (score >= 35) return "B";
  if (score >= 10) return "C";
  return "D";
}

function getTierClass(tier) {
  switch (tier) {
    case "S":
      return "tier-s";
    case "A":
      return "tier-a";
    case "B":
      return "tier-b";
    case "C":
      return "tier-c";
    default:
      return "tier-d";
  }
}

function renderResults(results) {
  const resultList = document.getElementById("result-list");
  resultList.innerHTML = "";

  if (results.length === 0) {
    resultList.innerHTML = `<p class="empty-text">候補がありません。</p>`;
    return;
  }

  results.forEach((result, index) => {
    const card = document.createElement("div");
    card.className = "result-card";

    const reasonsHtml = result.reasons.length
      ? `<ul class="reason-list">
          ${result.reasons.map((reason) => `<li>${reason.text} (+${reason.value})</li>`).join("")}
        </ul>`
      : `<p class="empty-text">有効な理由はまだありません。</p>`;

    card.innerHTML = `
      <div class="result-header">
        <div class="result-name">${index + 1}. ${result.pokemonName}</div>
        <div class="result-score">${result.totalScore}</div>
      </div>
      <div class="result-tier ${getTierClass(result.tier)}">${result.tier} Tier</div>
      ${reasonsHtml}
    `;

    resultList.appendChild(card);
  });
}

function resetAll() {
  for (let i = 1; i <= 5; i++) {
    document.getElementById(`ally-${i}`).value = "";
    document.getElementById(`enemy-${i}`).value = "";
  }

  document.getElementById("result-list").innerHTML =
    `<p class="empty-text">まだ計算していません。</p>`;
}