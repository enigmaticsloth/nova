// trade.js

// 1) 必備：引入 solanaWeb3 (你已在 HTML 用 <script> 方式引用了)
// 2) 需要 borsh 來手動序列化 buy() / sell() 的引數。如果沒有安裝，可直接套簡單的 borsh encode 方式
//    或自行寫個 bufferTools。這裡示範 inline 寫法。
//
//    你可以在 HTML 以 <script src="https://cdn.jsdelivr.net/npm/borsh@0.7.1/lib/index.min.js"></script>
//    然後這裡就可以使用 window.borsh。若不想依賴 borsh 也可直接用 DataView / Buffer 寫 8 bytes。
//    下面的範例直接用「手動方式」去拼 8 bytes (u64) + 8 bytes (u64)。

// ---------------------------------------------------------------------
// DOM elements
// ---------------------------------------------------------------------
const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletStatus = document.getElementById('walletStatus');
const solInput = document.getElementById('solInput');
const novaInput = document.getElementById('novaInput');
const swapBtn = document.getElementById('swapBtn');
const tradeStatus = document.getElementById('tradeStatus');

// ---------------------------------------------------------------------
// Global variables
// ---------------------------------------------------------------------
let walletPublicKey = null;
let activeField = null; // "sol" or "nova"

// 你的 Program ID (合約地址)
const programId = new solanaWeb3.PublicKey("HEAz4vAABHTYdY23JuYD3VTHKSBRXSdyt7Dq8YVGDUWm");

// ---------------------------
// 請改成你實際的帳戶/PDA地址
// 這些要跟你合約內 buy() / sell() 所需的 Accounts 對上
// (順序也要跟你 rust 的 #[derive(Accounts)] Buy / Sell 保持一致)
// ---------------------------
const globalStatePubkey = new solanaWeb3.PublicKey("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
const buyerNovaAccountPubkey = new solanaWeb3.PublicKey("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
const novaTreasuryPubkey = new solanaWeb3.PublicKey("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
const mintAuthorityPubkey = new solanaWeb3.PublicKey("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
const mintPubkey = new solanaWeb3.PublicKey("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
const liquidityPoolPdaPubkey = new solanaWeb3.PublicKey("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
const feeRecipientPubkey = new solanaWeb3.PublicKey("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
const developerRewardPoolPubkey = new solanaWeb3.PublicKey("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");

// tokenProgram, systemProgram
const TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"); // 常見
const SYSTEM_PROGRAM_ID = solanaWeb3.SystemProgram.programId;

// 下面只是輔助：我們計算 buy() / sell() 在 Anchor 的「方法 discriminant」。
// Anchor 的規則：  disco = 前 8 bytes of sha256("global:函式名稱")
// => buy: sha256("global:buy")
// => sell: sha256("global:sell")
// 你可以事先離線算出前 8 bytes。這裡給個範例 hex。
//
// 給你示例 (請自行驗證，或對應你自己的 IDL hash):
// "buy"  => 0x6C 0x65 0xDF 0xC4 0x13 0xFA 0x24 0xF5
// "sell" => 0x9A 0x03 0x09 0xB3 0xEE 0xAE 0x5E 0xA9
//
// 若有出入，請自己校正 (用 anchor.utils.sha256("global:buy") 取前 8 bytes)
const BUY_METHOD_DISCM = new Uint8Array([0x6c, 0x65, 0xdf, 0xc4, 0x13, 0xfa, 0x24, 0xf5]);
const SELL_METHOD_DISCM = new Uint8Array([0x9a, 0x03, 0x09, 0xb3, 0xee, 0xae, 0x5e, 0xa9]);

// ---------------------------------------------------------------------
// Debounce & Throttle (跟原本相同，不變)
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// Price input updates (保持不變)
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// Connect Phantom wallet (與原本一樣，不變)
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// 幫忙取 blockhash 的函式 (與原本一樣)
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// 【新的重點】建立 buy()/sell() Instruction 的資料序列化函式
// ---------------------------------------------------------------------
function encodeBuyData(solAmount, currentNovaPrice) {
  // buy() 的參數順序: (ctx, sol_amount: u64, current_nova_price: u64)
  // Anchor 預設: [8 bytes: discriminator][8 bytes: sol_amount][8 bytes: current_nova_price]
  //
  // 這裡手動做 8+8+8 = 24 bytes，再加上 discriminator 8 bytes => 總共 24 bytes + 8 = 32 bytes
  //
  // 1) 先建一個 24 bytes 的新 Buffer (或 Uint8Array)
  const buffer = new Uint8Array(8 + 8); // 16 bytes for the two u64
  // 2) 把 solAmount, currentNovaPrice 各寫入 8 bytes (little-endian or anchor is little-endian)
  const dataView = new DataView(buffer.buffer);
  dataView.setBigUint64(0, BigInt(solAmount), true);    // sol_amount
  dataView.setBigUint64(8, BigInt(currentNovaPrice), true); // current_nova_price

  // 組合：discriminator(8 bytes) + 參數(16 bytes) = 24 bytes
  // buy 的 discriminator:
  //    BUY_METHOD_DISCM = [0x6c, 0x65, 0xdf, 0xc4, 0x13, 0xfa, 0x24, 0xf5]
  const finalData = new Uint8Array(8 + 16);
  finalData.set(BUY_METHOD_DISCM, 0);
  finalData.set(buffer, 8);

  return finalData;
}

function encodeSellData(novaAmount, currentNovaPrice) {
  // sell() 的參數順序: (ctx, nova_amount: u64, current_nova_price: u64)
  // layout 跟 buy 一樣，只是 discriminator 不同
  const buffer = new Uint8Array(8 + 8);
  const dataView = new DataView(buffer.buffer);
  dataView.setBigUint64(0, BigInt(novaAmount), true);  // nova_amount
  dataView.setBigUint64(8, BigInt(currentNovaPrice), true);

  const finalData = new Uint8Array(8 + 16);
  finalData.set(SELL_METHOD_DISCM, 0);
  finalData.set(buffer, 8);

  return finalData;
}

// ---------------------------------------------------------------------
// 真正呼叫合約 buy() 或 sell() 的核心
// ---------------------------------------------------------------------
async function swapNOVA() {
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }

  try {
    console.log("Starting swap transaction...");
    // 使用 Vercel 的 RPC Proxy
    const connection = new solanaWeb3.Connection(
      "https://nova-enigmaticsloths-projects.vercel.app/api/rpc-proxy",
      "confirmed"
    );

    const fromPubkey = new solanaWeb3.PublicKey(walletPublicKey);

    // 你要指定多少 price，就看你在前端怎麼取得
    // 為方便示範，這裡只是把 window.CURRENT_NOVA_PRICE_USD 做個（假的）轉換，或你也可以寫死
    // 這個 "current_nova_price" 是你合約 buy(ctx, sol_amount, current_nova_price) 期望的「u64」。
    // 可能是「對應 lamports / 代幣」的價格，而不是「美元」；這裡你得自己做換算。
    //
    // 以下只是示範，實務上你要有自己的方式計算 "current_nova_price"（單位：多少 lamports / 1NOVA）
    // 例如：1 SOL = 1_000_000 NOVA => current_nova_price = 1_000_000 (對應合約)
    // 這部分請你按自己的邏輯計算。
    const approximateNovaPrice = 1000000; // 只是示範，隨便填

    let transaction = new solanaWeb3.Transaction();

    // ----------------------
    // 如果使用者想買 (activeField === "sol"):
    // 則呼叫合約的 buy( sol_amount, current_nova_price )
    // ----------------------
    if (activeField === "sol") {
      const solValue = parseFloat(solInput.value);
      if (isNaN(solValue) || solValue <= 0) {
        tradeStatus.innerText = "Please enter a valid SOL amount.";
        return;
      }
      // 把 SOL amount 轉成 lamports
      const lamports = Math.round(solValue * 1e9);

      // 準備 buy() instruction
      // 1) accounts => 跟合約 struct Buy 裡面的 11~12 個 accounts 對應
      //    注意 must 跟 Rust code 順序一致
      const buyAccounts = [
        // 1) buyer
        { pubkey: fromPubkey, isSigner: true, isWritable: true },
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
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      ];

      // 2) data => discriminator + sol_amount + current_nova_price
      const data = encodeBuyData(lamports, approximateNovaPrice);

      // 建立 instruction
      const buyIx = new solanaWeb3.TransactionInstruction({
        programId,
        keys: buyAccounts,
        data,
      });

      transaction.add(buyIx);

      tradeStatus.innerText = `Executing BUY: ${solValue} SOL => will call buy(sol_amount=${lamports}, price=${approximateNovaPrice}) ...\n`;

    // ----------------------
    // 如果使用者想賣 (activeField === "nova"):
    // 則呼叫合約的 sell( nova_amount, current_nova_price )
    // ----------------------
    } else if (activeField === "nova") {
      const novaValue = parseFloat(novaInput.value);
      if (isNaN(novaValue) || novaValue <= 0) {
        tradeStatus.innerText = "Please enter a valid NOVA amount.";
        return;
      }

      // 假設你合約代幣是 6 位小數 => novaValue * 1e6
      // 若是 9 位小數 => *1e9，請自己修正
      const novaLamports = Math.round(novaValue * 1e6);

      // 準備 sell() instruction
      const sellAccounts = [
        // 1) seller
        { pubkey: fromPubkey, isSigner: true, isWritable: true },
        // 2) global_state
        { pubkey: globalStatePubkey, isSigner: false, isWritable: true },
        // 3) seller_nova_account
        { pubkey: buyerNovaAccountPubkey, isSigner: false, isWritable: true }, 
        //    這一行要對應你的 Rust: seller_nova_account => 你使用者實際存放NOVA的ATA
        //    跟 buy 裡 "buyerNovaAccountPubkey" 其實是一樣的，如果同一個token帳戶
        // 4) nova_treasury
        { pubkey: novaTreasuryPubkey, isSigner: false, isWritable: true },
        // 5) mint
        { pubkey: mintPubkey, isSigner: false, isWritable: true },
        // 6) mint_authority
        { pubkey: mintAuthorityPubkey, isSigner: false, isWritable: false },
        // 7) liquidity_pool_pda_account
        { pubkey: liquidityPoolPdaPubkey, isSigner: false, isWritable: true },
        // 8) fee_recipient
        { pubkey: feeRecipientPubkey, isSigner: false, isWritable: true },
        // 9) developer_reward_pool_account
        { pubkey: developerRewardPoolPubkey, isSigner: false, isWritable: true },
        // 10) token_program
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        // 11) system_program
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      ];

      const data = encodeSellData(novaLamports, approximateNovaPrice);

      const sellIx = new solanaWeb3.TransactionInstruction({
        programId,
        keys: sellAccounts,
        data,
      });

      transaction.add(sellIx);

      tradeStatus.innerText = `Executing SELL: ${novaValue} NOVA => will call sell(nova_amount=${novaLamports}, price=${approximateNovaPrice}) ...\n`;
    } else {
      tradeStatus.innerText = "Please enter SOL or NOVA amount first.";
      return;
    }

    // -----------------------------------------------------------------
    // 設定交易的 feePayer, blockhash，然後由 Phantom sign & send
    // -----------------------------------------------------------------
    transaction.feePayer = fromPubkey;
    const blockhash = await getRecentBlockhashWithRetry(connection);
    transaction.recentBlockhash = blockhash;

    // Phantom 簽名
    const signedTransaction = await window.solana.signTransaction(transaction);
    const rawTransaction = signedTransaction.serialize();

    // 送出交易
    const signature = await connection.sendRawTransaction(rawTransaction);
    tradeStatus.innerText += `Transaction sent! Signature: ${signature}\n`;
    console.log("Transaction sent! Signature:", signature);

    // 確認交易
    await connection.confirmTransaction(signature, 'confirmed');
    tradeStatus.innerText += "Transaction confirmed!";
    console.log("Transaction confirmed!");

  } catch (err) {
    console.error("Swap transaction error:", err);
    tradeStatus.innerText = `Swap transaction error: ${err.message}`;
  }
}

// ---------------------------------------------------------------------
// 綁定按鈕事件
// ---------------------------------------------------------------------
connectWalletBtn.addEventListener('click', connectWallet);
const throttledSwapNOVA = throttle(swapNOVA, 2000);
swapBtn.addEventListener('click', throttledSwapNOVA);