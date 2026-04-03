require("dotenv").config();

const { savePriceSnapshot } = require("./historyService");
const {
  scrapeAndSaveDailyOHLCForSymbol,
  scrapeAndSaveAllDailyOHLC,
} = require("./ohlcService");
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
    const result = await collectHistoryWithRetry(3);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to collect history after retries",
        error: result.error,
      });
    }

    res.json({
      success: true,
      message: "History collected successfully",
      count: result.stocks.length,
      symbols: result.stocks.map((s) => s.symbol),
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
    const result = await scrapeDailyOHLCWithRetry(3);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to scrape and save OHLC after retries",
        error: result.error,
      });
    }

    res.json({
      success: true,
      candles: result.candles,
    });
  } catch (error) {
    console.error("OHLC ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to scrape and save OHLC",
      error: error.message,
    });
  }
});

app.get("/api/build-ohlc/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const watchlist = getWatchlist();

    const stock = watchlist.find(
      (s) => s.symbol.toUpperCase() === symbol.toUpperCase()
    );

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: `Symbol ${symbol} not found in watchlist`,
      });
    }

    const candle = await scrapeAndSaveDailyOHLCForSymbol(stock);

    res.json({
      success: true,
      candle,
    });
  } catch (error) {
    console.error("Single OHLC ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to scrape and save OHLC for symbol",
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

async function collectHistoryDirect() {
  const watchlistData = await getWatchlistData();

  for (const stock of watchlistData.watchlist) {
    await savePriceSnapshot(stock);
  }

  return watchlistData.watchlist;
}

async function collectHistoryWithRetry(maxRetries = 3) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      attempt++;
      console.log(`Price history attempt ${attempt}...`);

      const stocks = await collectHistoryDirect();

      console.log("✅ Price history saved successfully");
      return {
        success: true,
        stocks,
      };
    } catch (error) {
      console.error(`❌ Price history attempt ${attempt} failed:`, error.message);

      if (attempt >= maxRetries) {
        console.error("🚨 All price history retry attempts failed.");
        return {
          success: false,
          error: error.message,
        };
      }

      const delay = attempt * 5000;
      console.log(`⏳ Retrying price history in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function scrapeDailyOHLCDirect() {
  const results = await scrapeAndSaveAllDailyOHLC();
  return results;
}

async function scrapeDailyOHLCWithRetry(maxRetries = 3) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      attempt++;
      console.log(`Daily OHLC attempt ${attempt}...`);

      const results = await scrapeDailyOHLCDirect();

      console.log("✅ Daily OHLC saved successfully");
      return {
        success: true,
        candles: results,
      };
    } catch (error) {
      console.error(`❌ Daily OHLC attempt ${attempt} failed:`, error.message);

      if (attempt >= maxRetries) {
        console.error("🚨 All daily OHLC retry attempts failed.");
        return {
          success: false,
          error: error.message,
        };
      }

      const delay = attempt * 5000;
      console.log(`⏳ Retrying daily OHLC in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Every 15 minutes, Monday-Friday
cron.schedule(
  "*/15 9-15 * * 1-5",
  async () => {
    console.log("15-minute price history collection attempt");

    try {
      const result = await collectHistoryWithRetry(3);

      if (!result.success) {
        console.error("⚠️ Price history failed after retries");
      }
    } catch (err) {
      console.error("Price history cron error:", err.message);
    }
  },
  {
    timezone: "Asia/Manila",
  }
);

// Daily OHLC scrape after market close, Monday-Friday
cron.schedule(
  "0 17 * * 1-5",
  async () => {
    console.log("Daily OHLC scrape attempt");

    try {
      const result = await scrapeDailyOHLCWithRetry(3);

      if (!result.success) {
        console.error("⚠️ Daily OHLC failed after retries");
      } else {
        console.log(`✅ Daily OHLC saved for ${result.candles.length} stocks`);
      }
    } catch (err) {
      console.error("Daily OHLC cron error:", err.message);
    }
  },
  {
    timezone: "Asia/Manila",
  }
);

// Daily email at 6:00 PM, Monday-Friday
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
      console.error("Email cron error:", err.message);
    }
  },
  {
    timezone: "Asia/Manila",
  }
);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});