// api/rpc-proxy.js

export default async function handler(req, res) {
  // 設置 CORS 標頭
  res.setHeader('Access-Control-Allow-Origin', 'https://enigmaticsloth.github.io'); // 或使用 '*' 允許所有來源（不推薦）
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 處理預檢請求（OPTIONS）
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // 僅允許 POST 請求
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const quicknodeRpcUrl = 'https://intensit.solana-mainnet.quiknode.pro/61466a6e88d0e1f1f55ea00bf5ec117e22d16849'; // 替換為您的 QuickNode RPC URL

  try {
    // 將前端的請求轉發到 QuickNode RPC 端點
    const response = await fetch(quicknodeRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    // 將 QuickNode 的響應返回給前端
    const data = await response.json();

    res.status(response.status).json(data);
  } catch (error) {
    console.error('RPC Proxy Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
