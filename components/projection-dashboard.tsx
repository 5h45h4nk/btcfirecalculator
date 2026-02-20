"use client";

import { useCallback, useMemo, useState } from "react";
import { buildProjection } from "@/lib/projections";
import { ProjectionChart } from "@/components/projection-chart";

type PriceMode = "auto" | "manual";
type ValueView = "both" | "nominal" | "real";
type YScale = "log" | "linear";
type InputTab = "core" | "scenarios" | "models" | "display";
type ThemeName = "neon" | "tron" | "bitcoin";
type AcademyTab = "models" | "inputs";
type AcademyLevel = "beginner" | "advanced";
type FocusModel = "fixed" | "cagr" | "s2f" | "powerLaw" | "monteCarlo" | "halving";
type ModelVisibility = {
  fixed: boolean;
  cagr: boolean;
  s2f: boolean;
  powerLaw: boolean;
  monteCarlo: boolean;
  halving: boolean;
};

const MILESTONES = [1, 5, 10, 20, 30, 40, 50];

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const safeNumber = (value: string, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const MODEL_ACADEMY = [
  {
    key: "fixed" as const,
    title: "Fixed Annual Growth",
    kind: "Line",
    beginner:
      "Uses one constant yearly growth rate. Good for a fast baseline, but real markets are not this smooth.",
    advanced:
      "Compounds value with one annual rate r: V(t)=V0*(1+r)^t. Deterministic and highly rate-sensitive."
  },
  {
    key: "cagr" as const,
    title: "CAGR Scenarios",
    kind: "Range + Line",
    beginner:
      "Shows bear/base/bull paths so you can compare pessimistic vs optimistic outcomes.",
    advanced:
      "Three constant-rate trajectories with base line and bear-bull envelope. Scenario assumptions, not probabilities."
  },
  {
    key: "s2f" as const,
    title: "Stock-to-Flow Style",
    kind: "Line",
    beginner:
      "Assumes increasing scarcity from halvings can drive long-term value growth.",
    advanced:
      "Scales by scarcity ratio growth with exponent and optional decay term to damp future effect."
  },
  {
    key: "powerLaw" as const,
    title: "Power-Law Trend",
    kind: "Line",
    beginner:
      "Uses a long-term time trend tied to BTC network age, not short-term market cycles.",
    advanced:
      "Applies age-based scaling ((age+t)/age)^k. Exponent choice strongly controls slope."
  },
  {
    key: "monteCarlo" as const,
    title: "Monte Carlo",
    kind: "Band + Median",
    beginner:
      "Simulates many random paths and shows likely range (p10-p90) plus median (p50).",
    advanced:
      "Random yearly returns from drift + volatility. Quantiles from simulation distribution at each horizon."
  },
  {
    key: "halving" as const,
    title: "Halving Cycle",
    kind: "Line",
    beginner:
      "Adds repeating 4-year style cycle waves around a long-term trend.",
    advanced:
      "Trend + sinusoidal cycle with optional decay by cycle index, approximating diminishing cycle intensity."
  }
];

const INPUT_ACADEMY = [
  {
    group: "Core",
    items: [
      { name: "BTC owned", meaning: "How many BTC you hold.", effect: "Scales all outcomes up/down.", impact: "High" },
      { name: "Manual BTC price", meaning: "Year-0 USD price anchor.", effect: "Reanchors every curve.", impact: "High" },
      { name: "Inflation (%)", meaning: "Discount rate for real values.", effect: "Higher inflation lowers real lines.", impact: "High" }
    ]
  },
  {
    group: "Scenarios",
    items: [
      { name: "Fixed growth (%)", meaning: "Single annual compounding rate.", effect: "Moves fixed line exponentially.", impact: "High" },
      { name: "CAGR bear/base/bull", meaning: "Three constant scenario rates.", effect: "Shifts base and widens/narrows range.", impact: "High" }
    ]
  },
  {
    group: "Model Inputs",
    items: [
      { name: "S2F exponent", meaning: "Scarcity sensitivity.", effect: "Higher value steepens S2F curve.", impact: "High" },
      { name: "S2F decay", meaning: "Dampens S2F over time.", effect: "Higher value flattens S2F.", impact: "Medium" },
      { name: "Power-law exponent", meaning: "Trend steepness control.", effect: "Higher value increases long-run slope.", impact: "High" },
      { name: "MC drift / volatility", meaning: "Expected return and randomness.", effect: "Drift shifts center; volatility widens band.", impact: "High" },
      { name: "MC simulations", meaning: "Number of random paths.", effect: "Higher count stabilizes percentile estimates.", impact: "Medium" },
      { name: "Halving base/amplitude/decay", meaning: "Cycle trend, wave size, fade rate.", effect: "Controls cycle level, swing, and fade.", impact: "High" }
    ]
  },
  {
    group: "Display",
    items: [
      { name: "Value view", meaning: "Nominal, real, or both.", effect: "Display only, no math change.", impact: "Low" },
      { name: "Y-axis scale", meaning: "Linear vs log scale.", effect: "Readability only, no math change.", impact: "Low" },
      { name: "Visible models", meaning: "Show/hide series.", effect: "Declutters chart.", impact: "Low" }
    ]
  }
];

export function ProjectionDashboard() {
  const [btcOwned, setBtcOwned] = useState(1);
  const [priceMode, setPriceMode] = useState<PriceMode>("manual");
  const [manualPrice, setManualPrice] = useState(100000);
  const [autoPrice, setAutoPrice] = useState<number | null>(null);
  const [autoPriceStatus, setAutoPriceStatus] = useState<"idle" | "loading" | "error">("idle");

  const [fixedAnnualGrowthPct, setFixedAnnualGrowthPct] = useState(14);
  const [cagrBearPct, setCagrBearPct] = useState(5);
  const [cagrBasePct, setCagrBasePct] = useState(12);
  const [cagrBullPct, setCagrBullPct] = useState(22);
  const [inflationPct, setInflationPct] = useState(2.5);

  const [s2fExponent, setS2fExponent] = useState(2.2);
  const [s2fCurrentRatio, setS2fCurrentRatio] = useState(55);
  const [s2fDecayPct, setS2fDecayPct] = useState(6);

  const [powerLawExponent, setPowerLawExponent] = useState(4.2);
  const [btcAgeYears, setBtcAgeYears] = useState(16);

  const [monteCarloDriftPct, setMonteCarloDriftPct] = useState(15);
  const [monteCarloVolPct, setMonteCarloVolPct] = useState(45);
  const [monteCarloSims, setMonteCarloSims] = useState(400);

  const [halvingBaseGrowthPct, setHalvingBaseGrowthPct] = useState(18);
  const [halvingAmplitudePct, setHalvingAmplitudePct] = useState(30);
  const [halvingDecayPct, setHalvingDecayPct] = useState(20);

  const [valueView, setValueView] = useState<ValueView>("both");
  const [yScale, setYScale] = useState<YScale>("log");
  const [activeInputTab, setActiveInputTab] = useState<InputTab>("core");
  const [academyTab, setAcademyTab] = useState<AcademyTab>("models");
  const [academyLevel, setAcademyLevel] = useState<AcademyLevel>("beginner");
  const [focusedModel, setFocusedModel] = useState<FocusModel | null>(null);
  const [academyCollapsed, setAcademyCollapsed] = useState(true);
  const [theme, setTheme] = useState<ThemeName>("bitcoin");
  const [modelVisibility, setModelVisibility] = useState<ModelVisibility>({
    fixed: true,
    cagr: true,
    s2f: true,
    powerLaw: true,
    monteCarlo: true,
    halving: true
  });

  const startPriceUsd = priceMode === "manual" ? manualPrice : autoPrice ?? manualPrice;

  const points = useMemo(
    () =>
      buildProjection({
        btcOwned,
        startPriceUsd,
        years: 50,
        fixedAnnualGrowthPct,
        cagrBearPct,
        cagrBasePct,
        cagrBullPct,
        inflationPct,
        s2fExponent,
        s2fCurrentRatio,
        s2fDecayPct,
        powerLawExponent,
        btcAgeYears,
        monteCarloDriftPct,
        monteCarloVolPct,
        monteCarloSims,
        halvingBaseGrowthPct,
        halvingAmplitudePct,
        halvingDecayPct
      }),
    [
      btcOwned,
      startPriceUsd,
      fixedAnnualGrowthPct,
      cagrBearPct,
      cagrBasePct,
      cagrBullPct,
      inflationPct,
      s2fExponent,
      s2fCurrentRatio,
      s2fDecayPct,
      powerLawExponent,
      btcAgeYears,
      monteCarloDriftPct,
      monteCarloVolPct,
      monteCarloSims,
      halvingBaseGrowthPct,
      halvingAmplitudePct,
      halvingDecayPct
    ]
  );

  const latest = points[points.length - 1];

  const fetchAutoPrice = useCallback(async () => {
    setAutoPriceStatus("loading");
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch BTC price");
      }

      const data = (await response.json()) as { bitcoin?: { usd?: number } };
      const fetchedPrice = data.bitcoin?.usd;

      if (!fetchedPrice || Number.isNaN(fetchedPrice)) {
        throw new Error("No BTC price found");
      }

      setAutoPrice(fetchedPrice);
      setManualPrice(fetchedPrice);
      setAutoPriceStatus("idle");
    } catch {
      setAutoPriceStatus("error");
    }
  }, []);

  const milestoneRows = MILESTONES.map((year) => {
    const point = points[year];
    return {
      year,
      fixedNominal: point.fixedNominal,
      fixedReal: point.fixedReal,
      cagrRangeNominal: `${formatUsd(point.cagrLowNominal)} - ${formatUsd(point.cagrHighNominal)}`,
      cagrRangeReal: `${formatUsd(point.cagrLowReal)} - ${formatUsd(point.cagrHighReal)}`,
      s2fNominal: point.s2fNominal,
      s2fReal: point.s2fReal,
      powerLawNominal: point.powerLawNominal,
      powerLawReal: point.powerLawReal,
      halvingNominal: point.halvingNominal,
      halvingReal: point.halvingReal,
      mcRangeNominal: `${formatUsd(point.mcP10Nominal)} - ${formatUsd(point.mcP90Nominal)}`,
      mcRangeReal: `${formatUsd(point.mcP10Real)} - ${formatUsd(point.mcP90Real)}`,
      mcP50Nominal: point.mcP50Nominal,
      mcP50Real: point.mcP50Real
    };
  });

  const focusTones = focusedModel
    ? {
        fixed: ["fixedNominal", "fixedReal"],
        cagr: ["cagrNominal", "cagrReal", "bandCagrNominal", "bandCagrReal"],
        s2f: ["s2fNominal", "s2fReal"],
        powerLaw: ["powerNominal", "powerReal"],
        monteCarlo: ["mcMedianNominal", "mcMedianReal", "bandMcNominal", "bandMcReal"],
        halving: ["halvingNominal", "halvingReal"]
      }[focusedModel]
    : undefined;

  return (
    <main className={`page-shell theme-${theme}`}>
      <div className="bg-glow bg-glow-a" />
      <div className="bg-glow bg-glow-b" />

      <section className="panel hero-panel">
        <p className="kicker">BTC FIRE CALCULATOR</p>
        <h1>Bitcoin Wealth Projection Studio</h1>
        <p className="subtitle">
          Compare fixed growth, CAGR scenarios, stock-to-flow style curve, power-law trend,
          Monte Carlo simulation, and halving-cycle behavior over the next 50 years.
        </p>
      </section>

      <section className="grid-two">
        <div className="panel">
          <h2>Inputs</h2>
          <div className="input-tabs" role="tablist" aria-label="Input sections">
            <button
              type="button"
              className={`input-tab ${activeInputTab === "core" ? "active" : ""}`}
              onClick={() => setActiveInputTab("core")}
            >
              Core
            </button>
            <button
              type="button"
              className={`input-tab ${activeInputTab === "scenarios" ? "active" : ""}`}
              onClick={() => setActiveInputTab("scenarios")}
            >
              Scenarios
            </button>
            <button
              type="button"
              className={`input-tab ${activeInputTab === "models" ? "active" : ""}`}
              onClick={() => setActiveInputTab("models")}
            >
              Models
            </button>
            <button
              type="button"
              className={`input-tab ${activeInputTab === "display" ? "active" : ""}`}
              onClick={() => setActiveInputTab("display")}
            >
              Display
            </button>
          </div>

          <div className="control-grid">
            {activeInputTab === "core" && (
              <>
                <label>
                  BTC owned
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={btcOwned}
                    onChange={(e) => setBtcOwned(clamp(safeNumber(e.target.value, btcOwned), 0, 1000000))}
                  />
                </label>

                <fieldset>
                  <legend>Start price mode</legend>
                  <div className="radio-row">
                    <label>
                      <input
                        type="radio"
                        checked={priceMode === "auto"}
                        onChange={() => setPriceMode("auto")}
                      />
                      Auto fetch
                    </label>
                    <label>
                      <input
                        type="radio"
                        checked={priceMode === "manual"}
                        onChange={() => setPriceMode("manual")}
                      />
                      Manual
                    </label>
                  </div>
                </fieldset>

                <label>
                  Manual BTC price (USD)
                  <input
                    type="number"
                    min={1000}
                    step="100"
                    value={manualPrice}
                    onChange={(e) =>
                      setManualPrice(clamp(safeNumber(e.target.value, manualPrice), 1000, 1000000000))
                    }
                    disabled={priceMode === "auto"}
                  />
                </label>

                <div className="inline-action">
                  <button type="button" onClick={fetchAutoPrice}>
                    Fetch live BTC price
                  </button>
                  <span>
                    {priceMode === "auto" && !autoPrice && autoPriceStatus === "idle" && "Click to fetch."}
                    {autoPriceStatus === "loading" && "Loading..."}
                    {autoPriceStatus === "error" && "Fetch failed. Try again."}
                    {autoPrice && autoPriceStatus === "idle" && `Latest: ${formatUsd(autoPrice)}`}
                  </span>
                </div>

                <label>
                  Inflation (%)
                  <input
                    type="number"
                    min={-5}
                    max={20}
                    step="0.1"
                    value={inflationPct}
                    onChange={(e) =>
                      setInflationPct(clamp(safeNumber(e.target.value, inflationPct), -5, 20))
                    }
                  />
                </label>
              </>
            )}

            {activeInputTab === "scenarios" && (
              <>
                <label>
                  Fixed annual growth (%)
                  <input
                    type="number"
                    min={-80}
                    max={200}
                    step="0.5"
                    value={fixedAnnualGrowthPct}
                    onChange={(e) =>
                      setFixedAnnualGrowthPct(
                        clamp(safeNumber(e.target.value, fixedAnnualGrowthPct), -80, 200)
                      )
                    }
                  />
                </label>

                <label>
                  CAGR bear (%)
                  <input
                    type="number"
                    min={-50}
                    max={100}
                    step="0.5"
                    value={cagrBearPct}
                    onChange={(e) =>
                      setCagrBearPct(clamp(safeNumber(e.target.value, cagrBearPct), -50, 100))
                    }
                  />
                </label>

                <label>
                  CAGR base (%)
                  <input
                    type="number"
                    min={-50}
                    max={100}
                    step="0.5"
                    value={cagrBasePct}
                    onChange={(e) =>
                      setCagrBasePct(clamp(safeNumber(e.target.value, cagrBasePct), -50, 100))
                    }
                  />
                </label>

                <label>
                  CAGR bull (%)
                  <input
                    type="number"
                    min={-50}
                    max={100}
                    step="0.5"
                    value={cagrBullPct}
                    onChange={(e) =>
                      setCagrBullPct(clamp(safeNumber(e.target.value, cagrBullPct), -50, 100))
                    }
                  />
                </label>
              </>
            )}

            {activeInputTab === "models" && (
              <>
                <fieldset>
                  <legend>Stock-to-flow style</legend>
                  <label>
                    S2F exponent
                    <input
                      type="number"
                      min={0}
                      max={6}
                      step="0.1"
                      value={s2fExponent}
                      onChange={(e) =>
                        setS2fExponent(clamp(safeNumber(e.target.value, s2fExponent), 0, 6))
                      }
                    />
                  </label>
                  <label>
                    Current stock-to-flow ratio
                    <input
                      type="number"
                      min={1}
                      max={300}
                      step="1"
                      value={s2fCurrentRatio}
                      onChange={(e) =>
                        setS2fCurrentRatio(clamp(safeNumber(e.target.value, s2fCurrentRatio), 1, 300))
                      }
                    />
                  </label>
                  <label>
                    S2F decay (%)
                    <input
                      type="number"
                      min={0}
                      max={20}
                      step="0.1"
                      value={s2fDecayPct}
                      onChange={(e) =>
                        setS2fDecayPct(clamp(safeNumber(e.target.value, s2fDecayPct), 0, 20))
                      }
                    />
                  </label>
                </fieldset>

                <fieldset>
                  <legend>Power-law trend</legend>
                  <label>
                    Power-law exponent
                    <input
                      type="number"
                      min={0}
                      max={8}
                      step="0.1"
                      value={powerLawExponent}
                      onChange={(e) =>
                        setPowerLawExponent(
                          clamp(safeNumber(e.target.value, powerLawExponent), 0, 8)
                        )
                      }
                    />
                  </label>
                  <label>
                    BTC age baseline (years)
                    <input
                      type="number"
                      min={1}
                      max={50}
                      step="1"
                      value={btcAgeYears}
                      onChange={(e) =>
                        setBtcAgeYears(clamp(safeNumber(e.target.value, btcAgeYears), 1, 50))
                      }
                    />
                  </label>
                </fieldset>

                <fieldset>
                  <legend>Monte Carlo</legend>
                  <label>
                    Drift (%)
                    <input
                      type="number"
                      min={-40}
                      max={80}
                      step="0.5"
                      value={monteCarloDriftPct}
                      onChange={(e) =>
                        setMonteCarloDriftPct(
                          clamp(safeNumber(e.target.value, monteCarloDriftPct), -40, 80)
                        )
                      }
                    />
                  </label>
                  <label>
                    Volatility (%)
                    <input
                      type="number"
                      min={1}
                      max={250}
                      step="1"
                      value={monteCarloVolPct}
                      onChange={(e) =>
                        setMonteCarloVolPct(
                          clamp(safeNumber(e.target.value, monteCarloVolPct), 1, 250)
                        )
                      }
                    />
                  </label>
                  <label>
                    Simulations
                    <input
                      type="number"
                      min={50}
                      max={5000}
                      step="50"
                      value={monteCarloSims}
                      onChange={(e) =>
                        setMonteCarloSims(clamp(safeNumber(e.target.value, monteCarloSims), 50, 5000))
                      }
                    />
                  </label>
                </fieldset>

                <fieldset>
                  <legend>Halving-cycle model</legend>
                  <label>
                    Base growth (%)
                    <input
                      type="number"
                      min={-20}
                      max={120}
                      step="0.5"
                      value={halvingBaseGrowthPct}
                      onChange={(e) =>
                        setHalvingBaseGrowthPct(
                          clamp(safeNumber(e.target.value, halvingBaseGrowthPct), -20, 120)
                        )
                      }
                    />
                  </label>
                  <label>
                    Cycle amplitude (%)
                    <input
                      type="number"
                      min={0}
                      max={120}
                      step="0.5"
                      value={halvingAmplitudePct}
                      onChange={(e) =>
                        setHalvingAmplitudePct(
                          clamp(safeNumber(e.target.value, halvingAmplitudePct), 0, 120)
                        )
                      }
                    />
                  </label>
                  <label>
                    Halving decay (%)
                    <input
                      type="number"
                      min={0}
                      max={60}
                      step="0.5"
                      value={halvingDecayPct}
                      onChange={(e) =>
                        setHalvingDecayPct(
                          clamp(safeNumber(e.target.value, halvingDecayPct), 0, 60)
                        )
                      }
                    />
                  </label>
                </fieldset>
              </>
            )}

            {activeInputTab === "display" && (
              <>
                <fieldset>
                  <legend>Theme</legend>
                  <div className="radio-row">
                    <label>
                      <input
                        type="radio"
                        checked={theme === "neon"}
                        onChange={() => setTheme("neon")}
                      />
                      Neon
                    </label>
                    <label>
                      <input
                        type="radio"
                        checked={theme === "tron"}
                        onChange={() => setTheme("tron")}
                      />
                      Tron
                    </label>
                    <label>
                      <input
                        type="radio"
                        checked={theme === "bitcoin"}
                        onChange={() => setTheme("bitcoin")}
                      />
                      Bitcoin
                    </label>
                  </div>
                </fieldset>

                <fieldset>
                  <legend>Value view</legend>
                  <div className="radio-row">
                    <label>
                      <input
                        type="radio"
                        checked={valueView === "both"}
                        onChange={() => setValueView("both")}
                      />
                      Both
                    </label>
                    <label>
                      <input
                        type="radio"
                        checked={valueView === "nominal"}
                        onChange={() => setValueView("nominal")}
                      />
                      Nominal
                    </label>
                    <label>
                      <input
                        type="radio"
                        checked={valueView === "real"}
                        onChange={() => setValueView("real")}
                      />
                      Inflation-adjusted
                    </label>
                  </div>
                </fieldset>

                <fieldset>
                  <legend>Y-axis scale</legend>
                  <div className="radio-row">
                    <label>
                      <input
                        type="radio"
                        checked={yScale === "log"}
                        onChange={() => setYScale("log")}
                      />
                      Log (recommended)
                    </label>
                    <label>
                      <input
                        type="radio"
                        checked={yScale === "linear"}
                        onChange={() => setYScale("linear")}
                      />
                      Linear
                    </label>
                  </div>
                </fieldset>

                <fieldset>
                  <legend>Visible models</legend>
                  <div className="checkbox-grid">
                    <label>
                      <input
                        type="checkbox"
                        checked={modelVisibility.fixed}
                        onChange={(e) =>
                          setModelVisibility((prev) => ({ ...prev, fixed: e.target.checked }))
                        }
                      />
                      Fixed annual
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={modelVisibility.cagr}
                        onChange={(e) =>
                          setModelVisibility((prev) => ({ ...prev, cagr: e.target.checked }))
                        }
                      />
                      CAGR
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={modelVisibility.s2f}
                        onChange={(e) =>
                          setModelVisibility((prev) => ({ ...prev, s2f: e.target.checked }))
                        }
                      />
                      S2F style
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={modelVisibility.powerLaw}
                        onChange={(e) =>
                          setModelVisibility((prev) => ({ ...prev, powerLaw: e.target.checked }))
                        }
                      />
                      Power-law
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={modelVisibility.monteCarlo}
                        onChange={(e) =>
                          setModelVisibility((prev) => ({ ...prev, monteCarlo: e.target.checked }))
                        }
                      />
                      Monte Carlo
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={modelVisibility.halving}
                        onChange={(e) =>
                          setModelVisibility((prev) => ({ ...prev, halving: e.target.checked }))
                        }
                      />
                      Halving-cycle
                    </label>
                  </div>
                </fieldset>
              </>
            )}
          </div>
        </div>

        <div className="panel">
          <h2>50-Year Snapshot</h2>
          <div className="stat-grid">
            <article>
              <p>Starting value</p>
              <h3>{formatUsd(points[0].fixedNominal)}</h3>
            </article>
            <article>
              <p>Fixed model (year 50)</p>
              <h3>{formatUsd(valueView === "real" ? latest.fixedReal : latest.fixedNominal)}</h3>
            </article>
            <article>
              <p>CAGR base (year 50)</p>
              <h3>
                {formatUsd(valueView === "real" ? latest.cagrBaseReal : latest.cagrBaseNominal)}
              </h3>
            </article>
            <article>
              <p>S2F style (year 50)</p>
              <h3>{formatUsd(valueView === "real" ? latest.s2fReal : latest.s2fNominal)}</h3>
            </article>
            <article>
              <p>Power-law (year 50)</p>
              <h3>{formatUsd(valueView === "real" ? latest.powerLawReal : latest.powerLawNominal)}</h3>
            </article>
            <article>
              <p>Halving-cycle (year 50)</p>
              <h3>{formatUsd(valueView === "real" ? latest.halvingReal : latest.halvingNominal)}</h3>
            </article>
            <article>
              <p>Monte Carlo median (year 50)</p>
              <h3>{formatUsd(valueView === "real" ? latest.mcP50Real : latest.mcP50Nominal)}</h3>
            </article>
            <article>
              <p>Monte Carlo p10-p90 (year 50)</p>
              <h3>
                {valueView === "real"
                  ? `${formatUsd(latest.mcP10Real)} - ${formatUsd(latest.mcP90Real)}`
                  : `${formatUsd(latest.mcP10Nominal)} - ${formatUsd(latest.mcP90Nominal)}`}
              </h3>
            </article>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="academy-head">
          <div className="academy-title-row">
            <h2>Model Academy</h2>
            <button
              type="button"
              className="academy-toggle"
              onClick={() => setAcademyCollapsed((prev) => !prev)}
            >
              {academyCollapsed ? "Expand" : "Collapse"}
            </button>
          </div>
          <div className={`academy-controls ${academyCollapsed ? "collapsed" : ""}`}>
            <div className="academy-tab-group" role="tablist" aria-label="Academy tabs">
              <button
                type="button"
                className={`input-tab ${academyTab === "models" ? "active" : ""}`}
                onClick={() => setAcademyTab("models")}
              >
                Models
              </button>
              <button
                type="button"
                className={`input-tab ${academyTab === "inputs" ? "active" : ""}`}
                onClick={() => setAcademyTab("inputs")}
              >
                Inputs
              </button>
            </div>
            <div className="academy-level-group">
              <button
                type="button"
                className={`input-tab ${academyLevel === "beginner" ? "active" : ""}`}
                onClick={() => setAcademyLevel("beginner")}
              >
                Beginner
              </button>
              <button
                type="button"
                className={`input-tab ${academyLevel === "advanced" ? "active" : ""}`}
                onClick={() => setAcademyLevel("advanced")}
              >
                Advanced
              </button>
            </div>
          </div>
        </div>

        {!academyCollapsed && academyTab === "models" && (
          <div className="academy-model-grid">
            {MODEL_ACADEMY.map((model) => (
              <button
                key={model.key}
                type="button"
                className={`academy-model-card ${focusedModel === model.key ? "active" : ""}`}
                onClick={() =>
                  setFocusedModel((prev) => (prev === model.key ? null : model.key))
                }
              >
                <div className="academy-model-top">
                  <h3>{model.title}</h3>
                  <span className="academy-kind">{model.kind}</span>
                </div>
                <p>{academyLevel === "beginner" ? model.beginner : model.advanced}</p>
                <span className="academy-hint">
                  {focusedModel === model.key ? "Highlighted in chart" : "Tap to highlight in chart"}
                </span>
              </button>
            ))}
          </div>
        )}

        {!academyCollapsed && academyTab === "inputs" && (
          <div className="academy-input-grid">
            {INPUT_ACADEMY.map((group) => (
              <article key={group.group} className="academy-input-group">
                <h3>{group.group}</h3>
                <div className="academy-input-list">
                  {group.items.map((item) => (
                    <div key={item.name} className="academy-input-item">
                      <p className="academy-input-title">{item.name}</p>
                      <p>{item.meaning}</p>
                      <p>{item.effect}</p>
                      <span className={`academy-impact impact-${item.impact.toLowerCase()}`}>
                        {item.impact} impact
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Projection Chart</h2>
        <div className="chart-wrap">
          <ProjectionChart
            points={points}
            valueView={valueView}
            yScale={yScale}
            modelVisibility={modelVisibility}
            highlightTones={focusTones}
          />
        </div>
      </section>

      <section className="panel">
        <h2>Milestones</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Fixed Nominal</th>
                <th>Fixed Real</th>
                <th>CAGR Range Nominal</th>
                <th>CAGR Range Real</th>
                <th>S2F Nominal</th>
                <th>S2F Real</th>
                <th>Power-law Nominal</th>
                <th>Power-law Real</th>
                <th>Halving Nominal</th>
                <th>Halving Real</th>
                <th>MC P50 Nominal</th>
                <th>MC P50 Real</th>
                <th>MC Range Nominal</th>
                <th>MC Range Real</th>
              </tr>
            </thead>
            <tbody>
              {milestoneRows.map((row) => (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td>{formatUsd(row.fixedNominal)}</td>
                  <td>{formatUsd(row.fixedReal)}</td>
                  <td>{row.cagrRangeNominal}</td>
                  <td>{row.cagrRangeReal}</td>
                  <td>{formatUsd(row.s2fNominal)}</td>
                  <td>{formatUsd(row.s2fReal)}</td>
                  <td>{formatUsd(row.powerLawNominal)}</td>
                  <td>{formatUsd(row.powerLawReal)}</td>
                  <td>{formatUsd(row.halvingNominal)}</td>
                  <td>{formatUsd(row.halvingReal)}</td>
                  <td>{formatUsd(row.mcP50Nominal)}</td>
                  <td>{formatUsd(row.mcP50Real)}</td>
                  <td>{row.mcRangeNominal}</td>
                  <td>{row.mcRangeReal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel disclaimer">
        <h2>Disclaimer</h2>
        <p>
          This tool provides hypothetical projections based on user inputs and simplified models.
          It is not financial advice, and real-world BTC performance can vary significantly.
        </p>
      </section>
    </main>
  );
}
