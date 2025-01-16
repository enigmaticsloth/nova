// api/rpc-proxy.js

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

  const quicknodeRpcUrl = 'https://intensit.solana-mainnet.quiknode.pro/61466a6e88d0e1f1f55ea00bf5ec117e22d16849'; // 替換為您的 QuickNode RPC URL

  try {
    const response = await fetch(quicknodeRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    res.setHeader('Access-Control-Allow-Origin', '*'); // 設置 CORS 標頭
    res.status(response.status).json(data);
  } catch (error) {
    console.error('RPC Proxy Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
