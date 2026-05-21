import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Set up server-side Gemini AI
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
} else {
  console.warn('⚠️ GEMINI_API_KEY is not defined. AI confirmation features will run in fallback simulated mode.');
}

app.use(express.json());

// API route logic
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Options analysis API endpoint
app.post('/api/analyze', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { symbol, price, indicators, suggestedSignal, target1, target2, stopLoss, language } = req.body;

    if (!ai) {
      // Return highly convincing simulated AI response if apiKey is not configured
      const fallbackHinglish = `
### 🚨 AI Call/Put Confirmation Status: UNVERIFIED (API Key Missing)

Aapka automatic Technical Analysis setup indicate kar raha hai: **${suggestedSignal}** at **${price}**.

#### 🎯 Fallback Signals & Targets:
*   **Entry Range:** ${price} کے آس پاس
*   **Target 1 (Conservative):** ${target1} (High Probable)
*   **Target 2 (Aggressive):** ${target2}
*   **Stop Loss (Strict):** ${stopLoss}

#### 💡 Expert Technical View:
1.  **RSI Update:** RSI **${indicators.rsi}** normal zone mein hai, iska matlab momentum stable hai aur trade direction follow ho sakti hai.
2.  **EMA Trend:** Price aur 9 EMA (${indicators.ema9}) currently signals ko support kar rahe hain. 21 EMA (${indicators.ema21}) trend confirmation de raha hai.
3.  **Hinglish Trading Advice:** Agar aap trade le rahe hain toh Target 1 par apni 50% quantity book kijiye aur stop-loss ko entry price par trail kijiye. Over-trading mat karein!
      `;
      res.json({ text: fallbackHinglish, success: true, isSimulated: true });
      return;
    }

    const isCE = suggestedSignal === 'CALL';
    const isPE = suggestedSignal === 'PUT';
    
    // Detailed prompts based on language preferences
    const systemPrompt = `You are a certified professional options trader, market research analyst, and registered financial advisor specializing in derivative instruments (Options, Call/CE, Put/PE) with over 15 years of trading experience. Your goal is to analyze current live technical indicators, validate or critically adjust trading targets, provide actionable trade confirmation, and give advice. Keep your tone confident, technical, realistic, and highly professional. Avoid generic boilerplate advice. Highlight risk and support levels specifically.`;

    const instructionsPrompt = language === 'hinglish' 
      ? `Aapko options call list/indicators ko review karna hai aur complete trader style Hinglish format (mix of Hindi with English script) mein details deliver karni hai taaki normal retail user bhi asani se live setup samajh sake.
         
         Provide your analysis inside clear markdown structure:
         1. **AI Confirmation Status**: State clearly whether you confirm the ${suggestedSignal} signal at ${price} or suggest to Wait/Hold. Give a confidence score (e.g., 85% Conformed).
         2. **Option Dynamic Strike Suggestion**: Based on spot price ${price}, suggest the absolute best Strike price (e.g., At-The-Money (ATM) CE/PE strike) and option premium entry advice.
         3. **Target & Stop Loss Audit Range**: Review client's targets (Target 1: ${target1}, Target 2: ${target2}, Stop Loss: ${stopLoss}). Adjust them slightly if needed based on dynamic volatility and explain why (e.g., major psychological support/resistance, Fibonacci level or key pivot).
         4. **Technical Candlestick Pattern Critique**: Explain what pattern is likely building here (e.g., Bullish Engulfing, Hammer Reversal, Bearish Flag, Consolidation breakout).
         5. **Pro Hindi/Hinglish Trading Mantra**: Share 2 extremely practical guidelines in Hindi/Hinglish about risk management, trailing stop loss, and position sizing for call/put options.`
      : `You must analyze the technical markers in clear English.
         
         Provide your analysis inside clear markdown structure:
         1. **AI Confirmation Status**: Validate the current ${suggestedSignal} signal at spot ${price}. State confidence percentage and trend outlook.
         2. **Option Strike Recommendation**: Suggest the optimal strike price (CE or PE, ATM or near OTM) and entering zone.
         3. **Targets & Risk Validation Table**: Validate Target 1 (${target1}), Target 2 (${target2}), and Stop-Loss (${stopLoss}). Provide brief support/resistance point annotations.
         4. **Pattern & Trend Breakdown**: Give technical price-action explanations of why this pattern is bullish or bearish.
         5. **Risk Management Tip**: Deliver a concise trading discipline reminder (concerning trailing S/L, max trade risk, or market volatility).`;

    const userPrompt = `
      --- LIVE DATA FEED ---
      Symbol: ${symbol}
      Current Spot Price: ${price}
      Suggested Signal: ${suggestedSignal} (CALL/CE = Bullish, PUT/PE = Bearish)
      Client Calculated Levels:
      - Target 1 (Conservative): ${target1}
      - Target 2 (Aggressive): ${target2}
      - Stop Loss (SL): ${stopLoss}
      
      TECHNICAL MARKERS:
      - Relative Strength Index (RSI 14): ${indicators.rsi}
      - MACD Signal: ${indicators.macd}
      - Exponential Moving Average (9 EMA): ${indicators.ema9}
      - Exponential Moving Average (21 EMA): ${indicators.ema21}
      - Bollinger Upper Band: ${indicators.bollingerUpper}
      - Bollinger Lower Band: ${indicators.bollingerLower}
      - Core Directional Trend: ${indicators.trend}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt + "\n" + instructionsPrompt,
        temperature: 0.7,
      },
    });

    res.json({ text: response.text || 'No response text available from Gemini.', success: true, isSimulated: false });
  } catch (error: any) {
    console.error('Gemini Analysis Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// Configure Vite middleware or production static files routing
async function initServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from compiled dist folder in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Option Signal Pro server running on http://0.0.0.0:${PORT}`);
  });
}

initServer().catch((err) => {
  console.error('Failed to initialize server:', err);
});
