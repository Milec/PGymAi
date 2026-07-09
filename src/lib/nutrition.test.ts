import { describe, expect, it } from 'vitest';
import { barcodeVariants, mapFdcFood, mapOffProduct } from './foodApi';
import {
  addMacros,
  bmrMifflinStJeor,
  dateKey,
  dateKeyLabel,
  goalCalories,
  macroTargets,
  macrosForAmount,
  shiftDateKey,
  tdee,
  waterTargetMl,
} from './nutrition';

describe('Mifflin-St Jeor BMR', () => {
  it('matches the published formula for males', () => {
    // 10·80 + 6.25·180 − 5·30 + 5 = 1780
    expect(bmrMifflinStJeor('male', 80, 180, 30)).toBe(1780);
  });

  it('matches the published formula for females', () => {
    // 10·60 + 6.25·165 − 5·25 − 161 = 1345.25
    expect(bmrMifflinStJeor('female', 60, 165, 25)).toBeCloseTo(1345.25, 2);
  });

  it('unspecified sex is the midpoint of male and female', () => {
    const m = bmrMifflinStJeor('male', 70, 170, 40);
    const f = bmrMifflinStJeor('female', 70, 170, 40);
    expect(bmrMifflinStJeor('unspecified', 70, 170, 40)).toBeCloseTo((m + f) / 2, 6);
  });
});

describe('TDEE and goal calories', () => {
  it('applies the activity multiplier', () => {
    expect(tdee(1780, 'sedentary')).toBeCloseTo(2136, 0);
    expect(tdee(1780, 'moderate')).toBeCloseTo(2759, 0);
  });

  it('cuts subtract and bulks add ~7700 kcal per weekly kg', () => {
    expect(goalCalories(2500, 'maintain', 0.5)).toBe(2500);
    expect(goalCalories(2500, 'cut', 0.5)).toBe(2500 - 550);
    expect(goalCalories(2500, 'bulk', 0.25)).toBe(2500 + 275);
  });

  it('never prescribes below the 1200 kcal floor', () => {
    expect(goalCalories(1500, 'cut', 0.75)).toBe(1200);
  });
});

describe('macro targets', () => {
  it('splits protein by bodyweight, fat by %, carbs from remainder', () => {
    const t = macroTargets(2500, 80, 1.8, 30);
    expect(t.proteinG).toBe(144); // 1.8 g/kg × 80
    expect(t.fatG).toBe(83); // 30% of 2500 / 9
    // carbs = (2500 − 144·4 − 83·9) / 4
    expect(t.carbsG).toBe(Math.round((2500 - 144 * 4 - 83 * 9) / 4));
  });

  it('clamps carbs at zero for very low calorie targets', () => {
    expect(macroTargets(1200, 120, 2.2, 35).carbsG).toBe(0);
  });
});

describe('water target', () => {
  it('applies the ml/kg heuristic plus the activity bump, rounded to 50 ml', () => {
    expect(waterTargetMl(80, 'sedentary')).toBe(2650); // 2640 → 2650
    expect(waterTargetMl(80, 'moderate')).toBe(3150); // +500
    expect(waterTargetMl(60, 'athlete')).toBe(3000); // 1980 + 1000 = 2980 → 3000
  });
});

describe('macro arithmetic', () => {
  const per100 = { kcal: 250, proteinG: 10, carbsG: 30, fatG: 8 };

  it('scales per-100g macros to an amount', () => {
    const m = macrosForAmount(per100, 50);
    expect(m).toEqual({ kcal: 125, proteinG: 5, carbsG: 15, fatG: 4 });
  });

  it('adds macro sets component-wise', () => {
    const sum = addMacros(per100, macrosForAmount(per100, 100));
    expect(sum.kcal).toBe(500);
    expect(sum.proteinG).toBe(20);
  });
});

describe('journal date keys', () => {
  it('formats local YYYY-MM-DD and shifts across month boundaries', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDateKey('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('labels today/yesterday/tomorrow relative to a reference day', () => {
    expect(dateKeyLabel('2026-07-08', '2026-07-08')).toBe('Today');
    expect(dateKeyLabel('2026-07-07', '2026-07-08')).toBe('Yesterday');
    expect(dateKeyLabel('2026-07-09', '2026-07-08')).toBe('Tomorrow');
    expect(dateKeyLabel('2026-07-01', '2026-07-08')).not.toBe('Today');
  });
});

describe('Open Food Facts product mapping', () => {
  it('maps kcal, macros, and gram servings', () => {
    const food = mapOffProduct({
      code: '123',
      product_name: 'Greek Yogurt',
      brands: 'Fage, Other',
      nutriments: {
        'energy-kcal_100g': 97,
        proteins_100g: 9,
        carbohydrates_100g: 3.8,
        fat_100g: 5,
      },
      serving_quantity: '170',
      serving_quantity_unit: 'g',
    });
    expect(food).not.toBeNull();
    expect(food!.name).toBe('Greek Yogurt');
    expect(food!.brand).toBe('Fage');
    expect(food!.per100.kcal).toBe(97);
    expect(food!.servingG).toBe(170);
  });

  it('falls back from kJ and drops products without energy', () => {
    const kj = mapOffProduct({
      code: '1',
      product_name: 'A',
      nutriments: { energy_100g: 418.4 },
    });
    expect(kj!.per100.kcal).toBeCloseTo(100, 1);
    expect(
      mapOffProduct({ code: '2', product_name: 'B', nutriments: { proteins_100g: 5 } }),
    ).toBeNull();
    expect(mapOffProduct({ code: '3', nutriments: { 'energy-kcal_100g': 10 } })).toBeNull();
  });

  it('ignores non-gram serving units', () => {
    const food = mapOffProduct({
      code: '4',
      product_name: 'Bar',
      nutriments: { 'energy-kcal_100g': 400 },
      serving_quantity: 1,
      serving_quantity_unit: 'unit',
    });
    expect(food!.servingG).toBeUndefined();
  });
});

describe('USDA FoodData Central mapping', () => {
  it('maps per-100g nutrient numbers, title-cases, and keeps gram servings', () => {
    const food = mapFdcFood({
      description: 'COCONUT PUFF PROTEIN BARS, COCONUT PUFF',
      brandOwner: 'BUILT BRANDS',
      gtinUpc: '840229302093',
      servingSize: 40,
      servingSizeUnit: 'GRM',
      foodNutrients: [
        { nutrientNumber: '208', value: 350 },
        { nutrientNumber: '203', value: 42.5 },
        { nutrientNumber: '205', value: 32.5 },
        { nutrientNumber: '204', value: 7.5 },
      ],
    });
    expect(food).not.toBeNull();
    expect(food!.name).toBe('Coconut Puff Protein Bars, Coconut Puff');
    expect(food!.brand).toBe('Built Brands');
    expect(food!.per100).toEqual({ kcal: 350, proteinG: 42.5, carbsG: 32.5, fatG: 7.5 });
    expect(food!.servingG).toBe(40);
    expect(food!.barcode).toBe('840229302093');
  });

  it('drops foods without energy or a barcode', () => {
    expect(
      mapFdcFood({ description: 'A', gtinUpc: '1', foodNutrients: [{ nutrientNumber: '203', value: 5 }] }),
    ).toBeNull();
    expect(
      mapFdcFood({ description: 'B', foodNutrients: [{ nutrientNumber: '208', value: 100 }] }),
    ).toBeNull();
  });

  it('ignores non-gram serving units', () => {
    const food = mapFdcFood({
      description: 'C',
      gtinUpc: '2',
      servingSize: 1,
      servingSizeUnit: 'BAR',
      foodNutrients: [{ nutrientNumber: '208', value: 100 }],
    });
    expect(food!.servingG).toBeUndefined();
  });
});

describe('barcode variants', () => {
  it('bridges UPC-A and EAN-13 leading-zero forms', () => {
    expect(barcodeVariants('0840229302093')).toEqual(['0840229302093', '840229302093']);
    expect(barcodeVariants('840229302093')).toEqual(['840229302093', '0840229302093']);
    expect(barcodeVariants('12345678')).toEqual(['12345678']); // EAN-8 untouched
  });
});
