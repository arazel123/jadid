let allSymbols = [];
let currentChart;
let currentSymbol = "BTCUSDT";

async function getUSDTTradingPairs() {
  const res = await fetch('https://api.binance.com/api/v3/exchangeInfo');
  const data = await res.json();
  allSymbols = data.symbols
    .filter(s =>
      s.symbol.endsWith("USDT") &&
      s.status === "TRADING" &&
      !s.symbol.includes("UP") &&
      !s.symbol.includes("DOWN"))
    .map(s => s.symbol);
  updatePairList("");
  renderChart(currentSymbol);
}

function updatePairList(filter) {
  const list = document.getElementById("pair-list");
  list.innerHTML = "";
  const filtered = allSymbols.filter(sym =>
    sym.toLowerCase().includes(filter.toLowerCase())
  ).slice(0, 30);

  filtered.forEach(sym => {
    const li = document.createElement("li");
    li.textContent = sym;
    li.addEventListener("click", () => {
      currentSymbol = sym;
      renderChart(sym);
      list.style.display = "none";
    });
    list.appendChild(li);
  });
}

document.getElementById("search").addEventListener("input", e => {
  const value = e.target.value.trim();
  const list = document.getElementById("pair-list");
  if (value.length > 0) {
    list.style.display = "block";
    updatePairList(value);
  } else {
    list.style.display = "none";
  }
});

document.getElementById("interval").addEventListener("change", () => {
  renderChart(currentSymbol);
});

async function fetchCandles(symbol, interval) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=50`;
  const res = await fetch(url);
  const data = await res.json();
  return data.map(c => {
    const open = parseFloat(c[1]);
    const close = parseFloat(c[4]);
    const volume = parseFloat(c[5]);
    let buy = 0.7 * volume;
    let sell = 0.3 * volume;
    if (close < open) [buy, sell] = [sell, buy];
    return {
      time: new Date(c[0]).toLocaleString(),
      open,
      close,
      volume,
      buy,
      sell
    };
  });
}

function checkForSignal(data) {
  const recent = data.slice(-3);
  const signalCandle = recent[0];
  const avgSell = average(data.slice(0, -3).map(d => d.sell));
  const avgBuy = average(data.slice(0, -3).map(d => d.buy));

  let signal = null;

  if (signalCandle.sell > avgSell * 1.5 && (signalCandle.close >= signalCandle.open)) {
    if (recent[1].buy > avgBuy && recent[2].buy > recent[1].buy) {
      signal = {
        type: "خرید",
        sl: signalCandle.close * 0.98,
        tp: signalCandle.close * 1.04
      };
    }
  } else if (signalCandle.buy > avgBuy * 1.5 && (signalCandle.close <= signalCandle.open)) {
    if (recent[1].sell > avgSell && recent[2].sell > recent[1].sell) {
      signal = {
        type: "فروش",
        sl: signalCandle.close * 1.02,
        tp: signalCandle.close * 0.96
      };
    }
  }

  if (signal) {
    signal.time = signalCandle.time;
    signal.symbol = currentSymbol;
    displayLiveSignal(signal);
  }
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function displayLiveSignal(signal) {
  const container = document.getElementById("signalNow");
  container.innerHTML = `
    🚨 سیگنال جدید صادر شد!
    <br>جفت ارز: ${signal.symbol}
    <br>زمان: ${signal.time}
    <br>نوع سیگنال: ${signal.type}
    <br>SL: ${signal.sl.toFixed(3)} | TP: ${signal.tp.toFixed(3)}
  `;
  // انتقال به لیست پس از 15 دقیقه
  setTimeout(() => {
    logSignal(signal);
    container.innerHTML = "🔍 منتظر بررسی داده‌ها...";
  }, 15 * 60 * 1000);
}

function logSignal(signal) {
  const log = document.getElementById("signalList");
  const li = document.createElement("li");
  li.innerHTML = `
    🕒 ${signal.time} | ${signal.symbol} | ${signal.type} <br>
    🎯 TP: ${signal.tp.toFixed(3)} | 🛑 SL: ${signal.sl.toFixed(3)}
  `;
  log.appendChild(li);
}

async function renderChart(symbol) {
  const interval = document.getElementById("interval").value;
  const data = await fetchCandles(symbol, interval);
  checkForSignal(data);

  const ctx = document.getElementById("chartCanvas").getContext("2d");
  if (currentChart) currentChart.destroy();

  currentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.time),
      datasets: [
        {
          label: 'حجم خرید',
          data: data.map(d => d.buy),
          backgroundColor: 'rgba(0,255,0,0.5)',
          stack: 'vol',
          yAxisID: 'y'
        },
        {
          label: 'حجم فروش',
          data: data.map(d => d.sell),
          backgroundColor: 'rgba(255,0,0,0.5)',
          stack: 'vol',
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'قیمت',
          data: data.map(d => d.close),
          borderColor: 'cyan',
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.3,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          stacked: true,
          position: 'left',
          ticks: { color: '#0f0' }
        },
        y1: {
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#0ff' }
        }
      },
      plugins: {
        legend: { labels: { color: '#fff' } }
      }
    }
  });
}

getUSDTTradingPairs();
