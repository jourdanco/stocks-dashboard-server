const { initFirebase } = require("./firebaseService");

async function savePriceSnapshot(stock) {
  const db = initFirebase();

  await db.collection("price_history").add({
    symbol: stock.symbol,
    companyName: stock.companyName,
    cmpyId: stock.cmpyId,
    asOf: stock.asOf || null,
    status: stock.status || null,
    timestamp: new Date().toISOString(),
    price: Number(String(stock.lastTradedPrice || "0").replace(/,/g, "")),
    open: Number(String(stock.open || "0").replace(/,/g, "")),
    previousClose: Number(String(stock.previousClose || "0").replace(/,/g, "")),
    change: Number(String(stock.change || "0").replace(/,/g, "")),
    percentChange: Number(String(stock.percentChange || "0").replace(/,/g, "")),
    volume: Number(String(stock.volume || "0").replace(/,/g, "")),
    value: Number(String(stock.value || "0").replace(/,/g, "")),
    week52High: Number(String(stock.week52High || "0").replace(/,/g, "")),
    week52Low: Number(String(stock.week52Low || "0").replace(/,/g, "")),
  });
}

module.exports = {
  savePriceSnapshot,
};