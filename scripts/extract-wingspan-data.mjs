import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const defaults = {
  source: path.join(os.homedir(), "Downloads", "wingspan"),
  lang: path.join(
    os.tmpdir(),
    "wingspan-resource-audit-20260831",
    "lang_wingspan.js",
  ),
  out: path.join(projectRoot, "src", "data"),
};

function parseArguments(argv) {
  const options = { ...defaults };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      throw new Error(`Unknown argument: ${argument}`);
    }

    const name = argument.slice(2);
    if (!(name in options)) {
      throw new Error(`Unknown option: --${name}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }

    options[name] = path.resolve(value);
    index += 1;
  }
  return options;
}

function extractJsonArray(document, key, searchStart = 0) {
  const keyToken = `"${key}":`;
  const keyIndex = document.indexOf(keyToken, searchStart);
  if (keyIndex === -1) {
    throw new Error(`Could not find JSON key ${key}`);
  }

  const arrayStart = document.indexOf("[", keyIndex + keyToken.length);
  if (arrayStart === -1) {
    throw new Error(`Could not find array value for ${key}`);
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = arrayStart; index < document.length; index += 1) {
    const character = document[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "[") {
      depth += 1;
    } else if (character === "]") {
      depth -= 1;
      if (depth === 0) {
        const end = index + 1;
        return {
          value: JSON.parse(document.slice(arrayStart, end)),
          start: arrayStart,
          end,
        };
      }
    }
  }

  throw new Error(`Unterminated JSON array for ${key}`);
}

function parseAmdDictionary(contents) {
  const objectStart = contents.indexOf("{");
  const objectEnd = contents.lastIndexOf("}");
  if (objectStart === -1 || objectEnd <= objectStart) {
    throw new Error("Language file does not contain an AMD object");
  }
  return JSON.parse(contents.slice(objectStart, objectEnd + 1));
}

function assertUnique(items, field, label) {
  const values = items.map((item) => item[field]);
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contains duplicate ${field} values`);
  }
}

function numericValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
}

const options = parseArguments(process.argv.slice(2));
const document = fs.readFileSync(options.source, "utf8");
const translations = fs.existsSync(options.lang)
  ? parseAmdDictionary(fs.readFileSync(options.lang, "utf8"))
  : {};
const translate = (value) => (value ? (translations[value] ?? null) : null);

const foodTypesSource = extractJsonArray(document, "food_types");
const nestTypesSource = extractJsonArray(document, "nest_types");
const habitatsSource = extractJsonArray(document, "habitats");
const birdsSource = extractJsonArray(document, "birds");
const bonusCardsSource = extractJsonArray(
  document,
  "bonuscards",
  birdsSource.end,
);

const rawBirds = birdsSource.value;
const rawBonusCards = bonusCardsSource.value;

if (rawBirds.length !== 180) {
  throw new Error(`Expected 180 bird cards, found ${rawBirds.length}`);
}
if (rawBonusCards.length !== 26) {
  throw new Error(`Expected 26 bonus cards, found ${rawBonusCards.length}`);
}
assertUnique(rawBirds, "identifier", "Bird data");
assertUnique(rawBirds, "index", "Bird data");
assertUnique(rawBonusCards, "identifier", "Bonus-card data");
assertUnique(rawBonusCards, "index", "Bonus-card data");

const sets = [
  { value: 0, id: "originalCore", name: { en: "Original Core", zh: "核心版" } },
  { value: 1, id: "swiftStart", name: { en: "Swift Start", zh: "快速入门" } },
  { value: 2, id: "european", name: { en: "European Expansion", zh: "欧洲扩展" } },
  { value: 3, id: "oceania", name: { en: "Oceania Expansion", zh: "大洋洲扩展" } },
];
const setByValue = new Map(sets.map((item) => [item.value, item.id]));

const foodNamesZh = ["无脊椎动物", "种子", "鱼", "水果", "啮齿动物", "花蜜", "任意食物"];
const foodTypes = foodTypesSource.value.map((item, value) => ({
  value,
  id: item.identifier,
  name: { en: item.name, zh: translate(item.name) ?? foodNamesZh[value] },
}));

const nestNamesZh = ["无巢", "碗巢", "洞巢", "地面巢", "平台巢", "星巢"];
const nestTypes = nestTypesSource.value.map((item, value) => ({
  value,
  id: item.identifier,
  name: { en: item.name, zh: translate(item.name) ?? nestNamesZh[value] },
}));

const habitatNamesZh = ["打出鸟牌", "森林", "草原", "湿地"];
const habitats = habitatsSource.value.map((item, value) => ({
  value,
  birdFlagIndex: value === 0 ? null : value - 1,
  id: item.identifier,
  name: { en: item.name, zh: translate(item.name) ?? habitatNamesZh[value] },
}));

const powerColors = [
  { value: 0, id: "none", name: { en: "None", zh: "无能力" } },
  { value: 1, id: "brown", name: { en: "Brown", zh: "棕色能力" } },
  { value: 2, id: "pink", name: { en: "Pink", zh: "粉色能力" } },
  { value: 3, id: "teal", name: { en: "Teal", zh: "蓝绿色能力" } },
  { value: 4, id: "white", name: { en: "White", zh: "白色能力" } },
  { value: 5, id: "yellow", name: { en: "Yellow", zh: "黄色能力" } },
];

const powerCategories = [
  ["none", "None", "无"],
  ["cachingFood", "Caching food", "缓存食物"],
  ["cardDrawing", "Card drawing", "抽取鸟卡"],
  ["eggLaying", "Egg laying", "产蛋"],
  ["flocking", "Flocking", "塞牌"],
  ["foodFromBirdfeeder", "Food from birdfeeder", "从喂食器获得食物"],
  ["foodFromSupply", "Food from supply", "从供应区获得食物"],
  ["foodRelated", "Food related", "食物相关"],
  ["huntingAndFishing", "Hunting and fishing", "捕猎与捕鱼"],
  ["other", "Other", "其他"],
  ["tucking", "Tucking", "塞牌"],
].map(([id, en, zh], value) => ({ value, id, name: { en, zh } }));

const powerFlags = [
  { index: 0, id: "predator", name: { en: "Predator", zh: "捕食者" } },
  { index: 1, id: "flocking", name: { en: "Flocking", zh: "群居" } },
  { index: 2, id: "bonusCard", name: { en: "Bonus card", zh: "奖励卡相关" } },
];

const powerColorByValue = new Map(powerColors.map((item) => [item.value, item.id]));
const powerCategoryByValue = new Map(
  powerCategories.map((item) => [item.value, item.id]),
);
const foodIdByValue = foodTypes.map((item) => item.id);
const nestIdByValue = nestTypes.map((item) => item.id);
const birdHabitats = habitats.filter((item) => item.birdFlagIndex !== null);
const bonusIdByEnum = new Map(
  rawBonusCards
    .filter((item) => item.ENUM !== undefined && item.ENUM !== null)
    .map((item) => [Number(item.ENUM), item.identifier]),
);

const birds = rawBirds
  .map((bird) => {
    const foodAmounts = Object.fromEntries(
      foodIdByValue.map((id, index) => [id, Number(bird.food[index] ?? 0)]),
    );
    const habitatIds = birdHabitats
      .filter((habitat) => Boolean(bird.habitat[habitat.birdFlagIndex]))
      .map((habitat) => habitat.id);
    const bonusCardIds = (bird.bonuscards ?? [])
      .map((matches, enumValue) => (matches ? bonusIdByEnum.get(enumValue) : null))
      .filter(Boolean);
    const hasPower = Number(bird.powercolor) !== 0 || Boolean(bird.powertext);

    return {
      id: bird.identifier,
      index: Number(bird.index),
      set: setByValue.get(Number(bird.set)),
      names: {
        en: bird.commonname,
        zh: bird.commonnametr ?? translate(bird.commonname),
        scientific: bird.scientificname,
      },
      sprite: {
        sheet: Number(bird.set) === 1 ? "birdsSwiftStart" : "birdsOriginalCore",
        row: Number(bird.img_loc[0]),
        column: Number(bird.img_loc[1]),
      },
      victoryPoints: Number(bird.vp),
      nestType: nestIdByValue[Number(bird.nesttype)],
      eggCapacity: Number(bird.eggcapacity),
      wingspanCm: Number(bird.wingspan),
      habitats: habitatIds,
      foodCost: {
        amounts: foodAmounts,
        alternative: Boolean(bird.foodslash),
        total: Number(bird.totalfood),
      },
      power: hasPower
        ? {
            color: powerColorByValue.get(Number(bird.powercolor)),
            category: powerCategoryByValue.get(Number(bird.powercategory)),
            text: {
              en: bird.powertext ?? null,
              zh: translate(bird.powertext),
            },
            flags: {
              predator: Boolean(bird.powerflags?.[0]),
              flocking: Boolean(bird.powerflags?.[1]),
              bonusCard: Boolean(bird.powerflags?.[2]),
            },
            autoActivateDefault:
              bird.powerautodefault === undefined
                ? null
                : Boolean(bird.powerautodefault),
          }
        : null,
      bonusCardIds,
    };
  })
  .sort((left, right) => left.index - right.index);

const bonusCards = rawBonusCards
  .map((card) => ({
    id: card.identifier,
    index: Number(card.index),
    compatibilityEnum: numericValue(card.ENUM),
    set: setByValue.get(Number(card.set)),
    names: {
      en: card.name,
      zh: card.nametr ?? translate(card.name),
    },
    sprite: {
      sheet: "bonusCards",
      row: Number(card.img_loc[0]),
      column: Number(card.img_loc[1]),
    },
    condition: {
      en: card.condition ?? null,
      zh: translate(card.condition),
    },
    explanation: {
      en: card.explanatory ?? null,
      zh: translate(card.explanatory),
    },
    scoring: {
      en: card.vp ?? null,
      zh: translate(card.vp),
    },
    deckPercentage: numericValue(card.percentage),
    languageDependent: Boolean(card.language_dependent),
    automa: Boolean(card.automa),
  }))
  .sort((left, right) => left.index - right.index);

const enums = {
  schemaVersion: 1,
  sets,
  foodTypes,
  nestTypes,
  habitats,
  powerColors,
  powerCategories,
  powerFlags,
  spriteSheets: [
    {
      id: "birdsOriginalCore",
      standardFile: "birds_originalcore.png",
      highResolutionFile: "birds_originalcore@2x.png",
      columns: 16,
      rows: 11,
      standardTile: { width: 154, height: 231 },
      highResolutionTile: { width: 240, height: 363 },
    },
    {
      id: "birdsSwiftStart",
      standardFile: "birds_swiftstart.png",
      highResolutionFile: "birds_swiftstart@2x.png",
      columns: 10,
      rows: 1,
      standardTile: { width: 154, height: 231 },
      highResolutionTile: { width: 240, height: 363 },
    },
    {
      id: "bonusCards",
      standardFile: "bonus_cards.png",
      highResolutionFile: null,
      columns: 10,
      rows: 5,
      standardTile: { width: 162, height: 247 },
      sourceTile: { width: 250, height: 378 },
      highResolutionTile: null,
    },
  ],
};

fs.mkdirSync(options.out, { recursive: true });
fs.writeFileSync(
  path.join(options.out, "birds.json"),
  `${JSON.stringify(birds, null, 2)}\n`,
  "utf8",
);
fs.writeFileSync(
  path.join(options.out, "bonus-cards.json"),
  `${JSON.stringify(bonusCards, null, 2)}\n`,
  "utf8",
);
fs.writeFileSync(
  path.join(options.out, "enums.json"),
  `${JSON.stringify(enums, null, 2)}\n`,
  "utf8",
);

const poweredBirds = birds.filter((bird) => bird.power);
const translatedPowers = poweredBirds.filter((bird) => bird.power.text.zh);
const translatedBonusFields = bonusCards.reduce(
  (count, card) =>
    count +
    [card.condition.zh, card.explanation.zh, card.scoring.zh].filter(Boolean).length,
  0,
);
const availableBonusFields = bonusCards.reduce(
  (count, card) =>
    count +
    [card.condition.en, card.explanation.en, card.scoring.en].filter(Boolean).length,
  0,
);

console.log(`Generated ${birds.length} birds`);
console.log(`Generated ${bonusCards.length} bonus cards`);
console.log(
  `Chinese bird-power coverage: ${translatedPowers.length}/${poweredBirds.length}`,
);
console.log(
  `Chinese bonus-text coverage: ${translatedBonusFields}/${availableBonusFields}`,
);
console.log(`Output directory: ${options.out}`);
