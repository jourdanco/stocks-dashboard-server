require("dotenv").config();

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
  "* * * * *",
  async () => {
    console.log("Email send");

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