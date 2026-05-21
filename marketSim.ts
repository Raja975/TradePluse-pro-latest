import { TickerSymbol, LiveTick, TechnicalIndicators, TradingSignal, SignalType, RuleValidation } from '../types';

// Baseline parameters for premium Indian Indices
export const BASE_PRICES: Record<TickerSymbol, { price: number; step: number; atr: number; optionGap: number; isIndex: boolean }> = {
  'NIFTY 50': { price: 22420.5, step: 2.5, atr: 90.0, optionGap: 50, isIndex: true },
  'BANK NIFTY': { price: 47950.2, step: 8.5, atr: 260.0, optionGap: 100, isIndex: true },
  'SENSEX': { price: 73850.8, step: 18.0, atr: 410.0, optionGap: 100, isIndex: true },
  'FINNIFTY': { price: 21120.4, step: 3.2, atr: 105.0, optionGap: 50, isIndex: true },
  'MIDCPNIFTY': { price: 10840.6, step: 1.8, atr: 60.0, optionGap: 25, isIndex: true },
};

// Global VIX representing current market volatility index value
export let currentVixValue = 13.8; // Ideal default (between 12 and 18)

export function updateVixValue(newVix: number) {
  currentVixValue = Math.round(newVix * 100) / 100;
}

// Generate base indicators for a ticker on initial load
export function createInitialTick(symbol: TickerSymbol): LiveTick {
  const meta = BASE_PRICES[symbol];
  const price = meta.price;
  
  // Starting values
  const rsi = 45 + Math.random() * 20; // 45 to 65 neutral zone
  const atr = meta.atr * (0.9 + Math.random() * 0.2); // slight variance
  const ema20 = price * (1 + (Math.random() - 0.48) * 0.003);
  const ema50 = price * (1 + (Math.random() - 0.51) * 0.005);
  const vwap = (price + ema20) / 2;

  const supertrendDirection = Math.random() > 0.5 ? 'BUY' : 'SELL';
  const supertrendValue = supertrendDirection === 'BUY' 
    ? price - (atr * 2.5) 
    : price + (atr * 2.5);

  const pcr = 0.65 + Math.random() * 0.8; // around 1.0

  const indicators: TechnicalIndicators = {
    vwap: Math.round(vwap * 100) / 100,
    rsi: Math.round(rsi * 10) / 10,
    ema20: Math.round(ema20 * 100) / 100,
    ema50: Math.round(ema50 * 100) / 100,
    supertrendValue: Math.round(supertrendValue * 100) / 100,
    supertrendDirection,
    atr: Math.round(atr * 100) / 100,
    pcr: Math.round(pcr * 100) / 100,
    vix: currentVixValue,
    ema9: Math.round(ema20 * 0.999 * 100) / 100,   // Fallback support for any older prompt structures
    ema21: Math.round(ema50 * 0.998 * 100) / 100,
    macdText: Math.random() > 0.5 ? 'Bullish Crossover' : 'Neutral Stable',
  };

  return {
    symbol,
    price,
    prevPrice: price,
    change: 0,
    changePercent: 0,
    volume: Math.floor(1200000 + Math.random() * 800000),
    indicators,
    timestamp: new Date().toLocaleTimeString(),
  };
}

// Tick Simulator: Update indicators with exact rules
export function simulateNextTick(currentTick: LiveTick): LiveTick {
  const meta = BASE_PRICES[currentTick.symbol];
  const volatility = 0.00065; // volatility level
  const bias = (Math.random() - 0.492) * 2; // subtle upward bias for index
  const priceChange = currentTick.price * volatility * bias;
  
  const rawNextPrice = currentTick.price + priceChange;
  const nextPrice = Math.round(rawNextPrice * 100) / 100;
  
  const initialBase = BASE_PRICES[currentTick.symbol].price;
  const change = Math.round((nextPrice - initialBase) * 100) / 100;
  const changePercent = Math.round((change / initialBase) * 10000) / 100;

  // 1. RSI update with slight momentum bias in price direction
  let rsiDelta = (Math.random() - 0.5) * 1.8;
  if (priceChange > 0) rsiDelta += Math.random() * 1.2;
  else rsiDelta -= Math.random() * 1.2;
  let nextRsi = currentTick.indicators.rsi + rsiDelta;
  nextRsi = Math.max(5, Math.min(95, nextRsi));

  // 2. EMAs smoothing logic
  const alpha20 = 2 / (20 + 1);
  const alpha50 = 2 / (50 + 1);
  const nextEma20 = nextPrice * alpha20 + currentTick.indicators.ema20 * (1 - alpha20);
  const nextEma50 = nextPrice * alpha50 + currentTick.indicators.ema50 * (1 - alpha50);

  // 3. VWAP simulation
  const nextVwap = (currentTick.indicators.vwap * 11 + nextPrice) / 12;

  // 4. ATR update
  let nextAtr = currentTick.indicators.atr + (Math.random() - 0.5) * (meta.atr * 0.03);
  nextAtr = Math.max(meta.atr * 0.5, Math.min(meta.atr * 1.8, nextAtr));

  // 5. Supertrend direction flip or price trail
  const multiplier = 3;
  let nextSupertrendDir = currentTick.indicators.supertrendDirection;
  let nextSupertrendValue = currentTick.indicators.supertrendValue;

  if (nextSupertrendDir === 'BUY') {
    if (nextPrice < currentTick.indicators.supertrendValue) {
      nextSupertrendDir = 'SELL';
      nextSupertrendValue = nextPrice + (nextAtr * multiplier);
    } else {
      const newSupport = nextPrice - (nextAtr * multiplier);
      nextSupertrendValue = Math.max(currentTick.indicators.supertrendValue, newSupport);
    }
  } else {
    if (nextPrice > currentTick.indicators.supertrendValue) {
      nextSupertrendDir = 'BUY';
      nextSupertrendValue = nextPrice - (nextAtr * multiplier);
    } else {
      const newResistance = nextPrice + (nextAtr * multiplier);
      nextSupertrendValue = Math.min(currentTick.indicators.supertrendValue, newResistance);
    }
  }

  // 6. Put-Call Ratio (PCR) update
  const pcrDelta = (Math.random() - 0.5) * 0.03 + (priceChange > 0 ? 0.012 : -0.012);
  let nextPcr = currentTick.indicators.pcr + pcrDelta;
  nextPcr = Math.max(0.40, Math.min(1.85, nextPcr));

  const indicators: TechnicalIndicators = {
    vwap: Math.round(nextVwap * 100) / 100,
    rsi: Math.round(nextRsi * 10) / 10,
    ema20: Math.round(nextEma20 * 100) / 100,
    ema50: Math.round(nextEma50 * 100) / 100,
    supertrendValue: Math.round(nextSupertrendValue * 100) / 100,
    supertrendDirection: nextSupertrendDir,
    atr: Math.round(nextAtr * 100) / 100,
    pcr: Math.round(nextPcr * 100) / 100,
    vix: currentVixValue,
    ema9: Math.round(nextEma20 * 0.999 * 100) / 100,
    ema21: Math.round(nextEma50 * 0.998 * 100) / 100,
    macdText: nextRsi > 60 ? 'Bullish Crossover' : nextRsi < 40 ? 'Bearish Crossover' : 'Neutral Stable',
  };

  return {
    symbol: currentTick.symbol,
    price: nextPrice,
    prevPrice: currentTick.price,
    change,
    changePercent,
    volume: currentTick.volume + Math.floor(Math.random() * 8000 + 1000),
    indicators,
    timestamp: new Date().toLocaleTimeString(),
  };
}

// Generate signal and compute target checklist based strictly on user parameters
export function generateTechnicalSignal(tick: LiveTick): TradingSignal {
  const { symbol, price, indicators } = tick;
  const { vwap, rsi, ema20, ema50, supertrendDirection, atr, pcr, vix } = indicators;
  const meta = BASE_PRICES[symbol];

  const ruleStatus: RuleValidation[] = [
    {
      id: 'vwap',
      name: 'VWAP Institutional Filter',
      description: 'CALL: Price > VWAP | PUT: Price < VWAP',
      isPassed: false,
      actualValue: `Price: ${price.toFixed(1)} vs VWAP: ${vwap.toFixed(1)}`,
      expectedValue: '',
    },
    {
      id: 'rsi',
      name: 'RSI Momentum Trigger',
      description: 'CALL: RSI > 60 | PUT: RSI < 40 (Sideways Trapped inside 40-60)',
      isPassed: false,
      actualValue: `RSI: ${rsi.toFixed(1)}`,
      expectedValue: '',
    },
    {
      id: 'ema',
      name: 'Dual EMA Crossover',
      description: 'CALL: 20 EMA > 50 EMA | PUT: 20 EMA < 50 EMA',
      isPassed: false,
      actualValue: `20 EMA: ${ema20.toFixed(1)} / 50 EMA: ${ema50.toFixed(1)}`,
      expectedValue: '',
    },
    {
      id: 'supertrend',
      name: 'Supertrend Directional Band',
      description: 'CALL: Supertrend BUY (Green Line below) | PUT: Supertrend SELL (Red Line above)',
      isPassed: false,
      actualValue: `Supertrend: ${supertrendDirection}`,
      expectedValue: '',
    },
    {
      id: 'atr',
      name: 'ATR Live Threshold',
      description: 'Ensuring index has adequate baseline trend range',
      isPassed: atr > (meta.atr * 0.65),
      actualValue: `ATR(14): ${atr.toFixed(1)}`,
      expectedValue: `Sufficient Range (> ${(meta.atr * 0.65).toFixed(1)})`,
    },
    {
      id: 'vix',
      name: 'India VIX Sizing Alerts',
      description: 'VIX 12-18 Ideal. Below 11: Scalp. Above 20: Extreme danger (reduce slot size 50%)',
      isPassed: true,
      actualValue: `VIX: ${vix.toFixed(2)}`,
      expectedValue: 'Dynamic positioning guidance',
    },
    {
      id: 'pcr',
      name: 'Put-Call Ratio (PCR)',
      description: 'CALL: PCR > 1.1 OR PCR < 0.6 (Short bounce) | PUT: PCR < 0.7 OR PCR > 1.45',
      isPassed: false,
      actualValue: `PCR: ${pcr.toFixed(2)}`,
      expectedValue: '',
    },
  ];

  // Indicator booleans
  const isVwapCall = price > vwap;
  const isVwapPut = price < vwap;

  const isRsiCall = rsi > 60;
  const isRsiPut = rsi < 40;

  const isEmaCall = ema20 > ema50;
  const isEmaPut = ema20 < ema50;

  const isSupertrendCall = supertrendDirection === 'BUY';
  const isSupertrendPut = supertrendDirection === 'SELL';

  const isPcrCall = pcr > 1.1 || pcr < 0.6;
  const isPcrPut = pcr < 0.7 || pcr > 1.45;

  let callScore = 0;
  let putScore = 0;

  // Rule 1: VWAP
  if (isVwapCall) {
    callScore += 15;
    ruleStatus[0].expectedValue = 'CALL: Price above VWAP line (Close > VWAP)';
    ruleStatus[0].isPassed = true;
  } else {
    putScore += 15;
    ruleStatus[0].expectedValue = 'PUT: Price below VWAP line (Close < VWAP)';
    ruleStatus[0].isPassed = true;
  }

  // Rule 2: RSI
  if (isRsiCall) {
    callScore += 20;
    ruleStatus[1].expectedValue = 'CALL: RSI holds securely above 60 momentum band';
    ruleStatus[1].isPassed = true;
  } else if (isRsiPut) {
    putScore += 20;
    ruleStatus[1].expectedValue = 'PUT: RSI holds securely below 40 momentum band';
    ruleStatus[1].isPassed = true;
  } else {
    ruleStatus[1].expectedValue = 'RSI is trapped in 40-60 sideways decay zone. High premium decay danger!';
    ruleStatus[1].isPassed = false;
  }

  // Rule 3: EMA crossover
  if (isEmaCall) {
    callScore += 15;
    ruleStatus[2].expectedValue = 'CALL: Fast 20 EMA holds above Slow 50 EMA';
    ruleStatus[2].isPassed = true;
  } else if (isEmaPut) {
    putScore += 15;
    ruleStatus[2].expectedValue = 'PUT: Fast 20 EMA drops below Slow 50 EMA';
    ruleStatus[2].isPassed = true;
  }

  // Rule 4: Supertrend
  if (isSupertrendCall) {
    callScore += 15;
    ruleStatus[3].expectedValue = 'CALL: Supertrend Green (BUY line below price)';
    ruleStatus[3].isPassed = true;
  } else if (isSupertrendPut) {
    putScore += 15;
    ruleStatus[3].expectedValue = 'PUT: Supertrend Red (SELL line above price)';
    ruleStatus[3].isPassed = true;
  }

  // Rule 7: PCR sentiment
  if (isPcrCall) {
    callScore += 15;
    ruleStatus[6].expectedValue = 'CALL Align: PCR is strongly bullish (>1.1) or oversold oversell (<0.6)';
    ruleStatus[6].isPassed = true;
  } else if (isPcrPut) {
    putScore += 15;
    ruleStatus[6].expectedValue = 'PUT Align: PCR is strongly bearish (<0.7) or overbought (>1.45)';
    ruleStatus[6].isPassed = true;
  } else {
    ruleStatus[6].expectedValue = 'Sideways/Ambiguous Put-Call Ratio range';
    ruleStatus[6].isPassed = false;
  }

  // Dynamic Signal generation thresholds (Requires VWAP, RSI, EMA, and ST to trigger)
  let type: SignalType = 'HOLD (WAIT)';
  let strength = 0;

  if (isVwapCall && isRsiCall && isEmaCall && isSupertrendCall) {
    type = 'CALL (CE)';
    strength = Math.min(100, callScore + 20);
  } else if (isVwapPut && isRsiPut && isEmaPut && isSupertrendPut) {
    type = 'PUT (PE)';
    strength = Math.min(100, putScore + 20);
  }

  // Safe Levels calculations
  // Stop Loss: Initial spot SL is exactly 1.5 * ATR value
  // Conservative Target 1 is exactly 2.0 * ATR value away from entering spot
  // Aggressive Target 2 is exactly 3.5 * ATR value away from entering spot
  let target1 = price;
  let target2 = price;
  let stopLoss = price;

  if (type === 'CALL (CE)') {
    stopLoss = price - (1.5 * atr);
    target1 = price + (2.0 * atr);
    target2 = price + (3.5 * atr);
  } else if (type === 'PUT (PE)') {
    stopLoss = price + (1.5 * atr);
    target1 = price - (2.0 * atr);
    target2 = price - (3.5 * atr);
  }

  // Format option premium contracts naming standard guidelines
  const roundedSpot = Math.round(price / meta.optionGap) * meta.optionGap;
  const suffix = type === 'CALL (CE)' ? 'CE' : type === 'PUT (PE)' ? 'PE' : 'CE';
  const strikePrice = `${symbol} ${roundedSpot} ${suffix}`;

  // Option Premium
  const optionPremium = calculateSimulatedPremium(price, strikePrice, type === 'CALL (CE)');

  return {
    symbol,
    type,
    entryPrice: Math.round(price * 100) / 100,
    target1: Math.round(target1 * 100) / 100,
    target2: Math.round(target2 * 100) / 100,
    stopLoss: Math.round(stopLoss * 100) / 100,
    strikePrice,
    optionPremium,
    strength,
    ruleStatus,
    generatedAt: new Date().toLocaleTimeString(),
    impliedVolatility: Math.round((vix * 1.05 + (Math.random() - 0.5) * 0.3) * 100) / 100,
    openInterestCallPercent: type === 'CALL (CE)' ? Math.round(35 + Math.random() * 10) : Math.round(55 + Math.random() * 15),
    openInterestPutPercent: 0,
  };
}

// Compute premium with exact option premium decay mechanics
export function calculateSimulatedPremium(spot: number, strikeName: string, isCE: boolean): number {
  const parts = strikeName.split(' ');
  const strikeNum = parseFloat(parts[parts.length - 2]);
  if (isNaN(strikeNum)) return 110.00;

  const diff = spot - strikeNum;
  let intrinsic = isCE ? Math.max(0, diff) : Math.max(0, -diff);

  // Extrinsic (Time + Volatility pricing) based on VIX value
  const extrinsicBase = strikeNum * 0.0075;
  const vixMultiplier = currentVixValue / 14; // normalized around standard VIX of 14
  const extrinsicVal = extrinsicBase * vixMultiplier;

  const premium = intrinsic + extrinsicVal;
  return Math.round(Math.max(12, premium) * 100) / 100;
}
