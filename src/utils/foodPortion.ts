import type { FoodItem, Language, ServingOption } from '../types/fitplate';

export type SmartUnitKind =
  | 'bowl'
  | 'no'
  | 'cup'
  | 'glass'
  | 'plate'
  | 'tbsp'
  | 'scoop'
  | 'gram';

export interface SmartUnitInfo {
  kind: SmartUnitKind;
  storedUnit: string;
  singularEn: string;
  pluralEn: string;
  labelHi: string;
  isCountable: boolean;
  /** Number of counted pieces/items represented by 1 serving option (e.g., 2 for '2 Slices', 10 for '10 Almonds', otherwise 1) */
  baseCount: number;
  /** True if base serving represents liquid ml (e.g., 100ml, 150ml, 250ml) */
  isLiquid: boolean;
}

const BOWL_KEYWORDS_REGEX =
  /\b(bowl|katori|dal|daliya|khichdi|poha|upma|oats|curd|dahi|raita|salad|soup|sprouts|sabzi|curry|rajma|chole|chana|kadhi|sambar|rasam|halwa|kheer|custard|porridge|payasam|pongal|bhel|muesli|cornflakes|pulao|biryani|fried rice|noodles|pasta|macaroni)\b/i;

export function formatQtyNumber(val: number): string {
  const rounded = Math.round(val * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace(/\.0+$/, '');
}

/**
 * Resolves how a food serving should be presented and incremented:
 * - Bowl-served foods (dal, curries, daliya, oats, khichdi, curd, raita, salad, soup, etc.) -> Bowl / Bowls
 * - Countable / discrete foods (roti, paratha, idli, dosa, egg, banana, samosa, burger, etc.) -> No. / Nos.
 * - Drinks, plates, spoons, scoops, grams -> Cup, Glass, Plate, Tbsp, Scoop, g/ml
 */
export function resolveSmartServingUnit(
  food: FoodItem | null | undefined,
  serving: ServingOption | null | undefined
): SmartUnitInfo {
  const unit = serving?.unit ?? 'gram';
  const labelEn = (serving?.labelEn || '').trim();
  const labelLower = labelEn.toLowerCase();
  const isLiquid = /\b\d+\s*ml\b/i.test(labelLower);
  const foodNameLower = (food?.name || '').toLowerCase();

  // Extract leading number if label starts with e.g. "2 Slices (56g)", "10 Almonds (12g)", "4 Biscuits (22g)"
  const leadingMatch = labelEn.match(/^(\d+(?:\.\d+)?)\s+([a-zA-Z]+)/);
  const leadingNum = leadingMatch ? Number(leadingMatch[1]) : 1;
  const leadingWord = leadingMatch ? leadingMatch[2].toLowerCase() : '';

  // 1. Bowl-served foods
  const explicitlyBowlOrKatori =
    unit === 'bowl' ||
    unit === 'katori' ||
    /\bbowl\b|\bkatori\b/i.test(labelLower);

  // Exception: if label explicitly starts with "1 Plate" and doesn't prioritize Bowl (e.g. "1 Plate / Bowl" still works nicely as Plate or Bowl;
  // for dal_curry / raita_salad / pasta / soup / oats / khichdi / daliya, Bowl is always natural).
  const isPlateFirstMixed = /^1\s+(plate|combo|full|platter|sizzler)/i.test(labelLower);
  const isPastaOrSoupOrBowlDish =
    food?.category === 'pasta' ||
    food?.category === 'dal_curry' ||
    food?.category === 'raita_salad' ||
    BOWL_KEYWORDS_REGEX.test(foodNameLower);

  if (
    unit === 'bowl' ||
    unit === 'katori' ||
    (explicitlyBowlOrKatori && (!isPlateFirstMixed || isPastaOrSoupOrBowlDish))
  ) {
    return {
      kind: 'bowl',
      storedUnit: 'bowl',
      singularEn: 'Bowl',
      pluralEn: 'Bowls',
      labelHi: 'बाउल',
      isCountable: false,
      baseCount: 1,
      isLiquid,
    };
  }

  // 2. Countable / discrete items -> No. / Nos.
  if (unit === 'piece' || unit === 'no') {
    const validCountBase =
      leadingNum > 1 &&
      !['g', 'gm', 'gms', 'gram', 'grams', 'ml'].includes(leadingWord)
        ? leadingNum
        : 1;
    return {
      kind: 'no',
      storedUnit: 'no',
      singularEn: 'No.',
      pluralEn: 'Nos.',
      labelHi: 'नग',
      isCountable: true,
      baseCount: validCountBase,
      isLiquid,
    };
  }

  // Packaged / fast-food multi-piece servings marked as 'plate' like "6 Pieces (96g)"
  if (unit === 'plate' && /^\d+\s+(pieces?|pcs|nuggets|sticks|momos|vadas|tikkis)/i.test(labelLower)) {
    return {
      kind: 'no',
      storedUnit: 'no',
      singularEn: 'No.',
      pluralEn: 'Nos.',
      labelHi: 'नग',
      isCountable: true,
      baseCount: leadingNum > 1 ? leadingNum : 1,
      isLiquid,
    };
  }

  // 3. Other natural units
  if (unit === 'cup') {
    return {
      kind: 'cup',
      storedUnit: 'cup',
      singularEn: 'Cup',
      pluralEn: 'Cups',
      labelHi: 'कप',
      isCountable: false,
      baseCount: 1,
      isLiquid,
    };
  }

  if (unit === 'glass') {
    const isBottle = /\bbottle\b/i.test(labelLower) && !/\bglass\b/i.test(labelLower);
    return {
      kind: 'glass',
      storedUnit: 'glass',
      singularEn: isBottle ? 'Bottle' : 'Glass',
      pluralEn: isBottle ? 'Bottles' : 'Glasses',
      labelHi: isBottle ? 'बोतल' : 'गिलास',
      isCountable: false,
      baseCount: 1,
      isLiquid: true,
    };
  }

  if (unit === 'plate') {
    const isPack = /\b(pack|bag|tray)\b/i.test(labelLower);
    return {
      kind: 'plate',
      storedUnit: 'plate',
      singularEn: isPack ? 'Pack' : 'Plate',
      pluralEn: isPack ? 'Packs' : 'Plates',
      labelHi: isPack ? 'पैक' : 'प्लेट',
      isCountable: false,
      baseCount: 1,
      isLiquid,
    };
  }

  if (unit === 'tbsp') {
    return {
      kind: 'tbsp',
      storedUnit: 'tbsp',
      singularEn: 'Tbsp',
      pluralEn: 'Tbsp',
      labelHi: 'चम्मच',
      isCountable: false,
      baseCount: 1,
      isLiquid,
    };
  }

  if (unit === 'scoop') {
    return {
      kind: 'scoop',
      storedUnit: 'scoop',
      singularEn: 'Scoop',
      pluralEn: 'Scoops',
      labelHi: 'स्कूप',
      isCountable: false,
      baseCount: 1,
      isLiquid: false,
    };
  }

  // Default: gram / ml
  return {
    kind: 'gram',
    storedUnit: 'gram',
    singularEn: isLiquid ? 'ml' : 'g',
    pluralEn: isLiquid ? 'ml' : 'g',
    labelHi: isLiquid ? 'ml' : 'ग्राम',
    isCountable: false,
    baseCount: 1,
    isLiquid,
  };
}

/**
 * Formats a stored FoodLogEntry.servingUnit string into SmartUnitInfo
 * (handles both new 'bowl'/'no' values and legacy 'katori'/'piece' values).
 */
export function resolveStoredUnitInfo(servingUnitRaw: string): SmartUnitInfo {
  const u = (servingUnitRaw || '').trim().toLowerCase();
  if (u === 'bowl' || u === 'katori' || u.includes('bowl') || u.includes('katori')) {
    return {
      kind: 'bowl',
      storedUnit: 'bowl',
      singularEn: 'Bowl',
      pluralEn: 'Bowls',
      labelHi: 'बाउल',
      isCountable: false,
      baseCount: 1,
      isLiquid: false,
    };
  }
  if (
    u === 'no' ||
    u === 'nos' ||
    u === 'no.' ||
    u === 'nos.' ||
    u === 'piece' ||
    u === 'pieces' ||
    u === 'pcs'
  ) {
    return {
      kind: 'no',
      storedUnit: 'no',
      singularEn: 'No.',
      pluralEn: 'Nos.',
      labelHi: 'नग',
      isCountable: true,
      baseCount: 1,
      isLiquid: false,
    };
  }
  if (u === 'cup' || u === 'cups') {
    return {
      kind: 'cup',
      storedUnit: 'cup',
      singularEn: 'Cup',
      pluralEn: 'Cups',
      labelHi: 'कप',
      isCountable: false,
      baseCount: 1,
      isLiquid: false,
    };
  }
  if (u === 'glass' || u === 'glasses') {
    return {
      kind: 'glass',
      storedUnit: 'glass',
      singularEn: 'Glass',
      pluralEn: 'Glasses',
      labelHi: 'गिलास',
      isCountable: false,
      baseCount: 1,
      isLiquid: true,
    };
  }
  if (u === 'plate' || u === 'plates') {
    return {
      kind: 'plate',
      storedUnit: 'plate',
      singularEn: 'Plate',
      pluralEn: 'Plates',
      labelHi: 'प्लेट',
      isCountable: false,
      baseCount: 1,
      isLiquid: false,
    };
  }
  if (u === 'tbsp') {
    return {
      kind: 'tbsp',
      storedUnit: 'tbsp',
      singularEn: 'Tbsp',
      pluralEn: 'Tbsp',
      labelHi: 'चम्मच',
      isCountable: false,
      baseCount: 1,
      isLiquid: false,
    };
  }
  if (u === 'scoop' || u === 'scoops') {
    return {
      kind: 'scoop',
      storedUnit: 'scoop',
      singularEn: 'Scoop',
      pluralEn: 'Scoops',
      labelHi: 'स्कूप',
      isCountable: false,
      baseCount: 1,
      isLiquid: false,
    };
  }
  if (u === 'gram' || u === 'grams' || u === 'g') {
    return {
      kind: 'gram',
      storedUnit: 'gram',
      singularEn: 'g',
      pluralEn: 'g',
      labelHi: 'ग्राम',
      isCountable: false,
      baseCount: 1,
      isLiquid: false,
    };
  }

  // Fallback for coach-provided portion text
  return {
    kind: 'plate',
    storedUnit: servingUnitRaw,
    singularEn: servingUnitRaw,
    pluralEn: servingUnitRaw,
    labelHi: servingUnitRaw,
    isCountable: false,
    baseCount: 1,
    isLiquid: false,
  };
}

/**
 * Formats a quantity + unit cleanly, e.g.:
 * - (1, bowl) => "1 Bowl" / "1 बाउल"
 * - (2, bowl) => "2 Bowls" / "2 बाउल"
 * - (1, no) => "1 No." / "1 नग"
 * - (3, no) => "3 Nos." / "3 नग"
 * - (1.5, gram, 100g) => "150g"
 */
export function formatSmartQtyLabel(
  multiplierQty: number,
  info: SmartUnitInfo,
  language: Language,
  baseGrams = 100
): string {
  const isHi = language === 'hi';
  if (info.kind === 'gram') {
    const totalG = Math.round(baseGrams * multiplierQty * 10) / 10;
    const unit = info.isLiquid ? 'ml' : isHi ? 'g' : 'g';
    return `${formatQtyNumber(totalG)}${unit}`;
  }

  const effectiveCount = Math.round(multiplierQty * info.baseCount * 100) / 100;
  const numStr = formatQtyNumber(effectiveCount);
  if (isHi) {
    return `${numStr} ${info.labelHi}`;
  }
  const unitWord = effectiveCount === 1 ? info.singularEn : info.pluralEn;
  return `${numStr} ${unitWord}`;
}

/**
 * Formats a concise serving summary line for search rows & portion adjuster, e.g.:
 * "2 Bowls (300g)" or "3 Nos. (105g)" or "150g"
 */
export function formatServingSummary(
  food: FoodItem | null | undefined,
  serving: ServingOption | null | undefined,
  multiplierQty: number,
  language: Language
): string {
  if (!serving) return '';
  const info = resolveSmartServingUnit(food, serving);
  const totalGrams = Math.round(serving.grams * multiplierQty * 10) / 10;
  const unitSuffix = info.isLiquid ? 'ml' : 'g';

  if (info.kind === 'gram') {
    return `${formatQtyNumber(totalGrams)}${unitSuffix}`;
  }

  const qtyText = formatSmartQtyLabel(multiplierQty, info, language, serving.grams);
  return `${qtyText} (${formatQtyNumber(totalGrams)}${unitSuffix})`;
}

/**
 * Formats a ServingOption label in the Portion Adjuster dropdown so "Katori" consistently shows as "Bowl".
 */
export function formatServingOptionTitle(
  food: FoodItem | null | undefined,
  serving: ServingOption,
  language: Language
): string {
  const isHi = language === 'hi';
  const raw = isHi ? serving.labelHi : serving.labelEn;
  const info = resolveSmartServingUnit(food, serving);

  if (info.kind === 'bowl') {
    if (isHi) {
      return raw.replace(/कटोरी/g, 'बाउल');
    }
    return raw.replace(/Katori/gi, 'Bowl');
  }
  if (info.kind === 'no' && info.baseCount === 1) {
    if (isHi) {
      return raw.replace(/पीस/g, 'नग');
    }
    return raw.replace(/\bPiece\b/gi, 'No.');
  }
  return raw;
}

/**
 * Returns food-appropriate multiplier presets for inline search dropdowns.
 */
export function getSmartQtyPresets(info: SmartUnitInfo): number[] {
  if (info.kind === 'no') {
    if (info.baseCount === 2) return [0.5, 1, 1.5, 2, 2.5, 3]; // 1, 2, 3, 4, 5, 6 Nos.
    if (info.baseCount === 4) return [0.25, 0.5, 0.75, 1, 1.5, 2]; // 1, 2, 3, 4, 6, 8 Nos.
    if (info.baseCount === 6) return [0.5, 1, 1.5, 2]; // 3, 6, 9, 12 Nos.
    if (info.baseCount === 10) return [0.5, 1, 1.5, 2, 3]; // 5, 10, 15, 20, 30 Nos.
    return [0.5, 1, 2, 3, 4, 5, 6]; // 0.5 No., 1 No., 2 Nos., ...
  }
  return [0.5, 1, 1.5, 2, 2.5, 3, 4]; // Bowls, Cups, Glasses, Plates, Grams
}

/**
 * Computes smart step delta when clicking +/- on a food row or logged entry.
 */
export function getSmartStepDelta(
  currentQty: number,
  direction: 'inc' | 'dec',
  info: SmartUnitInfo
): number {
  if (info.kind === 'no') {
    if (info.baseCount > 1) {
      const singleUnit = Math.max(0.25, Math.round((1 / info.baseCount) * 100) / 100);
      // For large counts like 10 Almonds, step by 0.5 (5 almonds); for 2 Slices or 4 Biscuits, step by 1 item
      const step = info.baseCount >= 8 ? 0.5 : singleUnit;
      return direction === 'inc' ? currentQty + step : Math.max(0.25, currentQty - step);
    }
    if (direction === 'inc') {
      return currentQty < 1 ? 1 : currentQty + 1;
    }
    if (currentQty <= 1) return Math.max(0.5, currentQty - 0.5);
    return currentQty - 1;
  }

  // Bowl / cup / glass / plate / gram step by 0.5 (and 0.25 below 0.5)
  if (direction === 'inc') {
    return currentQty < 0.5 ? 0.5 : currentQty + 0.5;
  }
  return currentQty <= 0.5 ? Math.max(0.25, currentQty - 0.25) : currentQty - 0.5;
}

/**
 * Formats a logged entry's quantity & unit cleanly for display.
 */
export function formatLoggedEntryQty(
  servingQty: number,
  servingUnit: string,
  grams: number,
  language: Language
): string {
  const info = resolveStoredUnitInfo(servingUnit);
  const isHi = language === 'hi';
  if (info.kind === 'gram') {
    return `${formatQtyNumber(grams)}g`;
  }
  const numStr = formatQtyNumber(servingQty);
  if (isHi) {
    return `${numStr} ${info.labelHi}`;
  }
  const unitWord = servingQty === 1 ? info.singularEn : info.pluralEn;
  return `${numStr} ${unitWord}`;
}
