import Safe from '@safe-global/protocol-kit'
import SafeApiKit from '@safe-global/api-kit'
import { ethers } from 'ethers'
import dotenv from 'dotenv'

dotenv.config()

async function ExecutePendingTransaction() {

    const provider = process.env.RPC_URL
    const signer = process.env.SECOND_OWNER_PRIVATE_KEY
    const signerWallet = new ethers.Wallet(signer, provider)
    const signerAddress = await signerWallet.getAddress()

    const SAFE_ADDRESS = process.env.SAFE_ADDRESS
    const CHAIN_ID = 11155111

    // ✅ Initialize Safe SDK
    const safeSdk = await Safe.init({
        provider: provider,
        signer: signer,
        safeAddress: SAFE_ADDRESS
    })

    // ✅ Initialize Safe API Kit
    const apiKit = new SafeApiKit({
        chainId: BigInt(CHAIN_ID),
        apiKey: process.env.SAFE_API_KEY
    })

    // ✅ Fetch pending transactions
    const pendingTxs = await apiKit.getPendingTransactions(SAFE_ADDRESS)

    if (!pendingTxs.results.length) {
        console.log('No pending transactions')
        return
    }

    // ✅ Pick the first pending transaction
    const pendingTx = pendingTxs.results[0]
    console.log('Pending transaction:', pendingTx)

    // Get the number of confirmations
    const confirmationsCount = pendingTx.confirmations ? pendingTx.confirmations.length : 0;
    const requiredConfirmations = pendingTx.confirmationsRequired || 2;

    console.log('Transaction Hash:', pendingTx.safeTxHash);
    console.log('Confirmations count:', confirmationsCount);
    console.log('Required confirmations:', requiredConfirmations);

    const options = {
        from: SAFE_ADDRESS
    }



    // if (confirmationsCount >= requiredConfirmations && !pendingTx.isExecuted) {
    //     console.log('Executing transaction...');
    //     const txResponse = await safeSdk.executeTransaction(
    //         pendingTx,
    //         options
    //     )
    //     console.log('Transaction executed:', txResponse)
    // } else if (pendingTx.isExecuted) {
    //     console.log('Transaction already executed')
    // } else {
    //     console.log(`Transaction needs ${requiredConfirmations - confirmationsCount} more confirmation(s)`)
    // }


}

ExecutePendingTransaction().catch(console.error)
