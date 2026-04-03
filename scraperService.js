const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

function getWatchlist() {
  const filePath = path.join(__dirname, "watchlist.json");
  const fileData = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(fileData);
}

async function getMarketData() {
  const url = "https://edge.pse.com.ph/index/form.do";

  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  });

  const $ = cheerio.load(data);
  $("script, style, noscript").remove();

  const cleanText = $("body")
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const marketMatch =
    cleanText.match(
      /MARKET\s*:?\s*(OPEN|CLOSED)\s*As of\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s*[AP]M)/i
    ) ||
    cleanText.match(
      /(OPEN|CLOSED)\s*As of\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s*[AP]M)/i
    );

  const pseiMatch = cleanText.match(
    /PSEi\s+([\d,]+\.\d+)\s+([+-]?[\d,]+\.\d+)\s+([+-]?[\d,]+\.\d+)/i
  );

  const totalVolumeMatch = cleanText.match(/Total Volume\s+([\d,]+)/i);
  const totalTradesMatch = cleanText.match(/Total Trades\s+([\d,]+)/i);
  const totalValueMatch = cleanText.match(/Total Value\s+([\d,]+)/i);

  const advancesMatch = cleanText.match(/Advances\s+(\d+)/i);
  const declinesMatch = cleanText.match(/Declines\s+(\d+)/i);
  const unchangedMatch = cleanText.match(/Unchanged\s+(\d+)/i);

  return {
    success: true,
    marketStatus: marketMatch ? marketMatch[1] : null,
    asOf: marketMatch ? marketMatch[2] : null,
    psei: {
      value: pseiMatch ? pseiMatch[1] : null,
      change: pseiMatch ? pseiMatch[2] : null,
      percentChange: pseiMatch ? pseiMatch[3] : null,
    },
    totals: {
      volume: totalVolumeMatch ? totalVolumeMatch[1] : null,
      trades: totalTradesMatch ? totalTradesMatch[1] : null,
      value: totalValueMatch ? totalValueMatch[1] : null,
    },
    breadth: {
      advances: advancesMatch ? advancesMatch[1] : null,
      declines: declinesMatch ? declinesMatch[1] : null,
      unchanged: unchangedMatch ? unchangedMatch[1] : null,
    },
  };
}

async function scrapeStock(stock) {
  const url = `https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=${stock.cmpyId}`;

  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  });

  const $ = cheerio.load(data);
  $("script, style, noscript").remove();

  const cleanText = $("body")
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const asOfStatusMatch =
    cleanText.match(
      /As of\s+([A-Za-z]+\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s*[AP]M)\s+Status\s+(Open|Closed)/i
    ) ||
    cleanText.match(
      /As of\s+([A-Za-z]+\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s*[AP]M)/i
    );

  const lastTradedPriceMatch = cleanText.match(/Last Traded Price\s+([\d,]+\.\d+)/i);
  const openMatch = cleanText.match(/Open\s+([\d,]+\.\d+)/i);
  const previousCloseMatch = cleanText.match(
    /Previous Close and Date\s+([\d,]+\.\d+)\s+\(([A-Za-z]+\s+\d{1,2},\s+\d{4})\)/i
  );
  const changeMatch =
  cleanText.match(
    /Change\(%\s*Change\)\s+(?:up|down|unch)?\s*([+\-]?[\d,]+\.\d+)\s+\(([+\-]?[\d,]+\.\d+)%\)/i
  ) ||
  cleanText.match(
    /Change\(%\s*Change\)\s+([+\-]?[\d,]+\.\d+)\s+\(([+\-]?[\d,]+\.\d+)%\)/i
  );
  const valueMatch =
    cleanText.match(/Change\(% Change\).*?Value\s+([\d,]+\.\d+)/i) ||
    cleanText.match(/Last Traded Price.*?Value\s+([\d,]+\.\d+)/i);
  const volumeMatch = cleanText.match(/Volume\s+([\d,]+)/i);
  const highMatch = cleanText.match(/52-Week High\s+([\d,]+\.\d+)/i);
  const lowMatch = cleanText.match(/52-Week Low\s+([\d,]+\.\d+)/i);

  return {
    cmpyId: stock.cmpyId,
    symbol: stock.symbol,
    companyName: stock.companyName,
    asOf: asOfStatusMatch ? asOfStatusMatch[1] : null,
    status: asOfStatusMatch && asOfStatusMatch[2] ? asOfStatusMatch[2] : null,
    lastTradedPrice: lastTradedPriceMatch ? lastTradedPriceMatch[1] : null,
    open: openMatch ? openMatch[1] : null,
    previousClose: previousCloseMatch ? previousCloseMatch[1] : null,
    previousCloseDate: previousCloseMatch ? previousCloseMatch[2] : null,
    change: changeMatch ? changeMatch[1] : null,
    percentChange: changeMatch ? changeMatch[2] : null,
    value: valueMatch ? valueMatch[1] : null,
    volume: volumeMatch ? volumeMatch[1] : null,
    week52High: highMatch ? highMatch[1] : null,
    week52Low: lowMatch ? lowMatch[1] : null,
  };
}

async function getWatchlistData() {
  const watchlist = getWatchlist();
  const results = await Promise.all(watchlist.map((stock) => scrapeStock(stock)));

  return {
    success: true,
    watchlist: results,
  };
}

module.exports = {
  getMarketData,
  getWatchlistData,
  getWatchlist,
};
