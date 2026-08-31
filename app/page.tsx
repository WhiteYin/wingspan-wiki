'use client';

import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bird,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Egg,
  Feather,
  Filter,
  Languages,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import bonusCardsJson from '@/src/data/bonus-cards.json';
import birdsJson from '@/src/data/birds.json';
import enumsJson from '@/src/data/enums.json';

type Tab = 'bird' | 'bonus';
type SortOrder = 'asc' | 'desc';
type TriState = 'all' | 'yes' | 'no';
type RangeValue = [number, number];

type TextPair = {
  en: string | null;
  zh: string | null;
};

type BirdCard = {
  id: string;
  index: number;
  set: string;
  names: { en: string; zh: string; scientific: string };
  sprite: { sheet: string; row: number; column: number };
  victoryPoints: number;
  nestType: string;
  eggCapacity: number;
  wingspanCm: number;
  habitats: string[];
  foodCost: {
    amounts: Record<string, number>;
    alternative: boolean;
    total: number;
  };
  power: {
    color: string;
    category: string;
    text: TextPair;
    flags: { predator: boolean; flocking: boolean; bonusCard: boolean };
    autoActivateDefault: boolean | null;
  } | null;
  bonusCardIds: string[];
};

type BonusCard = {
  id: string;
  index: number;
  compatibilityEnum: number | null;
  set: string;
  names: { en: string; zh: string };
  sprite: { sheet: string; row: number; column: number };
  condition: TextPair;
  explanation: TextPair;
  scoring: TextPair;
  deckPercentage: number | null;
  languageDependent: boolean;
  automa: boolean;
};

type EnumOption = {
  id: string;
  value: number;
  name: { en: string; zh: string };
  birdFlagIndex?: number | null;
};

type SpriteSheet = {
  id: string;
  standardFile: string;
  highResolutionFile: string | null;
  columns: number;
  rows: number;
  standardTile: { width: number; height: number };
  highResolutionTile: { width: number; height: number } | null;
  sourceTile?: { width: number; height: number };
};

type BirdFilters = {
  sets: string[];
  habitats: string[];
  foods: string[];
  nests: string[];
  powers: string[];
  traits: string[];
  vp: RangeValue;
  cost: RangeValue;
  eggs: RangeValue;
  wingspan: RangeValue;
};

type BonusFilters = {
  sets: string[];
  languageDependent: TriState;
  automa: TriState;
};

type CardRef = { kind: Tab; id: string };

const birds = birdsJson as BirdCard[];
const bonusCards = bonusCardsJson as BonusCard[];
const enums = enumsJson as {
  sets: EnumOption[];
  foodTypes: EnumOption[];
  nestTypes: EnumOption[];
  habitats: EnumOption[];
  powerColors: EnumOption[];
  powerCategories: EnumOption[];
  spriteSheets: SpriteSheet[];
};

const spriteSheets = new Map(enums.spriteSheets.map((sheet) => [sheet.id, sheet]));
const birdById = new Map(birds.map((card) => [card.id, card]));
const bonusById = new Map(bonusCards.map((card) => [card.id, card]));
const setById = new Map(enums.sets.map((item) => [item.id, item]));
const foodById = new Map(enums.foodTypes.map((item) => [item.id, item]));
const nestById = new Map(enums.nestTypes.map((item) => [item.id, item]));
const habitatById = new Map(enums.habitats.map((item) => [item.id, item]));
const powerById = new Map(enums.powerColors.map((item) => [item.id, item]));

const zhCollator = new Intl.Collator('zh-CN');
const enCollator = new Intl.Collator('en');

const numberRange = (values: number[]): RangeValue => [
  Math.min(...values),
  Math.max(...values),
];

const BIRD_LIMITS = {
  vp: numberRange(birds.map((card) => card.victoryPoints)),
  cost: numberRange(birds.map((card) => card.foodCost.total)),
  eggs: numberRange(birds.map((card) => card.eggCapacity)),
  wingspan: numberRange(birds.map((card) => card.wingspanCm)),
};

const initialBirdFilters = (): BirdFilters => ({
  sets: [],
  habitats: [],
  foods: [],
  nests: [],
  powers: [],
  traits: [],
  vp: [...BIRD_LIMITS.vp],
  cost: [...BIRD_LIMITS.cost],
  eggs: [...BIRD_LIMITS.eggs],
  wingspan: [...BIRD_LIMITS.wingspan],
});

const initialBonusFilters = (): BonusFilters => ({
  sets: [],
  languageDependent: 'all',
  automa: 'all',
});

const normalizeText = (value: string | number | null | undefined) =>
  String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');

const birdSearchText = new Map(
  birds.map((card) => [
    card.id,
    normalizeText(
      [
        card.id,
        card.index,
        card.index + 1,
        card.names.zh,
        card.names.en,
        card.names.scientific,
        card.power?.text.zh,
        card.power?.text.en,
      ].join(' '),
    ),
  ]),
);

const bonusSearchText = new Map(
  bonusCards.map((card) => [
    card.id,
    normalizeText(
      [
        card.id,
        card.index,
        card.index + 1,
        card.names.zh,
        card.names.en,
        card.condition.zh,
        card.condition.en,
        card.explanation.zh,
        card.explanation.en,
        card.scoring.zh,
        card.scoring.en,
      ].join(' '),
    ),
  ]),
);

const birdSetOptions = enums.sets.filter((item) =>
  birds.some((card) => card.set === item.id),
);
const bonusSetOptions = enums.sets.filter((item) =>
  bonusCards.some((card) => card.set === item.id),
);
const habitatOptions = enums.habitats.filter(
  (item) => item.id !== 'playbird' && birds.some((card) => card.habitats.includes(item.id)),
);
const foodOptions = enums.foodTypes.filter((item) =>
  birds.some((card) => (card.foodCost.amounts[item.id] ?? 0) > 0),
);
const nestOptions = enums.nestTypes.filter((item) =>
  birds.some((card) => card.nestType === item.id),
);
const powerOptions = enums.powerColors.filter((item) =>
  item.id === 'none'
    ? birds.some((card) => !card.power)
    : birds.some((card) => card.power?.color === item.id),
);

const traitOptions = [
  { id: 'predator', name: '捕食者' },
  { id: 'flocking', name: '群居' },
  { id: 'bonusCard', name: '奖励卡相关' },
];

const birdSortOptions = [
  ['index', '卡牌编号'],
  ['zh', '中文名'],
  ['en', '英文名'],
  ['vp', '分数'],
  ['cost', '食物成本'],
  ['eggs', '蛋容量'],
  ['wingspan', '翼展'],
] as const;

const bonusSortOptions = [
  ['index', '卡牌编号'],
  ['zh', '中文名'],
  ['en', '英文名'],
  ['percentage', '牌库占比'],
] as const;

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function rangeMatches(value: number, range: RangeValue) {
  const low = Math.min(range[0], range[1]);
  const high = Math.max(range[0], range[1]);
  return value >= low && value <= high;
}

function matchTriState(value: boolean, filter: TriState) {
  return filter === 'all' || (filter === 'yes' ? value : !value);
}

function CardSprite({
  sprite,
  highResolution = false,
  className = '',
}: {
  sprite: BirdCard['sprite'] | BonusCard['sprite'];
  highResolution?: boolean;
  className?: string;
}) {
  const sheet = spriteSheets.get(sprite.sheet);
  if (!sheet) return null;

  const standardUrl = `/assets/cards/${sheet.standardFile}`;
  const highResolutionUrl = sheet.highResolutionFile
    ? `/assets/cards/${sheet.highResolutionFile}`
    : null;
  const backgroundImage = highResolution && highResolutionUrl
    ? `url("${highResolutionUrl}")`
    : highResolutionUrl
      ? `image-set(url("${standardUrl}") 1x, url("${highResolutionUrl}") 2x)`
      : `url("${standardUrl}")`;
  const tile = highResolution && sheet.highResolutionTile
    ? sheet.highResolutionTile
    : sheet.standardTile;
  const sourceTile = sheet.sourceTile ?? tile;
  const sourceSheetWidth = sheet.columns * sourceTile.width;
  const sourceSheetHeight = sheet.rows * sourceTile.height;
  const x = sheet.columns <= 1 ? 0 : (sprite.column * sourceTile.width / (sourceSheetWidth - sourceTile.width)) * 100;
  const y = sheet.rows <= 1 ? 0 : (sprite.row * sourceTile.height / (sourceSheetHeight - sourceTile.height)) * 100;

  return (
    <div
      aria-hidden="true"
      className={`card-sprite ${className}`}
      style={{
        aspectRatio: `${tile.width} / ${tile.height}`,
        backgroundImage,
        backgroundPosition: `${x}% ${y}%`,
        backgroundSize: `${sheet.columns * 100}% ${sheet.rows * 100}%`,
      }}
    />
  );
}

function ChoiceGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="font-heading text-sm font-semibold text-[#355e4b]">{title}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(option.id)}
              className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition focus-visible:ring-2 focus-visible:ring-[#4c8068] focus-visible:outline-none ${
                active
                  ? 'border-[#3d745c] bg-[#3d745c] text-white shadow-sm'
                  : 'border-[#d5c8b4] bg-white/75 text-[#5c554a] hover:border-[#70917f] hover:bg-[#edf3ed]'
              }`}
            >
              {active && <Check className="size-3" />}
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function RangeField({
  title,
  value,
  limits,
  unit,
  onChange,
}: {
  title: string;
  value: RangeValue;
  limits: RangeValue;
  unit?: string;
  onChange: (value: RangeValue) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-heading text-sm font-semibold text-[#355e4b]">{title}</legend>
      <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
        <input
          aria-label={`${title}最小值`}
          type="number"
          min={limits[0]}
          max={limits[1]}
          value={value[0]}
          onChange={(event) => onChange([Number(event.target.value), value[1]])}
          className="h-9 min-w-0 rounded-lg border border-[#d5c8b4] bg-white/80 px-2 text-center text-sm focus:border-[#4c8068] focus:ring-2 focus:ring-[#4c8068]/20 focus:outline-none"
        />
        <span className="text-[#8d8373]">—</span>
        <input
          aria-label={`${title}最大值`}
          type="number"
          min={limits[0]}
          max={limits[1]}
          value={value[1]}
          onChange={(event) => onChange([value[0], Number(event.target.value)])}
          className="h-9 min-w-0 rounded-lg border border-[#d5c8b4] bg-white/80 px-2 text-center text-sm focus:border-[#4c8068] focus:ring-2 focus:ring-[#4c8068]/20 focus:outline-none"
        />
        <span className="text-xs text-[#8d8373]">{unit}</span>
      </div>
    </fieldset>
  );
}

function TriStateField({
  title,
  value,
  onChange,
}: {
  title: string;
  value: TriState;
  onChange: (value: TriState) => void;
}) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="font-heading text-sm font-semibold text-[#355e4b]">{title}</legend>
      <div className="grid grid-cols-3 rounded-lg border border-[#d5c8b4] bg-white/70 p-1">
        {([
          ['all', '全部'],
          ['yes', '是'],
          ['no', '否'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={value === id}
            onClick={() => onChange(id)}
            className={`rounded-md px-2 py-1.5 text-xs transition focus-visible:ring-2 focus-visible:ring-[#4c8068] focus-visible:outline-none ${
              value === id ? 'bg-[#3d745c] text-white shadow-sm' : 'text-[#686055] hover:bg-[#edf3ed]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="col-span-full flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-[#cbbda8] bg-white/45 px-6 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-full bg-[#e7eee8] text-[#3b6d57]">
        <Feather className="size-7" />
      </div>
      <h2 className="font-heading text-xl font-semibold">没有找到符合条件的卡牌</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#746b5f]">
        尝试减少筛选条件，或清空当前搜索重新浏览完整牌库。
      </p>
      <Button onClick={onReset} className="mt-5 bg-[#3d745c] hover:bg-[#315f4c]">
        <RotateCcw /> 清空全部条件
      </Button>
    </div>
  );
}

export default function Home() {
  const searchRef = useRef<HTMLInputElement>(null);
  const detailDepthRef = useRef(0);
  const detailStackRef = useRef<CardRef[]>([]);
  const [urlReady, setUrlReady] = useState(false);
  const [tab, setTab] = useState<Tab>('bird');
  const [query, setQuery] = useState('');
  const [birdFilters, setBirdFilters] = useState<BirdFilters>(initialBirdFilters);
  const [bonusFilters, setBonusFilters] = useState<BonusFilters>(initialBonusFilters);
  const [sortKey, setSortKey] = useState('index');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardRef | null>(null);
  const [detailStack, setDetailStack] = useState<CardRef[]>([]);
  const [zoomed, setZoomed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const setStack = useCallback((next: CardRef[]) => {
    detailStackRef.current = next;
    setDetailStack(next);
  }, []);

  const resolveCardRef = useCallback((id: string): CardRef | null => {
    if (birdById.has(id)) return { kind: 'bird', id };
    if (bonusById.has(id)) return { kind: 'bonus', id };
    return null;
  }, []);

  const parseCsv = useCallback((params: URLSearchParams, key: string, allowed: string[]) => {
    const value = params.get(key);
    if (!value) return [];
    return value.split(',').filter((item) => allowed.includes(item));
  }, []);

  const parseRange = useCallback(
    (params: URLSearchParams, prefix: string, fallback: RangeValue): RangeValue => {
      const min = Number(params.get(`${prefix}Min`));
      const max = Number(params.get(`${prefix}Max`));
      return [
        Number.isFinite(min) && params.has(`${prefix}Min`) ? min : fallback[0],
        Number.isFinite(max) && params.has(`${prefix}Max`) ? max : fallback[1],
      ];
    },
    [],
  );

  const applyUrlState = useCallback(
    (fromPopState = false) => {
      const params = new URLSearchParams(window.location.search);
      const nextTab: Tab = params.get('type') === 'bonus' ? 'bonus' : 'bird';
      const validSorts = (nextTab === 'bird' ? birdSortOptions : bonusSortOptions).map(
        ([value]) => value,
      );
      setTab(nextTab);
      setQuery(params.get('q') ?? '');
      setSortKey(validSorts.includes(params.get('sort') as never) ? params.get('sort')! : 'index');
      setSortOrder(params.get('order') === 'desc' ? 'desc' : 'asc');

      if (nextTab === 'bird') {
        setBirdFilters({
          sets: parseCsv(params, 'set', birdSetOptions.map((item) => item.id)),
          habitats: parseCsv(params, 'habitat', habitatOptions.map((item) => item.id)),
          foods: parseCsv(params, 'food', foodOptions.map((item) => item.id)),
          nests: parseCsv(params, 'nest', nestOptions.map((item) => item.id)),
          powers: parseCsv(params, 'power', powerOptions.map((item) => item.id)),
          traits: parseCsv(params, 'trait', traitOptions.map((item) => item.id)),
          vp: parseRange(params, 'vp', BIRD_LIMITS.vp),
          cost: parseRange(params, 'cost', BIRD_LIMITS.cost),
          eggs: parseRange(params, 'eggs', BIRD_LIMITS.eggs),
          wingspan: parseRange(params, 'wing', BIRD_LIMITS.wingspan),
        });
      } else {
        const language = params.get('language');
        const automa = params.get('automa');
        setBonusFilters({
          sets: parseCsv(params, 'set', bonusSetOptions.map((item) => item.id)),
          languageDependent: language === 'yes' || language === 'no' ? language : 'all',
          automa: automa === 'yes' || automa === 'no' ? automa : 'all',
        });
      }

      const cardParam = params.get('card');
      const nextSelected = cardParam ? resolveCardRef(cardParam) : null;
      setSelectedCard(nextSelected);
      setZoomed(false);
      if (fromPopState) {
        if (!nextSelected) {
          detailDepthRef.current = 0;
          setStack([]);
        } else {
          const existingIndex = detailStackRef.current.findIndex(
            (item) => item.kind === nextSelected.kind && item.id === nextSelected.id,
          );
          if (existingIndex >= 0) {
            detailDepthRef.current = Math.min(detailDepthRef.current, existingIndex + 1);
            setStack(detailStackRef.current.slice(0, existingIndex + 1));
          } else {
            detailDepthRef.current = 0;
            setStack([nextSelected]);
          }
        }
      } else if (nextSelected) {
        detailDepthRef.current = 0;
        setStack([nextSelected]);
      }
    },
    [parseCsv, parseRange, resolveCardRef, setStack],
  );

  useEffect(() => {
    applyUrlState(false);
    setUrlReady(true);
    const onPopState = () => applyUrlState(true);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyUrlState]);

  useEffect(() => {
    const files = enums.spriteSheets.flatMap((sheet) =>
      [sheet.standardFile, sheet.highResolutionFile].filter(Boolean) as string[],
    );
    Promise.all(
      files.map(
        (file) =>
          new Promise<void>((resolve) => {
            const image = new Image();
            image.onload = () => resolve();
            image.onerror = () => resolve();
            image.src = `/assets/cards/${file}`;
          }),
      ),
    ).finally(() => setAssetsReady(true));
  }, []);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 720);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const buildUrl = useCallback(
    (override?: { selected?: CardRef | null; tab?: Tab }) => {
      const params = new URLSearchParams();
      const nextTab = override?.tab ?? tab;
      const nextSelected = override && 'selected' in override ? override.selected : selectedCard;
      params.set('type', nextTab);
      if (query.trim()) params.set('q', query.trim());
      params.set('sort', sortKey);
      params.set('order', sortOrder);

      if (nextTab === 'bird') {
        if (birdFilters.sets.length) params.set('set', birdFilters.sets.join(','));
        if (birdFilters.habitats.length) params.set('habitat', birdFilters.habitats.join(','));
        if (birdFilters.foods.length) params.set('food', birdFilters.foods.join(','));
        if (birdFilters.nests.length) params.set('nest', birdFilters.nests.join(','));
        if (birdFilters.powers.length) params.set('power', birdFilters.powers.join(','));
        if (birdFilters.traits.length) params.set('trait', birdFilters.traits.join(','));
        if (birdFilters.vp[0] !== BIRD_LIMITS.vp[0]) params.set('vpMin', String(birdFilters.vp[0]));
        if (birdFilters.vp[1] !== BIRD_LIMITS.vp[1]) params.set('vpMax', String(birdFilters.vp[1]));
        if (birdFilters.cost[0] !== BIRD_LIMITS.cost[0]) params.set('costMin', String(birdFilters.cost[0]));
        if (birdFilters.cost[1] !== BIRD_LIMITS.cost[1]) params.set('costMax', String(birdFilters.cost[1]));
        if (birdFilters.eggs[0] !== BIRD_LIMITS.eggs[0]) params.set('eggsMin', String(birdFilters.eggs[0]));
        if (birdFilters.eggs[1] !== BIRD_LIMITS.eggs[1]) params.set('eggsMax', String(birdFilters.eggs[1]));
        if (birdFilters.wingspan[0] !== BIRD_LIMITS.wingspan[0]) params.set('wingMin', String(birdFilters.wingspan[0]));
        if (birdFilters.wingspan[1] !== BIRD_LIMITS.wingspan[1]) params.set('wingMax', String(birdFilters.wingspan[1]));
      } else {
        if (bonusFilters.sets.length) params.set('set', bonusFilters.sets.join(','));
        if (bonusFilters.languageDependent !== 'all') params.set('language', bonusFilters.languageDependent);
        if (bonusFilters.automa !== 'all') params.set('automa', bonusFilters.automa);
      }

      if (nextSelected) params.set('card', nextSelected.id);
      return `${window.location.pathname}?${params.toString()}`;
    }, [birdFilters, bonusFilters, query, selectedCard, sortKey, sortOrder, tab],
  );

  useEffect(() => {
    if (!urlReady) return;
    window.history.replaceState(null, '', buildUrl());
  }, [buildUrl, urlReady]);

  const normalizedQuery = normalizeText(query);

  const filteredBirds = useMemo(
    () =>
      birds.filter((card) => {
        if (normalizedQuery && !birdSearchText.get(card.id)?.includes(normalizedQuery)) return false;
        if (birdFilters.sets.length && !birdFilters.sets.includes(card.set)) return false;
        if (
          birdFilters.habitats.length &&
          !birdFilters.habitats.some((habitat) => card.habitats.includes(habitat))
        ) return false;
        if (
          birdFilters.foods.length &&
          !birdFilters.foods.some((food) => (card.foodCost.amounts[food] ?? 0) > 0)
        ) return false;
        if (birdFilters.nests.length && !birdFilters.nests.includes(card.nestType)) return false;
        if (
          birdFilters.powers.length &&
          !birdFilters.powers.some((power) =>
            power === 'none' ? !card.power : card.power?.color === power,
          )
        ) return false;
        if (
          birdFilters.traits.length &&
          !birdFilters.traits.some((trait) => Boolean(card.power?.flags[trait as keyof typeof card.power.flags]))
        ) return false;
        return (
          rangeMatches(card.victoryPoints, birdFilters.vp) &&
          rangeMatches(card.foodCost.total, birdFilters.cost) &&
          rangeMatches(card.eggCapacity, birdFilters.eggs) &&
          rangeMatches(card.wingspanCm, birdFilters.wingspan)
        );
      }),
    [birdFilters, normalizedQuery],
  );

  const filteredBonusCards = useMemo(
    () =>
      bonusCards.filter((card) => {
        if (normalizedQuery && !bonusSearchText.get(card.id)?.includes(normalizedQuery)) return false;
        if (bonusFilters.sets.length && !bonusFilters.sets.includes(card.set)) return false;
        return (
          matchTriState(card.languageDependent, bonusFilters.languageDependent) &&
          matchTriState(card.automa, bonusFilters.automa)
        );
      }),
    [bonusFilters, normalizedQuery],
  );

  const sortedBirds = useMemo(() => {
    const direction = sortOrder === 'asc' ? 1 : -1;
    return [...filteredBirds].sort((left, right) => {
      let result = 0;
      if (sortKey === 'zh') result = zhCollator.compare(left.names.zh, right.names.zh);
      else if (sortKey === 'en') result = enCollator.compare(left.names.en, right.names.en);
      else if (sortKey === 'vp') result = left.victoryPoints - right.victoryPoints;
      else if (sortKey === 'cost') result = left.foodCost.total - right.foodCost.total;
      else if (sortKey === 'eggs') result = left.eggCapacity - right.eggCapacity;
      else if (sortKey === 'wingspan') result = left.wingspanCm - right.wingspanCm;
      else result = left.index - right.index;
      return result * direction || (left.index - right.index);
    });
  }, [filteredBirds, sortKey, sortOrder]);

  const sortedBonusCards = useMemo(() => {
    const direction = sortOrder === 'asc' ? 1 : -1;
    return [...filteredBonusCards].sort((left, right) => {
      let result = 0;
      if (sortKey === 'zh') result = zhCollator.compare(left.names.zh, right.names.zh);
      else if (sortKey === 'en') result = enCollator.compare(left.names.en, right.names.en);
      else if (sortKey === 'percentage') result = (left.deckPercentage ?? -1) - (right.deckPercentage ?? -1);
      else result = left.index - right.index;
      return result * direction || (left.index - right.index);
    });
  }, [filteredBonusCards, sortKey, sortOrder]);

  const resetAll = useCallback(() => {
    setQuery('');
    setBirdFilters(initialBirdFilters());
    setBonusFilters(initialBonusFilters());
    setSortKey('index');
    setSortOrder('asc');
    setAdvancedOpen(false);
  }, []);

  const openRootDetail = useCallback(
    (reference: CardRef) => {
      const nextUrl = buildUrl({ selected: reference });
      window.history.pushState(null, '', nextUrl);
      detailDepthRef.current = 1;
      setStack([reference]);
      setSelectedCard(reference);
      setZoomed(false);
      setCopied(false);
    },
    [buildUrl, setStack],
  );

  const openRelatedDetail = useCallback(
    (reference: CardRef) => {
      const nextUrl = buildUrl({ selected: reference });
      window.history.pushState(null, '', nextUrl);
      detailDepthRef.current += 1;
      setStack([...detailStackRef.current, reference]);
      setSelectedCard(reference);
      setZoomed(false);
      setCopied(false);
    },
    [buildUrl, setStack],
  );

  const closeDetail = useCallback(() => {
    if (detailDepthRef.current > 0) {
      window.history.go(-detailDepthRef.current);
      return;
    }
    setSelectedCard(null);
    setStack([]);
    window.history.replaceState(null, '', buildUrl({ selected: null }));
  }, [buildUrl, setStack]);

  const changeTab = useCallback(
    (nextTab: Tab) => {
      if (selectedCard) closeDetail();
      setTab(nextTab);
      setSortKey('index');
      setSortOrder('asc');
    },
    [closeDetail, selectedCard],
  );

  const detailSequence = selectedCard?.kind === 'bonus' ? sortedBonusCards : sortedBirds;
  const selectedIndex = selectedCard
    ? detailSequence.findIndex((card) => card.id === selectedCard.id)
    : -1;

  const navigateDetail = useCallback(
    (offset: number) => {
      if (!selectedCard) return;
      const filteredSequence = selectedCard.kind === 'bird' ? sortedBirds : sortedBonusCards;
      const fallbackSequence = selectedCard.kind === 'bird' ? birds : bonusCards;
      const sequence = filteredSequence.some((card) => card.id === selectedCard.id)
        ? filteredSequence
        : fallbackSequence;
      const currentIndex = sequence.findIndex((card) => card.id === selectedCard.id);
      const nextIndex = currentIndex + offset;
      if (nextIndex < 0 || nextIndex >= sequence.length) return;
      const nextReference: CardRef = { kind: selectedCard.kind, id: sequence[nextIndex].id };
      window.history.replaceState(null, '', buildUrl({ selected: nextReference }));
      const nextStack = detailStackRef.current.length
        ? [...detailStackRef.current.slice(0, -1), nextReference]
        : [nextReference];
      setStack(nextStack);
      setSelectedCard(nextReference);
      setZoomed(false);
      setCopied(false);
    },
    [buildUrl, selectedCard, setStack, sortedBirds, sortedBonusCards],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT';
      if (event.key === '/' && !isTyping && !selectedCard) {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === 'Escape' && !selectedCard && query) {
        setQuery('');
      } else if (selectedCard && event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateDetail(-1);
      } else if (selectedCard && event.key === 'ArrowRight') {
        event.preventDefault();
        navigateDetail(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigateDetail, query, selectedCard]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }, []);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; remove: () => void }[] = [];
    if (tab === 'bird') {
      birdFilters.sets.forEach((id) => chips.push({
        key: `set-${id}`,
        label: setById.get(id)?.name.zh ?? id,
        remove: () => setBirdFilters((current) => ({ ...current, sets: current.sets.filter((item) => item !== id) })),
      }));
      birdFilters.habitats.forEach((id) => chips.push({
        key: `habitat-${id}`,
        label: habitatById.get(id)?.name.zh ?? id,
        remove: () => setBirdFilters((current) => ({ ...current, habitats: current.habitats.filter((item) => item !== id) })),
      }));
      birdFilters.foods.forEach((id) => chips.push({
        key: `food-${id}`,
        label: foodById.get(id)?.name.zh ?? id,
        remove: () => setBirdFilters((current) => ({ ...current, foods: current.foods.filter((item) => item !== id) })),
      }));
      birdFilters.nests.forEach((id) => chips.push({
        key: `nest-${id}`,
        label: nestById.get(id)?.name.zh ?? id,
        remove: () => setBirdFilters((current) => ({ ...current, nests: current.nests.filter((item) => item !== id) })),
      }));
      birdFilters.powers.forEach((id) => chips.push({
        key: `power-${id}`,
        label: powerById.get(id)?.name.zh ?? id,
        remove: () => setBirdFilters((current) => ({ ...current, powers: current.powers.filter((item) => item !== id) })),
      }));
      birdFilters.traits.forEach((id) => chips.push({
        key: `trait-${id}`,
        label: traitOptions.find((item) => item.id === id)?.name ?? id,
        remove: () => setBirdFilters((current) => ({ ...current, traits: current.traits.filter((item) => item !== id) })),
      }));
      (Object.keys(BIRD_LIMITS) as (keyof typeof BIRD_LIMITS)[]).forEach((key) => {
        const value = birdFilters[key];
        const limit = BIRD_LIMITS[key];
        if (value[0] !== limit[0] || value[1] !== limit[1]) {
          const labels = { vp: '分数', cost: '成本', eggs: '蛋容量', wingspan: '翼展' };
          chips.push({
            key: `range-${key}`,
            label: `${labels[key]} ${value[0]}–${value[1]}`,
            remove: () => setBirdFilters((current) => ({ ...current, [key]: [...limit] })),
          });
        }
      });
    } else {
      bonusFilters.sets.forEach((id) => chips.push({
        key: `set-${id}`,
        label: setById.get(id)?.name.zh ?? id,
        remove: () => setBonusFilters((current) => ({ ...current, sets: current.sets.filter((item) => item !== id) })),
      }));
      if (bonusFilters.languageDependent !== 'all') chips.push({
        key: 'language',
        label: `语言相关：${bonusFilters.languageDependent === 'yes' ? '是' : '否'}`,
        remove: () => setBonusFilters((current) => ({ ...current, languageDependent: 'all' })),
      });
      if (bonusFilters.automa !== 'all') chips.push({
        key: 'automa',
        label: `自动机：${bonusFilters.automa === 'yes' ? '支持' : '不支持'}`,
        remove: () => setBonusFilters((current) => ({ ...current, automa: 'all' })),
      });
    }
    return chips;
  }, [birdFilters, bonusFilters, tab]);

  const renderFilterPanel = () => (
    <div className="space-y-5">
      {tab === 'bird' ? (
        <>
          <ChoiceGroup
            title="版本"
            options={birdSetOptions.map((item) => ({ id: item.id, label: item.name.zh }))}
            selected={birdFilters.sets}
            onToggle={(id) => setBirdFilters((current) => ({ ...current, sets: toggleValue(current.sets, id) }))}
          />
          <ChoiceGroup
            title="栖息地"
            options={habitatOptions.map((item) => ({ id: item.id, label: item.name.zh }))}
            selected={birdFilters.habitats}
            onToggle={(id) => setBirdFilters((current) => ({ ...current, habitats: toggleValue(current.habitats, id) }))}
          />
          <ChoiceGroup
            title="食物"
            options={foodOptions.map((item) => ({ id: item.id, label: item.name.zh }))}
            selected={birdFilters.foods}
            onToggle={(id) => setBirdFilters((current) => ({ ...current, foods: toggleValue(current.foods, id) }))}
          />
          <ChoiceGroup
            title="巢型"
            options={nestOptions.map((item) => ({ id: item.id, label: item.name.zh }))}
            selected={birdFilters.nests}
            onToggle={(id) => setBirdFilters((current) => ({ ...current, nests: toggleValue(current.nests, id) }))}
          />
          <ChoiceGroup
            title="能力颜色"
            options={powerOptions.map((item) => ({ id: item.id, label: item.name.zh }))}
            selected={birdFilters.powers}
            onToggle={(id) => setBirdFilters((current) => ({ ...current, powers: toggleValue(current.powers, id) }))}
          />
          <div className="border-t border-[#ddd1bf] pt-4">
            <button
              type="button"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((value) => !value)}
              className="flex w-full items-center justify-between rounded-lg py-1 text-left font-heading text-sm font-semibold text-[#355e4b] focus-visible:ring-2 focus-visible:ring-[#4c8068] focus-visible:outline-none"
            >
              <span className="flex items-center gap-2"><SlidersHorizontal className="size-4" />高级筛选</span>
              {advancedOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
            {advancedOpen && (
              <div className="mt-4 space-y-5">
                <ChoiceGroup
                  title="能力标签"
                  options={traitOptions.map((item) => ({ id: item.id, label: item.name }))}
                  selected={birdFilters.traits}
                  onToggle={(id) => setBirdFilters((current) => ({ ...current, traits: toggleValue(current.traits, id) }))}
                />
                <RangeField title="分数" value={birdFilters.vp} limits={BIRD_LIMITS.vp} unit="分" onChange={(vp) => setBirdFilters((current) => ({ ...current, vp }))} />
                <RangeField title="食物总成本" value={birdFilters.cost} limits={BIRD_LIMITS.cost} onChange={(cost) => setBirdFilters((current) => ({ ...current, cost }))} />
                <RangeField title="蛋容量" value={birdFilters.eggs} limits={BIRD_LIMITS.eggs} unit="枚" onChange={(eggs) => setBirdFilters((current) => ({ ...current, eggs }))} />
                <RangeField title="翼展" value={birdFilters.wingspan} limits={BIRD_LIMITS.wingspan} unit="cm" onChange={(wingspan) => setBirdFilters((current) => ({ ...current, wingspan }))} />
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <ChoiceGroup
            title="版本"
            options={bonusSetOptions.map((item) => ({ id: item.id, label: item.name.zh }))}
            selected={bonusFilters.sets}
            onToggle={(id) => setBonusFilters((current) => ({ ...current, sets: toggleValue(current.sets, id) }))}
          />
          <TriStateField title="语言相关条件" value={bonusFilters.languageDependent} onChange={(languageDependent) => setBonusFilters((current) => ({ ...current, languageDependent }))} />
          <TriStateField title="支持自动机" value={bonusFilters.automa} onChange={(automa) => setBonusFilters((current) => ({ ...current, automa }))} />
        </>
      )}
      <Button variant="outline" onClick={resetAll} className="w-full border-[#cbbda8] bg-white/70 text-[#645b4f] hover:bg-[#eee7da]">
        <RotateCcw /> 重置全部
      </Button>
    </div>
  );

  const selectedBird = selectedCard?.kind === 'bird' ? birdById.get(selectedCard.id) : null;
  const selectedBonus = selectedCard?.kind === 'bonus' ? bonusById.get(selectedCard.id) : null;
  const currentSortOptions = tab === 'bird' ? birdSortOptions : bonusSortOptions;
  const resultCount = tab === 'bird' ? sortedBirds.length : sortedBonusCards.length;

  return (
    <main className="min-h-screen pb-20">
      <header className="sticky top-0 z-30 border-b border-[#d8ccb9]/90 bg-[#f8f4ea]/92 shadow-[0_8px_28px_rgb(70_55_35/6%)] backdrop-blur-xl">
        <div className="mx-auto max-w-[1680px] px-3 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#315f4c] text-[#fff8e8] shadow-sm sm:size-11">
                <Feather className="size-5 sm:size-6" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate font-heading text-lg font-bold tracking-[0.08em] text-[#294d3d] sm:text-2xl">展翅翱翔百科</h1>
                <p className="hidden text-xs tracking-wide text-[#817667] sm:block">WINGSPAN CARD ENCYCLOPEDIA</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-[#d6c8b3] bg-white/65 px-3 py-1.5 text-xs text-[#6f6659] md:flex">
              <Bird className="size-3.5 text-[#3f725b]" />
              核心版 · 快速入门
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-[#766d60]" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tab === 'bird' ? '搜索中文名、英文名、学名、编号或能力…' : '搜索奖励卡名称、条件或计分规则…'}
                aria-label="搜索卡牌"
                className="h-12 w-full rounded-2xl border border-[#cfc1ac] bg-white/85 pr-12 pl-11 text-[15px] shadow-inner shadow-[#8c7856]/5 transition placeholder:text-[#a09789] focus:border-[#4c8068] focus:ring-4 focus:ring-[#4c8068]/12 focus:outline-none"
              />
              {query ? (
                <button type="button" onClick={() => setQuery('')} aria-label="清空搜索" className="absolute top-1/2 right-3 grid size-7 -translate-y-1/2 place-items-center rounded-full text-[#776e61] hover:bg-[#ede6da] focus-visible:ring-2 focus-visible:ring-[#4c8068] focus-visible:outline-none">
                  <X className="size-4" />
                </button>
              ) : (
                <kbd className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-[#d8cbb8] bg-[#f4eee4] px-2 py-0.5 font-mono text-[11px] text-[#847a6c] sm:block">/</kbd>
              )}
            </div>

            <div role="tablist" aria-label="卡牌类型" className="grid h-11 grid-cols-2 rounded-xl border border-[#cfc1ac] bg-[#e9e1d3]/75 p-1 lg:w-64">
              <button id="bird-tab" role="tab" aria-controls="card-results" aria-selected={tab === 'bird'} type="button" onClick={() => changeTab('bird')} className={`flex items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-[#4c8068] focus-visible:outline-none ${tab === 'bird' ? 'bg-[#315f4c] text-white shadow-sm' : 'text-[#685f52] hover:bg-white/60'}`}>
                <Bird className="size-4" /> 鸟卡 <span className="text-xs opacity-70">180</span>
              </button>
              <button id="bonus-tab" role="tab" aria-controls="card-results" aria-selected={tab === 'bonus'} type="button" onClick={() => changeTab('bonus')} className={`flex items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-[#4c8068] focus-visible:outline-none ${tab === 'bonus' ? 'bg-[#315f4c] text-white shadow-sm' : 'text-[#685f52] hover:bg-white/60'}`}>
                <Sparkles className="size-4" /> 奖励卡 <span className="text-xs opacity-70">26</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1680px] grid-cols-1 gap-6 px-3 py-5 sm:px-6 lg:grid-cols-[270px_minmax(0,1fr)] lg:px-8 lg:py-7">
        <aside className="field-paper sticky top-[158px] hidden max-h-[calc(100vh-178px)] overflow-y-auto rounded-2xl border border-[#d7cab7] p-5 shadow-[0_12px_34px_rgb(73_55_31/7%)] lg:block thin-scrollbar">
          <div className="mb-5 flex items-center justify-between border-b border-[#ddd1bf] pb-3">
            <h2 className="flex items-center gap-2 font-heading font-semibold text-[#315f4c]"><Filter className="size-4" />筛选卡牌</h2>
            {activeChips.length > 0 && <span className="rounded-full bg-[#3d745c] px-2 py-0.5 text-xs text-white">{activeChips.length}</span>}
          </div>
          {renderFilterPanel()}
        </aside>

        <section id="card-results" role="tabpanel" aria-labelledby={tab === 'bird' ? 'bird-tab' : 'bonus-tab'} className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-2xl border border-[#d8ccb9] bg-white/55 p-2.5 shadow-sm sm:p-3">
            <Button variant="outline" onClick={() => setMobileFiltersOpen(true)} className="border-[#cbbda8] bg-white/80 lg:hidden">
              <SlidersHorizontal /> 筛选
              {activeChips.length > 0 && <span className="rounded-full bg-[#3d745c] px-1.5 text-[11px] text-white">{activeChips.length}</span>}
            </Button>
            <div role="status" aria-live="polite" aria-atomic="true" className="mr-auto flex items-baseline gap-2 px-1">
              <strong className="font-heading text-xl text-[#315f4c]">{resultCount}</strong>
              <span className="text-sm text-[#776e61]">张结果</span>
            </div>
            <label className="flex items-center gap-2 text-sm text-[#70675a]">
              <span className="hidden sm:inline">排序</span>
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value)} className="h-9 rounded-lg border border-[#cbbda8] bg-white/85 px-2.5 text-sm focus:border-[#4c8068] focus:ring-2 focus:ring-[#4c8068]/20 focus:outline-none">
                {currentSortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <Button variant="outline" size="icon" onClick={() => setSortOrder((value) => value === 'asc' ? 'desc' : 'asc')} aria-label={sortOrder === 'asc' ? '当前升序，点击切换降序' : '当前降序，点击切换升序'} className="border-[#cbbda8] bg-white/85">
              {sortOrder === 'asc' ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </div>

          {activeChips.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="已选筛选条件">
              {activeChips.map((chip) => (
                <button key={chip.key} type="button" onClick={chip.remove} className="inline-flex items-center gap-1 rounded-full border border-[#b9cbbf] bg-[#edf4ee] px-2.5 py-1 text-xs text-[#315f4c] transition hover:bg-[#ddeadd] focus-visible:ring-2 focus-visible:ring-[#4c8068] focus-visible:outline-none">
                  {chip.label}<X className="size-3" />
                </button>
              ))}
              <button type="button" onClick={resetAll} className="px-2 py-1 text-xs text-[#8a5b42] underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[#9b6a4d] focus-visible:outline-none">全部清空</button>
            </div>
          )}

          {!assetsReady ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {Array.from({ length: 12 }, (_, index) => (
                <div key={index} className="animate-pulse space-y-3">
                  <div className="aspect-[154/231] rounded-xl bg-[#ded5c7]" />
                  <div className="h-4 w-4/5 rounded bg-[#ded5c7]" />
                  <div className="h-3 w-3/5 rounded bg-[#e7dfd3]" />
                </div>
              ))}
            </div>
          ) : resultCount === 0 ? (
            <EmptyState onReset={resetAll} />
          ) : tab === 'bird' ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 2xl:gap-x-5">
              {sortedBirds.map((card) => (
                <button key={card.id} type="button" onClick={() => openRootDetail({ kind: 'bird', id: card.id })} aria-label={`查看${card.names.zh}详情`} className="encyclopedia-card group min-w-0 text-left focus-visible:rounded-2xl focus-visible:ring-3 focus-visible:ring-[#4c8068] focus-visible:outline-none">
                  <div className="relative overflow-hidden rounded-[10px] bg-[#ddd3c4] shadow-[0_9px_24px_rgb(58_44_25/16%)] transition duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_16px_34px_rgb(58_44_25/22%)] group-focus-visible:-translate-y-1">
                    <CardSprite sprite={card.sprite} className="w-full" />
                    <span className="absolute top-2 right-2 rounded-full border border-white/40 bg-[#294d3d]/86 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm backdrop-blur">{setById.get(card.set)?.name.zh}</span>
                  </div>
                  <div className="px-1 pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-heading text-[15px] leading-5 font-semibold text-[#2e4f40] group-hover:text-[#9a5d3e] sm:text-base">{card.names.zh}</h2>
                      <span className="shrink-0 font-mono text-[10px] text-[#9a8f80]">#{String(card.index + 1).padStart(3, '0')}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] tracking-wide text-[#7b7164] sm:text-xs">{card.names.en}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 2xl:gap-x-5">
              {sortedBonusCards.map((card) => (
                <button key={card.id} type="button" onClick={() => openRootDetail({ kind: 'bonus', id: card.id })} aria-label={`查看${card.names.zh}详情`} className="encyclopedia-card group min-w-0 text-left focus-visible:rounded-2xl focus-visible:ring-3 focus-visible:ring-[#4c8068] focus-visible:outline-none">
                  <div className="relative mx-auto w-full max-w-[162px] overflow-hidden rounded-[10px] bg-[#ddd3c4] shadow-[0_9px_24px_rgb(58_44_25/16%)] transition duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_16px_34px_rgb(58_44_25/22%)] group-focus-visible:-translate-y-1">
                    <CardSprite sprite={card.sprite} className="w-full" />
                    {card.languageDependent && <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-[#9a5d3e]/88 text-white shadow-sm" title="语言相关"><Languages className="size-3.5" /></span>}
                  </div>
                  <div className="px-1 pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-heading text-[15px] leading-5 font-semibold text-[#2e4f40] group-hover:text-[#9a5d3e] sm:text-base">{card.names.zh}</h2>
                      <span className="shrink-0 font-mono text-[10px] text-[#9a8f80]">#{String(card.index + 1).padStart(2, '0')}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] tracking-wide text-[#7b7164] sm:text-xs">{card.names.en}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[88vh] rounded-t-3xl border-[#d1c3ae] bg-[#faf6ed] p-0">
          <SheetHeader className="border-b border-[#ddd1bf] px-5 py-4">
            <SheetTitle className="flex items-center gap-2 font-heading text-lg text-[#315f4c]"><SlidersHorizontal className="size-5" />筛选{tab === 'bird' ? '鸟卡' : '奖励卡'}</SheetTitle>
            <SheetDescription>同组条件满足任一，不同分组需同时满足。</SheetDescription>
          </SheetHeader>
          <div className="thin-scrollbar overflow-y-auto px-5 py-5">{renderFilterPanel()}</div>
          <div className="border-t border-[#ddd1bf] bg-[#faf6ed] p-4">
            <Button className="w-full bg-[#315f4c]" onClick={() => setMobileFiltersOpen(false)}>查看 {resultCount} 张结果</Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(selectedCard)} onOpenChange={(open) => { if (!open) closeDetail(); }}>
        <DialogContent showCloseButton={false} className="detail-dialog max-h-[92vh] w-[min(96vw,1280px)] max-w-[min(96vw,1280px)] overflow-hidden rounded-3xl border border-[#cfc0aa] bg-[#fbf8f0] p-0 shadow-[0_28px_90px_rgb(35_29_20/28%)] sm:max-w-[min(96vw,1280px)]">
          <DialogHeader className="sticky top-0 z-20 flex-row items-center border-b border-[#ddd1bf] bg-[#fbf8f0]/95 px-3 py-2.5 backdrop-blur sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              {detailStack.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => window.history.back()} aria-label="返回上一层"><ArrowLeft /></Button>
              )}
              <div className="min-w-0">
                <DialogTitle className="truncate font-heading text-base font-semibold text-[#315f4c] sm:text-lg">{selectedBird?.names.zh ?? selectedBonus?.names.zh ?? '卡牌详情'}</DialogTitle>
                <DialogDescription className="truncate text-xs">{selectedBird?.names.en ?? selectedBonus?.names.en ?? '展翅翱翔卡牌详情'}</DialogDescription>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => navigateDetail(-1)} disabled={selectedIndex <= 0} aria-label="上一张"><ArrowLeft /></Button>
              <span className="hidden min-w-16 text-center text-xs text-[#82786a] sm:block">{selectedIndex >= 0 ? `${selectedIndex + 1} / ${detailSequence.length}` : '—'}</span>
              <Button variant="ghost" size="icon" onClick={() => navigateDetail(1)} disabled={selectedIndex < 0 || selectedIndex >= detailSequence.length - 1} aria-label="下一张"><ArrowRight /></Button>
              <Button variant="ghost" size="icon" onClick={copyLink} aria-label="复制卡牌链接">{copied ? <Check className="text-[#367157]" /> : <Copy />}</Button>
              <DialogClose render={<Button variant="ghost" size="icon" aria-label="关闭详情" />}><X /></DialogClose>
            </div>
          </DialogHeader>

          <div className="detail-dialog-body thin-scrollbar min-h-0 min-w-0 overflow-x-hidden overflow-y-auto">
          {selectedBird && (
            <div className="grid gap-0 lg:grid-cols-[minmax(280px,0.82fr)_minmax(360px,1.18fr)]">
              <div className="flex min-h-[430px] items-start justify-center overflow-auto bg-[#e9e1d4] p-5 sm:p-8 lg:min-h-[670px] lg:items-center">
                <button type="button" onClick={() => setZoomed((value) => !value)} aria-label={zoomed ? '缩小卡面' : '放大卡面'} className={`w-full max-w-[360px] cursor-zoom-in rounded-2xl shadow-[0_20px_50px_rgb(50_39_23/24%)] transition duration-200 focus-visible:ring-3 focus-visible:ring-[#4c8068] focus-visible:outline-none ${zoomed ? 'scale-[1.3] cursor-zoom-out' : ''}`}>
                  <CardSprite sprite={selectedBird.sprite} highResolution className="w-full rounded-2xl" />
                </button>
              </div>
              <article className="field-paper p-5 sm:p-8 md:p-9">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#d9ccb9] pb-6">
                  <div>
                    <p className="mb-1 text-xs font-medium tracking-[0.18em] text-[#9a5d3e]">{setById.get(selectedBird.set)?.name.zh} · #{String(selectedBird.index + 1).padStart(3, '0')}</p>
                    <h2 className="font-heading text-3xl font-bold text-[#294d3d]">{selectedBird.names.zh}</h2>
                    <p className="mt-1 text-sm font-medium text-[#655d52]">{selectedBird.names.en}</p>
                    <p className="mt-0.5 font-serif text-sm italic text-[#8b8173]">{selectedBird.names.scientific}</p>
                  </div>
                  <div className="grid size-14 place-items-center rounded-full border border-[#d4c4ad] bg-white text-center shadow-sm"><strong className="font-heading text-2xl text-[#315f4c]">{selectedBird.victoryPoints}</strong><span className="-mt-2 text-[9px] text-[#887d6d]">分</span></div>
                </div>

                <dl className="grid grid-cols-2 gap-3 border-b border-[#d9ccb9] py-6 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/65 p-3"><dt className="text-[11px] text-[#8a8071]">栖息地</dt><dd className="mt-1 text-sm font-medium">{selectedBird.habitats.map((id) => habitatById.get(id)?.name.zh).join(' · ')}</dd></div>
                  <div className="rounded-xl bg-white/65 p-3"><dt className="text-[11px] text-[#8a8071]">巢型</dt><dd className="mt-1 text-sm font-medium">{nestById.get(selectedBird.nestType)?.name.zh}</dd></div>
                  <div className="rounded-xl bg-white/65 p-3"><dt className="text-[11px] text-[#8a8071]">蛋容量</dt><dd className="mt-1 flex items-center gap-1.5 text-sm font-medium"><Egg className="size-4 text-[#a16444]" />{selectedBird.eggCapacity} 枚</dd></div>
                  <div className="rounded-xl bg-white/65 p-3"><dt className="text-[11px] text-[#8a8071]">翼展</dt><dd className="mt-1 text-sm font-medium">{selectedBird.wingspanCm} cm</dd></div>
                  <div className="col-span-2 rounded-xl bg-white/65 p-3 sm:col-span-2"><dt className="text-[11px] text-[#8a8071]">食物费用{selectedBird.foodCost.alternative ? '（任选）' : ''}</dt><dd className="mt-1 flex flex-wrap gap-1.5">{Object.entries(selectedBird.foodCost.amounts).filter(([, amount]) => amount > 0).map(([id, amount]) => <span key={id} className="rounded-full bg-[#e3ede5] px-2 py-0.5 text-xs font-medium text-[#315f4c]">{foodById.get(id)?.name.zh} × {amount}</span>)}</dd></div>
                </dl>

                <section className="border-b border-[#d9ccb9] py-6">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="font-heading text-lg font-semibold text-[#315f4c]">鸟类能力</h3>
                    <span className="rounded-full border border-[#c9b9a4] bg-white/70 px-2 py-0.5 text-[11px] text-[#6c6255]">{selectedBird.power ? powerById.get(selectedBird.power.color)?.name.zh : '无能力'}</span>
                    {selectedBird.power?.flags.predator && <span className="rounded-full bg-[#efe0d6] px-2 py-0.5 text-[11px] text-[#8d4d32]">捕食者</span>}
                    {selectedBird.power?.flags.flocking && <span className="rounded-full bg-[#e2e8f0] px-2 py-0.5 text-[11px] text-[#465f78]">群居</span>}
                  </div>
                  {selectedBird.power ? <><p className="text-[15px] leading-7 text-[#3f3a33]">{selectedBird.power.text.zh}</p><p className="mt-3 border-l-2 border-[#cdbda6] pl-3 text-sm leading-6 text-[#7c7264]">{selectedBird.power.text.en}</p></> : <p className="text-sm text-[#817769]">这张鸟卡没有特殊能力。</p>}
                </section>

                <section className="pt-6">
                  <h3 className="font-heading text-lg font-semibold text-[#315f4c]">符合的奖励卡</h3>
                  {selectedBird.bonusCardIds.length ? <div className="mt-3 flex flex-wrap gap-2">{selectedBird.bonusCardIds.map((id) => { const card = bonusById.get(id); return card ? <button key={id} type="button" onClick={() => openRelatedDetail({ kind: 'bonus', id })} className="rounded-xl border border-[#c8b9a4] bg-white/75 px-3 py-2 text-left text-sm transition hover:-translate-y-0.5 hover:border-[#64866f] hover:bg-[#edf4ee] focus-visible:ring-2 focus-visible:ring-[#4c8068] focus-visible:outline-none"><strong className="font-heading text-[#315f4c]">{card.names.zh}</strong><span className="ml-2 text-xs text-[#867b6d]">{card.names.en}</span></button> : null; })}</div> : <p className="mt-2 text-sm text-[#817769]">没有对应的基础奖励卡条件。</p>}
                </section>
              </article>
            </div>
          )}

          {selectedBonus && (
            <div className="grid gap-0 lg:grid-cols-[minmax(260px,0.72fr)_minmax(380px,1.28fr)]">
              <div className="flex min-h-[520px] items-start justify-center overflow-auto bg-[#e9e1d4] p-5 sm:p-8 lg:min-h-[670px] lg:items-center">
                <button type="button" onClick={() => setZoomed((value) => !value)} aria-label={zoomed ? '缩小卡面' : '放大卡面'} className={`w-full max-w-[300px] cursor-zoom-in rounded-2xl shadow-[0_20px_50px_rgb(50_39_23/24%)] transition duration-200 focus-visible:ring-3 focus-visible:ring-[#4c8068] focus-visible:outline-none ${zoomed ? 'scale-[1.25] cursor-zoom-out' : ''}`}>
                  <CardSprite sprite={selectedBonus.sprite} highResolution className="w-full rounded-2xl" />
                </button>
              </div>
              <article className="field-paper p-5 sm:p-8 md:p-10">
                <p className="mb-1 text-xs font-medium tracking-[0.18em] text-[#9a5d3e]">奖励卡 · #{String(selectedBonus.index + 1).padStart(2, '0')}</p>
                <h2 className="font-heading text-3xl font-bold text-[#294d3d]">{selectedBonus.names.zh}</h2>
                <p className="mt-1 text-sm font-medium text-[#655d52]">{selectedBonus.names.en}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {selectedBonus.languageDependent && <span className="inline-flex items-center gap-1 rounded-full bg-[#efe0d6] px-2.5 py-1 text-xs text-[#8d4d32]"><Languages className="size-3.5" />语言相关</span>}
                  {selectedBonus.automa && <span className="inline-flex items-center gap-1 rounded-full bg-[#e2e8f0] px-2.5 py-1 text-xs text-[#465f78]"><Bot className="size-3.5" />支持自动机</span>}
                  {selectedBonus.deckPercentage !== null && <span className="rounded-full bg-[#e3ede5] px-2.5 py-1 text-xs text-[#315f4c]">约 {selectedBonus.deckPercentage}% 鸟卡符合</span>}
                </div>
                <div className="mt-7 space-y-6">
                  <section className="rounded-2xl border border-[#d8cab6] bg-white/70 p-5"><h3 className="font-heading text-lg font-semibold text-[#315f4c]">计分条件</h3><p className="mt-2 text-[15px] leading-7">{selectedBonus.condition.zh}</p><p className="mt-3 border-l-2 border-[#cdbda6] pl-3 text-sm leading-6 text-[#7c7264]">{selectedBonus.condition.en}</p></section>
                  {selectedBonus.explanation.zh && <section><h3 className="font-heading text-lg font-semibold text-[#315f4c]">条件说明</h3><p className="mt-2 text-[15px] leading-7">{selectedBonus.explanation.zh}</p><p className="mt-3 text-sm leading-6 text-[#7c7264]">{selectedBonus.explanation.en}</p></section>}
                  <section className="rounded-2xl bg-[#315f4c] p-5 text-white shadow-sm"><h3 className="font-heading text-lg font-semibold text-[#fff7e6]">得分规则</h3><p className="mt-2 text-lg leading-7">{selectedBonus.scoring.zh}</p><p className="mt-2 text-sm leading-6 text-white/70">{selectedBonus.scoring.en}</p></section>
                </div>
              </article>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      {showBackToTop && (
        <Button size="icon-lg" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="返回顶部" className="fixed right-4 bottom-5 z-20 rounded-full bg-[#315f4c] shadow-[0_8px_24px_rgb(44_76_61/28%)] sm:right-7 sm:bottom-7"><ArrowUp /></Button>
      )}
    </main>
  );
}
