export type ProjectionPoint = {
  year: number;
  fixedNominal: number;
  fixedReal: number;
  cagrBandNominal: number;
  cagrBandReal: number;
  cagrLowNominal: number;
  cagrLowReal: number;
  cagrBearNominal: number;
  cagrBearReal: number;
  cagrBaseNominal: number;
  cagrBaseReal: number;
  cagrBullNominal: number;
  cagrBullReal: number;
  cagrHighNominal: number;
  cagrHighReal: number;
  s2fNominal: number;
  s2fReal: number;
  powerLawNominal: number;
  powerLawReal: number;
  halvingNominal: number;
  halvingReal: number;
  mcP10Nominal: number;
  mcP10Real: number;
  mcP50Nominal: number;
  mcP50Real: number;
  mcP90Nominal: number;
  mcP90Real: number;
  mcBandNominal: number;
  mcBandReal: number;
};

export type ProjectionInputs = {
  btcOwned: number;
  startPriceUsd: number;
  years: number;
  fixedAnnualGrowthPct: number;
  cagrBearPct: number;
  cagrBasePct: number;
  cagrBullPct: number;
  inflationPct: number;
  s2fExponent: number;
  s2fCurrentRatio: number;
  s2fDecayPct: number;
  powerLawExponent: number;
  btcAgeYears: number;
  monteCarloDriftPct: number;
  monteCarloVolPct: number;
  monteCarloSims: number;
  halvingBaseGrowthPct: number;
  halvingAmplitudePct: number;
  halvingDecayPct: number;
};

const applyGrowth = (principal: number, annualPct: number, year: number) => {
  return principal * Math.pow(1 + annualPct / 100, year);
};

const applyInflationDiscount = (value: number, inflationPct: number, year: number) => {
  return value / Math.pow(1 + inflationPct / 100, year);
};

const makeRng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const sampleStandardNormal = (rand: () => number) => {
  const u1 = Math.max(rand(), 1e-12);
  const u2 = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

const quantile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) {
    return sorted[lo];
  }
  const blend = idx - lo;
  return sorted[lo] * (1 - blend) + sorted[hi] * blend;
};

const buildMonteCarlo = (inputs: ProjectionInputs, startingValue: number) => {
  const drift = inputs.monteCarloDriftPct / 100;
  const vol = inputs.monteCarloVolPct / 100;
  const sims = Math.max(50, Math.floor(inputs.monteCarloSims));
  const yearBuckets = Array.from({ length: inputs.years + 1 }, () => [] as number[]);

  for (let sim = 0; sim < sims; sim += 1) {
    const rand = makeRng(1337 + sim * 97);
    let value = startingValue;
    yearBuckets[0].push(value);

    for (let year = 1; year <= inputs.years; year += 1) {
      const shock = sampleStandardNormal(rand);
      const annualReturn = drift + vol * shock;
      value = Math.max(1, value * Math.max(0.02, 1 + annualReturn));
      yearBuckets[year].push(value);
    }
  }

  return yearBuckets.map((bucket) => ({
    p10: quantile(bucket, 0.1),
    p50: quantile(bucket, 0.5),
    p90: quantile(bucket, 0.9)
  }));
};

export const buildProjection = (inputs: ProjectionInputs): ProjectionPoint[] => {
  const startingValue = inputs.btcOwned * inputs.startPriceUsd;
  const years = inputs.years;
  const monteCarlo = buildMonteCarlo(inputs, startingValue);

  const halvingNominalSeries: number[] = Array.from({ length: years + 1 }, () => 0);
  halvingNominalSeries[0] = startingValue;
  for (let year = 1; year <= years; year += 1) {
    const cycle = Math.floor((year - 1) / 4);
    const cycleDecay = Math.pow(1 - inputs.halvingDecayPct / 100, cycle);
    const trend = inputs.halvingBaseGrowthPct * cycleDecay;
    const amplitude = inputs.halvingAmplitudePct * cycleDecay;
    const phase = ((year - 1) % 4) / 4;
    const wave = Math.sin((phase + 0.1) * 2 * Math.PI);
    const annualPct = trend + amplitude * wave;
    halvingNominalSeries[year] = Math.max(1, halvingNominalSeries[year - 1] * Math.max(0.05, 1 + annualPct / 100));
  }

  return Array.from({ length: years + 1 }, (_, year) => {
    const fixedNominal = applyGrowth(startingValue, inputs.fixedAnnualGrowthPct, year);
    const cagrBearNominal = applyGrowth(startingValue, inputs.cagrBearPct, year);
    const cagrBaseNominal = applyGrowth(startingValue, inputs.cagrBasePct, year);
    const cagrBullNominal = applyGrowth(startingValue, inputs.cagrBullPct, year);

    const cagrLowNominal = Math.min(cagrBearNominal, cagrBullNominal);
    const cagrHighNominal = Math.max(cagrBearNominal, cagrBullNominal);
    const cagrBandNominal = cagrHighNominal - cagrLowNominal;

    const sf0 = Math.max(1, inputs.s2fCurrentRatio);
    const sfYear = sf0 * Math.pow(2, year / 4);
    const s2fMultiplier =
      Math.pow(sfYear / sf0, inputs.s2fExponent) * Math.exp((-inputs.s2fDecayPct / 100) * year);
    const s2fNominal = startingValue * s2fMultiplier;

    const ageBase = Math.max(1, inputs.btcAgeYears);
    const powerLawNominal = startingValue * Math.pow((ageBase + year) / ageBase, inputs.powerLawExponent);

    const halvingNominal = halvingNominalSeries[year];

    const mcP10Nominal = monteCarlo[year].p10;
    const mcP50Nominal = monteCarlo[year].p50;
    const mcP90Nominal = monteCarlo[year].p90;

    return {
      year,
      fixedNominal,
      fixedReal: applyInflationDiscount(fixedNominal, inputs.inflationPct, year),
      cagrBandNominal,
      cagrBandReal: applyInflationDiscount(cagrBandNominal, inputs.inflationPct, year),
      cagrLowNominal,
      cagrLowReal: applyInflationDiscount(cagrLowNominal, inputs.inflationPct, year),
      cagrBearNominal,
      cagrBearReal: applyInflationDiscount(cagrBearNominal, inputs.inflationPct, year),
      cagrBaseNominal,
      cagrBaseReal: applyInflationDiscount(cagrBaseNominal, inputs.inflationPct, year),
      cagrBullNominal,
      cagrBullReal: applyInflationDiscount(cagrBullNominal, inputs.inflationPct, year),
      cagrHighNominal,
      cagrHighReal: applyInflationDiscount(cagrHighNominal, inputs.inflationPct, year),
      s2fNominal,
      s2fReal: applyInflationDiscount(s2fNominal, inputs.inflationPct, year),
      powerLawNominal,
      powerLawReal: applyInflationDiscount(powerLawNominal, inputs.inflationPct, year),
      halvingNominal,
      halvingReal: applyInflationDiscount(halvingNominal, inputs.inflationPct, year),
      mcP10Nominal,
      mcP10Real: applyInflationDiscount(mcP10Nominal, inputs.inflationPct, year),
      mcP50Nominal,
      mcP50Real: applyInflationDiscount(mcP50Nominal, inputs.inflationPct, year),
      mcP90Nominal,
      mcP90Real: applyInflationDiscount(mcP90Nominal, inputs.inflationPct, year),
      mcBandNominal: mcP90Nominal - mcP10Nominal,
      mcBandReal: applyInflationDiscount(mcP90Nominal - mcP10Nominal, inputs.inflationPct, year)
    };
  });
};
