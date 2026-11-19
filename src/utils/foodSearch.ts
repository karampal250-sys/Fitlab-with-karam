import type { FoodItem, Language } from '../types/fitplate';

/**
 * Normalize text for resilient English + Hindi/Hinglish search and deduplication.
 */
export function normalizeFoodText(input: string): string {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`".,/\\()[\]{}:;!?&+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SYNONYM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\b(microni|macroni|makroni|macarony)\b/g, 'macaroni'],
  [/\bpanjeeri\b/g, 'panjiri'],
  [/\b(chapati|chappati|phulka|fulka)\b/g, 'roti'],
  [/\bparotha\b/g, 'paratha'],
  [/\b(tuvar|tuver|arhar|tor)\b/g, 'toor'],
  [/\b(masur|mashore)\b/g, 'masoor'],
  [/\b(mung)\b/g, 'moong'],
  [/\b(chach|chhaas|chhachh)\b/g, 'chaas'],
  [/\b(yoghurt|yogurt|dahi)\b/g, 'curd'],
  [/\b(pyaz|pyaaz|kanda)\b/g, 'onion'],
  [/\b(tamatar)\b/g, 'tomato'],
  [/\b(pudina)\b/g, 'mint'],
  [/\b(dhaniya)\b/g, 'coriander'],
  [/\b(adrak)\b/g, 'ginger'],
  [/\b(elaichi)\b/g, 'cardamom'],
  [/\b(kesar)\b/g, 'saffron'],
  [/\b(badam)\b/g, 'almond'],
  [/\b(pista)\b/g, 'pistachio'],
  [/\b(kaju)\b/g, 'cashew'],
  [/\b(nariyal)\b/g, 'coconut'],
  [/\b(nimbu)\b/g, 'lemon'],
  [/\b(kheera)\b/g, 'cucumber'],
  [/\b(lauki|ghiya|doodhi)\b/g, 'bottle gourd'],
  [/\b(doodh)\b/g, 'milk'],
  [/\b(chawal|sadam|bhat)\b/g, 'rice'],
  [/\b(shakar|shakkar|gud|gur)\b/g, 'jaggery'],
  [/\b(laddu)\b/g, 'ladoo'],
  [/\b(firni)\b/g, 'phirni'],
  [/\b(barfee|burfi)\b/g, 'barfi'],
  [/\b(biriyani)\b/g, 'biryani'],
  [/\b(pulaav|pulav)\b/g, 'pulao'],
  [/\b(momoz|momo)\b/g, 'momos'],
  [/\b(szechuan|schezuan|sichuan)\b/g, 'schezwan'],
  [/\b(drt)\b/g, 'dry'],
];

export function canonicalizeFoodTerms(input: string): string {
  let out = normalizeFoodText(input);
  for (const [pattern, replacement] of SYNONYM_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Generates a canonical deduplication key ignoring parenthetical notes/brands & noise words.
 */
export function canonicalFoodNameKey(name: string): string {
  const withoutParens = String(name || '').replace(/\([^)]*\)/g, ' ');
  return canonicalizeFoodTerms(withoutParens)
    .replace(/\b(plain|classic|style|homestyle|authentic|traditional|fresh|homemade|steamed|boiled|indian|global|with|and|the|in)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Local regional, Hinglish, and colloquial aliases mapped directly to catalog food IDs.
 */
export const FOOD_LOCAL_ALIASES: Record<string, string[]> = {
  roti_wheat: ['chapati', 'phulka', 'tawa roti', 'gehu ki roti', 'wheat chapati'],
  steamed_basmati_rice: ['plain basmati rice', 'plain rice', 'chawal', 'sada chawal', 'white rice', 'bhat'],
  jeera_rice: ['zeera rice', 'cumin rice', 'jeera chawal'],
  veg_pulao: ['vegetable pulao', 'pulao', 'veg pulav', 'tawa pulao'],
  matar_pulao: ['peas pulao', 'matar pulav'],
  kashmiri_pulao: ['shahi pulao', 'mewa pulao', 'dry fruit pulao'],
  veg_biryani: ['veg biryani', 'vegetable biryani', 'subz biryani'],
  moong_khichdi: ['dal khichdi', 'khichdi', 'moong dal khichdi'],
  dal_khichdi_tadka: ['dal khichdi', 'khichdi tadka', 'hotel dal khichdi'],
  lemon_rice: ['chitranna', 'nimbu chawal', 'nimmakaya pulihora'],
  curd_rice: ['thayir sadam', 'dahi chawal', 'baghala bath'],

  curd_dahi: ['plain curd', 'dahi', 'yogurt', 'natural dahi'],
  boondi_raita: ['bundi raita', 'boondi dahi'],
  cucumber_raita: ['kheera raita', 'kakdi raita'],
  mix_veg_raita: ['mixed veg raita', 'vegetable raita'],
  onion_raita: ['pyaz raita', 'kanda raita', 'onion tomato raita'],
  green_salad: ['fresh green salad', 'hara salad', 'kachra salad'],
  kachumber_salad: ['kachumber', 'indian salad'],

  toor_dal_plain: ['toor dal', 'tor dal', 'arhar dal', 'tuvar dal', 'yellow dal'],
  masoor_dal: ['masoor dal', 'mashore dal', 'masur dal', 'red lentil dal'],
  kali_masoor_dal: ['sabut masoor', 'black masoor', 'malka masoor'],
  mix_dal_panchratna: ['mix dal', 'panchmel dal', 'panchratna dal'],
  yellow_moong_dal: ['dhuli moong', 'moong dal', 'pesarapappu'],
  dal_makhani: ['kali dal', 'makhani dal', 'urad makhani'],
  maa_ki_dal_langar: ['langar dal', 'maa ki dal', 'kali dal'],
  chole_masala: ['chana masala', 'kabuli chana', 'chhole'],
  rajma_chawal: ['rajma', 'kidney beans rice'],

  butter_naan: ['plain naan', 'tandoori naan'],
  garlic_naan: ['lasooni naan', 'garlic butter naan'],
  onion_naan: ['pyaz naan', 'onion kulcha'],
  chilli_garlic_naan: ['chili garlic naan', 'mirch garlic naan'],
  pudina_naan: ['mint naan', 'poodina naan'],
  coriander_naan: ['dhaniya naan', 'cilantro naan'],
  kulcha_naan: ['tandoori kulcha', 'plain kulcha'],
  amritsari_naan: ['amritsari kulcha'],

  ginger_tea_milk: ['adrak chai', 'chai', 'indian masala chai', 'milk tea'],
  tea_without_sugar: ['sugar free chai', 'bina cheeni chai', 'unsweetened milk tea'],
  chaas_buttermilk: ['masala chaas', 'chach', 'mattha', 'spiced buttermilk'],
  plain_chaas: ['sada chaas', 'plain buttermilk', 'lassi namkeen'],
  rajasthani_masala_chaas: ['rajasthani chaas', 'jeera hing chaas', 'smoked chaas'],
  sweet_lassi: ['meethi lassi', 'punjabi lassi'],
  salted_lassi: ['namkeen lassi', 'salt lassi'],
  makhaniya_lassi: ['jodhpuri lassi', 'makkhan lassi', 'creamy lassi'],
  badam_milk: ['badam doodh', 'kesar badam milk', 'almond milk'],
  rose_milk_sharbat: ['rose milk', 'gulab sharbat', 'rooh afza milk'],
  thandai_festive: ['thandai', 'kesar thandai', 'holi thandai'],
  aam_panna: ['kairi panna', 'raw mango drink'],
  nimbu_pani_salted: ['shikanji', 'salted shikanji', 'nimbu pani'],
  nimbu_shikanji_sweet: ['shikanji', 'sweet shikanji', 'meetha nimbu pani'],
  jaljeera_drink: ['jaljeera', 'jal jeera'],
  sattu_drink_namkeen: ['sattu drink', 'bihari sattu', 'roasted chana drink'],
  coconut_water: ['tender coconut water', 'nariyal pani', 'elaneer'],
  filter_coffee_milk: ['filter coffee', 'filter coffee with milk', 'south indian filter coffee', 'kaapi'],
  madras_coffee: ['madras kaapi', 'madras filter coffee'],
  south_indian_degree_coffee: ['degree coffee', 'kumbakonam degree coffee'],
  sukku_coffee: ['chukku kaapi', 'sukku malli coffee', 'dry ginger coffee'],
  neer_mor: ['neer moru', 'spiced buttermilk'],
  nannari_sarbath: ['nannari sherbet', 'naruneendi sarbath'],
  jigarthanda: ['madurai jigarthanda'],
  bajra_raab: ['bajre ki raab', 'raabdi'],
  jowar_raab: ['jowar ki raab'],
  mineral_water: ['bisleri', 'kinley', 'aquafina', 'bottled water', 'pani'],
  packaged_drinking_water: ['drinking water', 'water bottle'],
  soda_water: ['club soda', 'plain soda'],
  sparkling_water: ['carbonated water', 'perrier'],
  white_tea: ['safed chai'],
  matcha_tea: ['japanese green tea', 'matcha latte unsweetened'],
  saffron_milk_tea: ['kesar chai', 'saffron chai'],
  badam_tea: ['almond chai', 'badam chai'],
  rose_milk_tea: ['gulab chai', 'rose chai'],
  pista_tea: ['pistachio chai', 'pista chai'],

  dry_pasta_uncooked: ['raw pasta', 'drt pasta', 'uncooked penne', 'dry fusilli'],
  macaroni_dry_raw: ['microni dry', 'macroni dry', 'dry macaroni', 'raw macaroni', 'uncooked macaroni'],
  indian_masala_macaroni: ['desi microni', 'masala microni', 'veg macaroni'],
  red_sauce_pasta: ['arrabbiata pasta', 'tomato pasta'],
  white_sauce_pasta: ['alfredo pasta', 'creamy cheese pasta'],

  pani_puri: ['golgappa', 'puchka', 'gupchup', 'panipuri'],
  onion_pakora: ['kanda bhajji', 'pyaz pakora', 'onion bhaji'],
  poha_kanda: ['kanda poha', 'chivda', 'avalakki'],
  sweet_pongal: ['sakkarai pongal', 'chakkara pongal'],
  kesari_bath: ['rava kesari', 'suji kesari', 'sheera kesari'],
  suji_halwa: ['sheera', 'rava halwa', 'sooji halwa'],
  atta_panjiri: ['panjiri', 'panjeeri', 'wheat panjiri'],
  panjeeri_ladoo: ['panjiri ladoo', 'panjeeri laddu'],
  phirni_classic: ['phirni', 'firni', 'shahi phirni'],
  kesar_phirni: ['saffron phirni', 'kesar firni'],
  rice_kheer: ['chawal ki kheer', 'payasam', 'paal payasam'],
  kozhukattai: ['kolukattai', 'modak', 'modagam'],

  schezwan_sauce: ['sichuan sauce', 'chings schezwan chutney'],
  vinegar_chilli: ['sirka mirch', 'chilli vinegar', 'green chilli vinegar'],
  momos_red_chutney: ['momo chutney', 'red momos chutney'],
  mint_mayo: ['pudina mayo', 'mint mayonnaise'],
  garlic_mayo: ['garlic mayonnaise', 'toum mayo'],
  tomato_ketchup: ['ketchup', 'tomato sauce'],
};

/**
 * Direct query-level local name translations/mappings (e.g. searching "dahi" or "shikanji" or "kaapi").
 */
export const LOCAL_QUERY_SYNONYMS: Record<string, string> = {
  dahi: 'curd',
  chawal: 'rice',
  chappati: 'roti',
  chapati: 'roti',
  phulka: 'roti',
  shikanji: 'nimbu shikanji',
  golgappa: 'pani puri',
  puchka: 'pani puri',
  kaapi: 'coffee',
  pyaz: 'onion',
  kanda: 'onion',
  arhar: 'toor dal',
  tuvar: 'toor dal',
  mashore: 'masoor dal',
  masur: 'masoor dal',
  microni: 'macaroni',
  macroni: 'macaroni',
  panjeeri: 'panjiri',
  sheera: 'halwa',
  sirka: 'vinegar',
  chach: 'chaas',
  mattha: 'chaas',
  nariyal: 'coconut',
  doodh: 'milk',
  badam: 'almond',
  pista: 'pistachio',
  kesar: 'saffron',
  adrak: 'ginger',
  elaichi: 'cardamom',
  nimbu: 'lemon',
  kheera: 'cucumber',
  sakkarai: 'sweet pongal',
  payasam: 'kheer',
};

/**
 * Maps common Open Food Facts or external food names to clean local Hindi/Indian names
 * when `nameHi` is missing or identical to the English brand label.
 */
const LOCAL_HI_MAPPINGS: Array<[RegExp, string]> = [
  [/basmati rice|white rice/i, 'बासमती चावल'],
  [/curd|yogurt|dahi/i, 'दही'],
  [/buttermilk|chaas/i, 'छाछ'],
  [/lassi/i, 'लस्सी'],
  [/roti|chapati/i, 'रोटी / चपाती'],
  [/naan/i, 'नान'],
  [/paratha/i, 'पराठा'],
  [/pulao/i, 'पुलाव'],
  [/biryani/i, 'बिरयानी'],
  [/khichdi/i, 'खिचड़ी'],
  [/raita/i, 'रायता'],
  [/salad/i, 'सलाद'],
  [/macaroni|microni/i, 'मैकरोनी'],
  [/pasta/i, 'पास्ता'],
  [/noodles|chowmein/i, 'नूडल्स'],
  [/manchurian/i, 'मंचूरियन'],
  [/ketchup/i, 'टोमैटो केचप'],
  [/mayo|mayonnaise/i, 'मेयोनेज़'],
  [/sauce|chutney/i, 'सॉस / चटनी'],
  [/iced tea/i, 'आइस्ड टी'],
  [/green tea|matcha/i, 'ग्रीन टी'],
  [/tea|chai/i, 'चाय'],
  [/coffee|kaapi/i, 'कॉफ़ी'],
  [/mineral water|drinking water|sparkling water/i, 'पीने का पानी'],
  [/soda water/i, 'सोडा वाटर'],
  [/paneer/i, 'पनीर'],
  [/milk/i, 'दूध'],
  [/halwa/i, 'हलवा'],
  [/kheer/i, 'खीर'],
  [/ladoo|laddu/i, 'लड्डू'],
  [/gulab jamun/i, 'गुलाब जामुन'],
  [/dal|lentil/i, 'दाल'],
];

export function mapFoodLocalNames(food: FoodItem): FoodItem {
  const existingHi = (food.nameHi || '').trim();
  const hasDevanagari = /[\u0900-\u097F]/.test(existingHi);
  if (hasDevanagari) {
    return food;
  }

  for (const [pattern, hiLabel] of LOCAL_HI_MAPPINGS) {
    if (pattern.test(food.name) || pattern.test(food.id)) {
      return {
        ...food,
        nameHi: existingHi && existingHi.toLowerCase() !== food.name.toLowerCase()
          ? existingHi
          : `${food.name} (${hiLabel})`,
      };
    }
  }

  return {
    ...food,
    nameHi: existingHi || food.name,
  };
}

/**
 * Deduplicate food arrays keeping priority order:
 * 1) Custom user foods
 * 2) Comprehensive Indian & Global database (`INDIAN_AND_GLOBAL_FOODS`)
 * 3) Remote Open Food Facts items (suppressed if they collide with a local catalog item)
 */
export function deduplicateFoods(items: FoodItem[]): FoodItem[] {
  const seenIds = new Set<string>();
  const seenCanonicalKeys = new Set<string>();
  const seenExactNames = new Set<string>();
  const result: FoodItem[] = [];

  for (const raw of items) {
    const food = mapFoodLocalNames(raw);
    const cleanId = food.id.trim();
    if (!cleanId || seenIds.has(cleanId)) continue;

    const exactNorm = normalizeFoodText(food.name);
    const fullCanonKey = canonicalizeFoodTerms(food.name);
    const coreKey = canonicalFoodNameKey(food.name);
    const isRemote = cleanId.startsWith('off_');

    if (exactNorm && seenExactNames.has(exactNorm)) {
      continue;
    }

    // For remote Open Food Facts items, filter out duplicates matching already-prioritized local dishes
    if (isRemote && coreKey && seenCanonicalKeys.has(coreKey)) {
      continue;
    }

    // Prevent two local/custom items with identical canonical names + category (preserving qualifiers like No Sugar / Sweet / Dry)
    if (!isRemote && fullCanonKey) {
      const catKey = `${food.category}::${fullCanonKey}`;
      if (seenCanonicalKeys.has(catKey)) {
        continue;
      }
      seenCanonicalKeys.add(catKey);
    }

    seenIds.add(cleanId);
    if (exactNorm) seenExactNames.add(exactNorm);
    if (!isRemote && coreKey) {
      seenCanonicalKeys.add(coreKey);
    }

    result.push(food);
  }

  return result;
}

function getSearchableCorpus(food: FoodItem): {
  nameNorm: string;
  nameCanonical: string;
  hiNorm: string;
  aliases: string[];
  extra: string;
} {
  const aliases = (FOOD_LOCAL_ALIASES[food.id] || []).map((a) => canonicalizeFoodTerms(a));
  return {
    nameNorm: normalizeFoodText(food.name),
    nameCanonical: canonicalizeFoodTerms(food.name),
    hiNorm: normalizeFoodText(food.nameHi || ''),
    aliases,
    extra: canonicalizeFoodTerms(
      `${food.category.replace(/_/g, ' ')} ${food.ingredientsSummary || ''} ${food.id.replace(/_/g, ' ')}`
    ),
  };
}

export function scoreFoodMatch(food: FoodItem, rawQuery: string, isRemote = false): number {
  const qNorm = normalizeFoodText(rawQuery);
  if (!qNorm) return isRemote ? 0 : 100;

  const qCanon = canonicalizeFoodTerms(rawQuery);
  const mappedSynonym = LOCAL_QUERY_SYNONYMS[qNorm] || LOCAL_QUERY_SYNONYMS[qCanon] || '';
  const queryVariants = Array.from(new Set([qNorm, qCanon, mappedSynonym].filter(Boolean)));
  const tokens = qCanon.split(' ').filter(Boolean);

  const corpus = getSearchableCorpus(food);
  const localPriorityBoost = isRemote ? 0 : 250;

  // 1. Exact match on name, Hindi name, or mapped local alias
  for (const qv of queryVariants) {
    if (
      corpus.nameNorm === qv ||
      corpus.nameCanonical === qv ||
      corpus.hiNorm === qv ||
      corpus.aliases.includes(qv)
    ) {
      return 1000 + localPriorityBoost;
    }
  }

  // 2. Prefix match on name, Hindi name, or mapped alias
  for (const qv of queryVariants) {
    if (
      corpus.nameNorm.startsWith(qv) ||
      corpus.nameCanonical.startsWith(qv) ||
      corpus.hiNorm.startsWith(qv) ||
      corpus.aliases.some((a) => a.startsWith(qv))
    ) {
      return 780 + localPriorityBoost;
    }
  }

  // 3. Phrase containment in name, Hindi name, or mapped alias
  for (const qv of queryVariants) {
    if (
      corpus.nameNorm.includes(qv) ||
      corpus.nameCanonical.includes(qv) ||
      corpus.hiNorm.includes(qv) ||
      corpus.aliases.some((a) => a.includes(qv))
    ) {
      // Bonus if a word in name starts with query
      const wordStartBonus = corpus.nameCanonical.split(' ').some((w) => w.startsWith(qv)) ? 80 : 0;
      return 560 + wordStartBonus + localPriorityBoost;
    }
  }

  // 4. All tokens match across name, Hindi name, aliases, category & ingredients
  const combined = `${corpus.nameNorm} ${corpus.nameCanonical} ${corpus.hiNorm} ${corpus.aliases.join(' ')} ${corpus.extra}`;
  if (tokens.length > 0 && tokens.every((tk) => combined.includes(tk))) {
    const nameTokenHits = tokens.filter((tk) => corpus.nameCanonical.includes(tk)).length;
    return 360 + nameTokenHits * 40 + localPriorityBoost;
  }

  return 0;
}

export interface PrioritizedSearchOptions {
  query?: string;
  customFoods?: FoodItem[];
  localFoods: FoodItem[];
  remoteFoods?: FoodItem[];
  categoryFilter?: string;
  activeLetter?: string | null;
  language?: Language;
  limit?: number;
}

export function matchesCategoryFilter(food: FoodItem, categoryFilter: string): boolean {
  if (!categoryFilter || categoryFilter === 'all') return true;
  if (categoryFilter === 'dal_recipes') {
    return (
      food.category === 'dal_curry' &&
      /\b(dal|sambhar|rasam|lobia|rajma|chole|khichdi|kadhi)\b/i.test(food.name)
    );
  }
  if (categoryFilter === 'raita_salad') {
    return food.category === 'raita_salad' || food.id === 'boondi_raita' || food.id === 'cucumber_raita';
  }
  if (categoryFilter === 'indian_mains') {
    return food.category === 'bread_rice' || food.category === 'dal_curry';
  }
  return food.category === categoryFilter;
}

/**
 * Prioritizes custom + comprehensive Indian & Global DB over external results,
 * resolves local aliases/names, deduplicates overlapping dishes, and sorts cleanly.
 */
export function searchFoodsWithPriority({
  query = '',
  customFoods = [],
  localFoods,
  remoteFoods = [],
  categoryFilter = 'all',
  activeLetter = null,
  language = 'en',
  limit,
}: PrioritizedSearchOptions): FoodItem[] {
  const isHi = language === 'hi';
  const trimmed = query.trim();

  // Priority order: 1. Custom user foods -> 2. Comprehensive local Indian & global DB -> 3. Remote Open Food Facts
  const combinedUnique = deduplicateFoods([
    ...customFoods,
    ...localFoods,
    ...remoteFoods,
  ]);

  const byCategory = combinedUnique.filter((f) => matchesCategoryFilter(f, categoryFilter));

  const byLetter = activeLetter
    ? byCategory.filter((f) => {
        const ch = activeLetter.toLowerCase();
        const label = (isHi ? f.nameHi : f.name).trim().toLowerCase();
        return label.startsWith(ch) || f.name.trim().toLowerCase().startsWith(ch);
      })
    : byCategory;

  if (!trimmed) {
    const sortedAlpha = [...byLetter].sort((a, b) => {
      const aName = (isHi ? a.nameHi : a.name).trim();
      const bName = (isHi ? b.nameHi : b.name).trim();
      return aName.localeCompare(bName);
    });
    return typeof limit === 'number' ? sortedAlpha.slice(0, limit) : sortedAlpha;
  }

  const scored = byLetter
    .map((food) => ({
      food,
      score: scoreFoodMatch(food, trimmed, food.id.startsWith('off_')),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aName = (isHi ? a.food.nameHi : a.food.name).trim();
      const bName = (isHi ? b.food.nameHi : b.food.name).trim();
      return aName.localeCompare(bName);
    })
    .map((entry) => entry.food);

  return typeof limit === 'number' ? scored.slice(0, limit) : scored;
}

/**
 * Resolves a FoodItem (e.g. from barcode/Open Food Facts) against the local comprehensive DB
 * to prioritize local nutrition data and local Hindi/English names when an unambiguous match exists.
 */
export function resolveLookupFoodItem(candidate: FoodItem, localFoods: FoodItem[]): FoodItem {
  const mappedCandidate = mapFoodLocalNames(candidate);
  if (!mappedCandidate.id.startsWith('off_')) {
    return mappedCandidate;
  }

  // Prefer barcode match if present in local DB
  if (mappedCandidate.barcode) {
    const byBarcode = localFoods.find((f) => f.barcode === mappedCandidate.barcode);
    if (byBarcode) return mapFoodLocalNames(byBarcode);
  }

  // If Open Food Facts product name exactly matches a local DB item canonical name, enrich/map local Hindi name
  const candKey = canonicalFoodNameKey(mappedCandidate.name);
  if (candKey) {
    const exactLocal = localFoods.find((f) => canonicalFoodNameKey(f.name) === candKey);
    if (exactLocal && !/[\u0900-\u097F]/.test(mappedCandidate.nameHi)) {
      return {
        ...mappedCandidate,
        nameHi: exactLocal.nameHi,
      };
    }
  }

  return mappedCandidate;
}
