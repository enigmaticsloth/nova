// 引入 Web3.js SDK
const web3 = require("@solana/web3.js");

(async () => {
  try {
    // 使用 QuickNode 提供的 RPC URL
    const connection = new web3.Connection(
      "https://intensive-omniscient-asphalt.solana-mainnet.quiknode.pro/61466a6e88d0e1f1f55ea00bf5ec117e22d16849/",
      "confirmed" // 設置確認等級
    );

    // 測試獲取當前槽位（slot）
    const currentSlot = await connection.getSlot();
    console.log("Current Slot:", currentSlot);

    // 獲取最新的區塊哈希
    const latestBlockhash = await connection.getLatestBlockhash();
    console.log("Latest Blockhash:", latestBlockhash);
  } catch (error) {
    console.error("Error connecting to Solana:", error);
  }
})();
