import Safe from '@safe-global/protocol-kit';
import SafeApiKit from '@safe-global/api-kit';
import { ethers } from 'ethers';
import { OperationType } from '@safe-global/types-kit';
import { compileContract } from './CompileContract.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * @title Proxy Upgrade Script
 * @notice Deploys a new DCOLock implementation and creates a Safe transaction to upgrade the proxy
 * @dev This script follows the pattern from Testsdk.js for creating and proposing Safe transactions
 */
async function upgradeProxy() {
    try {
        console.log('🚀 Starting Proxy Upgrade Transaction...');

        // Environment variables
        const PRIVATE_KEY = process.env.PRIVATE_KEY;
        const SAFE_ADDRESS = process.env.SAFE_ADDRESS;
        const RPC_URL = process.env.RPC_URL;
        const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11155111'); // Sepolia testnet default
        const PROXY_ADDRESS = process.env.PROXY_ADDRESS || '0xB8dD4CD897211A6430c2ab3B8386aBeC3Dc08d85';

        if (!PRIVATE_KEY) {
            throw new Error('PRIVATE_KEY environment variable is required');
        }

        if (!SAFE_ADDRESS) {
            throw new Error('SAFE_ADDRESS environment variable is required');
        }

        if (!RPC_URL) {
            throw new Error('RPC_URL environment variable is required');
        }

        console.log('📋 Configuration:');
        console.log('- Safe Address:', SAFE_ADDRESS);
        console.log('- Proxy Address:', PROXY_ADDRESS);
        console.log('- Chain ID:', CHAIN_ID);
        console.log('- RPC URL:', RPC_URL);
        console.log('- Private Key:', PRIVATE_KEY.substring(0, 10) + '...');

        // Create provider and signer from private key
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

        // Step 1: Deploy new implementation using Hardhat to compile and get bytecode
        console.log('📦 Compiling and deploying new DCOLock implementation...');

        // Get contract name from environment or use default
        const CONTRACT_NAME = process.env.CONTRACT_NAME || 'DCOLock';

        console.log(`📝 Contract name: ${CONTRACT_NAME}`);

        // Compile contract using the standalone compilation script
        console.log('🔧 Compiling contract...');
        let DCO_LOCK_BYTECODE;
        try {
            const compilationResult = await compileContract(CONTRACT_NAME);

            if (!compilationResult.success) {
                throw new Error(compilationResult.error || 'Compilation failed');
            }

            DCO_LOCK_BYTECODE = compilationResult.bytecode;
            console.log('✅ Bytecode retrieved from Hardhat compilation');
            console.log(`📏 Bytecode length: ${compilationResult.bytecodeLength} characters`);
        } catch (error) {
            console.error('❌ Failed to compile contract:', error.message);
            throw new Error(`Failed to compile contract ${CONTRACT_NAME}. Make sure Hardhat is set up and the contract exists. Error: ${error.message}`);
        }

        if (!DCO_LOCK_BYTECODE || DCO_LOCK_BYTECODE === '0x') {
            throw new Error('Failed to get bytecode. Contract compilation may have failed.');
        }

        // Deploy the new implementation
        const deployTx = {
            data: DCO_LOCK_BYTECODE
        };

        console.log('⏳ Deploying contract...');
        const deployResponse = await signer.sendTransaction(deployTx);
        console.log('📝 Deployment transaction sent:', deployResponse.hash);

        console.log('⏳ Waiting for deployment confirmation...');
        const receipt = await deployResponse.wait();

        if (!receipt.contractAddress) {
            throw new Error('Contract deployment failed - no contract address in receipt');
        }

        const newImplementationAddress = receipt.contractAddress;
        console.log('✅ New implementation deployed at:', newImplementationAddress);

        // Step 2: Encode the upgradeToAndCall function call
        console.log('📝 Encoding upgradeToAndCall function call...');

        // ABI for upgradeToAndCall function
        // function upgradeToAndCall(address newImplementation, bytes memory data)
        const upgradeABI = [
            'function upgradeToAndCall(address newImplementation, bytes memory data)'
        ];

        const proxyInterface = new ethers.Interface(upgradeABI);

        // Prepare initialization data (empty for simple upgrade)
        const initData = process.env.INIT_DATA || '0x'; // Empty init data by default

        // Encode the function call
        const encodedData = proxyInterface.encodeFunctionData('upgradeToAndCall', [
            newImplementationAddress,
            initData
        ]);

        console.log('✅ Function call encoded');
        console.log('Encoded data:', encodedData);

        // Step 3: Create Safe transaction
        console.log('📝 Creating Safe transaction...');

        const safeTransactionData = {
            to: PROXY_ADDRESS, // The proxy contract address
            value: '0', // No ETH transfer
            data: encodedData, // The encoded upgradeToAndCall call
            operation: OperationType.Call
        };

        console.log('Transaction data:', {
            to: safeTransactionData.to,
            value: safeTransactionData.value,
            data: safeTransactionData.data.substring(0, 50) + '...',
            operation: safeTransactionData.operation
        });

        // Create Safe transaction
        const safeTransaction = await safeSdk.createTransaction({
            transactions: [safeTransactionData],
            options: { onlyCalls: false }
        });

        console.log('✅ Safe transaction created');

        // Step 4: Get transaction hash
        const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
        console.log('🔗 Safe Transaction Hash:', safeTxHash);

        // Step 5: Sign the transaction
        console.log('✍️ Signing transaction...');
        const signature = await safeSdk.signTransaction(safeTransaction);
        console.log('✅ Transaction signed');
        console.log('📜 Signature data:', signature.signatures.get(signerAddress.toLowerCase()).data);

        // Step 6: Initialize Safe API Kit
        console.log('🌐 Initializing Safe API Kit...');
        const apiKit = new SafeApiKit({
            chainId: BigInt(CHAIN_ID),
            apiKey: process.env.SAFE_API_KEY
        });

        // Step 7: Propose transaction to Safe Transaction Service
        console.log('📤 Proposing transaction to Safe Transaction Service...');
        await apiKit.proposeTransaction({
            safeAddress: SAFE_ADDRESS,
            safeTransactionData: safeTransaction.data,
            safeTxHash,
            senderAddress: signerAddress,
            senderSignature: signature.signatures.data
        });

        console.log('✅ Transaction proposed successfully!');

        // Step 8: Confirm the transaction (optional - you can do this separately)
        console.log('✅ Confirming transaction...');
        const signatureResponse = await apiKit.confirmTransaction(
            safeTxHash,
            signature.signatures.get(signerAddress.toLowerCase()).data
        );
        console.log('Signature response:', signatureResponse);

        // Store transaction data for verification
        const transactionData = {
            timestamp: new Date().toISOString(),
            safeTxHash,
            signature: signature.signatures.get(signerAddress.toLowerCase()).data,
            safeAddress: SAFE_ADDRESS,
            proxyAddress: PROXY_ADDRESS,
            newImplementationAddress: newImplementationAddress,
            deploymentTxHash: deployResponse.hash,
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
        console.log('2. Once threshold is reached, execute the transaction');
        console.log('3. Verify the upgrade was successful');

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

// Alternative function if you already have a deployed implementation address
async function upgradeProxyWithExistingImplementation(implementationAddress, initData = '0x') {
    try {
        console.log('🚀 Starting Proxy Upgrade with Existing Implementation...');

        const PRIVATE_KEY = process.env.PRIVATE_KEY;
        const SAFE_ADDRESS = process.env.SAFE_ADDRESS;
        const RPC_URL = process.env.RPC_URL;
        const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11155111');
        const PROXY_ADDRESS = process.env.PROXY_ADDRESS || '0xB8dD4CD897211A6430c2ab3B8386aBeC3Dc08d85';

        if (!PRIVATE_KEY || !SAFE_ADDRESS || !RPC_URL) {
            throw new Error('Missing required environment variables');
        }

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const signer = new ethers.Wallet(PRIVATE_KEY, provider);
        const signerAddress = await signer.getAddress();

        const safeSdk = await Safe.init({
            provider: RPC_URL,
            signer: PRIVATE_KEY,
            safeAddress: SAFE_ADDRESS
        });

        const upgradeABI = [
            'function upgradeToAndCall(address newImplementation, bytes memory data)'
        ];

        const proxyInterface = new ethers.Interface(upgradeABI);
        const encodedData = proxyInterface.encodeFunctionData('upgradeToAndCall', [
            implementationAddress,
            initData
        ]);

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

        const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
        const signature = await safeSdk.signTransaction(safeTransaction);

        const apiKit = new SafeApiKit({
            chainId: BigInt(CHAIN_ID),
            apiKey: process.env.SAFE_API_KEY
        });

        await apiKit.proposeTransaction({
            safeAddress: SAFE_ADDRESS,
            safeTransactionData: safeTransaction.data,
            safeTxHash,
            senderAddress: signerAddress,
            senderSignature: signature.signatures.data
        });

        await apiKit.confirmTransaction(
            safeTxHash,
            signature.signatures.get(signerAddress.toLowerCase()).data
        );

        console.log('✅ Upgrade transaction proposed!');
        console.log('Safe Tx Hash:', safeTxHash);
        console.log('New Implementation:', implementationAddress);

        return {
            safeTxHash,
            newImplementationAddress: implementationAddress,
            proxyAddress: PROXY_ADDRESS
        };

    } catch (error) {
        console.error('❌ Upgrade failed:', error);
        throw error;
    }
}

// Export functions
export { upgradeProxy, upgradeProxyWithExistingImplementation };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
    // Check if implementation address is provided as argument
    const implementationAddress = process.argv[2];

    if (implementationAddress) {
        console.log('Using existing implementation:', implementationAddress);
        upgradeProxyWithExistingImplementation(implementationAddress).catch(console.error);
    } else {
        upgradeProxy().catch(console.error);
    }
}

