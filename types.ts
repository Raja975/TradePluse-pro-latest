export type TickerSymbol =
  | 'NIFTY 50'
  | 'BANK NIFTY'
  | 'SENSEX'
  | 'FINNIFTY'
  | 'MIDCPNIFTY';

export interface TechnicalIndicators {
  vwap: number;
  rsi: number; // Length 14, overbought/oversold levels 60 and 40
  ema20: number; // Fast EMA
  ema50: number; // Slow EMA
  supertrendValue: number;
  supertrendDirection: 'BUY' | 'SELL';
  atr: number; // Length 14 (on index chart)
  pcr: number; // Put-Call Ratio
  vix: number; // India VIX
  ema9?: number;  // Fallback for custom prompt mapping if server uses it
  ema21?: number; // Fallback for custom prompt mapping if server uses it
  macdText?: string; // Fallback for legacy reference
}

export interface LiveTick {
  symbol: TickerSymbol;
  price: number;
  prevPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  indicators: TechnicalIndicators;
  timestamp: string;
}

export type SignalType = 'CALL (CE)' | 'PUT (PE)' | 'HOLD (WAIT)';

export interface RuleValidation {
  id: string;
  name: string;
  description: string;
  isPassed: boolean;
  actualValue: string;
  expectedValue: string;
}

export interface TradingSignal {
  symbol: TickerSymbol;
  type: SignalType;
  entryPrice: number; // Spot price entry
  target1: number; // Conservative target (2 * ATR away)
  target2: number; // Aggressive target (3.5 * ATR away)
  stopLoss: number; // Strict SL (1.5 * ATR away)
  strikePrice: string; // E.g. "NIFTY 50 22400 CE"
  optionPremium: number; // option premium price
  strength: number; // confidence score (0-100)
  ruleStatus: RuleValidation[];
  generatedAt: string;
  impliedVolatility: number;
  openInterestCallPercent: number;
  openInterestPutPercent: number;
}

export interface ActiveTrade {
  id: string;
  symbol: TickerSymbol;
  type: 'CALL (CE)' | 'PUT (PE)';
  qty: number;
  entryPrice: number; // Spot entry price
  entryPremium: number; // Option entry premium price
  currentIndexPrice: number; // Spot current price
  currentPremiumPrice: number; // Option current premium price
  pnl: number;
  pnlPercent: number;
  strikePrice: string;
  stopLossPremium: number; // Trigger limit based on Spot
  target1Premium: number; // Trigger limit based on Spot
  target2Premium: number; // Trigger limit based on Spot
  entryTime: string;
}

export interface SimulatedTradeHistory {
  id: string;
  symbol: TickerSymbol;
  type: 'CALL (CE)' | 'PUT (PE)';
  qty: number;
  entryPrice: number; // Spot entry price
  exitPrice: number; // Spot exit price
  entryPremium: number; // Option entry premium price
  exitPremium: number; // Option exit premium price
  pnl: number;
  pnlPercent: number;
  strikePrice: string;
  entryTime: string;
  exitTime: string;
  outcome: 'Target 1 Hit' | 'Target 2 Hit' | 'Stop Loss Hit' | 'Manual Exit';
}
