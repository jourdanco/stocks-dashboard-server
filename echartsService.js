const echarts = require("echarts");
const { createCanvas } = require("canvas");

function buildCandlestickOption(symbol, candles) {
  return {
    backgroundColor: "#1e293b",
    animation: false,
    title: {
      text: `${symbol}`,
      left: "center",
      textStyle: {
        color: "#f8fafc",
        fontSize: 18,
      },
    },
    grid: {
      left: 60,
      right: 20,
      top: 60,
      bottom: 50,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
      },
    },
    xAxis: {
      type: "category",
      data: candles.map((c) => c.date),
      boundaryGap: true,
      axisLine: {
        lineStyle: { color: "#94a3b8" },
      },
      axisLabel: {
        color: "#cbd5e1",
      },
      splitLine: {
        show: false,
      },
    },
    yAxis: {
      scale: true,
      axisLine: {
        lineStyle: { color: "#94a3b8" },
      },
      axisLabel: {
        color: "#cbd5e1",
      },
      splitLine: {
        lineStyle: { color: "#334155" },
      },
      splitArea: {
        show: false,
      },
    },
    series: [
      {
        name: symbol,
        type: "candlestick",
        data: candles.map((c) => [
          Number(c.open),
          Number(c.close),
          Number(c.low),
          Number(c.high),
        ]),
        itemStyle: {
          color: "#22c55e",
          color0: "#ef4444",
          borderColor: "#22c55e",
          borderColor0: "#ef4444",
        },
      },
    ],
  };
}

async function generateCandlestickChartBuffer(
  symbol,
  candles,
  width = 900,
  height = 500
) {
  const canvas = createCanvas(width, height);

  const chart = echarts.init(canvas, null, {
    renderer: "canvas",
    width,
    height,
  });

  const option = buildCandlestickOption(symbol, candles);
  chart.setOption(option);

  const buffer = canvas.toBuffer("image/png");
  chart.dispose();

  return buffer;
}

module.exports = {
  buildCandlestickOption,
  generateCandlestickChartBuffer,
};