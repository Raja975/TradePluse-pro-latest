import React, { useState, useEffect } from 'react';
import { 
  Play, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Award, 
  Briefcase, 
  Sliders, 
  Percent, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { TickerSymbol, SimulatedTradeHistory } from '../types';
import { BASE_PRICES } from '../utils/marketSim';
import { runBacktest, BacktestStrategy, BacktestResult, BacktestMetricPoint } from '../utils/backtestEngine';

interface BacktestPanelProps {
  selectedSymbol: TickerSymbol;
  playAlertSound: (type: 'click' | 'cash' | 'lose' | 'signal' | 'notification' | 'popup' | 'double_order') => void;
}

export default function BacktestPanel({ selectedSymbol, playAlertSound }: BacktestPanelProps) {
  // Inputs state
  const [strategy, setStrategy] = useState<BacktestStrategy>('all_rules');
  const [durationDays, setDurationDays] = useState<number>(30);
  const [initialCapital, setInitialCapital] = useState<number>(100000);
  const [quantityLots, setQuantityLots] = useState<number>(2);
  const [stopLossMultiple, setStopLossMultiple] = useState<number>(1.5);
  const [targetMultiple, setTargetMultiple] = useState<number>(2.0);

  // Simulation running status
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationStep, setSimulationStep] = useState<number>(0);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  
  // Results
  const [results, setResults] = useState<BacktestResult | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<BacktestMetricPoint | null>(null);
  const [tradeFilter, setTradeFilter] = useState<'all' | 'wins' | 'losses'>('all');

  // Trigger default run on mount or symbol shift
  useEffect(() => {
    handleRunBacktest(true);
  }, [selectedSymbol]);

  const handleRunBacktest = (silent = false) => {
    if (!silent) {
      playAlertSound('click');
    }
    setIsSimulating(true);
    setSimulationStep(0);
    setSimLogs([]);
    setResults(null);

    const logs = [
      'Initializing offline historical data feed...',
      `Generating mathematical tick arrays from ${durationDays}-day bounds...`,
      'Calculating Strategy indicator lines (VWAP, RSI, EMA 20/50, ST)...',
      'Assigning options strike price targets and executing simulated entries...',
      'Mapping trailing drawdowns, premium decays, and settlement ratios...',
      'Compiling performance matrix and equity curve analytics!'
    ];

    let currentLogIdx = 0;
    
    const interval = setInterval(() => {
      if (currentLogIdx < logs.length) {
        setSimLogs(prev => [...prev, logs[currentLogIdx]]);
        setSimulationStep(currentLogIdx + 1);
        currentLogIdx++;
      } else {
        clearInterval(interval);
        
        // Execute math backtest
        const generatedRes = runBacktest({
          symbol: selectedSymbol,
          strategy,
          durationDays,
          initialCapital,
          quantityLots,
          stopLossMultiple,
          targetMultiple
        });

        setResults(generatedRes);
        setIsSimulating(false);
        if (!silent) {
          if (generatedRes.metrics.netProfit >= 0) {
            playAlertSound('cash');
          } else {
            playAlertSound('lose');
          }
        }
      }
    }, silent ? 0 : 250); // instant in silent mode, else nice realistic progression
  };

  // Safe lot size for current symbol
  const currentLotSize = BASE_PRICES[selectedSymbol]?.optionGap === 50
    ? (selectedSymbol === 'FINNIFTY' ? 25 : 50)
    : (selectedSymbol === 'BANK NIFTY' ? 15 : selectedSymbol === 'SENSEX' ? 10 : 75);

  const totalTradedContracts = quantityLots * currentLotSize;

  // Filtered trades
  const filteredTrades = results ? results.trades.filter(t => {
    if (tradeFilter === 'wins') return t.pnl > 0;
    if (tradeFilter === 'losses') return t.pnl <= 0;
    return true;
  }) : [];

  return (
    <div id="backtest-pnl-root" className="flex-1 flex flex-col gap-4 overflow-y-auto min-h-[350px]">
      
      {/* Configuration Header Card */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col gap-4">
        <div className="flex justify-between items-start flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 font-mono">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Options Strategy Backtester Engine
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Simulate technical strategies on historical price curves with premium contract decay modeling.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 border border-indigo-950 text-indigo-400">
              Active Ticker: {selectedSymbol} ({currentLotSize} Lot Size)
            </span>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-lg border border-slate-850">
          
          {/* Strategy Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-500 font-mono uppercase font-black">Strategy Logic</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as BacktestStrategy)}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded p-1.5 font-sans focus:outline-none focus:border-indigo-500"
            >
              <option value="all_rules">Composite High-Convict Signals (All Rules)</option>
              <option value="ema_crossover">EMA 20/50 Trend Cross</option>
              <option value="rsi_momentum">RSI Breakout (RSI 40-60 Exits)</option>
              <option value="vwap_breakout">Institutional VWAP Breakout</option>
              <option value="supertrend_follower">Supertrend Trailing Support</option>
            </select>
          </div>

          {/* Range Duration */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-500 font-mono uppercase font-black">Data Range</label>
            <div className="flex bg-slate-900 rounded p-0.5 border border-slate-800">
              {([7, 15, 30, 90] as const).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setDurationDays(days)}
                  className={`flex-1 text-[11px] font-mono font-bold py-1 px-1.5 rounded transition-all ${
                    durationDays === days
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {days}D
                </button>
              ))}
            </div>
          </div>

          {/* Initial Capital Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-500 font-mono uppercase font-black">Start Equity (₹)</label>
            <select
              value={initialCapital}
              onChange={(e) => setInitialCapital(parseInt(e.target.value))}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded p-1.5 font-mono focus:outline-none focus:border-indigo-500"
            >
              <option value="50000">₹50,000</option>
              <option value="100000">₹1,00,000</option>
              <option value="250000">₹2,50,000</option>
              <option value="500000">₹5,00,000</option>
              <option value="1000000">₹10,00,000</option>
            </select>
          </div>

          {/* Traded lots sizing */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-500 font-mono uppercase font-black">Position Size (Lots)</label>
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded p-1.5">
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={quantityLots}
                onChange={(e) => setQuantityLots(parseInt(e.target.value))}
                className="flex-1 accent-indigo-500 h-1.5 bg-slate-950 rounded cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-white px-2 py-0.5 bg-slate-950 rounded select-none min-w-[50px] text-center">
                {quantityLots} L ({totalTradedContracts} Qty)
              </span>
            </div>
          </div>

        </div>

        {/* Strategy Specific Fine-tuning Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-3 px-4 rounded-lg border border-slate-850 text-xs text-slate-400 font-mono">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-black">
              <span>Exit Stop-Loss Multiplier</span>
              <span className="text-rose-400 font-bold">{stopLossMultiple.toFixed(1)}x ATR</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="2.5"
              step="0.1"
              value={stopLossMultiple}
              onChange={(e) => setStopLossMultiple(parseFloat(e.target.value))}
              className="accent-rose-500 h-1 bg-slate-900 rounded cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-black">
              <span>Exit Profit-Target Multiplier</span>
              <span className="text-emerald-400 font-bold">{targetMultiple.toFixed(1)}x ATR</span>
            </div>
            <input
              type="range"
              min="1.5"
              max="4.0"
              step="0.1"
              value={targetMultiple}
              onChange={(e) => setTargetMultiple(parseFloat(e.target.value))}
              className="accent-emerald-500 h-1 bg-slate-900 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Trigger Button */}
        <div className="flex justify-end mt-1">
          <button
            id="btn_execute_backtest"
            disabled={isSimulating}
            onClick={() => handleRunBacktest(false)}
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white text-xs font-bold font-mono py-2.5 px-6 rounded-lg shadow-lg shadow-purple-900/15 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
            {isSimulating ? 'Simulating Strategy Performance...' : 'Run Historical Matrix Backtest'}
          </button>
        </div>
      </div>

      {/* Progress Simulation Loader Area */}
      {isSimulating && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col items-center justify-center min-h-[220px]">
          <div className="relative w-14 h-14 mb-4 flex items-center justify-center">
            <div className="absolute inset-0 border-4 border-purple-500/10 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-purple-500 rounded-full animate-spin"></div>
            <Activity className="w-5 h-5 text-purple-400 animate-pulse" />
          </div>
          <h4 className="text-white text-xs font-bold font-mono uppercase tracking-wider mb-2">Backtester Simulation Active...</h4>
          
          {/* Logs steps */}
          <div className="w-full max-w-md bg-slate-950 border border-slate-850 p-3 rounded-lg flex flex-col gap-1.5 font-mono text-[10px] text-slate-400 min-h-[90px] justify-center">
            {simLogs.map((log, idx) => (
              <p key={idx} className="flex items-center gap-1.5 text-slate-300">
                <span className="text-purple-400 font-extrabold">&gt;&gt;</span>
                {log}
              </p>
            ))}
            <div className="flex items-center gap-2 mt-2 w-full">
              <div className="flex-1 bg-slate-900 h-1 rounded overflow-hidden">
                <div 
                  className="bg-purple-500 h-full transition-all duration-200" 
                  style={{ width: `${(simulationStep / 6) * 100}%` }}
                ></div>
              </div>
              <span className="text-slate-500 text-[9px] font-bold">{(simulationStep/6*100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Results details */}
      {!isSimulating && results && (
        <div className="flex flex-col gap-4 animate-fade-in">
          
          {/* Performance KPIs Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            
            {/* Net Return */}
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-black font-mono">Net Return</span>
              <div className="mt-1">
                <p className={`text-sm sm:text-base font-extrabold ${results.metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ₹{results.metrics.netProfit >= 0 ? '+' : ''}{results.metrics.netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
                <span className={`text-[10px] font-mono font-bold flex items-center gap-0.5 mt-0.5 ${results.metrics.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {results.metrics.netProfit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {results.metrics.netProfit >= 0 ? '+' : ''}{results.metrics.netProfitPercent.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Win Rate */}
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-black font-mono">Strategy Win Rate</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-extrabold text-white">{results.metrics.winRate}%</span>
                <span className="text-[10px] text-slate-400 font-mono">({results.metrics.winningTrades}/{results.metrics.totalTrades})</span>
              </div>
              <div className="w-full bg-slate-950 h-1 rounded overflow-hidden mt-2">
                <div 
                  className="bg-indigo-500 h-full" 
                  style={{ width: `${results.metrics.winRate}%` }}
                ></div>
              </div>
            </div>

            {/* Max Drawdown */}
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-black font-mono flex items-center gap-1">
                Max Drawdown
                <Info className="w-3 h-3 text-slate-600" title="Peak to trough portfolio drop" />
              </span>
              <div className="mt-1">
                <p className={`text-xl font-extrabold ${results.metrics.maxDrawdown > 15 ? 'text-amber-500' : 'text-slate-300'}`}>
                  {results.metrics.maxDrawdown === 0 ? '0.0%' : `-${results.metrics.maxDrawdown}%`}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5 uppercase font-mono font-bold">Standard Risk Tolerant</p>
              </div>
            </div>

            {/* Profit Factor */}
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-black font-mono flex items-center gap-1">
                Profit Factor
                <Info className="w-3 h-3 text-slate-600" title="Gross Gain divided by Gross Loss" />
              </span>
              <div className="mt-1">
                <p className={`text-xl font-extrabold ${results.metrics.profitFactor >= 2.0 ? 'text-indigo-400' : results.metrics.profitFactor >= 1.2 ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {results.metrics.profitFactor.toFixed(2)}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5 uppercase font-mono font-bold">
                  {results.metrics.profitFactor >= 2.0 ? 'Outstanding' : results.metrics.profitFactor >= 1.2 ? 'Profitable' : 'Weak System'}
                </p>
              </div>
            </div>

            {/* Average Profit / Loss per trade */}
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-black font-mono">Avg return/Trade</span>
              <div className="mt-1">
                <p className={`text-xl font-extrabold ${results.metrics.avgProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ₹{results.metrics.avgProfitLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5 uppercase font-mono font-bold">Expectancy Score</p>
              </div>
            </div>

            {/* Total Account Equity */}
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-black font-mono">Final Equity Balance</span>
              <div className="mt-1">
                <p className="text-xl font-extrabold text-white">
                  ₹{results.metrics.endingCapital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5 uppercase font-mono font-bold">
                  from ₹{initialCapital.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

          </div>

          {/* Performance Graph Curve */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-mono">
                  <Activity className="w-4 h-4 text-purple-400" />
                  Equity Growth Matrix Curve
                </h4>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Visual performance journey tracking starting capital vs trailing equity. Hover curves to audit details.
                </p>
              </div>
              
              {/* Reset view triggers */}
              {hoveredPoint ? (
                <div className="bg-slate-950 p-1 px-2 border border-slate-850 rounded text-[10px] font-mono text-slate-400 flex gap-3 select-none">
                  <span>Step: <strong className="text-slate-200">{hoveredPoint.index}</strong></span>
                  <span>Date: <strong className="text-slate-200">{hoveredPoint.timestamp}</strong></span>
                  <span>Equity: <strong className="text-indigo-400">₹{hoveredPoint.equity.toLocaleString('en-IN')}</strong></span>
                  <span>Max Drawdown: <strong className="text-rose-400">{hoveredPoint.drawdown}%</strong></span>
                </div>
              ) : (
                <div className="text-[10px] font-mono text-slate-500 uppercase font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-900 select-none">
                  HOVER AREA AUDITING ACTIVE
                </div>
              )}
            </div>

            {/* Interactive SVG Chart block */}
            <div className="h-44 md:h-52 w-full relative bg-slate-950 border border-slate-850 rounded-lg p-2 overflow-hidden flex items-center justify-center">
              {results.equityCurve.length > 1 ? (
                (() => {
                  const curve = results.equityCurve;
                  const equities = curve.map(p => p.equity);
                  const minEq = Math.min(...equities, initialCapital) * 0.95;
                  const maxEq = Math.max(...equities, initialCapital) * 1.05;
                  const deltaEq = maxEq - minEq || 1;

                  const points = curve.map((p, idx) => {
                    const x = (idx / (curve.length - 1)) * 100;
                    const y = 100 - ((p.equity - minEq) / deltaEq) * 90 - 5;
                    return `${x},${y}`;
                  }).join(' L ');

                  // Baseline starting capital relative point
                  const startY = 100 - ((initialCapital - minEq) / deltaEq) * 90 - 5;

                  return (
                    <svg 
                      className="w-full h-full text-indigo-500/10 cursor-crosshair select-none"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <defs>
                        <linearGradient id="eq-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" style={{ stopColor: results.metrics.netProfit >= 0 ? '#10b981' : '#f43f5e', stopOpacity: 0.12 }} />
                          <stop offset="100%" style={{ stopColor: 'rgba(99, 102, 241, 0)', stopOpacity: 0 }} />
                        </linearGradient>
                      </defs>

                      {/* Reference Grid lines */}
                      <line x1="0" y1="20" x2="100" y2="20" stroke="#1e293b" strokeWidth="0.15" />
                      <line x1="0" y1="50" x2="100" y2="50" stroke="#1e293b" strokeWidth="0.15" />
                      <line x1="0" y1="80" x2="100" y2="80" stroke="#1e293b" strokeWidth="0.15" />

                      {/* Horizontal Start Capital Line marker */}
                      <line 
                        x1="0" 
                        y1={startY} 
                        x2="100" 
                        y2={startY} 
                        stroke="#475569" 
                        strokeWidth="0.25" 
                        strokeDasharray="2,2" 
                      />

                      {/* Equity Area Shader */}
                      <path
                        d={`M 0,100 L ${points} L 100,100 Z`}
                        fill="url(#eq-gradient)"
                      />

                      {/* Equity Main Line path */}
                      <path
                        d={`M ${points}`}
                        fill="none"
                        stroke={results.metrics.netProfit >= 0 ? '#10b981' : '#f43f5e'}
                        strokeWidth="0.65"
                      />

                      {/* Drawdown relative indicators at bottom area */}
                      {curve.map((p, idx) => {
                        if (p.drawdown > 0 && idx % Math.max(1, Math.floor(curve.length / 50)) === 0) {
                          const x = (idx / (curve.length - 1)) * 100;
                          const ht = Math.min(15, p.drawdown * 0.4);
                          return (
                            <line 
                              key={idx}
                              x1={x} 
                              y1={100} 
                              x2={x} 
                              y2={100 - ht} 
                              stroke="#ef4444" 
                              strokeWidth="0.3" 
                              opacity="0.3"
                            />
                          );
                        }
                        return null;
                      })}

                      {/* Hover Invisible Slices */}
                      {curve.map((p, idx) => {
                        const x = (idx / (curve.length - 1)) * 100;
                        const sliceWidth = 100 / curve.length;
                        return (
                          <rect
                            key={idx}
                            x={x - sliceWidth / 2}
                            y="0"
                            width={sliceWidth}
                            height="100"
                            fill="transparent"
                            className="hover:fill-slate-800/10 cursor-pointer"
                            onMouseEnter={() => setHoveredPoint(p)}
                          />
                        );
                      })}

                      {/* Floating tooltip vertical guideline */}
                      {hoveredPoint && (() => {
                        const idx = curve.findIndex(pt => pt.index === hoveredPoint.index);
                        const x = (idx / (curve.length - 1)) * 100;
                        const y = 100 - ((hoveredPoint.equity - minEq) / deltaEq) * 90 - 5;
                        return (
                          <g>
                            <line x1={x} y1="0" x2={x} y2="100" stroke="#a855f7" strokeWidth="0.15" />
                            <circle cx={x} cy={y} r="1.3" fill="#faf5ff" stroke="#a855f7" strokeWidth="0.3" />
                          </g>
                        );
                      })()}
                    </svg>
                  );
                })()
              ) : (
                <p className="text-slate-500 font-mono text-xs">Insufficient sequence logs to graph</p>
              )}
            </div>

            {/* Legend Annotations */}
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase font-black bg-slate-950 p-2 px-3 rounded border border-slate-900 select-none">
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5">
                  <span className={`w-3 h-0.5 rounded ${results.metrics.netProfit >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  Real Portfolio Equity Line
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-slate-600 border border-dashed border-slate-400"></span>
                  Baseline Starting Capital (₹{initialCapital.toLocaleString()})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-rose-500/30"></span>
                  Trailing Drawdown Peak
                </span>
              </div>
              <span>Total bars tracked: {results.equityCurve.length}</span>
            </div>
          </div>

          {/* Historical Simulated Trades Log List */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col gap-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                  <Award className="w-4 h-4 text-amber-500" />
                  Historical Simulation Exit Log Trades ({results.trades.length})
                </h4>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Tick-by-tick records of every option trade completed during the backtest cycle.
                </p>
              </div>

              {/* Filtering trade types */}
              <div className="flex bg-slate-950 p-0.5 rounded border border-slate-850 text-[10px] font-mono font-bold select-none">
                <button
                  onClick={() => setTradeFilter('all')}
                  className={`px-2.5 py-1 rounded ${tradeFilter === 'all' ? 'bg-indigo-600 text-white font-extrabold' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  All Trades
                </button>
                <button
                  onClick={() => setTradeFilter('wins')}
                  className={`px-2.5 py-1 rounded ${tradeFilter === 'wins' ? 'bg-emerald-600/35 text-emerald-400 font-extrabold' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Wins Only
                </button>
                <button
                  onClick={() => setTradeFilter('losses')}
                  className={`px-2.5 py-1 rounded ${tradeFilter === 'losses' ? 'bg-rose-600/35 text-rose-400 font-extrabold' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Losses Only
                </button>
              </div>
            </div>

            {/* Trades ledger table */}
            {filteredTrades.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center text-slate-550 border border-slate-850 bg-slate-950/20 rounded">
                <p className="text-[11px] font-bold text-slate-550 font-mono uppercase">No simulation trades found matching filter</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse divide-y divide-slate-800">
                  <thead>
                    <tr className="text-slate-500 text-[10px] uppercase font-bold">
                      <th className="py-2.5 px-3">Contract Strike</th>
                      <th className="py-2.5 px-3">Signal</th>
                      <th className="py-2.5 px-3 text-right">Bought Lots</th>
                      <th className="py-2.5 px-3 text-right">Buy Prep</th>
                      <th className="py-2.5 px-3 text-right">Settle Premium</th>
                      <th className="py-2.5 px-3 text-right">P&amp;L Absolute</th>
                      <th className="py-2.5 px-3 text-center">Settled Outcome</th>
                      <th className="py-2.5 px-3 text-center">Simulation Bounds</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-1000/20">
                    {filteredTrades.map((trade, idx) => {
                      const isWin = trade.pnl >= 0;
                      return (
                        <tr key={trade.id || idx} className="hover:bg-slate-900/40 text-[11px]">
                          <td className="py-3 px-3 font-bold text-white">{trade.strikePrice}</td>
                          <td className="py-3 px-3">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase ${trade.type === 'CALL (CE)' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                              {trade.type}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right text-slate-400 font-bold">
                            {trade.qty} L ({trade.qty * currentLotSize} Qty)
                          </td>
                          <td className="py-3 px-3 text-right text-slate-300 font-mono">₹{trade.entryPremium.toFixed(1)}</td>
                          <td className="py-3 px-3 text-right text-slate-300 font-mono">₹{trade.exitPremium.toFixed(1)}</td>
                          <td className={`py-3 px-3 text-right font-extrabold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                            ₹{isWin ? '+' : ''}{trade.pnl.toLocaleString('en-IN', { maximumFractionDigits: 1 })} ({isWin ? '+' : ''}{trade.pnlPercent.toFixed(1)}%)
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              trade.outcome.includes('Target') 
                                ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-500/20' 
                                : trade.outcome.includes('Stop')
                                ? 'bg-rose-400/10 text-rose-400 border border-rose-500/20'
                                : 'bg-slate-800 text-slate-300'
                            }`}>
                              {trade.outcome}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center text-slate-500 text-[10px] whitespace-nowrap">
                            <span>{trade.entryTime.split(' ')[0]} {trade.entryTime.split(' ')[1]}</span>
                            <span className="mx-1 text-slate-700">&rarr;</span>
                            <span>{trade.exitTime.split(' ')[0]} {trade.exitTime.split(' ')[1]}</span>
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
    </div>
  );
}
