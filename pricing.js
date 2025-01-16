// pricing.js

// Default NOVA price (USD)
window.CURRENT_NOVA_PRICE_USD = 0.00123;
// Default SOL price (USD)
window.SOL_USD_PRICE = 20;

// Cache variables
let novaPriceLastFetched = 0;
let solPriceLastFetched = 0;
const PRICE_CACHE_DURATION = 10000; // 10 seconds

async function fetchNOVA_Price() {
  const now = Date.now();
  if (now - novaPriceLastFetched < PRICE_CACHE_DURATION) {
    console.log("Using cached NOVA price.");
    return;
  }

  try {
    const contractAddress = "5vjrnc823W14QUvomk96N2yyJYyG92Ccojyku64vofJX";
    const url = `https://api.geckoterminal.com/api/v2/simple/networks/solana/token_price/${contractAddress}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json;version=20230302" }
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const data = await response.json();
    console.log("GeckoTerminal API response:", data);
    if (
      data &&
      data.data &&
      data.data.attributes &&
      data.data.attributes.token_prices &&
      data.data.attributes.token_prices[contractAddress]
    ) {
      window.CURRENT_NOVA_PRICE_USD = parseFloat(data.data.attributes.token_prices[contractAddress]);
      updatePriceDisplay();
      novaPriceLastFetched = now;
    } else {
      updatePriceDisplay("NOVA price data missing; using default value.");
    }
  } catch (err) {
    console.error("NOVA Price fetch error:", err);
    updatePriceDisplay(`Failed to fetch NOVA price. Error: ${err.message}`);
  }
}

async function fetchSOL_Price() {
  const now = Date.now();
  if (now - solPriceLastFetched < PRICE_CACHE_DURATION) {
    console.log("Using cached SOL price.");
    return;
  }

  try {
    const url = "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT";
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Binance HTTP error ${response.status}`);
    }
    const data = await response.json();
    console.log("Binance SOL price response:", data);
    if (data && data.price) {
      window.SOL_USD_PRICE = parseFloat(data.price);
      updatePriceDisplay();
      solPriceLastFetched = now;
    } else {
      updatePriceDisplay("SOL price data missing; using default value.");
    }
  } catch (err) {
    console.error("SOL Price fetch error:", err);
    updatePriceDisplay(`Failed to fetch SOL price. Error: ${err.message}`);
  }
}

function updatePriceDisplay(message) {
  const priceStatus = document.getElementById('priceStatus');
  if (priceStatus) {
    if (message) {
      priceStatus.innerText = message;
    } else {
      priceStatus.innerText = `NOVA Price: $${window.CURRENT_NOVA_PRICE_USD.toFixed(6)} USD, SOL Price: $${window.SOL_USD_PRICE.toFixed(2)} USD`;
    }
  }
}

// Initial fetch and set interval to 10 seconds
fetchNOVA_Price();
fetchSOL_Price();
setInterval(fetchNOVA_Price, PRICE_CACHE_DURATION);
setInterval(fetchSOL_Price, PRICE_CACHE_DURATION);
