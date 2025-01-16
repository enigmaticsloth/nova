// pricing.js

// 將價格存入全域變數，單位為 USD
window.CURRENT_NOVA_PRICE_USD = 0.00123;

// 從 GeckoTerminal API v2 取得價格
async function fetchCurrentPrice() {
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
    // 假設回傳格式：
    // {
    //   "data": {
    //     "id": "xxx",
    //     "type": "simple_token_price",
    //     "attributes": {
    //       "token_prices": {
    //         "5vjrnc823W14QUvomk96N2yyJYyG92Ccojyku64vofJX": "237.433210276503"
    //       }
    //     }
    //   }
    // }
    if (
      data &&
      data.data &&
      data.data.attributes &&
      data.data.attributes.token_prices &&
      data.data.attributes.token_prices[contractAddress]
    ) {
      window.CURRENT_NOVA_PRICE_USD = parseFloat(data.data.attributes.token_prices[contractAddress]);
      const priceStatus = document.getElementById('priceStatus');
      if (priceStatus) {
        priceStatus.innerText = `Current NOVA Price: $${window.CURRENT_NOVA_PRICE_USD.toFixed(6)} USD`;
      }
    } else {
      const priceStatus = document.getElementById('priceStatus');
      if (priceStatus) {
        priceStatus.innerText = "Price data missing in API response; using default value.";
      }
    }
  } catch (err) {
    console.error("Price fetch error:", err);
    const priceStatus = document.getElementById('priceStatus');
    if (priceStatus) {
      priceStatus.innerText = `Failed to fetch price, using default value. Error: ${err.message}`;
    }
  }
}

// 初始呼叫與每 2 秒更新一次
fetchCurrentPrice();
setInterval(fetchCurrentPrice, 2 * 1000);
