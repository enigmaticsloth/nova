import { Connection } from "@solana/web3.js";

export default async function handler(req, res) {
  // 設置 CORS 標頭
  res.setHeader("Access-Control-Allow-Origin", "https://enigmaticsloth.github.io");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // 處理 OPTIONS 請求
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // 僅允許 POST 請求
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    // 使用 QuickNode 提供的 RPC URL
    const connection = new Connection(
      "https://intensive-omniscient-asphalt.solana-mainnet.quiknode.pro/61466a6e88d0e1f1f55ea00bf5ec117e22d16849",
      "confirmed"
    );

    // 獲取請求中的方法和參數
    const { method, params } = req.body;

    let result;

    // 根據方法執行相應操作
    switch (method) {
      case "getSlot":
        result = await connection.getSlot();
        break;
      case "getLatestBlockhash":
        result = await connection.getLatestBlockhash();
        break;
      default:
        throw new Error("Unsupported method");
    }

    // 返回結果
    res.status(200).json({
      jsonrpc: "2.0",
      id: req.body.id,
      result,
    });
  } catch (error) {
    console.error("Error in RPC Proxy:", error.message);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
}
