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