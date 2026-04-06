const { initFirebase } = require("./firebaseService");
const { getWatchlist, scrapeStock } = require("./scraperService");

function getPHDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseNumber(value) {
  if (!value) return null; // 👈 handles undefined, null, empty

  try {
    const num = parseFloat(String(value).replace(/,/g, ""));
    return Number.isNaN(num) ? null : num;
  } catch (err) {
    console.error("parseNumber error:", value);
    return null;
  }
}

async function scrapeAndSaveDailyOHLCForSymbol(stock) {
  const db = initFirebase();
  const dateString = getPHDateString();

  const stockData = await scrapeStock(stock);

  const open = parseNumber(stockData.open);
  const high = parseNumber(stockData.dayHigh);
  const low = parseNumber(stockData.dayLow);
  const close = parseNumber(stockData.lastTradedPrice);

  if (
    open === null ||
    high === null ||
    low === null ||
    close === null
  ) {
    throw new Error(
      `Incomplete OHLC data for ${stock.symbol}. open=${stockData.open}, high=${stockData.dayHigh}, low=${stockData.dayLow}, close=${stockData.lastTradedPrice}`
    );
  }

  const candle = {
    symbol: stockData.symbol,
    date: dateString,
    open,
    high,
    low,
    close,
    updatedAt: new Date().toISOString(),
  };

  await db
    .collection("daily_ohlc")
    .doc(`${stockData.symbol}_${dateString}`)
    .set(candle);

  return candle;
}

async function scrapeAndSaveAllDailyOHLC() {
  const watchlist = getWatchlist();
  const results = [];

  for (const stock of watchlist) {
    try {
      const candle = await scrapeAndSaveDailyOHLCForSymbol(stock);
      results.push(candle);
    } catch (error) {
      console.error(
        `Failed to save daily OHLC for ${stock.symbol}:`,
        error.message
      );
    }
  }

  return results;
}

async function getLastCandles(symbol, limit = 30) {
  const db = initFirebase();

  const snapshot = await db
    .collection("daily_ohlc")
    .where("symbol", "==", symbol)
    .orderBy("date", "desc")
    .limit(limit)
    .get();

  const candles = snapshot.docs.map((doc) => doc.data());

  return candles.reverse();
}

module.exports = {
  scrapeAndSaveDailyOHLCForSymbol,
  scrapeAndSaveAllDailyOHLC,
  getLastCandles,
};