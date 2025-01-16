// trade.js

// 取得頁面上需要的元素
const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletStatus = document.getElementById('walletStatus');
const buyBtn = document.getElementById('buyBtn');
const sellBtn = document.getElementById('sellBtn');
const tradeStatus = document.getElementById('tradeStatus');
const buyAmountInput = document.getElementById('buyAmount');
const sellAmountInput = document.getElementById('sellAmount');

let walletPublicKey = null;

// 連接 Phantom 錢包（請確保在 HTTP/HTTPS 下執行）
async function connectWallet() {
  if (window.solana && window.solana.isPhantom) {
    try {
      const resp = await window.solana.connect();
      walletPublicKey = resp.publicKey.toString();
      walletStatus.innerText = `Wallet connected: ${walletPublicKey}`;
    } catch (err) {
      walletStatus.innerText = `Connect failed: ${err.message}`;
    }
  } else {
    walletStatus.innerText = "Phantom wallet not found. Please install the Phantom extension.";
  }
}

// 示範：Buy NOVA
// 假設使用者輸入的是「SOL 金額」
async function buyNOVA() {
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }
  let solValue = parseFloat(buyAmountInput.value);
  if (isNaN(solValue) || solValue <= 0) {
    tradeStatus.innerText = "Please enter a valid SOL amount.";
    return;
  }
  // 將 SOL 轉換成 lamports (1 SOL = 1e9 lamports)
  const lamports = Math.round(solValue * 1e9);
  try {
    const connection = new solanaWeb3.Connection("https://api.mainnet-beta.solana.com", "processed");
    const fromPubkey = new solanaWeb3.PublicKey(walletPublicKey);

    // 模擬一個交易：這裡僅示範將 lamports 轉給自己
    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey,
        toPubkey: fromPubkey,
        lamports: lamports,
      })
    );

    // 要求 Phantom 進行簽名與傳送交易
    const { signature } = await window.solana.signAndSendTransaction({ transaction, connection });
    tradeStatus.innerText = `Buy transaction sent! Signature: ${signature}`;
  } catch (err) {
    tradeStatus.innerText = `Buy transaction error: ${err.message}`;
  }
}

// 示範：Sell NOVA
// 假設使用者輸入的是「NOVA 金額」
// 這裡僅以相同方式模擬一筆交易，實際情況請根據你的合約修改
async function sellNOVA() {
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }
  let novaValue = parseFloat(sellAmountInput.value);
  if (isNaN(novaValue) || novaValue <= 0) {
    tradeStatus.innerText = "Please enter a valid NOVA amount.";
    return;
  }
  // 這裡假設賣出金額以 NOVA 為單位，但示範交易仍用 SOL (僅作範例)
  // 如果是呼叫合約 sell 函式，則需要將 novaValue 轉換為對應的 token 數量（例如乘上 10^6）
  try {
    const connection = new solanaWeb3.Connection("https://api.mainnet-beta.solana.com", "processed");
    const fromPubkey = new solanaWeb3.PublicKey(walletPublicKey);

    // 範例：模擬一筆交易（轉 0.00001 SOL 給自己）
    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey,
        toPubkey: fromPubkey,
        lamports: 10000,
      })
    );

    const { signature } = await window.solana.signAndSendTransaction({ transaction, connection });
    tradeStatus.innerText = `Sell transaction sent! Signature: ${signature}`;
  } catch (err) {
    tradeStatus.innerText = `Sell transaction error: ${err.message}`;
  }
}

// 綁定按鈕事件
connectWalletBtn.addEventListener('click', connectWallet);
buyBtn.addEventListener('click', buyNOVA);
sellBtn.addEventListener('click', sellNOVA);
