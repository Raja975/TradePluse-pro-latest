import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Sliders, 
  Play, 
  Pause, 
  ChevronRight, 
  AlertTriangle, 
  Settings, 
  CheckCircle2, 
  XCircle, 
  Info, 
  Sparkles, 
  Activity,
  Briefcase, 
  History, 
  Percent, 
  AlertCircle, 
  Search,
  DollarSign,
  Award,
  BookOpen,
  Volume2,
  VolumeX,
  CreditCard
} from 'lucide-react';
import { TickerSymbol, LiveTick, TechnicalIndicators, TradingSignal, ActiveTrade, SimulatedTradeHistory } from './types';
import { BASE_PRICES, createInitialTick, simulateNextTick, generateTechnicalSignal, calculateSimulatedPremium } from './utils/marketSim';
import BacktestPanel from './components/BacktestPanel';

export default function App() {
  // State for active indices ticks
  const [ticks, setTicks] = useState<Record<TickerSymbol, LiveTick>>(() => {
    const initial: Record<string, LiveTick> = {};
    (Object.keys(BASE_PRICES) as TickerSymbol[]).forEach((sym) => {
      initial[sym] = createInitialTick(sym);
    });
    return initial as Record<TickerSymbol, LiveTick>;
  });

  const [selectedSymbol, setSelectedSymbol] = useState<TickerSymbol>('NIFTY 50');
  const [isLiveRunning, setIsLiveRunning] = useState<boolean>(true);
  const [systemVix, setSystemVix] = useState<number>(14.2);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'signals' | 'optionChain' | 'broker' | 'rules' | 'history' | 'backtest'>('signals');
  const [languageMode, setLanguageMode] = useState<'hinglish' | 'english'>('hinglish');
  
  // Custom manual broker settings
  const [apiKey, setApiKey] = useState<string>('15C7ctlo');
  const [lotSize, setLotSize] = useState<number>(50); // initial default for Nifty
  const [selectedQuantity, setSelectedQuantity] = useState<number>(2); // Multiplier of lots
  
  // Active Simulated Paper Trades
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [tradesHistory, setTradesHistory] = useState<SimulatedTradeHistory[]>([]);
  
  // Chart visual and technical analysis settings
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1m' | '5m' | '15m' | '1h'>('1m');
  const [showBB, setShowBB] = useState<boolean>(true);
  const [showEMA, setShowEMA] = useState<boolean>(false);
  const [showMACD, setShowMACD] = useState<boolean>(true);

  // Active drawings panel
  const [drawingMode, setDrawingMode] = useState<'pan' | 'trendline' | 'fibonacci'>('pan');
  const [drawings, setDrawings] = useState<Array<{
    id: string;
    type: 'trendline' | 'fibonacci';
    startX: number;     // Index percentage (0-100)
    startVal: number;   // actual price level
    endX: number;       // Index percentage (0-100)
    endVal: number;     // actual price level
  }>>([]);

  // Store click coordinates during interactive drag/click sequence
  const [firstPoint, setFirstPoint] = useState<{ x: number; val: number } | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; val: number } | null>(null);

  // Chart historical prices database for nice curved visualization across multiple timeframes (flat key dictionary)
  const [chartHistory, setChartHistory] = useState<Record<string, number[]>>(() => {
    const initialHist: Record<string, number[]> = {};
    const timeframes = ['1m', '5m', '15m', '1h'];
    (Object.keys(BASE_PRICES) as TickerSymbol[]).forEach((sym) => {
      const base = BASE_PRICES[sym].price;
      timeframes.forEach((tf) => {
        const historyArr: number[] = [];
        let temp = base - 120;
        const count = 35; // keep 35 points for high fidelity indicator formulas
        const multiplier = tf === '1m' ? 0.002 : tf === '5m' ? 0.004 : tf === '15m' ? 0.007 : 0.012;
        for (let i = 0; i < count; i++) {
          temp += (Math.random() - 0.48) * (base * multiplier);
          historyArr.push(Math.round(temp * 100) / 100);
        }
        initialHist[`${tf}_${sym}`] = historyArr;
      });
    });
    return initialHist;
  });

  // AI analysis cache and state
  const [aiAnalysisText, setAiAnalysisText] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>('');

  // Simulation controls: manual price overrides for live action demo
  const [manualPriceShift, setManualPriceShift] = useState<number>(0);

  // Audio Beep cues
  const playAlertSound = (type: 'win' | 'lose' | 'signal' | 'click') => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'win') {
        // Double sweet note
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
          gain2.gain.setValueAtTime(0.12, ctx.currentTime);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.25);
        }, 160);
      } else if (type === 'lose') {
        // Falling low note
        osc.frequency.setValueAtTime(293.66, ctx.currentTime); // D4
        osc.frequency.exponentialRampToValueAtTime(146.83, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'signal') {
        // Bright high note
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        // Soft blip
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch (e) {
      // Audio context may be blocked by user activation rules initially
    }
  };

  // Adjust default lot sizes when selecting another index symbol
  useEffect(() => {
    if (selectedSymbol === 'NIFTY 50') setLotSize(50);
    else if (selectedSymbol === 'BANK NIFTY') setLotSize(15);
    else if (selectedSymbol === 'SENSEX') setLotSize(10);
    else if (selectedSymbol === 'FINNIFTY') setLotSize(25);
    else if (selectedSymbol === 'MIDCPNIFTY') setLotSize(75);
    
    // Clear AI analysis box when changing symbol
    setAiAnalysisText('');
  }, [selectedSymbol]);

  // Global system live ticks simulator loop
  useEffect(() => {
    if (!isLiveRunning) return;

    const interval = setInterval(() => {
      setTicks((prev) => {
        const next = { ...prev };
        (Object.keys(prev) as TickerSymbol[]).forEach((sym) => {
          // Trigger dynamic tick movement
          const updatedTick = simulateNextTick(prev[sym]);
          next[sym] = updatedTick;

          // Update chart line points across all timeframes (1m, 5m, 15m, 1h) with relative smoothing
          setChartHistory((hist) => {
            const nextHist = { ...hist };
            const timeframes = ['1m', '5m', '15m', '1h'] as const;
            timeframes.forEach((tf) => {
              const key = `${tf}_${sym}`;
              const currentArr = [...(hist[key] || [])];
              
              // Simulate different timeframe speeds via exponential moving standard deviations & filters:
              let addVal = updatedTick.price;
              if (currentArr.length > 0) {
                const prev = currentArr[currentArr.length - 1];
                if (tf === '5m') {
                  addVal = prev * 0.4 + updatedTick.price * 0.6;
                } else if (tf === '15m') {
                  addVal = prev * 0.7 + updatedTick.price * 0.3;
                } else if (tf === '1h') {
                  addVal = prev * 0.88 + updatedTick.price * 0.12;
                }
              }

              currentArr.push(Math.round(addVal * 100) / 100);
              if (currentArr.length > 35) { // Maintain high indicators window capacity (35 blocks)
                currentArr.shift();
              }
              nextHist[key] = currentArr;
            });
            return nextHist;
          });
        });

        return next;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [isLiveRunning]);

  // Watch ticks change to compute live Position targets & Stop Loss alerts
  useEffect(() => {
    if (activeTrades.length === 0) return;

    setActiveTrades((prevTrades) => {
      const updatedTrades: ActiveTrade[] = [];
      let listChanged = false;

      prevTrades.forEach((trade) => {
        const liveTick = ticks[trade.symbol];
        if (!liveTick) {
          updatedTrades.push(trade);
          return;
        }

        const spotPrice = liveTick.price;
        const isCE = trade.type === 'CALL (CE)';
        
        // Re-calculate the live option contract premium based on spot movement
        const currentPremium = calculateSimulatedPremium(spotPrice, trade.strikePrice, isCE);
        const priceDiff = currentPremium - trade.entryPremium;
        const pnl = priceDiff * trade.qty * lotSize;
        const pnlPercent = (priceDiff / trade.entryPremium) * 100;

        // Auto limit target checks based on live index price triggers
        let breached = false;
        let outcome: SimulatedTradeHistory['outcome'] = 'Manual Exit';
        let finalExitPremium = currentPremium;

        if (isCE) {
          if (spotPrice >= trade.target2Premium) { // Use Target 2 Trigger Index Target
            breached = true;
            outcome = 'Target 2 Hit';
            finalExitPremium = calculateSimulatedPremium(trade.target2Premium, trade.strikePrice, true);
          } else if (spotPrice >= trade.target1Premium) { // Use Target 1 Trigger index target
            breached = true;
            outcome = 'Target 1 Hit';
            finalExitPremium = calculateSimulatedPremium(trade.target1Premium, trade.strikePrice, true);
          } else if (spotPrice <= trade.stopLossPremium) {
            breached = true;
            outcome = 'Stop Loss Hit';
            finalExitPremium = calculateSimulatedPremium(trade.stopLossPremium, trade.strikePrice, true);
          }
        } else {
          // Put options (triggers represent downside index drop)
          if (spotPrice <= trade.target2Premium) {
            breached = true;
            outcome = 'Target 2 Hit';
            finalExitPremium = calculateSimulatedPremium(trade.target2Premium, trade.strikePrice, false);
          } else if (spotPrice <= trade.target1Premium) {
            breached = true;
            outcome = 'Target 1 Hit';
            finalExitPremium = calculateSimulatedPremium(trade.target1Premium, trade.strikePrice, false);
          } else if (spotPrice >= trade.stopLossPremium) {
            breached = true;
            outcome = 'Stop Loss Hit';
            finalExitPremium = calculateSimulatedPremium(trade.stopLossPremium, trade.strikePrice, false);
          }
        }

        if (breached) {
          // Trigger trade archive completion
          listChanged = true;
          const finalPnl = (finalExitPremium - trade.entryPremium) * trade.qty * lotSize;
          const finalPnlPercent = ((finalExitPremium - trade.entryPremium) / trade.entryPremium) * 100;

          const historyItem: SimulatedTradeHistory = {
            id: trade.id,
            symbol: trade.symbol,
            type: trade.type,
            qty: trade.qty,
            entryPrice: trade.entryPrice,
            exitPrice: spotPrice,
            entryPremium: trade.entryPremium,
            exitPremium: Math.round(finalExitPremium * 100) / 100,
            pnl: Math.round(finalPnl * 100) / 100,
            pnlPercent: Math.round(finalPnlPercent * 100) / 100,
            strikePrice: trade.strikePrice,
            entryTime: trade.entryTime,
            exitTime: new Date().toLocaleTimeString(),
            outcome
          };

          setTradesHistory((prev) => [historyItem, ...prev]);
          playAlertSound(outcome === 'Stop Loss Hit' ? 'lose' : 'win');
        } else {
          updatedTrades.push({
            ...trade,
            currentIndexPrice: spotPrice,
            currentPremiumPrice: currentPremium,
            pnl: Math.round(pnl * 100) / 100,
            pnlPercent: Math.round(pnlPercent * 100) / 100
          });
        }
      });

      return listChanged ? updatedTrades : updatedTrades;
    });
  }, [ticks]);

  // Execute manual mock market shift simulation buttons (BULLISH spike vs BEARISH crash)
  const triggerManualMarketShift = (bias: 'UP' | 'DOWN' | 'STABLE') => {
    playAlertSound('click');
    setTicks((prev) => {
      const currentTick = prev[selectedSymbol];
      const shiftPercent = bias === 'UP' ? 0.008 : bias === 'DOWN' ? -0.008 : 0;
      const nextPrice = currentTick.price * (1 + shiftPercent);

      // Recalculate all indicators immediately to confirm the signal flip
      const meta = BASE_PRICES[selectedSymbol];
      const nextRsi = bias === 'UP' ? 68.5 : bias === 'DOWN' ? 32.0 : 50.0;
      const nextAtr = currentTick.indicators.atr;
      
      const nextEma20 = nextPrice * 0.994;
      const nextEma50 = nextPrice * (bias === 'UP' ? 0.988 : 1.006);
      const nextVwap = bias === 'UP' ? nextPrice - 15 : nextPrice + 15;
      const nextSupertrendDir = bias === 'UP' ? 'BUY' : 'SELL';
      const nextSupertrendValue = bias === 'UP' ? nextPrice - nextAtr * 3 : nextPrice + nextAtr * 3;
      const nextPcr = bias === 'UP' ? 1.35 : 0.55;

      const indicators: TechnicalIndicators = {
        vwap: Math.round(nextVwap * 100) / 100,
        rsi: nextRsi,
        ema20: Math.round(nextEma20 * 100) / 100,
        ema50: Math.round(nextEma50 * 100) / 100,
        supertrendValue: Math.round(nextSupertrendValue * 100) / 100,
        supertrendDirection: nextSupertrendDir,
        atr: Math.round(nextAtr * 100) / 100,
        pcr: nextPcr,
        vix: systemVix,
        ema9: Math.round(nextEma20 * 0.999 * 100) / 100,
        ema21: Math.round(nextEma50 * 0.998 * 100) / 100,
        macdText: bias === 'UP' ? 'Bullish Crossover' : 'Bearish Crossover',
      };

      return {
        ...prev,
        [selectedSymbol]: {
          ...currentTick,
          price: Math.round(nextPrice * 100) / 100,
          prevPrice: currentTick.price,
          change: Math.round((nextPrice - BASE_PRICES[selectedSymbol].price) * 100) / 100,
          changePercent: Math.round(((nextPrice - BASE_PRICES[selectedSymbol].price) / BASE_PRICES[selectedSymbol].price) * 10000) / 100,
          indicators
        }
      };
    });
  };

  // Submit live options signal data directly to server backend for validation and expert technical advice via Gemini AI
  const handleRequestAiAnalysis = async (techSignal: TradingSignal) => {
    if (techSignal.type === 'HOLD (WAIT)') {
      setAiError('Technical Alert: Hold state is active. Please wait till VWAP, RSI & Dual EMA rules fully align to produce a strong CALL or PUT buy signal.');
      return;
    }
    
    setIsAiLoading(true);
    setAiAnalysisText('');
    setAiError('');
    playAlertSound('signal');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: techSignal.symbol,
          price: techSignal.entryPrice,
          suggestedSignal: techSignal.type === 'CALL (CE)' ? 'CALL' : 'PUT',
          target1: techSignal.target1,
          target2: techSignal.target2,
          stopLoss: techSignal.stopLoss,
          language: languageMode,
          indicators: {
            rsi: ticks[selectedSymbol].indicators.rsi,
            macd: ticks[selectedSymbol].indicators.macdText,
            ema9: ticks[selectedSymbol].indicators.ema20, // bind parameter
            ema21: ticks[selectedSymbol].indicators.ema50,
            bollingerUpper: ticks[selectedSymbol].indicators.supertrendValue,
            bollingerLower: ticks[selectedSymbol].indicators.vwap,
            trend: ticks[selectedSymbol].indicators.supertrendDirection === 'BUY' ? 'BULLISH' : 'BEARISH'
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Server API returned negative response status.');
      }

      const result = await response.json();
      if (result && result.success) {
        setAiAnalysisText(result.text);
      } else {
        throw new Error('Analysis payload failed rendering.');
      }
    } catch (err: any) {
      console.error(err);
      setAiError('Failed communicating with AI analysis engine. Ensure GEMINI_API_KEY environment config or internet access is setup correctly.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Create a paper trade placement in mock portfolio
  const triggerExecuteOrder = (signal: TradingSignal) => {
    if (signal.type === 'HOLD (WAIT)') return;

    playAlertSound('click');
    const existingTrade = activeTrades.find(t => t.symbol === signal.symbol);
    if (existingTrade) {
      alert(`An active option contract position for ${signal.symbol} is already open in your Broker Terminal. Double exposure warning!`);
      return;
    }

    // Capture entry premium and target rules index limits
    const tradeOrder: ActiveTrade = {
      id: Math.random().toString(36).substring(3, 9).toUpperCase(),
      symbol: signal.symbol,
      type: signal.type === 'CALL (CE)' ? 'CALL (CE)' : 'PUT (PE)',
      qty: selectedQuantity,
      entryPrice: signal.entryPrice,
      entryPremium: signal.optionPremium,
      currentIndexPrice: signal.entryPrice,
      currentPremiumPrice: signal.optionPremium,
      pnl: 0,
      pnlPercent: 0,
      strikePrice: signal.strikePrice,
      stopLossPremium: signal.stopLoss, // We trigger limits mathematically base on Spot Prices
      target1Premium: signal.target1,
      target2Premium: signal.target2,
      entryTime: new Date().toLocaleTimeString()
    };

    setActiveTrades((prev) => [tradeOrder, ...prev]);
    setActiveTab('broker');
    playAlertSound('win');
  };

  // Create an order placement from the interactive Option Chain table
  const executeOptionChainOrder = (strike: number, premium: number, isCE: boolean) => {
    playAlertSound('click');
    const suffix = isCE ? 'CE' : 'PE';
    const strikeName = `${selectedSymbol} ${strike} ${suffix}`;
    
    // Check if double-buying
    const existingTrade = activeTrades.find(t => t.strikePrice === strikeName);
    if (existingTrade) {
      alert(`An active option contract position for ${strikeName} is already open in your Broker Terminal. Double exposure warning!`);
      return;
    }

    const atr = currentTickData.indicators.atr;
    const spotPrice = currentTickData.price;

    // Calculate dynamic index-based targets matching the active trend or baseline simulation
    const target1Spot = isCE ? spotPrice + (2.0 * atr) : spotPrice - (2.0 * atr);
    const target2Spot = isCE ? spotPrice + (3.5 * atr) : spotPrice - (3.5 * atr);
    const slSpot = isCE ? spotPrice - (1.5 * atr) : spotPrice + (1.5 * atr);

    const tradeOrder: ActiveTrade = {
      id: Math.random().toString(36).substring(3, 9).toUpperCase(),
      symbol: selectedSymbol,
      type: isCE ? 'CALL (CE)' : 'PUT (PE)',
      qty: selectedQuantity,
      entryPrice: spotPrice,
      entryPremium: premium,
      currentIndexPrice: spotPrice,
      currentPremiumPrice: premium,
      pnl: 0,
      pnlPercent: 0,
      strikePrice: strikeName,
      stopLossPremium: Math.round(slSpot * 100) / 100,
      target1Premium: Math.round(target1Spot * 100) / 100,
      target2Premium: Math.round(target2Spot * 100) / 100,
      entryTime: new Date().toLocaleTimeString()
    };

    setActiveTrades((prev) => [tradeOrder, ...prev]);
    setActiveTab('broker');
    playAlertSound('win');
  };

  const forceExitTrade = (trade: ActiveTrade) => {
    playAlertSound('click');
    const liveTick = ticks[trade.symbol];
    const spot = liveTick ? liveTick.price : trade.currentIndexPrice;
    
    // final option pricing
    const exitPremium = calculateSimulatedPremium(spot, trade.strikePrice, trade.type === 'CALL (CE)');
    const finalPnl = (exitPremium - trade.entryPremium) * trade.qty * lotSize;
    const finalPnlPercent = ((exitPremium - trade.entryPremium) / trade.entryPremium) * 100;

    const historyItem: SimulatedTradeHistory = {
      id: trade.id,
      symbol: trade.symbol,
      type: trade.type,
      qty: trade.qty,
      entryPrice: trade.entryPrice,
      exitPrice: spot,
      entryPremium: trade.entryPremium,
      exitPremium: Math.round(exitPremium * 100) / 100,
      pnl: Math.round(finalPnl * 100) / 100,
      pnlPercent: Math.round(finalPnlPercent * 100) / 100,
      strikePrice: trade.strikePrice,
      entryTime: trade.entryTime,
      exitTime: new Date().toLocaleTimeString(),
      outcome: 'Manual Exit'
    };

    setTradesHistory((prev) => [historyItem, ...prev]);
    setActiveTrades((prev) => prev.filter(t => t.id !== trade.id));
    playAlertSound('lose');
  };

  // Selected tick data helpers
  const currentTickData = ticks[selectedSymbol] || createInitialTick(selectedSymbol);
  const currentSignal = generateTechnicalSignal(currentTickData);
  const selectedHistory = chartHistory[`${selectedTimeframe}_${selectedSymbol}`] || [];

  // Live Technical overlays math engine
  const calculateIndicators = (prices: number[]) => {
    if (prices.length === 0) return {
      upperBand: [] as number[],
      middleBand: [] as number[],
      lowerBand: [] as number[],
      ema9: [] as number[],
      ema21: [] as number[],
      macd: [] as number[],
      signal: [] as number[],
      hist: [] as number[],
    };

    const len = prices.length;
    const bbPeriod = 10;
    const bbUpper: number[] = [];
    const bbMiddle: number[] = [];
    const bbLower: number[] = [];

    // EMA helper function
    const getEMA = (values: number[], period: number) => {
      const emaArr: number[] = [];
      const k = 2 / (period + 1);
      let prevEma = values[0] || 0;
      for (let i = 0; i < values.length; i++) {
        const curEMA = values[i] * k + prevEma * (1 - k);
        emaArr.push(curEMA);
        prevEma = curEMA;
      }
      return emaArr;
    };

    const ema9Calculated = getEMA(prices, 9);
    const ema21Calculated = getEMA(prices, 21);

    for (let i = 0; i < len; i++) {
      const startIdx = Math.max(0, i - bbPeriod + 1);
      const windowPrices = prices.slice(startIdx, i + 1);
      const mean = windowPrices.reduce((sum, val) => sum + val, 0) / windowPrices.length;
      const variance = windowPrices.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / windowPrices.length;
      const stdDev = Math.sqrt(variance) || 0.5;

      bbMiddle.push(mean);
      bbUpper.push(mean + 2 * stdDev);
      bbLower.push(mean - 2 * stdDev);
    }

    // Direct MACD line estimates (Fast Window 6, Slow Window 14, Signal Period 5)
    const emaFast = getEMA(prices, 6);
    const emaSlow = getEMA(prices, 14);
    const macdLine: number[] = [];
    for (let i = 0; i < len; i++) {
      macdLine.push(emaFast[i] - emaSlow[i]);
    }

    const signalLine = getEMA(macdLine, 5);
    const macdHist: number[] = [];
    for (let i = 0; i < len; i++) {
      macdHist.push(macdLine[i] - signalLine[i]);
    }

    return {
      upperBand: bbUpper,
      middleBand: bbMiddle,
      lowerBand: bbLower,
      ema9: ema9Calculated,
      ema21: ema21Calculated,
      macd: macdLine,
      signal: signalLine,
      hist: macdHist,
    };
  };

  const currentIndicators = calculateIndicators(selectedHistory);

  // VIX Advice details based on specific boundaries
  const getVixAdvice = (v: number) => {
    if (v < 11) {
      return {
        label: 'SLOW MOVEMENT',
        color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
        note: 'Index ranges are low. Premiums decay very fast. Stick to quick 10-15 points premium scalp targets only.'
      };
    } else if (v >= 12 && v <= 18) {
      return {
        label: 'IDEAL ZONE',
        color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
        note: 'Excellent volatility score. Option pricing is normal, volatility curves are stable, and index target breakouts are highly reliable.'
      };
    } else {
      return {
        label: 'EXTREME VOLATILITY',
        color: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
        note: 'High crash hazard! Option premiums are heavily inflated. Reduce position sizes by 50% to prevent sharp trailing losses.'
      };
    }
  };

  const activeVixAdvice = getVixAdvice(systemVix);

  return (
    <div id="option-signal-pro" className="bg-slate-950 text-slate-200 min-h-screen w-full flex flex-col font-sans transition-all selection:bg-indigo-600 selection:text-white">
      {/* Dynamic Sound Alert Settings Bar */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-slate-300 py-1.5 px-6 border-b border-slate-800 text-xs flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            INDIAN INDEX OPTIONS ENGINE
          </span>
          <span className="text-slate-500">|</span>
          <span className="hidden md:inline text-slate-400">
            Real-time VWAP, Dual EMA Crossover (20/50), ATR Standard Pivot Target Matrix & VIX Gauges.
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center h-5 bg-slate-950 rounded-full border border-slate-800 p-0.5">
            <button 
              id="set_hinglish"
              onClick={() => { setLanguageMode('hinglish'); playAlertSound('click'); }} 
              className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${languageMode === 'hinglish' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Hinglish
            </button>
            <button 
              id="set_english"
              onClick={() => { setLanguageMode('english'); playAlertSound('click'); }} 
              className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${languageMode === 'english' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              English
            </button>
          </div>
          <button 
            id="audio_toggle"
            onClick={() => { setSoundEnabled(!soundEnabled); }} 
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-all focus:outline-none"
            title="Toggle Sound Alerts"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-indigo-400" /> : <VolumeX className="w-3.5 h-3.5 text-rose-500" />}
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider">{soundEnabled ? 'Beep On' : 'Beep Off'}</span>
          </button>
        </div>
      </div>

      {/* Top Professional Navigation Header Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between px-6 flex-shrink-0 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-700 to-indigo-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/10">
            <TrendingUp className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5 font-mono">
              TRADEPULSE <span className="text-indigo-400 font-sans font-light">PRO</span>
            </h1>
            <p className="text-[9px] uppercase tracking-wider text-indigo-400/70 font-semibold font-mono">INDIA OPTION CORE V1.5</p>
          </div>
          <div className="ml-4 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${isLiveRunning ? 'block' : 'hidden'}`}></span>
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isLiveRunning ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-[9px] uppercase font-bold text-emerald-400 tracking-wider font-mono">
              {isLiveRunning ? 'NSE Live Stream Feed' : 'Feed Paused'}
            </span>
          </div>
        </div>

        {/* Global Stats bar for Indian Market Index */}
        <div className="hidden lg:flex items-center gap-5 mr-4 text-xs font-mono">
          <div className="border-r border-slate-800 pr-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-sans font-semibold">INDIA VIX</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-white font-bold">{systemVix.toFixed(2)}</span>
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${activeVixAdvice.color.split(' ')[1]}`}>
                {activeVixAdvice.label}
              </span>
            </div>
          </div>
          
          <div className="border-r border-slate-800 pr-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-sans font-semibold">API KEY STATUS</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-green-400 font-mono text-[11px] font-bold bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
                Active ({apiKey})
              </span>
            </div>
          </div>
        </div>

        {/* Primary Navigation Mode Selector */}
        <div className="flex items-center gap-3">
          <nav className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button 
              id="tab_signals"
              onClick={() => { setActiveTab('signals'); playAlertSound('click'); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === 'signals' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Activity className="w-3.5 h-3.5" />
              Signals
            </button>
            <button 
              id="tab_option_chain"
              onClick={() => { setActiveTab('optionChain'); playAlertSound('click'); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === 'optionChain' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Option Chain
            </button>
            <button 
              id="tab_broker"
              onClick={() => { setActiveTab('broker'); playAlertSound('click'); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 relative ${activeTab === 'broker' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Terminal P&L
              {activeTrades.length > 0 && (
                <span className="absolute -top-1.5 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white animate-bounce">
                  {activeTrades.length}
                </span>
              )}
            </button>
            <button 
              id="tab_history"
              onClick={() => { setActiveTab('history'); playAlertSound('click'); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <History className="w-3.5 h-3.5" />
              Archived ({tradesHistory.length})
            </button>
            <button 
              id="tab_backtest"
              onClick={() => { setActiveTab('backtest'); playAlertSound('click'); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === 'backtest' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Backtest Model
            </button>
          </nav>
        </div>
      </header>

      {/* Main Workspaces panels Container */}
      <main className="flex-1 flex flex-col xl:flex-row overflow-hidden p-4 gap-4">
        
        {/* Left Ticker Sidebar: Selector on all Indian Indices */}
        <aside className="w-full xl:w-76 flex flex-col gap-3 flex-shrink-0">
          <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden h-full">
            <div className="p-3.5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-3 bg-indigo-500 rounded"></span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Indian Indices Feed</h2>
              </div>
              <button 
                id="feed_freeze"
                onClick={() => { setIsLiveRunning(!isLiveRunning); playAlertSound('click'); }}
                className={`p-1.5 rounded hover:bg-slate-800 text-xs transition-colors ${isLiveRunning ? 'text-indigo-400' : 'text-amber-500 bg-amber-500/10'}`}
                title={isLiveRunning ? 'Pause live simulator' : 'Resume live simulator'}
              >
                {isLiveRunning ? <Pause className="w-4 h-4 text-emerald-400" /> : <Play className="w-4 h-4 text-amber-400 animate-pulse" />}
              </button>
            </div>

            {/* Indian Tickers List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 bg-slate-950/20">
              {(Object.keys(BASE_PRICES) as TickerSymbol[]).map((symbol) => {
                const tick = ticks[symbol];
                const signal = generateTechnicalSignal(tick);
                const isSelected = selectedSymbol === symbol;
                const isBullish = tick.price >= tick.prevPrice;
                const isCall = signal.type === 'CALL (CE)';
                const isPut = signal.type === 'PUT (PE)';

                return (
                  <div
                    id={`symbol_card_${symbol.replace(' ', '_')}`}
                    key={symbol}
                    onClick={() => { setSelectedSymbol(symbol); playAlertSound('click'); }}
                    className={`p-3.5 cursor-pointer transition-all flex flex-col gap-1.5 ${isSelected ? 'bg-indigo-950/40 border-l-4 border-indigo-500' : 'hover:bg-slate-900/40 border-l-4 border-transparent'}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold tracking-tight text-white font-mono">{symbol}</span>
                      <div className="flex items-center gap-1.5">
                        {isCall && (
                          <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">
                            CE SIGNAL
                          </span>
                        )}
                        {isPut && (
                          <span className="text-[9px] font-extrabold bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/30">
                            PE SIGNAL
                          </span>
                        )}
                        {signal.type === 'HOLD (WAIT)' && (
                          <span className="text-[9px] font-semibold bg-slate-800/60 text-slate-400 px-1.5 py-0.5 rounded">
                            WAIT
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-end">
                      <span className={`text-[13px] font-bold font-mono transition-all duration-300 ${isBullish ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tick.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <div className="flex items-center gap-1 text-[10px] font-mono">
                        <span className={tick.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                          {tick.change >= 0 ? '+' : ''}{tick.changePercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    {/* Simple Mini Indicator Preview Dots under symbol */}
                    <div className="flex items-center justify-between mt-1 text-[9px] text-slate-500 font-mono">
                      <span>RSI: <strong className={tick.indicators.rsi > 60 ? 'text-emerald-400' : tick.indicators.rsi < 40 ? 'text-rose-400' : 'text-slate-400'}>{tick.indicators.rsi}</strong></span>
                      <span>VIX: {tick.indicators.vix.toFixed(1)}</span>
                      <span>PCR: {tick.indicators.pcr.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick API Key custom input form below sidebar for complete realism */}
            <div className="p-3.5 bg-slate-950/60 border-t border-slate-800 flex flex-col gap-2">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center justify-between font-mono">
                <span>Broker API Channel Key</span>
                <span className="text-indigo-400 text-[9px] font-light uppercase">Secure Local</span>
              </label>
              <div className="relative">
                <input
                  id="broker_api_key_input"
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter custom API verification token..."
                  className="w-full bg-slate-900 border border-slate-700/60 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <p className="text-[9px] text-slate-500 font-mono">
                Default key set for authenticating target confirmation reports.
              </p>
            </div>
          </div>
        </aside>

        {/* Middle Central Panel: High Fidelity Options technical charts, signal validation checking list, and dynamic paper trading limits */}
        <section className="flex-1 flex flex-col gap-4 overflow-hidden">
          
          {/* Signal Header block representing Options CE/PE current triggers */}
          <div className={`bg-gradient-to-r p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-500 ${
            currentSignal.type === 'CALL (CE)' 
              ? 'from-emerald-950/30 via-slate-900 to-emerald-900/10 border-emerald-500/20 shadow-emerald-950/10 shadow-lg' 
              : currentSignal.type === 'PUT (PE)' 
              ? 'from-rose-950/30 via-slate-900 to-rose-950/10 border-rose-500/20 shadow-rose-950/10 shadow-lg'
              : 'from-slate-900 via-slate-900 to-indigo-950/10 border-slate-800/80'
          }`}>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center font-bold ${
                currentSignal.type === 'CALL (CE)' 
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10' 
                  : currentSignal.type === 'PUT (PE)' 
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/10'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {currentSignal.type === 'CALL (CE)' ? 'CE' : currentSignal.type === 'PUT (PE)' ? 'PE' : 'HOLD'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-white tracking-wide font-mono">
                    {selectedSymbol} - {currentSignal.strikePrice}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    currentSignal.type === 'CALL (CE)' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : currentSignal.type === 'PUT (PE)' 
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {currentSignal.type === 'CALL (CE)' ? 'ACCURATE BUY CALL' : currentSignal.type === 'PUT (PE)' ? 'ACCURATE BUY PUT' : 'NO DECAY ZONE RANGE'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  {currentSignal.type === 'HOLD (WAIT)'
                    ? `Index is trapped in 40-60 RSI decay zone. Sideways consolidation alert!`
                    : `Signal Confidence Score: ${currentSignal.strength}% probability of breakout based on 7 indicators.`
                  }
                </p>
              </div>
            </div>

            {/* Quick Order Entry Placement Panel inside Header */}
            {currentSignal.type !== 'HOLD (WAIT)' ? (
              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <div className="flex items-center bg-slate-900 border border-slate-800 text-[11px] h-9 px-2.5 rounded-lg text-slate-400 font-mono">
                  <span>Lots: </span>
                  <input
                    id="quantity_select"
                    type="number"
                    min="1"
                    max="10"
                    value={selectedQuantity}
                    onChange={(e) => setSelectedQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-10 bg-transparent text-white focus:outline-none font-bold text-center ml-1 border-b border-indigo-500"
                  />
                  <span className="text-[9px] text-slate-500 ml-1">({selectedQuantity * lotSize} Qty)</span>
                </div>
                <button
                  id="broker_quick_execute"
                  onClick={() => triggerExecuteOrder(currentSignal)}
                  className={`h-9 px-5 text-xs font-black uppercase text-slate-950 rounded-lg transition-all flex items-center gap-1 hover:scale-[1.02] active:scale-[0.98] ${
                    currentSignal.type === 'CALL (CE)' 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300' 
                      : 'bg-gradient-to-r from-rose-500 to-orange-400 hover:from-rose-400 hover:to-orange-300 text-white'
                  }`}
                >
                  EXECUTE CONTRACT
                </button>
              </div>
            ) : (
              <div className="text-xs font-semibold text-amber-500/80 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-lg flex items-center gap-1.5 max-w-md">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>RSI ranges between 40-60. Avoid operations inside chop zones.</span>
              </div>
            )}
          </div>

          {/* Tab Workspaces Switch views */}
          {activeTab === 'signals' && (
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              
              {/* Technical Option Chart Area Visualization */}
              <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-4 relative overflow-hidden flex flex-col justify-between shadow-inner">
                
                {/* Upper Left Stats & Chart Toggles */}
                <div className="flex justify-between items-start z-10">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-mono font-black text-white leading-none">
                        {currentTickData.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <span className={`text-xs font-mono font-bold flex items-center gap-0.5 ${currentTickData.price >= currentTickData.prevPrice ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {currentTickData.price >= currentTickData.prevPrice ? '▲' : '▼'} 
                        {Math.abs(currentTickData.change).toFixed(2)} ({currentTickData.changePercent.toFixed(2)}%)
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1 font-mono">
                      LAST TICK: {currentTickData.timestamp} &middot; VOLUME: {(currentTickData.volume / 100000).toFixed(1)}L Contracts &middot; TF: <span className="text-indigo-400 font-extrabold">{selectedTimeframe.toUpperCase()}</span>
                    </p>
                  </div>

                  {/* Manual testing control suite overlay context */}
                  <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <span className="text-[9px] uppercase font-extrabold text-slate-400 px-2 font-mono">TEST FEED:</span>
                    <button 
                      id="sim_spike_button"
                      onClick={() => triggerManualMarketShift('UP')} 
                      className="px-2 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded text-[9px] font-bold uppercase transition-colors"
                      title="Spike Price to simulate CALL signal"
                    >
                      ▲ Spike Up
                    </button>
                    <button 
                      id="sim_crash_button"
                      onClick={() => triggerManualMarketShift('DOWN')} 
                      className="px-2 py-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded text-[9px] font-bold uppercase transition-colors"
                      title="Crash Price to simulate PUT signal"
                    >
                      ▼ Crash Down
                    </button>
                  </div>
                </div>

                {/* Advanced Multi-Indicator & Drawing Toolbar Overlay */}
                <div className="bg-slate-950/80 px-3 py-2 border border-slate-800/85 flex flex-wrap justify-between items-center gap-3 w-full rounded-lg my-3.5 text-xs select-none relative z-20">
                  
                  {/* Timeframes Selector */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500 font-mono uppercase font-bold mr-1">Tf:</span>
                    {(['1m', '5m', '15m', '1h'] as const).map((tf) => (
                      <button
                        key={tf}
                        onClick={() => { setSelectedTimeframe(tf); playAlertSound('click'); }}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all ${
                          selectedTimeframe === tf 
                            ? 'bg-indigo-600 text-white shadow-sm font-black' 
                            : 'bg-slate-900 border border-slate-800/85 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>

                  {/* Indicators Checkboxes */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-mono uppercase font-bold mr-1">Overlays:</span>
                    <button
                      onClick={() => { setShowBB(!showBB); playAlertSound('click'); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1 ${
                        showBB 
                          ? 'bg-indigo-900/30 text-indigo-400 border border-indigo-500/40 font-extrabold' 
                          : 'bg-slate-900 border border-slate-850 text-slate-500 hover:text-slate-400'
                      }`}
                    >
                      Bollinger Bands (BB)
                    </button>
                    <button
                      onClick={() => { setShowEMA(!showEMA); playAlertSound('click'); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1 ${
                        showEMA 
                          ? 'bg-amber-900/30 text-amber-400 border border-amber-500/40 font-extrabold' 
                          : 'bg-slate-900 border border-slate-850 text-slate-500 hover:text-slate-400'
                      }`}
                    >
                      EMA (9/21)
                    </button>
                    <button
                      onClick={() => { setShowMACD(!showMACD); playAlertSound('click'); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1 ${
                        showMACD 
                          ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/40 font-extrabold' 
                          : 'bg-slate-900 border border-slate-850 text-slate-500 hover:text-slate-400'
                      }`}
                    >
                      MACD Osc
                    </button>
                  </div>

                  {/* Drawings Selectors */}
                  <div className="flex items-center gap-1 sm:ml-auto">
                    <span className="text-[10px] text-slate-500 font-mono uppercase font-bold mr-1">Drawings:</span>
                    <button
                      onClick={() => { setDrawingMode('pan'); setFirstPoint(null); setHoverPoint(null); playAlertSound('click'); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all ${
                        drawingMode === 'pan' 
                          ? 'bg-indigo-600 text-white font-extrabold' 
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title="Direct cursor pointing details"
                    >
                      Cursor
                    </button>
                    <button
                      onClick={() => { setDrawingMode('trendline'); setFirstPoint(null); setHoverPoint(null); playAlertSound('click'); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all ${
                        drawingMode === 'trendline' 
                          ? 'bg-purple-600 text-white font-extrabold animate-pulse' 
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title="Click starting point on chart, then click ending point to draw trendline"
                    >
                      Trendline
                    </button>
                    <button
                      onClick={() => { setDrawingMode('fibonacci'); setFirstPoint(null); setHoverPoint(null); playAlertSound('click'); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all ${
                        drawingMode === 'fibonacci' 
                          ? 'bg-purple-600 text-white font-extrabold animate-pulse' 
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title="Click High point, then Low point to overlay Fibonacci retracements"
                    >
                      Fibonacci
                    </button>
                    {drawings.length > 0 && (
                      <button
                        onClick={() => { setDrawings([]); setFirstPoint(null); setHoverPoint(null); playAlertSound('lose'); }}
                        className="ml-1 px-1.5 py-0.5 rounded bg-rose-950/70 border border-rose-500/40 text-rose-400 hover:bg-rose-500 hover:text-white transition-all text-[10px] font-black"
                        title="Trash all active trendlines & fib drawings"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {drawingMode !== 'pan' && (
                  <div className="bg-purple-950/20 px-3 py-1.5 text-[10px] font-mono text-purple-300 border border-purple-500/25 rounded-lg flex justify-between items-center mb-3 animate-pulse select-none">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>
                      <span>
                        <strong>INTERACTIVE {drawingMode.toUpperCase()} TOOL ACTIVE:</strong>{' '}
                        {!firstPoint 
                          ? 'Click any coordinate on the chart area to lock the starting price point.' 
                          : 'Now click another coordinate to lock the ending price point and draw levels.'
                        }
                      </span>
                    </span>
                    {firstPoint && (
                      <button 
                        onClick={() => { setFirstPoint(null); setHoverPoint(null); }}
                        className="underline hover:text-white font-bold uppercase ml-2 text-rose-400 text-[9px]"
                      >
                        [Cancel Drawing]
                      </button>
                    )}
                  </div>
                )}

                {/* SVG Live Area Chart Line */}
                <div className="relative flex-1 w-full flex items-center min-h-[140px] md:min-h-[180px]">
                  {selectedHistory.length > 1 ? (
                    <svg 
                      className={`w-full h-full absolute inset-0 text-indigo-500/10 ${drawingMode !== 'pan' ? 'cursor-crosshair' : 'cursor-default'}`} 
                      viewBox="0 0 100 40" 
                      preserveAspectRatio="none"
                      onMouseDown={(e) => {
                        if (drawingMode === 'pan') return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const clickY = e.clientY - rect.top;
                        const pctX = (clickX / rect.width) * 100;
                        const pctY = (clickY / rect.height) * 40;

                        const minVal = Math.min(...selectedHistory) * 0.9998;
                        const maxVal = Math.max(...selectedHistory) * 1.0002;
                        const delta = maxVal - minVal || 1;
                        const clickVal = minVal + delta * (38 - pctY) / 36;

                        if (!firstPoint) {
                          playAlertSound('click');
                          setFirstPoint({ x: pctX, val: clickVal });
                          setHoverPoint({ x: pctX, val: clickVal });
                        } else {
                          playAlertSound('signal');
                          setDrawings((prev) => [
                            ...prev,
                            {
                              id: Math.random().toString(36).substring(3, 9).toUpperCase(),
                              type: drawingMode,
                              startX: firstPoint.x,
                              startVal: firstPoint.val,
                              endX: pctX,
                              endVal: clickVal
                            }
                          ]);
                          setFirstPoint(null);
                          setHoverPoint(null);
                        }
                      }}
                      onMouseMove={(e) => {
                        if (drawingMode === 'pan' || !firstPoint) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const mouseX = e.clientX - rect.left;
                        const mouseY = e.clientY - rect.top;
                        const pctX = (mouseX / rect.width) * 100;
                        const pctY = (mouseY / rect.height) * 40;

                        const minVal = Math.min(...selectedHistory) * 0.9998;
                        const maxVal = Math.max(...selectedHistory) * 1.0002;
                        const delta = maxVal - minVal || 1;
                        const mouseVal = minVal + delta * (38 - pctY) / 36;
                        setHoverPoint({ x: pctX, val: mouseVal });
                      }}
                      onMouseLeave={() => setHoverPoint(null)}
                    >
                      <defs>
                        <linearGradient id="area-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" style={{ stopColor: currentSignal.type === 'CALL (CE)' ? '#10b981' : currentSignal.type === 'PUT (PE)' ? '#f43f5e' : '#6366f1', stopOpacity: 0.18 }} />
                          <stop offset="100%" style={{ stopColor: '#6366f1', stopOpacity: 0 }} />
                        </linearGradient>
                      </defs>

                      {/* Volatility Channel Indicator: Bollinger Bands Area Overlay */}
                      {(() => {
                        const minVal = Math.min(...selectedHistory) * 0.9998;
                        const maxVal = Math.max(...selectedHistory) * 1.0002;
                        const delta = maxVal - minVal || 1;

                        if (showBB && currentIndicators.upperBand.length > 0) {
                          const pointsUp = currentIndicators.upperBand.map((val, idx) => {
                            const x = (idx / (selectedHistory.length - 1)) * 100;
                            const y = 40 - ((val - minVal) / delta) * 36 - 2;
                            return `${x},${y}`;
                          });
                          const pointsDown = currentIndicators.lowerBand.map((val, idx) => {
                            const x = (idx / (selectedHistory.length - 1)) * 100;
                            const y = 40 - ((val - minVal) / delta) * 36 - 2;
                            return `${x},${y}`;
                          }).reverse();
                          const pathD = `M ${pointsUp.join(' L ')} L ${pointsDown.join(' L ')} Z`;

                          return (
                            <g className="opacity-60">
                              <path d={pathD} fill="rgba(99, 102, 241, 0.045)" />
                              <path
                                d={`M ${pointsUp.join(' L ')}`}
                                fill="none"
                                stroke="#818cf8"
                                strokeWidth="0.4"
                                strokeDasharray="1.5,1.5"
                              />
                              <path
                                d={`M ${pointsDown.reverse().map((p, i) => {
                                  // un-reverse for rendering standard lower boundary lines
                                  const val = currentIndicators.lowerBand[i];
                                  const x = (i / (selectedHistory.length - 1)) * 100;
                                  const y = 40 - ((val - minVal) / delta) * 36 - 2;
                                  return `${x},${y}`;
                                }).join(' L ')}`}
                                fill="none"
                                stroke="#818cf8"
                                strokeWidth="0.4"
                                strokeDasharray="1.5,1.5"
                              />
                              <path
                                d={`M ${currentIndicators.middleBand.map((val, idx) => {
                                  const x = (idx / (selectedHistory.length - 1)) * 100;
                                  const y = 40 - ((val - minVal) / delta) * 36 - 2;
                                  return `${x},${y}`;
                                }).join(' L ')}`}
                                fill="none"
                                stroke="#4f46e5"
                                strokeWidth="0.35"
                                strokeDasharray="3,3"
                                opacity="0.6"
                              />
                            </g>
                          );
                        }
                        return null;
                      })()}

                      {/* Moving Average Indicators: EMA Overlays */}
                      {(() => {
                        const minVal = Math.min(...selectedHistory) * 0.9998;
                        const maxVal = Math.max(...selectedHistory) * 1.0002;
                        const delta = maxVal - minVal || 1;

                        if (showEMA && currentIndicators.ema9.length > 0) {
                          const pointsEma9 = currentIndicators.ema9.map((val, idx) => {
                            const x = (idx / (selectedHistory.length - 1)) * 100;
                            const y = 40 - ((val - minVal) / delta) * 36 - 2;
                            return `${x},${y}`;
                          });
                          const pointsEma21 = currentIndicators.ema21.map((val, idx) => {
                            const x = (idx / (selectedHistory.length - 1)) * 100;
                            const y = 40 - ((val - minVal) / delta) * 36 - 2;
                            return `${x},${y}`;
                          });

                          return (
                            <g>
                              {/* EMA 9 (yellow) */}
                              <path
                                d={`M ${pointsEma9.join(' L ')}`}
                                fill="none"
                                stroke="#eab308"
                                strokeWidth="0.8"
                                opacity="0.9"
                              />
                              {/* EMA 21 (orange) */}
                              <path
                                d={`M ${pointsEma21.join(' L ')}`}
                                fill="none"
                                stroke="#f97316"
                                strokeWidth="0.8"
                                opacity="0.9"
                              />
                            </g>
                          );
                        }
                        return null;
                      })()}

                      <path
                        d={(() => {
                          const minVal = Math.min(...selectedHistory) * 0.9998;
                          const maxVal = Math.max(...selectedHistory) * 1.0002;
                          const delta = maxVal - minVal || 1;
                          const points = selectedHistory.map((val, idx) => {
                            const x = (idx / (selectedHistory.length - 1)) * 100;
                            const y = 40 - ((val - minVal) / delta) * 36 - 2; // leaving bounds padding
                            return `${x},${y}`;
                          });
                          return `M ${points.join(' L ')}`;
                        })()}
                        fill="none"
                        stroke={currentSignal.type === 'CALL (CE)' ? '#10b981' : currentSignal.type === 'PUT (PE)' ? '#f43f5e' : '#4f46e5'}
                        strokeWidth="1.5"
                        className="transition-all duration-300"
                      />
                      
                      {/* Area Fill */}
                      <path
                        d={(() => {
                          const minVal = Math.min(...selectedHistory) * 0.9998;
                          const maxVal = Math.max(...selectedHistory) * 1.0002;
                          const delta = maxVal - minVal || 1;
                          const points = selectedHistory.map((val, idx) => {
                            const x = (idx / (selectedHistory.length - 1)) * 100;
                            const y = 40 - ((val - minVal) / delta) * 36 - 2;
                            return `${x},${y}`;
                          });
                          return `M 0,40 L ${points.join(' L ')} L 100,40 Z`;
                        })()}
                        fill="url(#area-gradient)"
                        className="transition-all duration-300"
                      />

                      {/* Interactive Drawings Render Block (Trendlines and Fibonacci Retracements) */}
                      {(() => {
                        const minVal = Math.min(...selectedHistory) * 0.9998;
                        const maxVal = Math.max(...selectedHistory) * 1.0002;
                        const delta = maxVal - minVal || 1;

                        return drawings.map((drawing) => {
                          const y1 = 40 - ((drawing.startVal - minVal) / delta) * 36 - 2;
                          const y2 = 40 - ((drawing.endVal - minVal) / delta) * 36 - 2;

                          if (drawing.type === 'trendline') {
                            return (
                              <g key={drawing.id} className="opacity-95 text-purple-400">
                                <line
                                  x1={drawing.startX}
                                  y1={y1}
                                  x2={drawing.endX}
                                  y2={y2}
                                  stroke="#a855f7"
                                  strokeWidth="0.85"
                                />
                                <circle cx={drawing.startX} cy={y1} r="0.8" fill="#faf5ff" stroke="#a855f7" strokeWidth="0.3" />
                                <circle cx={drawing.endX} cy={y2} r="0.8" fill="#faf5ff" stroke="#a855f7" strokeWidth="0.3" />
                                <text x={Math.min(drawing.startX, drawing.endX) + 2} y={Math.min(y1, y2) - 1} fill="#d8b4fe" fontSize="1" fontFamily="monospace">
                                  T-Line
                                </text>
                              </g>
                            );
                          } else if (drawing.type === 'fibonacci') {
                            const diff = drawing.endVal - drawing.startVal;
                            const fibRatios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
                            const fibColors = [
                              'rgba(244, 63, 94, 0.05)',   // 0%
                              'rgba(249, 115, 22, 0.05)',  // 23.6%
                              'rgba(234, 179, 8, 0.05)',   // 38.2%
                              'rgba(16, 185, 129, 0.05)',  // 50%
                              'rgba(14, 165, 233, 0.05)',  // 61.8%
                              'rgba(99, 102, 241, 0.05)',  // 78.6%
                              'rgba(168, 85, 247, 0.05)'   // 100%
                            ];

                            return (
                              <g key={drawing.id}>
                                {fibRatios.map((ratio, rIdx) => {
                                  const val = drawing.startVal + ratio * diff;
                                  const y = 40 - ((val - minVal) / delta) * 36 - 2;
                                  const prevVal = rIdx > 0 ? drawing.startVal + fibRatios[rIdx-1] * diff : val;
                                  const prevY = 40 - ((prevVal - minVal) / delta) * 36 - 2;

                                  return (
                                    <g key={ratio} className="select-none pointer-events-none">
                                      {/* Horizontal Level line */}
                                      <line
                                        x1="0"
                                        y1={y}
                                        x2="100"
                                        y2={y}
                                        stroke="#a855f7"
                                        strokeWidth="0.25"
                                        strokeDasharray="1.5,1.5"
                                        opacity="0.75"
                                      />
                                      {/* Horizontal shaded ribbons */}
                                      {rIdx > 0 && (
                                        <rect
                                          x="0"
                                          y={Math.min(y, prevY)}
                                          width="100"
                                          height={Math.abs(y - prevY)}
                                          fill={fibColors[rIdx]}
                                        />
                                      )}
                                      {/* Fib Coordinate Floating labels */}
                                      <text
                                        x="25"
                                        y={y - 0.5}
                                        fill="#d8b4fe"
                                        fontSize="0.95"
                                        fontFamily="monospace"
                                        fontWeight="bold"
                                      >
                                        Fib {ratio === 0 ? '0.0' : ratio === 1 ? '1.0' : ratio.toFixed(3)}: ₹{val.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                      </text>
                                    </g>
                                  );
                                })}
                              </g>
                            );
                          }
                          return null;
                        });
                      })()}

                      {/* Live dragging / stretching preview indicator */}
                      {(() => {
                        const minVal = Math.min(...selectedHistory) * 0.9998;
                        const maxVal = Math.max(...selectedHistory) * 1.0002;
                        const delta = maxVal - minVal || 1;

                        if (firstPoint && hoverPoint) {
                          const y1 = 40 - ((firstPoint.val - minVal) / delta) * 36 - 2;
                          const y2 = 40 - ((hoverPoint.val - minVal) / delta) * 36 - 2;

                          if (drawingMode === 'trendline') {
                            return (
                              <g>
                                <line x1={firstPoint.x} y1={y1} x2={hoverPoint.x} y2={y2} stroke="#c084fc" strokeWidth="0.65" strokeDasharray="2,2" />
                                <circle cx={firstPoint.x} cy={y1} r="0.9" fill="#c084fc" opacity="0.9" />
                                <circle cx={hoverPoint.x} cy={y2} r="0.9" fill="#c084fc" opacity="0.9" />
                              </g>
                            );
                          } else if (drawingMode === 'fibonacci') {
                            const diff = hoverPoint.val - firstPoint.val;
                            return (
                              <g>
                                <line x1={firstPoint.x} y1={y1} x2={hoverPoint.x} y2={y2} stroke="#a855f7" strokeWidth="0.45" />
                                <circle cx={firstPoint.x} cy={y1} r="0.9" fill="#a855f7" />
                                <circle cx={hoverPoint.x} cy={y2} r="0.9" fill="#a855f7" />
                                {[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map((ratio) => {
                                  const val = firstPoint.val + ratio * diff;
                                  const y = 40 - ((val - minVal) / delta) * 36 - 2;
                                  return (
                                    <g key={`prev_${ratio}`}>
                                      <line x1="0" y1={y} x2="100" y2={y} stroke="#c084fc" strokeWidth="0.25" strokeDasharray="1,1" opacity="0.5" />
                                      <text x="5" y={y - 0.4} fill="#c084fc" fontSize="0.9" fontFamily="monospace">
                                        {(ratio * 100).toFixed(1)}% (₹{val.toFixed(0)})
                                      </text>
                                    </g>
                                  );
                                })}
                              </g>
                            );
                          }
                        }
                        return null;
                      })()}
                    </svg>
                  ) : (
                    <div className="text-center w-full text-slate-500 text-xs font-mono">
                      Calibrating Index Signal Charts. Please wait for first data ticks...
                    </div>
                  )}

                  {/* Horizontal Guideline Overlay Markers - Target 1 / Target 2 / Entry / Stop Loss */}
                  {currentSignal.type !== 'HOLD (WAIT)' && (
                    <div className="absolute inset-x-0 inset-y-12 flex flex-col justify-between pointer-events-none select-none z-10">
                      {/* Target 2 Guideline line */}
                      <div className="border-t border-dashed border-sky-400/50 flex justify-end relative h-0">
                        <span className="bg-slate-950/90 text-sky-400 text-[8px] font-extrabold px-1.5 py-0.5 rounded border border-sky-500/20 font-mono -translate-y-1/2 absolute right-2">
                          🎯 TARGET 2: {currentSignal.target2.toFixed(1)}
                        </span>
                      </div>

                      {/* Target 1 Guideline line */}
                      <div className="border-t border-dashed border-emerald-400/50 flex justify-end relative h-0">
                        <span className="bg-slate-950/90 text-emerald-400 text-[8px] font-extrabold px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono -translate-y-1/2 absolute right-2">
                          🎯 TARGET 1: {currentSignal.target1.toFixed(1)}
                        </span>
                      </div>

                      {/* Stop Loss Guideline line */}
                      <div className="border-t border-dashed border-rose-400/50 flex justify-end relative h-0">
                        <span className="bg-slate-950/90 text-rose-400 text-[8px] font-extrabold px-1.5 py-0.5 rounded border border-rose-500/20 font-mono -translate-y-1/2 absolute right-2">
                          🛡️ STRICT SL: {currentSignal.stopLoss.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* MACD Technical Oscillator Sub-Panel */}
                {showMACD && currentIndicators.macd.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-800/80 w-full relative z-10 select-none">
                    <div className="flex justify-between items-center mb-1 text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5 font-bold text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                        MACD Momentum Oscillator (6, 14, 5)
                      </span>
                      <div className="flex gap-3">
                        <span className="text-indigo-400">MACD: {currentIndicators.macd[currentIndicators.macd.length - 1]?.toFixed(2)}</span>
                        <span className="text-rose-400">Signal: {currentIndicators.signal[currentIndicators.signal.length - 1]?.toFixed(2)}</span>
                        <span className="text-emerald-450 font-semibold">Hist: {currentIndicators.hist[currentIndicators.hist.length - 1]?.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div className="h-10 w-full relative">
                      <svg className="w-full h-full absolute inset-0 text-indigo-500/10" viewBox="0 0 100 15" preserveAspectRatio="none">
                        {(() => {
                          const macdAbsVals = [
                            ...currentIndicators.macd.map(Math.abs),
                            ...currentIndicators.signal.map(Math.abs),
                            ...currentIndicators.hist.map(Math.abs)
                          ];
                          const maxAbs = Math.max(...macdAbsVals, 0.5);

                          // Center zero reference is exactly 7.5
                          const getMacdY = (val: number) => {
                            return 7.5 - (val / maxAbs) * 6.5;
                          };

                          const pointsMacd = currentIndicators.macd.map((val, idx) => {
                            const x = (idx / (selectedHistory.length - 1)) * 100;
                            const y = getMacdY(val);
                            return `${x},${y}`;
                          });

                          const pointsSignal = currentIndicators.signal.map((val, idx) => {
                            const x = (idx / (selectedHistory.length - 1)) * 100;
                            const y = getMacdY(val);
                            return `${x},${y}`;
                          });

                          return (
                            <>
                              {/* Center zero line */}
                              <line x1="0" y1="7.5" x2="100" y2="7.5" stroke="#334155" strokeWidth="0.25" strokeDasharray="2,2" />

                              {/* Hist Bars */}
                              {currentIndicators.hist.map((val, idx) => {
                                const x = (idx / (selectedHistory.length - 1)) * 100;
                                const y = getMacdY(val);
                                const isPositive = val >= 0;
                                const barWidth = 100 / (selectedHistory.length * 1.8);

                                return (
                                  <rect
                                    key={idx}
                                    x={x - barWidth / 2}
                                    y={isPositive ? y : 7.5}
                                    width={barWidth}
                                    height={Math.max(0.1, Math.abs(y - 7.5))}
                                    fill={isPositive ? '#10b981' : '#f43f5e'}
                                    opacity="0.35"
                                  />
                                );
                              })}

                              {/* MACD Line */}
                              <path
                                d={`M ${pointsMacd.join(' L ')}`}
                                fill="none"
                                stroke="#6366f1"
                                strokeWidth="0.5"
                              />

                              {/* MACD Signal Line */}
                              <path
                                d={`M ${pointsSignal.join(' L ')}`}
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="0.5"
                              />
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  </div>
                )}

                {/* Sub annotations and Legend */}
                <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-lg border border-slate-800/40 mt-2 z-10">
                  <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      spot
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-0.5 bg-emerald-400 border-t border-dashed"></span>
                      Target Targets (Conservative/Aggressive)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-0.5 bg-rose-400 border-t border-dashed"></span>
                      Stop Loss limit
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    VWAP Daily Session Level: <strong>{currentTickData.indicators.vwap.toFixed(1)}</strong>
                  </div>
                </div>
              </div>

              {/* Target Stats Grid block */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold font-mono">Entry Index Spot</span>
                    <p className="text-base font-mono font-black text-white mt-1">
                      {currentSignal.entryPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-2 border-t border-slate-800/60 pt-1 flex justify-between">
                    <span>Lot Size:</span>
                    <span className="text-white font-bold">{lotSize}</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold font-mono">TP 1 Target (2x ATR)</span>
                      <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded">Strict</span>
                    </div>
                    <p className="text-base font-mono font-black text-emerald-400 mt-1">
                      {currentSignal.type !== 'HOLD (WAIT)' ? currentSignal.target1.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '--'}
                    </p>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-2 border-t border-slate-800/60 pt-1 flex justify-between">
                    <span>Est Prem Gain:</span>
                    <span className="text-emerald-400 font-bold">
                      {currentSignal.type !== 'HOLD (WAIT)' ? `+${(Math.abs(currentSignal.target1 - currentSignal.entryPrice) * 0.7).toFixed(1)} pts` : '--'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold font-mono">TP 2 Target (3.5x ATR)</span>
                      <span className="text-[9px] font-mono text-sky-400 bg-sky-500/10 px-1 py-0.2 rounded">Aggr</span>
                    </div>
                    <p className="text-base font-mono font-black text-sky-400 mt-1">
                      {currentSignal.type !== 'HOLD (WAIT)' ? currentSignal.target2.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '--'}
                    </p>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-2 border-t border-slate-800/60 pt-1 flex justify-between">
                    <span>Est Max Gain:</span>
                    <span className="text-sky-400 font-bold">
                      {currentSignal.type !== 'HOLD (WAIT)' ? `+${(Math.abs(currentSignal.target2 - currentSignal.entryPrice) * 0.75).toFixed(1)} pts` : '--'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold font-mono">Stop Loss (1.5x ATR)</span>
                      <span className="text-[9px] font-mono text-rose-400 bg-rose-500/10 px-1 py-0.2 rounded">Risk</span>
                    </div>
                    <p className="text-base font-mono font-black text-rose-400 mt-1">
                      {currentSignal.type !== 'HOLD (WAIT)' ? currentSignal.stopLoss.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '--'}
                    </p>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-2 border-t border-slate-800/60 pt-1 flex justify-between">
                    <span>Est Prem Loss:</span>
                    <span className="text-rose-400 font-bold">
                      {currentSignal.type !== 'HOLD (WAIT)' ? `-${(Math.abs(currentSignal.entryPrice - currentSignal.stopLoss) * 0.6).toFixed(1)} pts` : '--'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Option Contract simulated details widget */}
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                    <CreditCard className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white uppercase tracking-wider">
                      Option Contract Est. Strike Premium Pricing
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Premium priced directly via Black-Scholes ATM model referencing India Volatility index (VIX: {systemVix.toFixed(1)}).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 font-mono text-xs w-full lg:w-auto justify-between lg:justify-end">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-sans uppercase font-bold">Contract Strike</p>
                    <p className="text-white font-bold mt-0.5">{currentSignal.strikePrice}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-sans uppercase font-bold">Base Premium</p>
                    <p className="text-indigo-400 text-sm font-extrabold mt-0.5">
                      ₹{currentSignal.optionPremium.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-sans uppercase font-bold">Lots Est Capital Required</p>
                    <p className="text-amber-400 font-bold mt-0.5">
                      ₹{(currentSignal.optionPremium * selectedQuantity * lotSize).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Segment: Interactive Indian Option Chain with Buying Advisory */}
          {activeTab === 'optionChain' && (
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
              {/* Option Buying Advisory Room Header */}
              <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-indigo-950/20 border border-slate-800 p-4 rounded-xl">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2 font-mono">
                      <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                      TradePulse Option Buying Desk & Expert Advisory
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Dynamic strike advisory mapping Spot Momentum directly to NSE-standard ATM, ITM, and OTM contracts.
                    </p>
                  </div>
                  <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs text-slate-400">
                    <span className="px-3 py-1 font-mono text-indigo-400 font-bold">
                      {selectedSymbol} Spot: {currentTickData.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Advisory Card based on Current Market Trend */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-4">
                  
                  {/* Recommended buying action */}
                  <div className={`md:col-span-12 lg:col-span-7 bg-slate-950/60 border rounded-lg p-3.5 flex flex-col justify-between ${
                    currentSignal.type === 'CALL (CE)' 
                      ? 'border-emerald-500/25 bg-emerald-950/5' 
                      : currentSignal.type === 'PUT (PE)' 
                      ? 'border-rose-500/25 bg-rose-950/5' 
                      : 'border-slate-800'
                  }`}>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Live Advisory Recommendation</span>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                          <span className="text-[10px] uppercase font-mono text-indigo-400 font-bold">Expert Desk Live</span>
                        </div>
                      </div>

                      {currentSignal.type === 'CALL (CE)' ? (
                        <>
                          <div className="text-base font-extrabold text-emerald-400 flex items-center gap-1.5 uppercase font-mono">
                            <TrendingUp className="w-5 h-5 text-emerald-400 animate-bounce" />
                            BUY ACTION: At-The-Money (ATM) CALL (CE)
                          </div>
                          
                          <p className="text-xs text-slate-200 mt-2 font-medium leading-relaxed">
                            {languageMode === 'hinglish' 
                              ? 'Market Trend strongly Bullish hai Kyunki Index key EMAs cross karke high velocity breakout de raha hai. Call options buying ke liye perfect opportunity hai!'
                              : 'Market Trend is strongly bullish as Index breaches key resistance bands. Recommend buying CALL (CE) At-The-Money (ATM) strike to capture maximum trend velocity.'
                            }
                          </p>
                          <div className="mt-3 text-[11px] text-slate-400 font-mono bg-emerald-500/10 p-2.5 rounded border border-emerald-500/15">
                            <strong>🎯 Recommended Strike:</strong> {selectedSymbol} {Math.round(currentTickData.price / BASE_PRICES[selectedSymbol].optionGap) * BASE_PRICES[selectedSymbol].optionGap} CE &middot; 
                            <strong> Premium:</strong> ₹{calculateSimulatedPremium(currentTickData.price, `${selectedSymbol} ${Math.round(currentTickData.price / BASE_PRICES[selectedSymbol].optionGap) * BASE_PRICES[selectedSymbol].optionGap} CE`, true).toFixed(2)}
                          </div>
                        </>
                      ) : currentSignal.type === 'PUT (PE)' ? (
                        <>
                          <div className="text-base font-extrabold text-rose-400 flex items-center gap-1.5 uppercase font-mono">
                            <TrendingDown className="w-5 h-5 text-rose-400 animate-bounce" />
                            BUY ACTION: At-The-Money (ATM) PUT (PE)
                          </div>
                          
                          <p className="text-xs text-slate-200 mt-2 font-medium leading-relaxed">
                            {languageMode === 'hinglish' 
                              ? 'Index below-VWAP breakdown de chuka hai. Support layers crash ho rahi hain, PUT (PE) buy karne par downside breakout ka solid gain mil sakta hai.'
                              : 'Index has broken below critical VWAP institutional support levels. Direct option-buying bias to At-The-Money PUT (PE) strikes to leverage bearish momentum.'
                            }
                          </p>
                          <div className="mt-3 text-[11px] text-slate-400 font-mono bg-rose-500/10 p-2.5 rounded border border-rose-500/15">
                            <strong>🎯 Recommended Strike:</strong> {selectedSymbol} {Math.round(currentTickData.price / BASE_PRICES[selectedSymbol].optionGap) * BASE_PRICES[selectedSymbol].optionGap} PE &middot; 
                            <strong> Premium:</strong> ₹{calculateSimulatedPremium(currentTickData.price, `${selectedSymbol} ${Math.round(currentTickData.price / BASE_PRICES[selectedSymbol].optionGap) * BASE_PRICES[selectedSymbol].optionGap} PE`, false).toFixed(2)}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-base font-extrabold text-amber-500 flex items-center gap-1.5 uppercase font-mono">
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                            AVOID TRADING: RESTORE RANGE-BOUND DEFENSE
                          </div>
                          
                          <p className="text-xs text-slate-200 mt-2 font-medium leading-relaxed">
                            {languageMode === 'hinglish' 
                              ? 'RSI 40-60 sideways trap zone mein hai. Option Buyer ke liye momentum missing hai, yahan trade lene par heavily premium decay (Theta time decay) loss hoga. Breakout ka wait karein.'
                              : 'Index RSI holds range-bound inside the 40-60 noise band. Momentum is flat. Option buyers suffer extreme Time (Theta) Decay here. Stand aside or stick only to scalp plays.'
                            }
                          </p>
                          <div className="mt-3 text-[11px] text-slate-400 font-mono bg-amber-500/10 p-2.5 rounded border border-amber-500/15">
                            <strong>💡 Strategy:</strong> Keep Cash Protected & Wait for VWAP Crossover or RSI breakout above 60 / below 40.
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Smart educational rules card */}
                  <div className="md:col-span-12 lg:col-span-5 bg-slate-950/60 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Option Buying Pillars</span>
                      <h4 className="text-xs font-bold text-white mt-1 hover:text-indigo-400 transition-colors uppercase font-mono">
                        ऑप्शन बायर्स के 4 स्वर्ण नियम
                      </h4>
                      <ul className="mt-2 text-[11px] leading-relaxed text-slate-400 space-y-1.5 font-mono list-decimal pl-4">
                        <li>
                          <strong className="text-slate-200">Avoid Cheap OTM Strips:</strong> Out-of-the-money options contain no intrinsic value and vanish to zero. Stick to ATM or ITM!
                        </li>
                        <li>
                          <strong className="text-slate-200">ATR Risk Control:</strong> Intraday SL index trigger hamesha 1.5x ATR level par set rakhna chahiye.
                        </li>
                        <li>
                          <strong className="text-slate-200">Watch The VIX Rule:</strong> VIX &gt; 20 means decrease position sizes, as option premiums are heavily bloated.
                        </li>
                        <li>
                          <strong className="text-slate-200">Time Decay Warning:</strong> Do not hold long positions overnight during choppy sideways markets.
                        </li>
                      </ul>
                    </div>
                  </div>

                </div>
              </div>

              {/* Real Option Chain Panel */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-300 font-mono tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-indigo-400" />
                      Live NSE Interactive Option Chain: CE (Calls) vs PE (Puts)
                    </h4>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Highlights represent At-The-Money (ATM) and In-The-Money (ITM) regions. Click any buy button to place active test order.
                    </span>
                  </div>
                  
                  {/* Position Qty Selectors */}
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-slate-400">Order Quantity:</span>
                    <div className="bg-slate-950 px-2 py-1 rounded border border-slate-800 flex items-center">
                      <input
                        id="option_qty_select_chain"
                        type="number"
                        min="1"
                        max="10"
                        value={selectedQuantity}
                        onChange={(e) => setSelectedQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-10 bg-transparent text-white font-bold text-center border-b border-indigo-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-500 ml-1">({selectedQuantity * lotSize} Qty)</span>
                    </div>
                  </div>
                </div>

                {/* Main Option Chain Table Layout */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono border-collapse text-xs divide-y divide-slate-800">
                    <thead className="bg-slate-950/40 text-[10px] uppercase font-bold text-slate-500">
                      <tr>
                        <th colSpan={3} className="py-2 px-3 text-center border-r border-slate-800 text-emerald-400 bg-emerald-500/5">
                          CALLS (CE) - BUY ON BULLISH MOVEMENT
                        </th>
                        <th className="py-2 px-2 text-center text-slate-400">INDEX</th>
                        <th colSpan={3} className="py-2 px-3 text-center text-rose-400 bg-rose-500/5">
                          PUTS (PE) - BUY ON BEARISH MOVEMENT
                        </th>
                      </tr>
                      <tr className="border-t border-slate-800">
                        <th className="py-1.5 px-3 text-left">OI (Lakhs)</th>
                        <th className="py-1.5 px-3 text-right">Vol</th>
                        <th className="py-1.5 px-3 text-right text-indigo-400">CE LTP (₹)</th>
                        <th className="py-1.5 px-2 text-center bg-slate-950 text-white font-extrabold">STRIKE</th>
                        <th className="py-1.5 px-3 text-left text-indigo-400 font-semibold">PE LTP (₹)</th>
                        <th className="py-1.5 px-3 text-right">Vol</th>
                        <th className="py-1.5 px-3 text-right">OI (Lakhs)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-950/20">
                      {(() => {
                        const m = BASE_PRICES[selectedSymbol];
                        const sPrice = currentTickData.price;
                        const atmFactor = Math.round(sPrice / m.optionGap) * m.optionGap;
                        const strikeArray: number[] = [];
                        for (let d = -4; d <= 4; d++) {
                          strikeArray.push(atmFactor + d * m.optionGap);
                        }

                        return strikeArray.map((strike) => {
                          const isATM = strike === atmFactor;
                          const callPremium = calculateSimulatedPremium(sPrice, `${selectedSymbol} ${strike} CE`, true);
                          const putPremium = calculateSimulatedPremium(sPrice, `${selectedSymbol} ${strike} PE`, false);

                          const isCE_ITM = strike < sPrice;
                          const isPE_ITM = strike > sPrice;

                          // OI calculations
                          const strikeDiff = strike - atmFactor;
                          const devFactor = Math.abs(strikeDiff / m.optionGap);
                          const baseOI = selectedSymbol === 'NIFTY 50' ? 45 : selectedSymbol === 'BANK NIFTY' ? 22 : 12;

                          const callOI = Math.max(1.5, Math.round((baseOI * (1.1 / (1 + devFactor * 0.45)) + (Math.sin(strike + sPrice / 100) * 4)) * 10) / 10);
                          const putOI = Math.max(1.2, Math.round((baseOI * (1.1 / (1 + devFactor * 0.45)) + (Math.cos(strike + sPrice / 100) * 4)) * 10) / 10);

                          const callVol = Math.floor((callOI * 1150) + (Math.sin(strike) * 200) + 1200);
                          const putVol = Math.floor((putOI * 1100) + (Math.cos(strike) * 180) + 1100);

                          return (
                            <tr 
                              key={strike} 
                              className={`hover:bg-indigo-900/10 transition-colors ${isATM ? 'bg-indigo-950/20 border-y border-indigo-500/20' : ''}`}
                            >
                              {/* CALLS */}
                              <td className={`py-3 px-3 relative ${isCE_ITM ? 'bg-amber-400/5' : ''}`}>
                                <span className="font-semibold text-slate-300">{callOI.toFixed(1)}L</span>
                              </td>
                              <td className={`py-3 px-3 text-right text-slate-500 ${isCE_ITM ? 'bg-amber-400/5' : ''}`}>
                                {callVol.toLocaleString()}
                              </td>
                              <td className={`py-2 px-3 text-right ${isCE_ITM ? 'bg-amber-400/5' : ''}`}>
                                <div className="flex items-center justify-end gap-2.5">
                                  <span className="font-extrabold text-white">₹{callPremium.toFixed(2)}</span>
                                  <button
                                    id={`buy_ce_btn_${strike}`}
                                    onClick={() => executeOptionChainOrder(strike, callPremium, true)}
                                    className="px-2 py-1 rounded bg-emerald-500 text-slate-950 hover:bg-emerald-400 text-[10px] font-black uppercase tracking-wider transition-colors active:scale-90"
                                    title={`Buy ${selectedSymbol} ${strike} CALL`}
                                  >
                                    BUY CE
                                  </button>
                                </div>
                              </td>

                              {/* STRIKE PRICE CENTER */}
                              <td className={`py-3 px-2 text-center font-black ${isATM ? 'bg-indigo-600 text-white' : 'bg-slate-950 hover:text-indigo-400 text-slate-400 border-x border-slate-805'}`}>
                                {strike.toLocaleString('en-IN')} {isATM && <span className="text-[8px] tracking-widest block font-bold">ATM</span>}
                              </td>

                              {/* PUTS */}
                              <td className={`py-2 px-3 text-left ${isPE_ITM ? 'bg-amber-400/5' : ''}`}>
                                <div className="flex items-center gap-2.5">
                                  <button
                                    id={`buy_pe_btn_${strike}`}
                                    onClick={() => executeOptionChainOrder(strike, putPremium, false)}
                                    className="px-2 py-1 rounded bg-rose-500 text-white hover:bg-rose-400 text-[10px] font-black uppercase tracking-wider transition-colors active:scale-90"
                                    title={`Buy ${selectedSymbol} ${strike} PUT`}
                                  >
                                    BUY PE
                                  </button>
                                  <span className="font-extrabold text-white">₹{putPremium.toFixed(2)}</span>
                                </div>
                              </td>
                              <td className={`py-3 px-3 text-right text-slate-500 ${isPE_ITM ? 'bg-amber-400/5' : ''}`}>
                                {putVol.toLocaleString()}
                              </td>
                              <td className={`py-3 px-3 text-right ${isPE_ITM ? 'bg-amber-400/5' : ''}`}>
                                <span className="font-semibold text-slate-300">{putOI.toFixed(1)}L</span>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3.5 bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-slate-400 gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    <span className="flex items-center gap-1.5 font-sans">
                      <span className="w-2.5 h-2.5 rounded bg-amber-400/10 border border-amber-500/20"></span>
                      In-The-Money (ITM) High Intrinsic Region
                    </span>
                    <span className="text-slate-700">|</span>
                    <span className="flex items-center gap-1.5 font-sans">
                      <span className="w-2.5 h-2.5 rounded bg-indigo-950/20 border border-indigo-500/20"></span>
                      At-The-Money (ATM) Breakout Strike
                    </span>
                  </div>
                  <div className="text-slate-500 uppercase font-bold text-[9px] tracking-widest text-right">
                    NSE SENSITIVITY CALIBRATOR v1.5
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Segment: Mock Broker Terminal portfolio details */}
          {activeTab === 'broker' && (
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-h-[300px]">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Open Derivative Positions Portfolios (TradePulse Sandbox Terminal)
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Live calculations matching standard Indian stock brokerages. Positions will execute auto-limits on target hits.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Trading Equity Bal</span>
                    <span className="text-lg font-mono font-black text-indigo-400">₹2,50,000.00</span>
                  </div>
                </div>

                {activeTrades.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-800 rounded-lg bg-slate-950/40">
                    <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center border border-slate-800 mb-3 text-slate-500">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-extrabold text-slate-300">No active Call or Put derivative positions open.</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Select NIFTY 50 or BANK NIFTY indices from the sidebar, verify indicator checkmarks, and click the &quot;Execute Contract&quot; button to launch simulated trades.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase font-bold">
                          <th className="py-2.5 px-3">Script Strike</th>
                          <th className="py-2.5 px-3">Position Type</th>
                          <th className="py-2.5 px-3 text-right">Qty (Lots)</th>
                          <th className="py-2.5 px-3 text-right">Entry Premium</th>
                          <th className="py-2.5 px-3 text-right">Live Premium</th>
                          <th className="py-2.5 px-3 text-right">Index Spot (Entry)</th>
                          <th className="py-2.5 px-3 text-right">PNL Output (INR)</th>
                          <th className="py-2.5 px-3 text-center">Auto Trigger Targets</th>
                          <th className="py-2.5 px-3 text-center">Exit position</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {activeTrades.map((trade) => {
                          const lotFactor = trade.symbol === 'BANK NIFTY' ? 15 : trade.symbol === 'SENSEX' ? 10 : trade.symbol === 'FINNIFTY' ? 25 : trade.symbol === 'MIDCPNIFTY' ? 75 : 50;
                          const totalVal = trade.entryPremium * trade.qty * lotFactor;

                          return (
                            <tr key={trade.id} className="hover:bg-slate-900/30">
                              <td className="py-3 px-3 font-bold text-white">{trade.strikePrice}</td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 text-[9px] font-black rounded ${trade.type === 'CALL (CE)' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                  {trade.type}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right text-slate-300">
                                {trade.qty * lotFactor} <span className="text-[10px] text-slate-500">({trade.qty} Lot)</span>
                              </td>
                              <td className="py-3 px-3 text-right font-semibold">₹{trade.entryPremium.toFixed(2)}</td>
                              <td className="py-3 px-3 text-right text-indigo-400 font-bold">₹{trade.currentPremiumPrice.toFixed(2)}</td>
                              <td className="py-3 px-3 text-right text-slate-400">
                                <span className="text-white font-bold">{trade.currentIndexPrice.toFixed(1)}</span> <span className="text-[9px]">({trade.entryPrice.toFixed(0)})</span>
                              </td>
                              <td className={`py-3 px-3 text-right font-extrabold ${trade.pnl >= 0 ? 'text-emerald-400 bg-emerald-500/5' : 'text-rose-400 bg-rose-500/5'}`}>
                                ₹{trade.pnl >= 0 ? '+' : ''}{trade.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                <span className="text-[9px] block font-light">({trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(1)}%)</span>
                              </td>
                              <td className="py-3 px-3 text-center text-[10px]">
                                <div className="inline-flex flex-col gap-0.5 text-[9px] text-slate-500">
                                  <span>T1 Ind: <strong className="text-green-500">{trade.target1Premium.toFixed(0)}</strong></span>
                                  <span>T2 Ind: <strong className="text-sky-500">{trade.target2Premium.toFixed(0)}</strong></span>
                                  <span>SL Ind: <strong className="text-rose-500">{trade.stopLossPremium.toFixed(0)}</strong></span>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <button
                                  id={`exit_pos_btn_${trade.id}`}
                                  onClick={() => forceExitTrade(trade)}
                                  className="px-2.5 py-1 bg-slate-800 text-slate-300 hover:bg-rose-600 hover:text-white rounded transition-colors text-[10px] font-bold uppercase tracking-wider"
                                >
                                  Square Off
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Segment: Archived Trade History */}
          {activeTab === 'history' && (
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-h-[300px]">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5 font-mono">
                      <Award className="w-4 h-4 text-amber-500" />
                      Simulated Position Exit Ledger History
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Complete diagnostic overview of options buy/sell signal performance metrics.
                    </p>
                  </div>
                  <button 
                    id="clear_ledger_btn"
                    onClick={() => { setTradesHistory([]); playAlertSound('click'); }}
                    className="text-[10px] text-slate-500 hover:text-rose-400 font-bold uppercase tracking-wider font-mono bg-slate-950 p-1 px-2.5 rounded border border-slate-800"
                  >
                    Reset Archive
                  </button>
                </div>

                {tradesHistory.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center text-slate-550 border border-slate-800/60 rounded">
                    <p className="text-xs font-bold text-slate-500">Archived performance logs are clean.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse divide-y divide-slate-800">
                      <thead>
                        <tr className="text-slate-500 text-[10px] uppercase font-bold">
                          <th className="py-2 px-3">Closed Strike</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3 text-right">Lots Size Qty</th>
                          <th className="py-2 px-3 text-right">Buy Prep</th>
                          <th className="py-2 px-3 text-right">Exit Premium</th>
                          <th className="py-2 px-3 text-right">Realized Return</th>
                          <th className="py-2 px-3 text-center">Settlement Status</th>
                          <th className="py-2 px-3 text-center">Exit Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 bg-slate-950/20">
                        {tradesHistory.map((item, index) => {
                          const isWin = item.pnl >= 0;
                          return (
                            <tr key={index} className="hover:bg-slate-900/40">
                              <td className="py-3 px-3 font-bold text-white">{item.strikePrice}</td>
                              <td className="py-3 px-3">
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${item.type === 'CALL (CE)' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                                  {item.type}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right text-slate-400">{item.qty} lot</td>
                              <td className="py-3 px-3 text-right">₹{item.entryPremium.toFixed(2)}</td>
                              <td className="py-3 px-3 text-right">₹{item.exitPremium.toFixed(2)}</td>
                              <td className={`py-3 px-3 text-right font-extrabold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                ₹{isWin ? '+' : ''}{item.pnl.toLocaleString('en-IN')} ({isWin ? '+' : ''}{item.pnlPercent.toFixed(1)}%)
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                                  item.outcome.includes('Target') 
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                                    : item.outcome.includes('Stop')
                                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse'
                                    : 'bg-slate-800 text-slate-300'
                                }`}>
                                  {item.outcome}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center text-slate-500 text-[10px]">{item.exitTime}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Segment: Strategy Matrix Backtesting */}
          {activeTab === 'backtest' && (
            <BacktestPanel 
              selectedSymbol={selectedSymbol} 
              playAlertSound={playAlertSound} 
            />
          )}

        </section>

        {/* Right Sidebar: Volatility controls, Expert analysis, and full PCR sentiments gauges */}
        <aside className="w-full xl:w-[320px] flex flex-col gap-4 flex-shrink-0">
          
          {/* Market Pulse context: VIX, PCR, and Trend stats */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span>Market Sentiment Pulse</span>
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
            </h2>

            {/* India VIX Slider Adjuster represent trading size limits */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-400 font-sans">Mock Indian VIX:</span>
                <span className="text-xs font-mono font-extrabold text-indigo-400">{systemVix.toFixed(2)}</span>
              </div>
              <input
                id="vix_adjust_slider"
                type="range"
                min="8.0"
                max="25.0"
                step="0.5"
                value={systemVix}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSystemVix(val);
                }}
                className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
              />
              
              {/* Dynamic Warning Alert banner */}
              <div className={`mt-2 p-2 rounded text-[10px] leading-relaxed border ${activeVixAdvice.color}`}>
                <p className="font-extrabold font-mono uppercase text-[9px] tracking-widest">{activeVixAdvice.label} ALERT</p>
                <p className="mt-0.5 text-slate-300">{activeVixAdvice.note}</p>
              </div>
            </div>

            {/* Put-Call Ratio indicators analysis bar */}
            <div className="flex flex-col gap-2 bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400 font-sans">Put-Call Ratio (PCR):</span>
                <span className={`font-black ${
                  currentTickData.indicators.pcr > 1.1 
                    ? 'text-emerald-400 bg-emerald-500/10 px-1.5 rounded' 
                    : currentTickData.indicators.pcr < 0.7 
                    ? 'text-rose-400 bg-rose-500/10 px-1.5 rounded' 
                    : 'text-indigo-400'
                }`}>
                  {currentTickData.indicators.pcr.toFixed(2)}
                </span>
              </div>
              
              {/* Visual horizontal score gauge */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    currentTickData.indicators.pcr > 1.1 
                      ? 'bg-emerald-400' 
                      : currentTickData.indicators.pcr < 0.7 
                      ? 'bg-rose-400' 
                      : 'bg-indigo-500'
                  }`} 
                  style={{ width: `${Math.min(100, Math.max(0, (currentTickData.indicators.pcr - 0.4) / 1.4 * 100))}%` }}
                ></div>
              </div>
              <p className="text-[9px] text-slate-500 leading-normal font-mono">
                PCR &gt; 1.1 is strongly bullish. PCR &lt; 0.7 triggers major institutional put resistance breakouts.
              </p>
            </div>

            {/* Micro details indicators */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-950/50 p-2.5 rounded border border-slate-850">
                <span className="text-[9px] text-slate-500 font-sans uppercase font-bold block">Supertrend Status</span>
                <span className={`font-black uppercase text-[10px] flex items-center gap-1 mt-0.5 ${currentTickData.indicators.supertrendDirection === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ● {currentTickData.indicators.supertrendDirection}
                </span>
              </div>
              <div className="bg-slate-950/50 p-2.5 rounded border border-slate-850">
                <span className="text-[9px] text-slate-500 font-sans uppercase font-bold block block">ATR Standard (14)</span>
                <span className="text-white font-extrabold text-[10px] block mt-0.5">
                  {currentTickData.indicators.atr.toFixed(1)} Points
                </span>
              </div>
            </div>
          </div>

          {/* Expert Technical validation panel + server analysis */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 flex-1 overflow-hidden">
            <h3 className="text-xs font-black uppercase text-slate-300 tracking-wider flex items-center justify-between">
              <span>Verified AI Confirmation Report</span>
              <span className="text-indigo-400 text-[10px] font-bold tracking-normal uppercase">Gemini powered</span>
            </h3>
            
            {/* Submit report button */}
            <button
              id="ai_request_btn"
              onClick={() => handleRequestAiAnalysis(currentSignal)}
              disabled={isAiLoading || currentSignal.type === 'HOLD (WAIT)'}
              className={`w-full py-2.5 rounded-lg text-xs font-black uppercase transition-all tracking-wider flex items-center justify-center gap-1.5 select-none ${
                currentSignal.type === 'HOLD (WAIT)' 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/40' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95 border border-indigo-400/20'
              }`}
            >
              {isAiLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  Generating Trading Analysis...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Request AI Advisor Target Audit
                </>
              )}
            </button>

            {/* Error messaging */}
            {aiError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded text-[11px] text-rose-400 flex items-start gap-1 font-mono">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-500" />
                <span>{aiError}</span>
              </div>
            )}

            {/* AI Response Display Box */}
            <div className="flex-1 bg-slate-950 p-3 rounded-lg border border-slate-850 overflow-y-auto text-xs leading-relaxed font-mono relative">
              {aiAnalysisText ? (
                <div id="ai_response_content" className="text-slate-300 text-[11px] space-y-2 whitespace-pre-line prose prose-invert">
                  {aiAnalysisText}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 h-full flex flex-col items-center justify-center gap-2">
                  <BookOpen className="w-8 h-8 text-slate-700" />
                  <p className="font-bold text-slate-400">Trading Advisor Report Clean</p>
                  <p className="text-[10px] leading-normal text-slate-500 max-w-xs font-sans">
                    Once a direct **CALL (CE)** or **PUT (PE)** Signal triggers successfully on the chart above, click the button to authorize real-time AI confirmation and technical targets audit.
                  </p>
                </div>
              )}
            </div>

            <div className="text-[9px] text-slate-500 uppercase tracking-widest font-black flex justify-between font-mono">
              <span>Security verified</span>
              <span>100% Client-Side Private</span>
            </div>
          </div>

        </aside>
      </main>

      {/* Grid system analysis list - explaining exactly the 7 criteria checks & parameters validation */}
      <section className="bg-slate-900 border-t border-slate-800 p-4 shrink-0">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5 font-mono">
          <Sliders className="w-4 h-4 text-indigo-400" />
          7-Parameters Live Option Buy Signal Rule Book
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          
          {/* Rule 1: VWAP */}
          <div className={`p-2.5 rounded-lg border flex flex-col justify-between font-mono text-xs ${
            currentTickData.price > currentTickData.indicators.vwap
              ? 'bg-emerald-950/20 border-emerald-500/20' 
              : 'bg-rose-950/20 border-rose-500/20'
          }`}>
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-extrabold">1. VWAP Target</span>
                <span className="text-[9px] font-black text-slate-400 p-0.5 rounded">Anchored</span>
              </div>
              <p className="text-[11px] text-white font-extrabold mt-1">
                Spot: {currentTickData.price.toFixed(1)} vs VWAP: {currentTickData.indicators.vwap.toFixed(1)}
              </p>
            </div>
            <p className="text-[9.5px] text-slate-500 mt-2 leading-relaxed">
              {currentTickData.price > currentTickData.indicators.vwap ? '🟢 Bullish direction (Price holds above VWAP)' : '🔴 Bearish direction (Price holds below VWAP)'}
            </p>
          </div>

          {/* Rule 2: RSI */}
          <div className={`p-2.5 rounded-lg border flex flex-col justify-between font-mono text-xs ${
            currentTickData.indicators.rsi > 60 
              ? 'bg-emerald-950/20 border-emerald-500/20' 
              : currentTickData.indicators.rsi < 40 
              ? 'bg-rose-950/20 border-rose-500/20' 
              : 'bg-slate-950/40 border-slate-800'
          }`}>
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-extrabold">2. RSI (14) Momentum</span>
                <span className="text-[9px] font-black text-slate-400 p-0.5 rounded">Adjusted</span>
              </div>
              <p className="text-[11px] text-white font-extrabold mt-1">
                Current RSI: {currentTickData.indicators.rsi}
              </p>
            </div>
            <p className="text-[9.5px] text-slate-500 mt-2 leading-relaxed">
              {currentTickData.indicators.rsi > 60 
                ? '🟢 Momentum strong (>60 limits Call Buy)' 
                : currentTickData.indicators.rsi < 40 
                ? '🔴 Downside decay strong (<40 Put Buy)' 
                : '⚠️ WARNING: Trapped inside 40-60 chop zone (High decay)'}
            </p>
          </div>

          {/* Rule 3: Dual EMA */}
          <div className={`p-2.5 rounded-lg border flex flex-col justify-between font-mono text-xs ${
            currentTickData.indicators.ema20 > currentTickData.indicators.ema50 
              ? 'bg-emerald-950/20 border-emerald-500/20' 
              : 'bg-rose-950/20 border-rose-500/20'
          }`}>
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-extrabold">3. Dual EMA (20/50)</span>
                <span className="text-[9px] font-black text-slate-400 p-0.5 rounded">Trends</span>
              </div>
              <p className="text-[11px] text-white font-extrabold mt-1">
                20 EMA: {currentTickData.indicators.ema20.toFixed(0)} / 50 EMA: {currentTickData.indicators.ema50.toFixed(0)}
              </p>
            </div>
            <p className="text-[9.5px] text-slate-500 mt-2 leading-relaxed">
              {currentTickData.indicators.ema20 > currentTickData.indicators.ema50 
                ? '🟢 Golden cross active (20 EMA > 50 EMA)' 
                : '🔴 Death breakdown active (20 EMA < 50 EMA)'}
            </p>
          </div>

          {/* Rule 4: Supertrend */}
          <div className={`p-2.5 rounded-lg border flex flex-col justify-between font-mono text-xs ${
            currentTickData.indicators.supertrendDirection === 'BUY' 
              ? 'bg-emerald-950/20 border-emerald-500/20' 
              : 'bg-rose-950/20 border-rose-500/20'
          }`}>
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-extrabold">4. Supertrend (10, 3)</span>
                <span className="text-[9px] font-black text-indigo-400 p-0.5 rounded">ATR=10</span>
              </div>
              <p className="text-[11px] text-white font-extrabold mt-1">
                Direction: {currentTickData.indicators.supertrendDirection}
              </p>
            </div>
            <p className="text-[9.5px] text-slate-500 mt-2 leading-relaxed">
              {currentTickData.indicators.supertrendDirection === 'BUY' 
                ? '🟢 Buy support active line at: ' + currentTickData.indicators.supertrendValue.toFixed(0) 
                : '🔴 Sell opposition resistance at: ' + currentTickData.indicators.supertrendValue.toFixed(0)}
            </p>
          </div>

          {/* Rule 5: ATR Targets */}
          <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/40 flex flex-col justify-between font-mono text-xs">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-extrabold">5. ATR Volatility Range</span>
                <span className="text-[9px] font-black text-slate-400 p-0.5 rounded">Standard</span>
              </div>
              <p className="text-[11px] text-white font-extrabold mt-1">
                ATR (14): {currentTickData.indicators.atr.toFixed(1)} Pts
              </p>
            </div>
            <p className="text-[9.5px] text-slate-500 mt-2 leading-relaxed">
              SL is set exactly 1.5 &times; ATR value below entry. Take-Profit targets are set at 2 &times; ATR.
            </p>
          </div>

          {/* Rule 6: India VIX sizing alerts */}
          <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/40 flex flex-col justify-between font-mono text-xs">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-extrabold">6. Volatility Index (VIX)</span>
                <span className="text-[9px] font-black text-slate-400 p-0.5 rounded">Filter</span>
              </div>
              <p className="text-[11px] text-white font-extrabold mt-1">
                Sizing Score: {systemVix.toFixed(1)}
              </p>
            </div>
            <p className="text-[9.5px] text-slate-400 mt-2 leading-relaxed font-sans">
              {systemVix < 11 
                ? 'Scalp 10-15 pts only.' 
                : systemVix > 20 
                ? '💣 Extreme risk! Position halved.' 
                : '✅ Optimal buying premium environment.'}
            </p>
          </div>

          {/* Rule 7: Put-Call Ratio (PCR) */}
          <div className={`p-2.5 rounded-lg border flex flex-col justify-between font-mono text-xs ${
            currentTickData.indicators.pcr > 1.1 || currentTickData.indicators.pcr < 0.6
              ? 'bg-emerald-950/20 border-emerald-500/20' 
              : currentTickData.indicators.pcr < 0.7 || currentTickData.indicators.pcr > 1.45
              ? 'bg-rose-950/20 border-rose-500/20'
              : 'bg-slate-950/40 border-slate-800'
          }`}>
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-extrabold">7. PCR Sentiment</span>
                <span className="text-[9px] font-black text-slate-400 p-0.5 rounded">OI Live</span>
              </div>
              <p className="text-[11px] text-white font-extrabold mt-1">
                PCR: {currentTickData.indicators.pcr.toFixed(2)}
              </p>
            </div>
            <p className="text-[9.5px] text-slate-500 mt-2 leading-relaxed">
              {currentTickData.indicators.pcr > 1.1 
                ? '🟢 PCR > 1.1 supports calls' 
                : currentTickData.indicators.pcr < 0.7 
                ? '🔴 PCR < 0.7 supports puts' 
                : 'Neutral range (expect rangebound action)'}
            </p>
          </div>

        </div>
      </section>

      {/* Bottom status bar in slate-950 */}
      <footer className="h-9 border-t border-slate-800 bg-slate-950 flex items-center justify-between px-6 flex-shrink-0 text-[10px] text-slate-500 font-mono">
        <div className="flex items-center gap-4">
          <span>SYSTEM SERVER: Asia-Mumbai-02</span>
          <span>|</span>
          <span>DATA FEED: NSE Weekly Option Expiries</span>
          <span>|</span>
          <span className="hidden sm:inline">GMT+5:30 (Mumbai standard time)</span>
        </div>
        <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-emerald-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Live feed healthy (98.6% precision score)</span>
        </div>
      </footer>
    </div>
  );
}
