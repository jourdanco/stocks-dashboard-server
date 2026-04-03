const { initFirebase } = require("./firebaseService");

function getPHDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function buildDailyOHLCForSymbol(symbol) {
  const db = initFirebase();
  const dateString = getPHDateString();

  const snapshot = await db
    .collection("price_history")
    .where("symbol", "==", symbol)
    .get();

  const rows = snapshot.docs
    .map((doc) => doc.data())
    .filter((row) => row.timestamp.startsWith(dateString))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (!rows.length) return null;

  const prices = rows.map((r) => r.price);

  const candle = {
    symbol,
    date: dateString,
    open: rows[0].price,
    high: Math.max(...prices),
    low: Math.min(...prices),
    close: rows[rows.length - 1].price,
    points: rows.length,
    updatedAt: new Date().toISOString(),
  };

  await db.collection("daily_ohlc").doc(`${symbol}_${dateString}`).set(candle);

  return candle;
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

  return candles.reverse(); // oldest → newest
}

module.exports = {
  buildDailyOHLCForSymbol,
  getLastCandles,
};