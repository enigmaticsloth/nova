// api/rpc-proxy.js

export default async function handler(req, res) {
  // 設置 CORS 標頭，僅允許指定來源
  res.setHeader("Access-Control-Allow-Origin", "https://enigmaticsloth.github.io");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, solana-client");

  // 處理 OPTIONS 預檢請求
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // 僅允許 POST 請求
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  // QuickNode RPC URL，確保有末尾的斜線
  const quicknodeRpcUrl = 'https://intensive-omniscient-asphalt.solana-mainnet.quiknode.pro/61466a6e88d0e1f1f55ea00bf5ec117e22d16849/';

  try {
    // 日誌：記錄收到的請求
    console.log("Proxy received request:", JSON.stringify(req.body));

    // 轉發請求到 QuickNode RPC
    const response = await fetch(quicknodeRpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    // 日誌：記錄 RPC 回應狀態
    console.log("Proxy forwarded request to RPC and received status:", response.status);

    // 檢查 RPC 回應是否成功
    if (!response.ok) {
      throw new Error(`RPC Error: ${response.status} ${response.statusText}`);
    }

    // 獲取回應數據
    const data = await response.json();
    console.log("RPC response data:", JSON.stringify(data));

    // 檢查回應是否為有效的 JSON-RPC 回應
    if (data.jsonrpc !== "2.0") {
      throw new Error("Invalid JSON-RPC response");
    }

    // 返回回應給前端
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Proxy Error:", error.message);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
}