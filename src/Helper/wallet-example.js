#!/usr/bin/env node

/**
 * Wallet Generation Example
 * 
 * This file demonstrates how to use the WalletGenerator class
 * to create and manage Ethereum wallets programmatically.
 */

import { WalletGenerator } from './WalletGeneration.js';

async function example() {
    console.log('🔐 Ethereum Wallet Generator Example\n');

    const generator = new WalletGenerator();

    try {
        // Example 1: Generate a single wallet
        console.log('1️⃣ Generating a single wallet...');
        const wallet1 = generator.generateWallet('6546550!');
        console.log(`Address: ${wallet1.address}`);
        console.log(`Private Key: ${wallet1.privateKey}`);
        console.log(`Mnemonic: ${wallet1.mnemonic}\n`);

        // Example 2: Generate multiple wallets
        // console.log('2️⃣ Generating 3 wallets...');
        // const wallets = generator.generateMultipleWallets(3, 'batchPassword456!');
        // wallets.forEach((wallet, index) => {
        //     console.log(`Wallet ${index + 1}: ${wallet.address}`);
        // });
        // console.log('');

        // Example 3: Import from mnemonic
        // console.log('3️⃣ Importing wallet from mnemonic...');
        // const importedWallet = generator.generateFromMnemonic(
        //     wallet1.mnemonic,
        //     'importPassword789!'
        // );
        // console.log(`Imported Address: ${importedWallet.address}`);
        // console.log(`Matches Original: ${importedWallet.address === wallet1.address}\n`);

        // // Example 4: Validate addresses
        // console.log('4️⃣ Validating addresses...');
        // const testAddresses = [
        //     wallet1.address,
        //     '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
        //     'invalid-address'
        // ];

        // testAddresses.forEach(addr => {
        //     const isValid = generator.validateAddress(addr);
        //     console.log(`${addr}: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
        // });
        // console.log('');

        // // Example 5: Export wallets
        // console.log('5️⃣ Exporting wallets...');
        // generator.exportToJSON('example-wallets.json');
        // generator.exportToCSV('example-wallets.csv');
        // generator.exportKeystoreFiles('exportPassword123!');
        // console.log('✅ Wallets exported successfully!\n');

        // // Example 6: Get summary
        // console.log('6️⃣ Wallet Summary:');
        // const summary = generator.getSummary();
        // console.log(`Total Wallets: ${summary.totalWallets}`);
        // console.log(`Generated: ${summary.generatedWallets}`);
        // console.log(`Imported: ${summary.importedWallets}`);
        // console.log(`Addresses: ${summary.addresses.join(', ')}\n`);

        // // Example 7: Check balance (requires network connection)
        // console.log('7️⃣ Checking wallet balance...');
        // try {
        //     const balance = await generator.getWalletBalance(wallet1.address);
        //     console.log(`Balance: ${balance.balanceEth} ETH`);
        // } catch (error) {
        //     console.log(`Balance check failed: ${error.message}`);
        // }

        // console.log('\n🎉 Example completed successfully!');
        // console.log('📁 Check the "generated-wallets" folder for exported files.');

    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
    }
}

// Run the example
example();
