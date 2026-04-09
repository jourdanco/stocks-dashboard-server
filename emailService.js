require("dotenv").config();

const fs = require("fs");
const path = require("path");

const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

const { getMarketData, getWatchlistData } = require("./scraperService");
const { getLastCandles } = require("./ohlcService");
const { initFirebase } = require("./firebaseService");
const echarts = require("echarts");
const { createCanvas } = require("canvas");
const { generateCandlestickChartBuffer, generateLineChartBuffer } = require("./echartsService");

// ================= DATE =================
function getPHDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// ================= DAILY PRICE HISTORY =================
async function getDailyPriceHistory(symbol) {
  const db = initFirebase();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const snapshot = await db.collection("price_history")
    .where("symbol", "==", symbol)
    .where("timestamp", ">=", startOfDay.toISOString())
    .where("timestamp", "<=", endOfDay.toISOString())
    .orderBy("timestamp")
    .get();

  return snapshot.docs.map(doc => doc.data());
}


// ================= BUILD DAILY CHARTS =================
async function buildDailyLineChartMap(watchlist) {
  const chartMap = {};
  const isLocal = process.env.BASE_URL?.includes("localhost");
  const chartsDir = path.join(__dirname, "charts");

  if (!fs.existsSync(chartsDir)) fs.mkdirSync(chartsDir);

  for (const stock of watchlist) {
    try {
      const priceHistory = await getDailyPriceHistory(stock.symbol);
      if (!priceHistory || priceHistory.length === 0) continue;

      const buffer = await generateLineChartBuffer(stock.symbol, priceHistory, 900, 500);

      if (isLocal) {
        chartMap[stock.symbol] = `data:image/png;base64,${buffer.toString("base64")}`;
      } else {
        const filePath = path.join(chartsDir, `${stock.symbol}-daily.png`);
        fs.writeFileSync(filePath, buffer);
        chartMap[stock.symbol] = `${process.env.BASE_URL}/charts/${stock.symbol}-daily.png`;
      }
    } catch (err) {
      console.error(`Daily line chart failed for ${stock.symbol}:`, err.message);
    }
  }

  return chartMap;
}

// ================= BUILD MONTHLY CHARTS =================
async function buildChartMap(watchlist) {
  const chartMap = {};
  const isLocal = process.env.BASE_URL?.includes("localhost");

  const chartsDir = path.join(__dirname, "charts");
  if (!fs.existsSync(chartsDir)) {
    fs.mkdirSync(chartsDir);
  }

  for (const stock of watchlist) {
    try {
      const candles = await getLastCandles(stock.symbol, 30);
      if (!candles || candles.length === 0) continue;

      const sortedCandles = [...candles].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      const buffer = await generateCandlestickChartBuffer(
        stock.symbol,
        sortedCandles,
        900,
        500
      );

      if (isLocal) {
        chartMap[stock.symbol] = `data:image/png;base64,${buffer.toString("base64")}`;
      } else {
        const filePath = path.join(chartsDir, `${stock.symbol}.png`);
        fs.writeFileSync(filePath, buffer);
        chartMap[stock.symbol] = `${process.env.BASE_URL}/charts/${stock.symbol}.png`;
      }
    } catch (err) {
      console.error(`Chart failed for ${stock.symbol}:`, err.message);
    }
  }

  return chartMap;
}

// ================= WATCHLIST HTML =================
async function buildWatchlistHTML(watchlist, chartMap = {}, dailyLineChartMap = {}) {
  let watchlistHTML = "";

  for (const stock of watchlist) {
    const change = Number(stock.change || 0);
    const color = change > 0 ? "#22c55e" : change < 0 ? "#ef4444" : "#f8fafc";
    const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "";

    let chartHtml = "";

    // ✅ If a daily chart exists, show it first
    if (dailyLineChartMap[stock.symbol]) {
      chartHtml += `
        <div style="margin-top: 14px;">
          <div style="font-size: 13px; color: #cbd5e1; margin-bottom: 8px;">Daily Price Chart</div>
          <img
            src="${dailyLineChartMap[stock.symbol]}"
            alt="${stock.symbol}"
            style="width: 100%; max-width: 620px; border-radius: 10px; display: block;"
          />
        </div>
      `;
    }

    // Then show the monthly chart below
    if (chartMap[stock.symbol]) {
      chartHtml += `
        <div style="margin-top: 12px;">
          <div style="font-size: 13px; color: #cbd5e1; margin-bottom: 8px;">Monthly Chart</div>
          <img
            src="${chartMap[stock.symbol]}"
            alt="${stock.symbol}"
            style="width: 100%; max-width: 620px; border-radius: 10px; display: block;"
          />
        </div>
      `;
    } else {
      chartHtml = `
        <div style="margin-top: 14px; font-size: 13px; color: #94a3b8;">
          Chart unavailable for now.
        </div>
      `;
    }

    watchlistHTML += `
      <tr>
        <td style="padding: 0 0 14px 0;">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              width: 100%;
              background: #1e293b;
              border-radius: 12px;
            "
          >
            <tr>
              <td style="padding: 16px;">
                <div style="font-size: 18px; font-weight: bold; color: #f8fafc; margin-bottom: 4px;">
                  ${stock.symbol}
                </div>
                <div style="font-size: 13px; color: #cbd5e1; margin-bottom: 14px; line-height: 1.4;">
                  ${stock.companyName}
                </div>

                <div style="font-size: 14px; color: #e2e8f0; line-height: 1.8;">
                  <div><strong>Price:</strong> ${stock.lastTradedPrice || "N/A"}</div>
                  <div style="color: ${color}; font-weight: bold;">
                    <strong>Change:</strong> ${arrow} ${stock.change || "N/A"}
                  </div>
                  <div style="color: ${color}; font-weight: bold;">
                    <strong>% Change:</strong> ${stock.percentChange || "N/A"}%
                  </div>
                  <div><strong>Volume:</strong> ${stock.volume || "N/A"}</div>
                  <div><strong>Value:</strong> ${stock.value || "N/A"}</div>
                  <div><strong>As of:</strong> ${stock.asOf || "N/A"}</div>
                </div>

                ${chartHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }

  return watchlistHTML;
}

// ================= EMAIL HTML =================
async function formatEmailHTML(marketData, watchlist, chartMap = {}, dailyLineChartMap = {}) {
  const serverDate = getPHDateString();
  const watchlistHTML = await buildWatchlistHTML(watchlist, chartMap, dailyLineChartMap);

  const pseiChange = Number(marketData?.psei?.change || 0);
  const pseiColor = pseiChange > 0 ? "#22c55e" : pseiChange < 0 ? "#ef4444" : "#f8fafc";
  const pseiArrow = pseiChange > 0 ? "▲" : pseiChange < 0 ? "▼" : "";

  return `
     <div style="margin: 0; padding: 0; background-color: #0f172a;">
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="width: 100%; background-color: #0f172a; font-family: Arial, sans-serif; color: #f8fafc;"
      >
        <tr>
          <td align="center" style="padding: 24px 12px;">
            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              border="0"
              style="max-width: 720px; width: 100%; background-color: #0f172a;"
            >
              <tr>
                <td style="padding-bottom: 20px; text-align: center;">
                  <div style="font-size: 26px; font-weight: bold; color: #f8fafc;">
                    📊 Daily Stocks Report ${serverDate}
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding-bottom: 16px;">
                  <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                    style="width: 100%; background: #1e293b; border-radius: 12px;"
                  >
                    <tr>
                      <td style="padding: 18px;">
                        <div style="font-size: 18px; font-weight: bold; margin-bottom: 12px;">Market Overview</div>
                        <div style="font-size: 14px; line-height: 1.8;">
                          <div><strong>Status:</strong> ${marketData.marketStatus || "N/A"}</div>
                          <div><strong>As of:</strong> ${marketData.asOf || "N/A"}</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-bottom: 16px;">
                  <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                    style="width: 100%; background: #1e293b; border-radius: 12px;"
                  >
                    <tr>
                      <td style="padding: 18px;">
                        <div style="font-size: 18px; font-weight: bold; margin-bottom: 12px;">PSEi</div>
                        <div style="font-size: 14px; line-height: 1.8;">
                          <div><strong>Value:</strong> ${marketData?.psei?.value || "N/A"}</div>
                          <div style="color: ${pseiColor}; font-weight: bold;">
                            <strong>Change:</strong> ${pseiArrow} ${marketData?.psei?.change || "N/A"}
                          </div>
                          <div style="color: ${pseiColor}; font-weight: bold;">
                            <strong>% Change:</strong> ${marketData?.psei?.percentChange || "N/A"}%
                          </div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-bottom: 16px;">
                  <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                    style="width: 100%; background: #1e293b; border-radius: 12px;"
                  >
                    <tr>
                      <td style="padding: 18px;">
                        <div style="font-size: 18px; font-weight: bold; margin-bottom: 12px;">Market Totals</div>
                        <div style="font-size: 14px; line-height: 1.8;">
                          <div><strong>Volume:</strong> ${marketData?.totals?.volume || "N/A"}</div>
                          <div><strong>Trades:</strong> ${marketData?.totals?.trades || "N/A"}</div>
                          <div><strong>Value:</strong> ${marketData?.totals?.value || "N/A"}</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-bottom: 16px;">
                  <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                    style="width: 100%; background: #1e293b; border-radius: 12px;"
                  >
                    <tr>
                      <td style="padding: 18px;">
                        <div style="font-size: 18px; font-weight: bold; margin-bottom: 12px;">Market Breadth</div>
                        <div style="font-size: 14px; line-height: 1.8;">
                          <div><strong>Advances:</strong> ${marketData?.breadth?.advances || "N/A"}</div>
                          <div><strong>Declines:</strong> ${marketData?.breadth?.declines || "N/A"}</div>
                          <div><strong>Unchanged:</strong> ${marketData?.breadth?.unchanged || "N/A"}</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-bottom: 8px;">
                  <div style="font-size: 18px; font-weight: bold; margin-bottom: 12px;">Watchlist</div>
                </td>
              </tr>

              <tr>
                <td>
                  <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                    style="width: 100%;"
                  >
                    ${watchlistHTML}
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-top: 10px; text-align: center;">
                  <div style="font-size: 12px; color: #94a3b8;">
                    Sent automatically every 6:00PM © jdan
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

// ================= SEND =================
async function sendEmailDirect() {
  const marketData = await getMarketData();
  const watchlistData = await getWatchlistData();
  const serverDate = getPHDateString();

  const chartMap = await buildChartMap(watchlistData.watchlist);
  const dailyLineChartMap = await buildDailyLineChartMap(watchlistData.watchlist);

  const html = await formatEmailHTML(
    marketData,
    watchlistData.watchlist,
    chartMap,
    dailyLineChartMap
  );

  return await resend.emails.send({
    from: "onboarding@resend.dev",
    to: process.env.EMAIL_TO,
    subject: `📊 Daily Stocks Report ${serverDate}`,
    html,
  });
}

// ================= TEST =================
async function sendSimpleTestEmail() {
  return await resend.emails.send({
    from: "onboarding@resend.dev",
    to: process.env.EMAIL_TO,
    subject: "Test Email",
    html: "<p>Test OK</p>",
  });
}

// ================= RETRY =================
async function sendEmailWithRetry(maxRetries = 3) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      console.log(`Attempt ${i}`);
      await sendEmailDirect();
      return true;
    } catch (e) {
      console.error("Fail:", e.message);
      await new Promise((r) => setTimeout(r, i * 5000));
    }
  }
  return false;
}

module.exports = {
  sendEmailDirect,
  sendSimpleTestEmail,
  sendEmailWithRetry,
};