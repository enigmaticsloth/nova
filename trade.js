// trade.js

/************************************************************
 * 
 *  完整示範程式碼：自動建立 ATA + 呼叫 buy() 與 Phantom 交互
 *  前提：HTML 已載入
 *    - bufferPolyfill.js (若需要)
 *    - https://cdn.jsdelivr.net/npm/@solana/web3.js@1.84.1/lib/index.iife.min.js
 *    - https://unpkg.com/@solana/spl-token@latest/dist/spl-token.umd.js
 *    - pricing.js (若需要)
 *
 ************************************************************/

console.log("trade.js loaded!");

// -----------------------------------------------------
// 1. DOM 元素綁定
// -----------------------------------------------------
const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletStatus     = document.getElementById('walletStatus');
const solInput         = document.getElementById('solInput');
const novaInput        = document.getElementById('novaInput');
const swapBtn          = document.getElementById('swapBtn');
const tradeStatus      = document.getElementById('tradeStatus');

// -----------------------------------------------------
// 2. 全域變數
// -----------------------------------------------------
let walletPublicKey = null;
let activeField = null; // "sol" or "nova"

// 你的合約 Program ID (注意：Base58 合法字串)
const programId = new solanaWeb3.PublicKey("HEAz4vAABHTYdY23JuYD3VTHKSBRXSdyt7Dq8YVGDUWm");

// 以下請替換成你實際使用的 PDA、公鑰。
const globalStatePubkey        = new solanaWeb3.PublicKey("HLSLMK51mUc375t69T93quNqpLqLdySZKvodjyeuNdp");  // global-state
const mintPubkey               = new solanaWeb3.PublicKey("5vjrnc823W14QUvomk96N2yyJYyG92Ccojyku64vofJX");  // mint
const mintAuthorityPubkey      = new solanaWeb3.PublicKey("AfqG9eh244LzXTEBo4UDepa2pKKTopvZHWmX4sFadch7");  // mint-authority
const novaTreasuryPubkey       = new solanaWeb3.PublicKey("4fuD8ELTbhRBcnG61WnSVe9TCdkVAhJLKteYz51yMnKH");  // nova-treasury
const liquidityPoolPdaPubkey   = new solanaWeb3.PublicKey("C7sSvpgZvRPVqLqfLSeDb3ErHWhMQYM3fvbRgSWBwVkF");  // liq-pool
const developerRewardPoolPubkey= new solanaWeb3.PublicKey("9WHRVWCiWeCC8Lhb4ohk3e2wdoZpALh6xNcnteP6E75o");  // dev-reward-pool

// 假設你另有一個 feeRecipientPubkey (收取 5% 手續費的地址)
const feeRecipientPubkey       = new solanaWeb3.PublicKey("EKBw9HwFJNa4xuEGzp8kGaWxqmCUWWwj7Rpc8tco2foV"); // <== 請自行替換

// 引入 splToken 內的常用 ID
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } = splToken;

// Anchor discriminator (buy)
const BUY_METHOD_DISCM = new Uint8Array([0x6c, 0x65, 0xdf, 0xc4, 0x13, 0xfa, 0x24, 0xf5]); 
// 如果你要賣(sell)，可以再加 SELL_METHOD_DISCM

// 先示範 buy() 參數序列化：   buy(ctx, sol_amount: u64, current_nova_price: u64)
function encodeBuyData(solAmountU64, currentNovaPriceU64) {
  // 先做 16 bytes buffer (兩個 u64)
  const buffer = new Uint8Array(16);
  const dv = new DataView(buffer.buffer);
  dv.setBigUint64(0, BigInt(solAmountU64), true);       // sol_amount
  dv.setBigUint64(8, BigInt(currentNovaPriceU64), true); // current_nova_price

  // 再把 discriminator + 參數
  const finalData = new Uint8Array(8 + 16);
  finalData.set(BUY_METHOD_DISCM, 0);
  finalData.set(buffer, 8);

  return finalData;
}

// -----------------------------------------------------
// 3. Debounce / Throttle (供輸入框使用) - 與原先一樣
// -----------------------------------------------------
function debounce(func, delay) {
  let debounceTimer;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(context, args), delay);
  };
}

function throttle(func, limit) {
  let lastFunc;
  let lastRan;
  return function() {
    const context = this;
    const args = arguments;
    if (!lastRan) {
      func.apply(context, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(function() {
        if ((Date.now() - lastRan) >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

// -----------------------------------------------------
// 4. 更新 SOL / NOVA 輸入框
// -----------------------------------------------------
function updateNovaFromSOL() {
  if (!solInput.value) {
    novaInput.value = "";
    return;
  }
  const solValue = parseFloat(solInput.value);
  if (isNaN(solValue)) {
    novaInput.value = "";
    return;
  }
  // Demo: 直接根據假設的匯率
  // 也可結合 pricing.js => window.SOL_USD_PRICE, window.CURRENT_NOVA_PRICE_USD
  const novaVal = solValue * (window.SOL_USD_PRICE / window.CURRENT_NOVA_PRICE_USD);
  novaInput.value = novaVal.toFixed(5);
  activeField = "sol";
}

function updateSOLFromNOVA() {
  if (!novaInput.value) {
    solInput.value = "";
    return;
  }
  const novaValue = parseFloat(novaInput.value);
  if (isNaN(novaValue)) {
    solInput.value = "";
    return;
  }
  const solVal = novaValue * (window.CURRENT_NOVA_PRICE_USD / window.SOL_USD_PRICE);
  solInput.value = solVal.toFixed(5);
  activeField = "nova";
}

const debouncedUpdateNovaFromSOL = debounce(updateNovaFromSOL, 300);
const debouncedUpdateSOLFromNOVA = debounce(updateSOLFromNOVA, 300);

solInput.addEventListener('input', debouncedUpdateNovaFromSOL);
novaInput.addEventListener('input', debouncedUpdateSOLFromNOVA);

// -----------------------------------------------------
// 5. 連接 Phantom 錢包
// -----------------------------------------------------
async function connectWallet() {
  if (window.solana && window.solana.isPhantom) {
    try {
      const resp = await window.solana.connect();
      walletPublicKey = resp.publicKey.toString();
      walletStatus.innerText = `Wallet Connected: ${walletPublicKey}`;
      console.log("Wallet connected:", walletPublicKey);
    } catch (err) {
      walletStatus.innerText = `Connection Failed: ${err.message}`;
      console.error("Connection failed:", err);
    }
  } else {
    walletStatus.innerText = "Phantom wallet not found. Please install the Phantom extension.";
  }
}

// -----------------------------------------------------
// 6. 幫忙取 blockhash 的函式
// -----------------------------------------------------
async function getRecentBlockhashWithRetry(connection, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Fetching blockhash, attempt ${i + 1}`);
      const { blockhash } = await connection.getLatestBlockhash();
      console.log(`Fetched blockhash: ${blockhash}`);
      return blockhash;
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed: ${error.message}`);
      if (i === retries - 1) {
        console.error("All attempts to fetch blockhash failed:", error);
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// -----------------------------------------------------
// 7. 檢查 / 建立使用者的 ATA (NOVA)
// -----------------------------------------------------
async function prepareBuyerAtaIfNeeded(connection, userPubkey, mintPubkey, transaction) {
  // 1) 算出 Associated Token Address
  const ataPubkey = await getAssociatedTokenAddress(
    mintPubkey,          // mint
    userPubkey,          // owner
    false,               // allowOwnerOffCurve => false
    TOKEN_PROGRAM_ID     // programId => spl-token program
  );
  console.log("Buyer ATA:", ataPubkey.toBase58());

  // 2) 檢查該 ATA 是否已存在
  const ataAccountInfo = await connection.getAccountInfo(ataPubkey);
  if (!ataAccountInfo) {
    // => 尚未存在，需要先創建
    console.log("User ATA does not exist. Creating ATA...");

    // createAssociatedTokenAccountInstruction(payer, ata, owner, mint)
    const createIx = createAssociatedTokenAccountInstruction(
      userPubkey, // payer
      ataPubkey,  // ATA to create
      userPubkey, // token owner
      mintPubkey  // mint
    );
    transaction.add(createIx);
  } else {
    console.log("ATA already exists:", ataPubkey.toBase58());
  }

  // 回傳使用者的 ATA
  return ataPubkey;
}

// -----------------------------------------------------
// 8. Swap (Buy) 主邏輯：
//    - 假設 user 想用 SOL 買 NOVA
//    - 會自動檢查/創建 ATA
//    - 再呼叫合約 buy()
// -----------------------------------------------------
async function swapNOVA() {
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }

  try {
    console.log("Starting swap transaction (Buy flow)...");
    const connection = new solanaWeb3.Connection(
      "https://nova-enigmaticsloths-projects.vercel.app/api/rpc-proxy",
      "confirmed"
    );

    const fromPubkey = new solanaWeb3.PublicKey(walletPublicKey);

    // -----------------------------------------------------------------
    // 這裡只示範「買」 => activeField === "sol"
    // 若你有「賣」，就需要另一個 function, or 另做 if (activeField === "nova") ...
    // -----------------------------------------------------------------
    if (activeField !== "sol") {
      tradeStatus.innerText = "Please enter SOL amount (Buy) or rewrite code for SELL flow.";
      return;
    }

    // 取得使用者輸入
    const solValue = parseFloat(solInput.value);
    if (isNaN(solValue) || solValue <= 0) {
      tradeStatus.innerText = "Please enter a valid SOL amount.";
      return;
    }
    const lamports = Math.round(solValue * 1e9);

    // 你在合約 buy(ctx, sol_amount, current_nova_price)
    // 需要 current_nova_price => 這裡示範先寫個常數 1_000_000
    // 代表 1 SOL = 1,000,000 baseUnits of NOVA (看你合約怎麼定義)
    // 請自行計算 / 從後端取得
    const approximateNovaPrice = 1_000_000;

    // ------------------------------------------------
    // 建立一個空的 transaction，先把「建立 ATA」指令加進去
    // ------------------------------------------------
    let transaction = new solanaWeb3.Transaction();

    // 幫 user 準備 ATA (若沒有就創建)，最後回傳 ATA
    const buyerNovaAccountPubkey = await prepareBuyerAtaIfNeeded(
      connection,
      fromPubkey,
      mintPubkey,
      transaction
    );

    // ------------------------------------------------
    // 再加上合約 buy() instruction
    // ------------------------------------------------
    // 1) 生成 data (discriminator + 參數)
    const data = encodeBuyData(lamports, approximateNovaPrice);

    // 2) 要帶入合約 buy() 所需的 accounts (順序要對齊 Rust)
    const buyAccounts = [
      // 1) buyer
      { pubkey: fromPubkey, isSigner: true,  isWritable: true },
      // 2) global_state
      { pubkey: globalStatePubkey, isSigner: false, isWritable: true },
      // 3) buyer_nova_account
      { pubkey: buyerNovaAccountPubkey, isSigner: false, isWritable: true },
      // 4) nova_treasury
      { pubkey: novaTreasuryPubkey, isSigner: false, isWritable: true },
      // 5) mint_authority
      { pubkey: mintAuthorityPubkey, isSigner: false, isWritable: false },
      // 6) mint
      { pubkey: mintPubkey, isSigner: false, isWritable: true },
      // 7) liquidity_pool_pda_account
      { pubkey: liquidityPoolPdaPubkey, isSigner: false, isWritable: true },
      // 8) fee_recipient
      { pubkey: feeRecipientPubkey, isSigner: false, isWritable: true },
      // 9) developer_reward_pool_account
      { pubkey: developerRewardPoolPubkey, isSigner: false, isWritable: true },
      // 10) token_program
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      // 11) system_program
      { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const buyIx = new solanaWeb3.TransactionInstruction({
      programId,
      keys: buyAccounts,
      data,
    });
    transaction.add(buyIx);

    // ------------------------------------------------
    // 發送交易
    // ------------------------------------------------
    // 設置 feePayer、blockhash
    transaction.feePayer = fromPubkey;
    const blockhash = await getRecentBlockhashWithRetry(connection);
    transaction.recentBlockhash = blockhash;

    // Phantom 簽名
    const signedTransaction = await window.solana.signTransaction(transaction);
    const rawTransaction = signedTransaction.serialize();

    // 送出
    const signature = await connection.sendRawTransaction(rawTransaction);
    tradeStatus.innerText = `Transaction sent! Signature: ${signature}\n`;
    console.log("Transaction sent! Signature:", signature);

    // 確認
    await connection.confirmTransaction(signature, 'confirmed');
    tradeStatus.innerText += "Transaction confirmed!";
    console.log("Transaction confirmed!");

  } catch (err) {
    console.error("Swap transaction error:", err);
    tradeStatus.innerText = `Swap transaction error: ${err.message}`;
  }
}

// -----------------------------------------------------
// 9. 綁定按鈕事件
// -----------------------------------------------------
connectWalletBtn.addEventListener('click', connectWallet);
const throttledSwapNOVA = throttle(swapNOVA, 2000);
swapBtn.addEventListener('click', throttledSwapNOVA);