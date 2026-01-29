const {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  createSyncNativeInstruction,
  getOrCreateAssociatedTokenAccount,
} = require("@solana/spl-token");
const bs58Module = require("bs58");
const bs58Decode = bs58Module.decode || (bs58Module.default && bs58Module.default.decode);

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const secretInput = "4628mDHbgwHFm9SBu8G5KZNB7k6YiWgySdCEpZu3vgvH7reiN7JfWB2QDVyDa3Ud9LTr6y6QPjDkrx7bSMLpqrub"// cập nhật secret key của bạn
  const secretKeyBytes = secretInput.trim().startsWith("[")
    ? Uint8Array.from(JSON.parse(secretInput))
    : bs58Decode(secretInput);
  const wallet = Keypair.fromSecretKey(secretKeyBytes);

  const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
  const amountLamports = 10 * 1e9;

  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet, // payer
    WSOL_MINT,
    wallet.publicKey // owner
  );

  const tx = new Transaction().add(
    // chuyển SOL vào ATA (wrap)
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: ata.address,
      lamports: amountLamports,
    }),
    // đồng bộ trạng thái native SOL thành WSOL
    createSyncNativeInstruction(ata.address)
  );

  await sendAndConfirmTransaction(connection, tx, [wallet]);

  console.log("✓ Đã wrap SOL thành WSOL!");
}

main().catch(async (err) => {
  try {
    if (typeof err.getLogs === "function") {
      const logs = await err.getLogs();
      console.error("Transaction logs:", logs);
    }
  } catch (_) {}
  console.error("✗ Error:", err);
  process.exit(1);
});
  