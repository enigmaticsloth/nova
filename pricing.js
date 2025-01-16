// pricing.js

// 將 NOVA 價格預設為 0.00123 USD（若查詢失敗則沿用此值）
window.CURRENT_NOVA_PRICE_USD = 0.00123;
// 預設 SOL 價格（USD），初始為 20 美元，之後會從 Binance 更新
window.SOL_USD_PRICE = 20;

// 從 GeckoTerminal API v2 取得 NOVA 價格（USD）
async function fetchNOVA_Price() {
  try {
    const contractAddress = "5vjrnc823W14QUvomk96N2yyJYyG92Ccojyku64vofJX";
    const url = `https://api.geckoterminal.com/api/v2/simple/networks/solana/token_price/${contractAddress}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json;version=20230302"
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const data = await response.json();
    console.log("GeckoTerminal API response:", data);
    // 解析格式：
    // { "data": { "attributes": { "token_prices": { "<contractAddress>": "237.433210276503" } } } }
    if (
      data &&
      data.data &&
      data.data.attributes &&
      data.data.attributes.token_prices &&
      data.data.attributes.token_prices[contractAddress]
    ) {
      window.CURRENT_NOVA_PRICE_USD = parseFloat(data.data.attributes.token_prices[contractAddress]);
      updatePriceDisplay();
    } else {
      updatePriceDisplay("Price data missing in API response; using default value.");
    }
  } catch (err) {
    console.error("NOVA Price fetch error:", err);
    updatePriceDisplay(`Failed to fetch NOVA price, using default value. Error: ${err.message}`);
  }
}

// 從 Binance API 取得 SOL-USDT 價格
async function fetchSOL_Price() {
  try {
    // Binance REST API: SOLUSDT
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
    } else {
      updatePriceDisplay("SOL price data missing; using default value.");
    }
  } catch (err) {
    console.error("SOL Price fetch error:", err);
    updatePriceDisplay(`Failed to fetch SOL price, using default value. Error: ${err.message}`);
  }
}

// 更新頁面上價格顯示
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

// 初次呼叫並定時更新
fetchNOVA_Price();
fetchSOL_Price();
// 這裡設為每 2 秒更新一次，注意 API 限制，建議測試時低頻率即可
setInterval(fetchNOVA_Price, 2 * 1000);
setInterval(fetchSOL_Price, 2 * 1000);
