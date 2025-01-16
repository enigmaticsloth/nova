// pricing.js

// 全域價格變數，初始預設值（USD 單位）
window.CURRENT_NOVA_PRICE_USD = 0.00123;

// 預設 SOL 的 USD 價格（你可以另外更新）
window.SOL_USD_PRICE = 20;

// fetchPrice() 函式：從 Geckoterminal API 查詢價格
async function fetchPrice() {
  try {
    // 請根據 Geckoterminal API 文件確認 URL 格式與合約地址
    const contractAddress = "5vjrnc823W14QUvomk96N2yyJYyG92Ccojyku64vofJX";
    const url = `https://api.geckoterminal.com/simple/networks/solana/token_price/${contractAddress}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const data = await response.json();
    console.log("Geckoterminal API response:", data);

    // 假設 API 回傳格式：
    // {
    //   "data": {
    //     "5vjrnc823W14QUvomk96N2yyJYyG92Ccojyku64vofJX": { "usd": 0.00123 }
    //   }
    // }
    if (
      data &&
      data.data &&
      data.data[contractAddress] &&
      data.data[contractAddress].usd
    ) {
      window.CURRENT_NOVA_PRICE_USD = data.data[contractAddress].usd;
      // 更新頁面上價格顯示
      const priceStatus = document.getElementById('priceStatus');
      if (priceStatus) {
        priceStatus.innerText = `Current NOVA Price: $${window.CURRENT_NOVA_PRICE_USD.toFixed(6)} USD`;
      }
    } else {
      console.warn("Price data missing in API response; using default value.");
      const priceStatus = document.getElementById('priceStatus');
      if (priceStatus) {
        priceStatus.innerText = "Price data missing; using default value.";
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

// 一開始呼叫一次，然後每分鐘更新一次
fetchPrice();
setInterval(fetchPrice, 60 * 1000);
