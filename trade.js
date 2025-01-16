// pricing.js

// 初始預設價格（USD），若查詢失敗則沿用此值
window.CURRENT_NOVA_PRICE_USD = 0.00123;

// 使用 GeckoTerminal API v2 取得價格
async function fetchCurrentPrice() {
  try {
    // 基本 URL 與版本設定 (根據 API 文件)
    const contractAddress = "5vjrnc823W14QUvomk96N2yyJYyG92Ccojyku64vofJX"; // 你的 mint pda
    const url = `https://api.geckoterminal.com/api/v2/simple/networks/solana/token_price/${contractAddress}`;

    // 設定 header，指定 API 版本
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
    // { "data": { "5vjrnc823W14QUvomk96N2yyJYyG92Ccojyku64vofJX": { "usd": 0.00123 } } }
    if (data && data.data && data.data[contractAddress] && data.data[contractAddress].usd) {
      window.CURRENT_NOVA_PRICE_USD = data.data[contractAddress].usd;
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

// 初次呼叫與定時更新（每 1 分鐘更新一次）
fetchCurrentPrice();
setInterval(fetchCurrentPrice, 60 * 1000);
