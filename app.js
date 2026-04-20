const DATA_PATHS = {
  pokemon: "./data/pokemon.json",
  traits: "./data/traits.json",
  matchups: "./data/matchups.json"
};

let pokemonList = [];
let traitsList = [];
let matchups = [];

// trait名 → id
const traitNameToId = {
  "DPS": 1,
  "バースト": 2,
  "フロント": 3,
  "機動力": 4,
  "CC": 5,
  "オブジェクト": 6,
  "射程": 7,
  "エンゲージ": 8
};

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  createPickSelectors();
  bindEvents();
  updateSelectOptions();
  calculateResults();
});

// ----------------
// データ読み込み
// ----------------
async function loadData() {
  const [pokemonRes, traitsRes, matchupsRes] = await Promise.all([
    fetch(DATA_PATHS.pokemon),
    fetch(DATA_PATHS.traits),
    fetch(DATA_PATHS.matchups)
  ]);

  pokemonList = await pokemonRes.json();
  traitsList = await traitsRes.json();
  matchups = await matchupsRes.json();
}

// ----------------
// UI生成
// ----------------
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

// ----------------
// イベント
// ----------------
function bindEvents() {
  document.getElementById("reset-btn").addEventListener("click", resetAll);

  const allSelects = document.querySelectorAll(".pick-slot select");
  allSelects.forEach((select) => {
    select.addEventListener("change", () => {
      updateSelectOptions();
      calculateResults();
    });
  });
}

// ----------------
// 重複選択禁止
// ----------------
function updateSelectOptions() {
  const allSelects = document.querySelectorAll(".pick-slot select");

  const selectedValues = Array.from(allSelects)
    .map((s) => s.value)
    .filter((v) => v !== "");

  allSelects.forEach((currentSelect) => {
    const currentValue = currentSelect.value;

    Array.from(currentSelect.options).forEach((option) => {
      if (option.value === "") {
        option.disabled = false;
        return;
      }

      if (option.value === currentValue) {
        option.disabled = false;
        return;
      }

      option.disabled = selectedValues.includes(option.value);
    });
  });
}

// ----------------
// 選択取得
// ----------------
function getSelectedPokemonIds() {
  const allyIds = [];
  const enemyIds = [];

  for (let i = 1; i <= 5; i++) {
    const ally = document.getElementById(`ally-${i}`).value;
    const enemy = document.getElementById(`enemy-${i}`).value;

    if (ally) allyIds.push(Number(ally));
    if (enemy) enemyIds.push(Number(enemy));
  }

  return { allyIds, enemyIds };
}

// ----------------
// スコア計算
// ----------------
function calculateResults() {
  const { allyIds, enemyIds } = getSelectedPokemonIds();
  const selectedIds = [...allyIds, ...enemyIds];

  const candidates = pokemonList.filter((p) => !selectedIds.includes(p.id));

  const results = candidates.map((candidate) =>
    calculatePokemonScore(candidate, allyIds, enemyIds)
  );

  results.sort((a, b) => b.totalScore - a.totalScore);

  renderResults(results);
}

function calculatePokemonScore(candidate, allyIds, enemyIds) {
  let totalScore = candidate.baseScore || 0;
  const reasons = [];

  // 敵との相性
  enemyIds.forEach((enemyId) => {
    const enemy = pokemonList.find((p) => p.id === enemyId);
    if (!enemy) return;

    Object.entries(candidate.traits).forEach(([myTrait, myWeight]) => {
      const myId = traitNameToId[myTrait];

      Object.entries(enemy.traits).forEach(([enemyTrait, enemyWeight]) => {
        const enemyId = traitNameToId[enemyTrait];

        const matchup = getMatchup(myId, enemyId);
        if (!matchup) return;

        const gain = myWeight * enemyWeight * matchup.score;
        totalScore += gain;

        reasons.push({
          text: `${myTrait} → ${enemyTrait}: ${matchup.reason}`,
          value: gain
        });
      });
    });
  });

  // 味方シナジー（簡易）
  allyIds.forEach((allyId) => {
    const ally = pokemonList.find((p) => p.id === allyId);
    if (!ally) return;

    Object.entries(candidate.traits).forEach(([myTrait]) => {
      Object.entries(ally.traits).forEach(([allyTrait]) => {
        if (myTrait === allyTrait) {
          totalScore += 3;
          reasons.push({
            text: `${myTrait} が味方とシナジー`,
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
    reasons: reasons.slice(0, 5),
    tags: candidate.tags || []
  };
}

// ----------------
// 相性取得
// ----------------
function getMatchup(attackerTraitId, defenderTraitId) {
  return matchups.find(
    (m) =>
      m.attackerTraitId === attackerTraitId &&
      m.defenderTraitId === defenderTraitId
  );
}

// ----------------
// 表示
// ----------------
function renderResults(results) {
  const container = document.getElementById("result-list");
  container.innerHTML = "";

  if (results.length === 0) {
    container.innerHTML = "<p>候補なし</p>";
    return;
  }

  results.forEach((r, i) => {
    const div = document.createElement("div");
    div.className = "result-card";

    const tags = r.tags.length ? `タグ: ${r.tags.join(", ")}` : "";

    div.innerHTML = `
      <div class="result-header">
        <strong>${i + 1}. ${r.pokemonName}</strong>
        <span>${r.totalScore}</span>
      </div>
      <div>${r.tier} Tier</div>
      <div>${tags}</div>
      <ul>
        ${r.reasons.map((x) => `<li>${x.text} (+${x.value})</li>`).join("")}
      </ul>
    `;

    container.appendChild(div);
  });
}

// ----------------
// ティア変換
// ----------------
function convertScoreToTier(score) {
  if (score >= 120) return "S";
  if (score >= 70) return "A";
  if (score >= 35) return "B";
  if (score >= 10) return "C";
  return "D";
}

// ----------------
// リセット
// ----------------
function resetAll() {
  for (let i = 1; i <= 5; i++) {
    document.getElementById(`ally-${i}`).value = "";
    document.getElementById(`enemy-${i}`).value = "";
  }

  updateSelectOptions();
  calculateResults();
}