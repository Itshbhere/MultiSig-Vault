import Safe from '@safe-global/protocol-kit';
import SafeApiKit from '@safe-global/api-kit';
import { ethers } from 'ethers';
import { OperationType } from '@safe-global/types-kit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * @title Simple Proxy Upgrade Script
 * @notice Creates a Safe transaction to upgrade the proxy using an already deployed implementation
 * @dev Use this after deploying the new implementation with Forge
 * 
 * Usage:
 * 1. Deploy new implementation using Forge: forge script script/UpgradeProxy.sol:UpgradeProxy --rpc-url $RPC_URL --broadcast
 * 2. Get the deployed implementation address from the Forge output
 * 3. Run this script with the implementation address: node src/Scripts/UpgradeProxySimple.js <implementationAddress>
 * 
 * Or set NEW_IMPLEMENTATION_ADDRESS in .env file
 */
async function upgradeProxyWithImplementation(implementationAddress, initData = '0x') {
    try {
        console.log('🚀 Starting Proxy Upgrade Transaction...');
        console.log('📦 Using implementation address:', implementationAddress);

        // Environment variables
        const PRIVATE_KEY = process.env.PRIVATE_KEY;
        const SAFE_ADDRESS = process.env.SAFE_ADDRESS;
        const RPC_URL = process.env.RPC_URL;
        const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11155111');
        const PROXY_ADDRESS = process.env.PROXY_ADDRESS || '0xB8dD4CD897211A6430c2ab3B8386aBeC3Dc08d85';
        const SAFE_API_KEY = process.env.SAFE_API_KEY;

        // Validation
        if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY environment variable is required');
        if (!SAFE_ADDRESS) throw new Error('SAFE_ADDRESS environment variable is required');
        if (!RPC_URL) throw new Error('RPC_URL environment variable is required');
        if (!SAFE_API_KEY) throw new Error('SAFE_API_KEY environment variable is required');
        if (!ethers.isAddress(implementationAddress)) throw new Error('Invalid implementation address');
        if (!ethers.isAddress(PROXY_ADDRESS)) throw new Error('Invalid proxy address');

        console.log('📋 Configuration:');
        console.log('- Safe Address:', SAFE_ADDRESS);
        console.log('- Proxy Address:', PROXY_ADDRESS);
        console.log('- New Implementation:', implementationAddress);
        console.log('- Chain ID:', CHAIN_ID);
        console.log('- RPC URL:', RPC_URL);

        // Create provider and signer
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const signer = new ethers.Wallet(PRIVATE_KEY, provider);
        const signerAddress = await signer.getAddress();

        console.log('✅ Provider and signer created');
        console.log('📱 Signer address:', signerAddress);

        // Initialize Safe SDK
        console.log('🔧 Initializing Safe SDK...');
        const safeSdk = await Safe.init({
            provider: RPC_URL,
            signer: PRIVATE_KEY,
            safeAddress: SAFE_ADDRESS
        });

        console.log('✅ Safe SDK initialized');

        // Verify signer is an owner
        const isOwner = await safeSdk.isOwner(signerAddress);
        if (!isOwner) {
            throw new Error(`Signer ${signerAddress} is not an owner of the Safe ${SAFE_ADDRESS}`);
        }
        console.log('✅ Signer is verified as Safe owner');

        // Encode the upgradeToAndCall function call
        console.log('📝 Encoding upgradeToAndCall function call...');

        // ABI for upgradeToAndCall function
        // function upgradeToAndCall(address newImplementation, bytes memory data)
        const upgradeABI = [
            'function upgradeToAndCall(address newImplementation, bytes memory data)'
        ];

        const proxyInterface = new ethers.Interface(upgradeABI);

        // Encode the function call
        const encodedData = proxyInterface.encodeFunctionData('upgradeToAndCall', [
            implementationAddress,
            initData
        ]);

        console.log('✅ Function call encoded');
        console.log('Encoded data (first 100 chars):', encodedData.substring(0, 100) + '...');

        // Create Safe transaction
        console.log('📝 Creating Safe transaction...');

        const safeTransactionData = {
            to: PROXY_ADDRESS,
            value: '0',
            data: encodedData,
            operation: OperationType.Call
        };

        const safeTransaction = await safeSdk.createTransaction({
            transactions: [safeTransactionData],
            options: { onlyCalls: false }
        });

        console.log('✅ Safe transaction created');

        // Get transaction hash
        const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
        console.log('🔗 Safe Transaction Hash:', safeTxHash);

        // Sign the transaction
        console.log('✍️ Signing transaction...');
        const signature = await safeSdk.signTransaction(safeTransaction);
        const signatureData = signature.signatures.get(signerAddress.toLowerCase()).data;
        console.log('✅ Transaction signed');
        console.log('📜 Signature data:', signatureData);

        // Initialize Safe API Kit
        console.log('🌐 Initializing Safe API Kit...');
        const apiKit = new SafeApiKit({
            chainId: BigInt(CHAIN_ID),
            apiKey: SAFE_API_KEY
        });

        // Propose transaction to Safe Transaction Service
        console.log('📤 Proposing transaction to Safe Transaction Service...');
        await apiKit.proposeTransaction({
            safeAddress: SAFE_ADDRESS,
            safeTransactionData: safeTransaction.data,
            safeTxHash,
            senderAddress: signerAddress,
            senderSignature: signature.signatures.data
        });

        console.log('✅ Transaction proposed successfully!');

        // Confirm the transaction
        console.log('✅ Confirming transaction...');
        const signatureResponse = await apiKit.confirmTransaction(
            safeTxHash,
            signatureData
        );
        console.log('Signature response:', signatureResponse);

        // Transaction summary
        const transactionData = {
            timestamp: new Date().toISOString(),
            safeTxHash,
            signature: signatureData,
            safeAddress: SAFE_ADDRESS,
            proxyAddress: PROXY_ADDRESS,
            newImplementationAddress: implementationAddress,
            to: PROXY_ADDRESS,
            data: encodedData,
            signerAddress: signerAddress,
            chainId: CHAIN_ID
        };

        console.log('\n💾 Transaction Summary:');
        console.log(JSON.stringify(transactionData, null, 2));

        console.log('\n🎉 Proxy upgrade transaction created successfully!');
        console.log('\n📋 Next Steps:');
        console.log('1. Wait for other owners to sign the transaction');
        console.log(`2. Check pending transactions: https://safe-transaction-sepolia.safe.global/#/safes/${SAFE_ADDRESS}/transactions`);
        console.log('3. Once threshold is reached, execute the transaction');
        console.log('4. Verify the upgrade was successful');

        return transactionData;

    } catch (error) {
        console.error('❌ Upgrade failed:', error);
        console.error('Error details:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        throw error;
    }
}

// Main execution
async function main() {
    // Get implementation address from command line argument or environment variable
    const implementationAddress = process.argv[2] || process.env.NEW_IMPLEMENTATION_ADDRESS;
    const initData = process.env.INIT_DATA || '0x';

    if (!implementationAddress) {
        console.error('❌ Error: Implementation address is required');
        console.error('\nUsage:');
        console.error('  node src/Scripts/UpgradeProxySimple.js <implementationAddress>');
        console.error('\nOr set NEW_IMPLEMENTATION_ADDRESS in .env file');
        console.error('\nExample:');
        console.error('  node src/Scripts/UpgradeProxySimple.js 0x1234567890123456789012345678901234567890');
        process.exit(1);
    }

    await upgradeProxyWithImplementation(implementationAddress, initData);
}

// Export function
export { upgradeProxyWithImplementation };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

