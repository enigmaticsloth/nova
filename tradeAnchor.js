// tradeAnchor.js
import { AnchorProvider, Program, web3, BN } from 'https://esm.sh/@coral-xyz/anchor@1.84.1';
import { getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from 'https://esm.sh/@solana/spl-token@0.2.0';
import idl from './nova.json' assert { type: 'json' };

// DOM Elements
const connectWalletBtn = document.getElementById("connectWalletBtn");
const walletStatus = document.getElementById("walletStatus");
const solInput = document.getElementById("solInput");
const novaInput = document.getElementById("novaInput");
const swapBtn = document.getElementById("swapBtn");
const tradeStatus = document.getElementById("tradeStatus");

// Global Variables
let walletPublicKey = null;

// Program ID and Account Addresses
const programId = new web3.PublicKey("HEAz4vAABHTYdY23JuYD3VTHKSBRXSdyt7Dq8YVGDUWm");
const GLOBAL_STATE = new web3.PublicKey("HLSLMK51mUc375t69T93quNqpLqLdySZKvodjyeuNdp");
const NOVA_TREASURY = new web3.PublicKey("4fuD8ELTbhRBcnG61WnSVe9TCdkVAhJLKteYz51yMnKH");
const MINT_AUTHORITY = new web3.PublicKey("AfqG9eh244LzXTEBo4UDepa2pKKTopvZHWmX4sFadch7");
const MINT = new web3.PublicKey("5vjrnc823W14QUvomk96N2yyJYyG92Ccojyku64vofJX");
const LIQ_POOL_PDA_ACCOUNT = new web3.PublicKey("C7sSvpgZvRPVqLqfLSeDb3ErHWhMQYM3fvbRgSWBwVkF");
const FEE_RECIPIENT = new web3.PublicKey("7MaisRjGojZVb9gS6B1UZqBtFqajAArTkwnXhp3Syubk");
const DEV_REWARD_POOL_ACCOUNT = new web3.PublicKey("9WHRVWCiWeCC8Lhb4ohk3e2wdoZpALh6xNcnteP6E75o");

/***************************************************************************
 * getProvider():
 *   - Create AnchorProvider (connect to your RPC endpoint)
 *   - Use window.solana (Phantom) as the wallet
 ***************************************************************************/
function getProvider() {
  const connection = new web3.Connection(
    "https://nova-enigmaticsloths-projects.vercel.app/api/rpc-proxy",
    "confirmed"
  );
  const provider = new AnchorProvider(connection, window.solana, {
    preflightCommitment: "confirmed",
  });
  return provider;
}

/***************************************************************************
 * getBuyerNovaAccount():
 *   - Get or create buyer's Associated Token Account (ATA) for NOVA
 *   - Returns ATA address (PublicKey)
 ***************************************************************************/
async function getBuyerNovaAccount(provider, buyerPubkey) {
  // getOrCreateAssociatedTokenAccount from spl-token
  const ata = await getOrCreateAssociatedTokenAccount(
    provider.connection,   // Connection
    provider.wallet.payer, // Payer (SignTransaction)
    MINT,                  // NOVA Mint
    buyerPubkey            // Owner
  );
  return ata.address;
}

/***************************************************************************
 * swapNOVA():
 *   - Execute (SOL -> NOVA) buy operation
 ***************************************************************************/
async function swapNOVA() {
  if (!walletPublicKey) {
    tradeStatus.innerText = "Please connect your wallet first.";
    return;
  }

  // (1) Read the amount of SOL entered by the user
  const solValue = parseFloat(solInput.value);
  if (isNaN(solValue) || solValue <= 0) {
    tradeStatus.innerText = "Please enter a valid SOL amount.";
    return;
  }
  // Convert SOL to lamports (1 SOL = 1e9 lamports)
  const lamportsToSend = Math.floor(solValue * 1e9);

  // Get current NOVA price from pricing.js
  const currentNovaPrice = window.CURRENT_NOVA_PRICE_USD; // Assuming pricing.js sets this

  tradeStatus.innerText = `Executing Buy: ${solValue} SOL → Estimated NOVA...\n`;

  try {
    // (2) Create Anchor Program
    const provider = getProvider();
    const program = new Program(idl, programId, provider);

    // (3) Get buyer's NOVA ATA
    const buyerPubkey = new web3.PublicKey(walletPublicKey);
    const buyerNovaAccountPubkey = await getBuyerNovaAccount(provider, buyerPubkey);
    console.log("buyerNovaAccount:", buyerNovaAccountPubkey.toBase58());

    // (4) Call buy() method on the program
    // buy(ctx, sol_amount: u64, current_nova_price: u64)
    const signature = await program.methods
      .buy(new BN(lamportsToSend), new BN(currentNovaPrice))
      .accounts({
        buyer: buyerPubkey,
        globalState: GLOBAL_STATE,
        buyerNovaAccount: buyerNovaAccountPubkey, 
        novaTreasury: NOVA_TREASURY,
        mintAuthority: MINT_AUTHORITY,
        mint: MINT,
        liquidityPoolPdaAccount: LIQ_POOL_PDA_ACCOUNT,
        feeRecipient: FEE_RECIPIENT,
        developerRewardPoolAccount: DEV_REWARD_POOL_ACCOUNT,
        tokenProgram: TOKEN_PROGRAM_ID,            // SPL Token Program
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    // Display result
    tradeStatus.innerText += `Transaction sent! Signature: ${signature}\n`;
    tradeStatus.innerText += "Swap completed successfully!";
    console.log("Transaction signature:", signature);

  } catch (err) {
    console.error("Swap transaction error:", err);
    tradeStatus.innerText = `Swap transaction error: ${err.message}`;
  }
}

// Bind events
swapBtn.addEventListener("click", swapNOVA);