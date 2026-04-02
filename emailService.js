require("dotenv").config();

const nodemailer = require("nodemailer");
const { getMarketData, getWatchlistData } = require("./scraperService");

const serverDate = new Date();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function formatEmailHTML(marketData, watchlist) {
  const pseiChange = Number(marketData?.psei?.change || 0);
  const pseiColor =
    pseiChange > 0 ? "#22c55e" : pseiChange < 0 ? "#ef4444" : "#f8fafc";
  const pseiArrow = pseiChange > 0 ? "▲" : pseiChange < 0 ? "▼" : "";

  let watchlistHTML = "";

  watchlist.forEach((stock) => {
    const change = Number(stock.change || 0);
    const color =
      change > 0 ? "#22c55e" : change < 0 ? "#ef4444" : "#f8fafc";
    const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "";

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
              border: 0px;
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
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  });

  return `
    <div style="margin: 0; padding: 0; background-color: #0f172a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
        style="width: 100%; background-color: #0f172a; font-family: Arial, sans-serif; color: #f8fafc;">
        <tr>
          <td align="center" style="padding: 24px 12px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
              style="max-width: 720px; width: 100%; background-color: #0f172a;">
              <tr>
                <td style="padding-bottom: 20px; text-align: center;">
                  <div style="font-size: 26px; font-weight: bold; color: #f8fafc;">
                    📊 Daily Stocks Report ${serverDate.toLocaleDateString()}
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding-bottom: 16px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                    style="width: 100%; background: #1e293b; border-radius: 12px;">
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
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                    style="width: 100%; background: #1e293b; border-radius: 12px;">
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
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                    style="width: 100%; background: #1e293b; border-radius: 12px;">
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
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                    style="width: 100%; background: #1e293b; border-radius: 12px;">
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
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                    style="width: 100%;">
                    ${watchlistHTML}
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-top: 10px; text-align: center;">
                  <div style="font-size: 12px; color: #94a3b8;">
                    Generated automatically by your Stocks Dashboard
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

async function sendEmailDirect() {
  const marketData = await getMarketData();
  const watchlistData = await getWatchlistData();

  const htmlContent = formatEmailHTML(
    marketData,
    watchlistData.watchlist
  );

  const info = await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: `📊 Daily Stocks Report - ${serverDate.toLocaleDateString()}`,
    html: htmlContent,
  });

  return info;
}

async function sendSimpleTestEmail() {
  const info = await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: "Test Email",
    text: "If you received this, direct email sending works.",
  });

  return info;
}

async function sendEmailWithRetry(maxRetries = 3) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      attempt++;
      console.log(`Attempt ${attempt} to send email...`);

      await sendEmailDirect();

      console.log("✅ Email sent successfully");
      return true;
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);

      if (attempt >= maxRetries) {
        console.error("🚨 All retry attempts failed.");
        return false;
      }

      const delay = attempt * 5000;
      console.log(`⏳ Retrying in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

module.exports = {
  formatEmailHTML,
  sendEmailDirect,
  sendSimpleTestEmail,
  sendEmailWithRetry,
};