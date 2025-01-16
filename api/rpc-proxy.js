const fetch = require('node-fetch');

let cachedBlockhash = null;
let lastFetched = 0;
const CACHE_DURATION = 10000; // 10 seconds

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const quicknodeRpcUrl = 'https://intensive-omniscient-asphalt.solana-mainnet.quiknode.pro/61466a6e88d0e1f1f55ea00bf5ec117e22d16849'; // 替換為您的 QuickNode RPC URL

  try {
    // 如果請求是 getRecentBlockhash，使用快取
    if (req.body.method === 'getRecentBlockhash') {
      const now = Date.now();
      if (cachedBlockhash && (now - lastFetched < CACHE_DURATION)) {
        return res.json({
          jsonrpc: "2.0",
          result: {
            context: { slot: 12345678 }, // 您可以根據實際情況設置 slot
            value: { blockhash: cachedBlockhash, feeCalculator: {} }
          },
          id: req.body.id
        });
      }

      const response = await fetch(quicknodeRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });

      const data = await response.json();

      if (data && data.result && data.result.value && data.result.value.blockhash) {
        cachedBlockhash = data.result.value.blockhash;
        lastFetched = now;
      }

      res.status(response.status).json(data);
    } else {
      // 其他 RPC 請求直接轉發
      const response = await fetch(quicknodeRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });

      const data = await response.json();

      res.status(response.status).json(data);
    }
  } catch (error) {
    console.error('RPC Proxy Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
