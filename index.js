require("dotenv").config();

const { getLastCandles } = require("./ohlcService");
const { buildCandlestickChartConfig, getChartUrl } = require("./echartsService");
const { savePriceSnapshot } = require("./historyService");
const { buildDailyOHLCForSymbol } = require("./ohlcService");
const { getWatchlist } = require("./scraperService");
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");

const { getMarketData, getWatchlistData } = require("./scraperService");
const {
  sendEmailDirect,
  sendSimpleTestEmail,
  sendEmailWithRetry,
} = require("./emailService");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.get("/api/collect-history", async (req, res) => {
  try {
    const watchlistData = await getWatchlistData();

    for (const stock of watchlistData.watchlist) {
      await savePriceSnapshot(stock);
    }

    res.json({
      success: true,
      message: "History collected successfully",
      count: watchlistData.watchlist.length,
      symbols: watchlistData.watchlist.map((s) => s.symbol),
    });
  } catch (error) {
    console.error("Collect history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to collect history",
      error: error.message,
    });
  }
});

app.get("/api/build-ohlc", async (req, res) => {
  try {
    const watchlist = getWatchlist();

    const results = [];

    for (const stock of watchlist) {
      const candle = await buildDailyOHLCForSymbol(stock.symbol);
      if (candle) results.push(candle);
    }

    res.json({
      success: true,
      candles: results,
    });
  } catch (error) {
    console.error("OHLC ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to build OHLC",
      error: error.message,
    });
  }
});

app.get("/api/test-market", async (req, res) => {
  try {
    const marketData = await getMarketData();
    res.json(marketData);
  } catch (error) {
    console.error("Market scrape error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to scrape market data",
      error: error.message,
    });
  }
});

app.get("/api/watchlist", async (req, res) => {
  try {
    const watchlistData = await getWatchlistData();
    res.json(watchlistData);
  } catch (error) {
    console.error("Watchlist scrape error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch watchlist",
      error: error.message,
    });
  }
});

app.get("/api/test-email-direct", async (req, res) => {
  try {
    const info = await sendSimpleTestEmail();

    res.json({
      success: true,
      message: "Direct test email sent successfully",
      response: info?.response || null,
    });
  } catch (error) {
    console.error("DIRECT EMAIL ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Direct email test failed",
      errorMessage: error.message || null,
      errorCode: error.code || null,
      errorResponse: error.response || null,
      errorCommand: error.command || null,
    });
  }
});

app.get("/api/test-chart/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const candles = await getLastCandles(symbol, 30);

    if (!candles.length) {
      return res.json({
        success: false,
        message: `No candles found for ${symbol}`,
      });
    }

    const config = buildCandlestickChartConfig(symbol, candles);
    const chartUrl = getChartUrl(config);

    res.send(`
      <h1>${symbol} Chart Test</h1>
      <p>Candles found: ${candles.length}</p>
      <p><a href="${chartUrl}" target="_blank">Open chart directly</a></p>
      <img src="${chartUrl}" style="max-width: 100%; border: 1px solid #ccc;" />
      <pre>${JSON.stringify(candles, null, 2)}</pre>
    `);
  } catch (error) {
    console.error("TEST CHART ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate test chart",
      error: error.message,
    });
  }
});

app.get("/api/test-chart-hardcoded", (req, res) => {
  const candles = [
    { date: "2026-03-30", open: 109, high: 115, low: 106, close: 115 },
    { date: "2026-03-31", open: 115, high: 118, low: 108, close: 110 },
    { date: "2026-04-01", open: 110, high: 125, low: 109, close: 120 },
    { date: "2026-04-02", open: 120, high: 122, low: 112, close: 114 },
    { date: "2026-04-03", open: 114, high: 121, low: 113, close: 119 },
  ];

  const config = buildCandlestickChartConfig("BDO", candles);
  const chartUrl = getChartUrl(config);

  res.send(`
    <h1>Hardcoded Candlestick Test</h1>
    <p><a href="${chartUrl}" target="_blank">Open chart directly</a></p>
    <img src="${chartUrl}" style="max-width: 100%;" />
    <pre>${JSON.stringify(config, null, 2)}</pre>
  `);
});

app.get("/api/send-email", async (req, res) => {
  try {
    const info = await sendEmailDirect();

    res.json({
      success: true,
      message: "Email sent successfully",
      response: info?.response || null,
    });
  } catch (error) {
    console.error("Send email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send email",
      errorMessage: error.message || null,
      errorCode: error.code || null,
      errorResponse: error.response || null,
      errorCommand: error.command || null,
    });
  }
});

cron.schedule(
  "0 18 * * 1-5",
  async () => {
    console.log("Email send attempt");

    try {
      const success = await sendEmailWithRetry(3);
      if (!success) {
        console.error("⚠️ Email failed after retries");
      }
    } catch (err) {
      console.error("Error:", err.message);
    }
  },
  {
    timezone: "Asia/Manila",
  }
);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});