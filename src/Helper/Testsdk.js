// Test SDK for Safe Transaction Verification
import Safe from '@safe-global/protocol-kit';
import SafeApiKit from '@safe-global/api-kit';
import { ethers } from 'ethers';
import { OperationType } from '@safe-global/types-kit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testSafeTransaction() {
  try {
    console.log('🚀 Starting Safe SDK Test Transaction...');
    
    // Environment variables
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    const SAFE_ADDRESS = process.env.SAFE_ADDRESS ;
    const RPC_URL = process.env.RPC_URL;
    const CHAIN_ID = 11155111; // Sepolia testnet
    const signerWallet = new ethers.Wallet(PRIVATE_KEY, RPC_URL)
    const signerAddress = await signerWallet.getAddress()
    
    if (!PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }
    
    console.log('📋 Configuration:');
    console.log('- Safe Address:', SAFE_ADDRESS);
    console.log('- Chain ID:', CHAIN_ID);
    console.log('- RPC URL:', RPC_URL);
    console.log('- Private Key:', PRIVATE_KEY.substring(0, 10) + '...');
    
    // Create provider and signer from private key
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log('✅ Provider and signer created');
    console.log('📱 Signer address:', await signer.getAddress());
    
    // Initialize Safe SDK
    console.log('🔧 Initializing Safe SDK...');
    const safeSdk = await Safe.init({
      provider: RPC_URL,
      signer: PRIVATE_KEY,
      safeAddress: SAFE_ADDRESS
    });
    
    console.log('✅ Safe SDK initialized');
    
    // Test transaction data (simple ETH transfer)
    const testTransactionData = {
      to: await signer.getAddress(), // Send to self for testing
      value: '1000000000000000', // 0.001 ETH
      data: '0x', // No additional data
      operation: OperationType.Call
    };
    
    console.log('📝 Creating test transaction...');
    console.log('Transaction data:', testTransactionData);
    
    // Create Safe transaction
    const safeTransaction = await safeSdk.createTransaction({
      transactions: [testTransactionData],
      options: { onlyCalls: false }
    });
    
    console.log('✅ Safe transaction created');
    
    // Get transaction hash
    const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
    console.log('🔗 Safe Transaction Hash:', safeTxHash);
    
    // Sign the transaction
    console.log('✍️ Signing transaction...');
    const signature = await safeSdk.signTransaction(safeTransaction);
    console.log('✅ Transaction signed');
    console.log('📜 Signature:', signature);
    
    // Initialize Safe API Kit
    console.log('🌐 Initializing Safe API Kit...');
    const apiKit = new SafeApiKit({
      chainId: BigInt(CHAIN_ID),
      apiKey: process.env.SAFE_API_KEY
    });
    
    // Propose transaction to Safe Transaction Service
    console.log('📤 Proposing transaction to Safe Transaction Service...');
    await apiKit.proposeTransaction({
      safeAddress: SAFE_ADDRESS,
      safeTransactionData: safeTransaction.data,
      safeTxHash,
      senderAddress: await signer.getAddress(),
      senderSignature: signature.signatures.data
    });
    
    console.log('✅ Transaction proposed successfully!');
    
    // Store transaction data for verification
    const transactionData = {
      timestamp: new Date().toISOString(),
      safeTxHash,
      signature: signature.data,
      safeAddress: SAFE_ADDRESS,
      to: testTransactionData.to,
      value: testTransactionData.value,
      data: testTransactionData.data,
      signerAddress: await signer.getAddress(),
      chainId: CHAIN_ID
    };
    
    console.log('💾 Transaction data stored:');
    console.log(JSON.stringify(transactionData, null, 2));
    
    // Verify Safe ownership
    console.log('🔍 Verifying Safe ownership...');
    const isOwner = await safeSdk.isOwner(await signer.getAddress());
    console.log('Is signer an owner?', isOwner);
    
    // Get Safe info
    console.log('📊 Safe Information:');
    const owners = await safeSdk.getOwners();
    const threshold = await safeSdk.getThreshold();
    const nonce = await safeSdk.getNonce();
    
    console.log('- Owners:', owners);
    console.log('- Threshold:', threshold);
    console.log('- Current Nonce:', nonce);

    const signatureResponse = await apiKit.confirmTransaction(safeTxHash, signature.signatures.get(signerAddress.toLowerCase()).data)
    console.log('Signature response:', signatureResponse);


    console.log('🎉 Transaction confirmed successfully!');
    
    console.log('🎉 Test completed successfully!');
    
    
    
    return signatureResponse;


    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.message);
    throw error;
  }
}

// Test different scenarios
async function runAllTests() {
  console.log('🧪 Running Safe SDK Tests...\n');
  
  try {
    // Test 1: Basic transaction creation and signing
    console.log('=== Test 1: Basic Transaction ===');
    const result1 = await testSafeTransaction();
    console.log('✅ Test 1 passed\n');
    
    // Test 2: Verify transaction data
    console.log('=== Test 2: Transaction Verification ===');
    if (result1.safeTxHash && result1.signature) {
      console.log('✅ Transaction hash and signature generated successfully');
    } else {
      throw new Error('Transaction hash or signature missing');
    }
    console.log('✅ Test 2 passed\n');
    
    console.log('🎊 All tests passed successfully!');
    
  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// Export functions for use in other modules
export { testSafeTransaction, runAllTests };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}
