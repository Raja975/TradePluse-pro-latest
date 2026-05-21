import { TickerSymbol, TradingSignal, SimulatedTradeHistory } from '../types';
import { BASE_PRICES, calculateSimulatedPremium } from './marketSim';

export type BacktestStrategy = 
  | 'all_rules' 
  | 'ema_crossover' 
  | 'rsi_momentum' 
  | 'vwap_breakout' 
  | 'supertrend_follower';

export interface BacktestRequest {
  symbol: TickerSymbol;
  strategy: BacktestStrategy;
  durationDays: number;
  initialCapital: number;
  quantityLots: number;
  stopLossMultiple: number; // e.g. 1.5 ATR
  targetMultiple: number;   // e.g. 2.0 ATR
}

export interface BacktestMetricPoint {
  index: number;
  price: number;
  equity: number;
  drawdown: number;
  timestamp: string;
}

export interface BacktestResult {
  metrics: {
    winRate: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    netProfit: number;
    netProfitPercent: number;
    avgProfitLoss: number;
    maxDrawdown: number;
    profitFactor: number;
    startingCapital: number;
    endingCapital: number;
  };
  trades: SimulatedTradeHistory[];
  equityCurve: BacktestMetricPoint[];
}

/**
 * Generate a complete historical backtest simulation.
 */
export function runBacktest(req: BacktestRequest): BacktestResult {
  const {
    symbol,
    strategy,
    durationDays,
    initialCapital,
    quantityLots,
    stopLossMultiple,
    targetMultiple,
  } = req;

  const meta = BASE_PRICES[symbol];
  const lotFactor = symbol === 'BANK NIFTY' ? 15 : symbol === 'SENSEX' ? 10 : symbol === 'FINNIFTY' ? 25 : symbol === 'MIDCPNIFTY' ? 75 : 50;
  const totalContracts = quantityLots * lotFactor;

  // We will simulate periodic data ticks representing 5-minute bars over the selected duration.
  // 7 days = ~100 bars, 15 days = ~200 bars, 30 days = ~350 bars, 90 days = ~800 bars.
  const barsCount = durationDays === 7 ? 80 : durationDays === 15 ? 150 : durationDays === 30 ? 280 : 600;

  let currentPrice = meta.price * (0.95 + Math.random() * 0.08); // start slightly offset from standard spot
  let currentEma20 = currentPrice;
  let currentEma50 = currentPrice;
  let currentRsi = 48 + (Math.random() - 0.5) * 10;
  let currentVwap = currentPrice;
  let supertrendDir: 'BUY' | 'SELL' = Math.random() > 0.5 ? 'BUY' : 'SELL';
  let supertrendVal = supertrendDir === 'BUY' ? currentPrice - (meta.atr * 2.5) : currentPrice + (meta.atr * 2.5);
  let currentAtr = meta.atr * (0.9 + Math.random() * 0.25);
  let currentPcr = 0.85 + (Math.random() - 0.5) * 0.3;

  // Track accounts state
  let capital = initialCapital;
  let peakCapital = initialCapital;
  let maxDrawdown = 0;

  const trades: SimulatedTradeHistory[] = [];
  const equityCurve: BacktestMetricPoint[] = [];

  // Auxiliary structures to monitor open trades
  interface OpenPosition {
    id: string;
    type: 'CALL (CE)' | 'PUT (PE)';
    entryPrice: number;
    entryPremium: number;
    target1: number;
    target2: number;
    stopLoss: number;
    strikePrice: string;
    entryTime: string;
  }

  let activePosition: OpenPosition | null = null;

  // Pre-generate historical timestamps
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - durationDays);

  const formatTimestamp = (index: number, total: number) => {
    const elapsedMs = (durationDays * 24 * 60 * 60 * 1000 * index) / total;
    const date = new Date(baseDate.getTime() + elapsedMs);
    return `${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  };

  // Run bars loop
  for (let step = 0; step < barsCount; step++) {
    const barTime = formatTimestamp(step, barsCount);

    // 1. Simulate next spot price bar with realistic trend, stochastic waves and noise
    const trendCycle = Math.sin(step / (barsCount / 6.5)) * 0.0018; // clean multi-hour waves
    const volatilityScalar = 0.0035;
    const randomWalk = (Math.random() - 0.495) * volatilityScalar;
    const priceChange = currentPrice * (trendCycle + randomWalk);
    currentPrice = Math.round((currentPrice + priceChange) * 100) / 100;

    // 2. Update trailing mathematical indicators
    const alpha20 = 2 / (20 + 1);
    const alpha50 = 2 / (50 + 1);
    currentEma20 = currentPrice * alpha20 + currentEma20 * (1 - alpha20);
    currentEma50 = currentPrice * alpha50 + currentEma50 * (1 - alpha50);

    // RSI oscillator step
    let rsiDelta = (Math.random() - 0.5) * 4.5 + (priceChange > 0 ? 1.8 : -1.8);
    currentRsi = Math.max(10, Math.min(90, currentRsi + rsiDelta));

    // VWAP mean reversion
    currentVwap = (currentVwap * 14 + currentPrice) / 15;

    // ATR decay/expansion
    currentAtr = Math.max(meta.atr * 0.5, Math.min(meta.atr * 2, currentAtr + (Math.random() - 0.5) * (meta.atr * 0.02)));

    // Supertrend band calculations
    if (supertrendDir === 'BUY') {
      if (currentPrice < supertrendVal) {
        supertrendDir = 'SELL';
        supertrendVal = currentPrice + (currentAtr * 3);
      } else {
        supertrendVal = Math.max(supertrendVal, currentPrice - (currentAtr * 3));
      }
    } else {
      if (currentPrice > supertrendVal) {
        supertrendDir = 'BUY';
        supertrendVal = currentPrice - (currentAtr * 3);
      } else {
        supertrendVal = Math.min(supertrendVal, currentPrice + (currentAtr * 3));
      }
    }

    // PCR cycles
    currentPcr = Math.max(0.45, Math.min(1.8, currentPcr + (Math.random() - 0.5) * 0.04 + (priceChange > 0 ? 0.008 : -0.008)));

    // 3. Trade Management: If a trade is currently open, check exit benchmarks
    if (activePosition) {
      const pos = activePosition;
      let exitReason: 'Target 1 Hit' | 'Target 2 Hit' | 'Stop Loss Hit' | 'Manual Exit' | null = null;
      let exitPrice = currentPrice;

      if (pos.type === 'CALL (CE)') {
        if (currentPrice <= pos.stopLoss) {
          exitReason = 'Stop Loss Hit';
          exitPrice = pos.stopLoss;
        } else if (currentPrice >= pos.target2) {
          exitReason = 'Target 2 Hit';
          exitPrice = pos.target2;
        } else if (currentPrice >= pos.target1) {
          // 40% chance of taking trailing profits at target 1, else holding for target 2
          if (Math.random() > 0.6) {
            exitReason = 'Target 1 Hit';
            exitPrice = pos.target1;
          }
        }
      } else if (pos.type === 'PUT (PE)') {
        if (currentPrice >= pos.stopLoss) {
          exitReason = 'Stop Loss Hit';
          exitPrice = pos.stopLoss;
        } else if (currentPrice <= pos.target2) {
          exitReason = 'Target 2 Hit';
          exitPrice = pos.target2;
        } else if (currentPrice <= pos.target1) {
          if (Math.random() > 0.6) {
            exitReason = 'Target 1 Hit';
            exitPrice = pos.target1;
          }
        }
      }

      // If we reached the end of the simulation, force close
      if (!exitReason && step === barsCount - 1) {
        exitReason = 'Manual Exit';
        exitPrice = currentPrice;
      }

      if (exitReason) {
        // Option premium pricing at exit
        const exitPremium = calculateSimulatedPremium(exitPrice, pos.strikePrice, pos.type === 'CALL (CE)');
        const premiumChange = exitPremium - pos.entryPremium;
        const tradePnl = premiumChange * totalContracts;
        const pnlPercent = (premiumChange / pos.entryPremium) * 100;

        capital = Math.round((capital + tradePnl) * 100) / 100;

        trades.push({
          id: pos.id,
          symbol,
          type: pos.type === 'CALL (CE)' ? 'CALL (CE)' : 'PUT (PE)',
          qty: quantityLots,
          entryPrice: pos.entryPrice,
          exitPrice: Math.round(exitPrice * 100) / 100,
          entryPremium: pos.entryPremium,
          exitPremium: exitPremium,
          pnl: Math.round(tradePnl * 100) / 100,
          pnlPercent: Math.round(pnlPercent * 100) / 100,
          strikePrice: pos.strikePrice,
          entryTime: pos.entryTime,
          exitTime: barTime,
          outcome: exitReason,
        });

        // Clear active position
        activePosition = null;
      }
    }

    // 4. Signal Generation & Entries (if no active position exists)
    if (!activePosition) {
      let signalType: 'CALL (CE)' | 'PUT (PE)' | null = null;

      // Evaluate selected strategy rules
      if (strategy === 'ema_crossover') {
        const isEMAUp = currentEma20 > currentEma50;
        const prevEMAUp = (step > 0) && (currentEma20 - (Math.random() - 0.5) * 5 > currentEma50 + (Math.random() - 0.5) * 5); // simulated cross
        if (isEMAUp && !prevEMAUp && currentRsi > 50) {
          signalType = 'CALL (CE)';
        } else if (!isEMAUp && prevEMAUp && currentRsi < 50) {
          signalType = 'PUT (PE)';
        }
      } else if (strategy === 'rsi_momentum') {
        if (currentRsi > 62 && currentPrice > currentVwap) {
          signalType = 'CALL (CE)';
        } else if (currentRsi < 38 && currentPrice < currentVwap) {
          signalType = 'PUT (PE)';
        }
      } else if (strategy === 'vwap_breakout') {
        const hasVwapCall = currentPrice > currentVwap && currentRsi > 55;
        const hasVwapPut = currentPrice < currentVwap && currentRsi < 45;
        if (hasVwapCall && Math.random() > 0.8) {
          signalType = 'CALL (CE)';
        } else if (hasVwapPut && Math.random() > 0.8) {
          signalType = 'PUT (PE)';
        }
      } else if (strategy === 'supertrend_follower') {
        if (supertrendDir === 'BUY' && currentPrice > currentEma20) {
          signalType = 'CALL (CE)';
        } else if (supertrendDir === 'SELL' && currentPrice < currentEma20) {
          signalType = 'PUT (PE)';
        }
      } else { // 'all_rules'
        const isVwapCE = currentPrice > currentVwap;
        const isRsiCE = currentRsi > 60;
        const isEmaCE = currentEma20 > currentEma50;
        const isStCE = supertrendDir === 'BUY';

        if (isVwapCE && isRsiCE && isEmaCE && isStCE) {
          signalType = 'CALL (CE)';
        } else if (!isVwapCE && currentRsi < 40 && !isEmaCE && !isStCE) {
          signalType = 'PUT (PE)';
        }
      }

      // Check if we place an entry (avoiding entering on the very last bar)
      if (signalType && step < barsCount - 12) {
        // Set targets and stop losses in accordance with multiples
        const isCall = signalType === 'CALL (CE)';
        const atrGap = currentAtr;
        const stopLoss = isCall ? currentPrice - (stopLossMultiple * atrGap) : currentPrice + (stopLossMultiple * atrGap);
        const target1 = isCall ? currentPrice + (targetMultiple * atrGap) : currentPrice - (targetMultiple * atrGap);
        const target2 = isCall ? currentPrice + (targetMultiple * 1.7 * atrGap) : currentPrice - (targetMultiple * 1.7 * atrGap);

        const roundedSpot = Math.round(currentPrice / meta.optionGap) * meta.optionGap;
        const strikePrice = `${symbol} ${roundedSpot} ${isCall ? 'CE' : 'PE'}`;
        const entryPremium = calculateSimulatedPremium(currentPrice, strikePrice, isCall);

        // Required buying margin capital
        const requiredCapital = entryPremium * totalContracts;

        // Ensure we have sufficient margins to deploy trade
        if (capital >= requiredCapital) {
          activePosition = {
            id: Math.random().toString(36).substring(3, 9).toUpperCase(),
            type: signalType,
            entryPrice: currentPrice,
            entryPremium,
            target1: Math.round(target1 * 100) / 100,
            target2: Math.round(target2 * 100) / 100,
            stopLoss: Math.round(stopLoss * 100) / 100,
            strikePrice,
            entryTime: barTime,
          };
        }
      }
    }

    // 5. Track peak equity & trailing maximum drawdown metrics
    if (capital > peakCapital) {
      peakCapital = capital;
    }
    const currentDrawdown = peakCapital > 0 ? ((peakCapital - capital) / peakCapital) * 100 : 0;
    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown;
    }

    // Capture curve metrics
    equityCurve.push({
      index: step + 1,
      price: currentPrice,
      equity: Math.round(capital),
      drawdown: Math.round(currentDrawdown * 100) / 100,
      timestamp: barTime,
    });
  }

  // 6. Assemble finalized metrics calculations
  const totalTrades = trades.length;
  const winningTrades = trades.filter(t => t.pnl > 0).length;
  const losingTrades = totalTrades - winningTrades;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const netProfit = capital - initialCapital;
  const netProfitPercent = (netProfit / initialCapital) * 100;
  const avgProfitLoss = totalTrades > 0 ? netProfit / totalTrades : 0;

  // Compute profit factor
  const grossProfits = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
  const grossLosses = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLosses > 0 ? grossProfits / grossLosses : grossProfits > 0 ? 99.9 : 0;

  return {
    metrics: {
      winRate: Math.round(winRate * 10) / 10,
      totalTrades,
      winningTrades,
      losingTrades,
      netProfit: Math.round(netProfit * 100) / 100,
      netProfitPercent: Math.round(netProfitPercent * 10) / 10,
      avgProfitLoss: Math.round(avgProfitLoss * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      startingCapital: initialCapital,
      endingCapital: Math.round(capital * 100) / 100,
    },
    trades,
    equityCurve,
  };
}
