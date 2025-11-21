import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';
import { readFile } from 'fs/promises';
import { access } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

/**
 * @title Standalone Contract Compiler
 * @notice Compiles a Solidity contract using Hardhat and returns the bytecode
 * @dev This script can be run independently to test contract compilation
 */
async function compileContract(contractName = 'DCOLock') {
    try {
        console.log('🚀 Starting Contract Compilation...');
        console.log(`📝 Contract name: ${contractName}`);

        // Find the project root by looking for hardhat.config.cjs or hardhat.config.js
        let projectRoot = process.cwd();
        let configFound = false;

        console.log('🔍 Searching for Hardhat config file...');
        let currentDir = projectRoot;
        while (currentDir !== dirname(currentDir)) {
            const configCjs = join(currentDir, 'hardhat.config.cjs');
            const configJs = join(currentDir, 'hardhat.config.js');
            try {
                await access(configCjs);
                projectRoot = currentDir;
                configFound = true;
                console.log(`✅ Found Hardhat config at: ${configCjs}`);
                break;
            } catch {
                try {
                    await access(configJs);
                    projectRoot = currentDir;
                    configFound = true;
                    console.log(`✅ Found Hardhat config at: ${configJs}`);
                    break;
                } catch {
                    // Continue searching
                }
            }
            currentDir = dirname(currentDir);
        }

        if (!configFound) {
            throw new Error('❌ Could not find hardhat.config.cjs or hardhat.config.js. Make sure you are running from a Hardhat project directory.');
        }

        console.log(`📁 Project root: ${projectRoot}`);

        // Check if Hardhat is installed
        console.log('🔧 Checking Hardhat installation...');
        try {
            const { stdout } = await execAsync('npx hardhat --version');
            console.log(`✅ Hardhat version: ${stdout.trim()}`);
        } catch (error) {
            throw new Error(
                '❌ Hardhat is not installed. Please install it with: npm install --save-dev hardhat\n' +
                'Or if using a different package manager: yarn add -D hardhat'
            );
        }

        // Check if contract file exists
        console.log('🔍 Checking for contract file...');
        const contractPath = resolve(projectRoot, 'contracts', `${contractName}.sol`);
        try {
            await access(contractPath);
            console.log(`✅ Found contract at: ${contractPath}`);
        } catch {
            // Try alternative location
            const altPath = resolve(projectRoot, 'contracts', 'DCO.sol');
            try {
                await access(altPath);
                console.log(`⚠️  Contract name is ${contractName} but file is DCO.sol`);
                console.log(`📁 Contract file at: ${altPath}`);
            } catch {
                throw new Error(`❌ Could not find contract file. Searched for:\n  - ${contractPath}\n  - ${altPath}`);
            }
        }

        // Compile the contract
        console.log('⏳ Compiling contract with Hardhat...');
        const command = `npx hardhat compile --force`;
        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: projectRoot,
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer
            });

            if (stdout) {
                console.log('📋 Compilation output:');
                console.log(stdout);
            }

            if (stderr && !stderr.includes('Warning') && !stderr.includes('Compiled')) {
                console.warn('⚠️  Compilation warnings:', stderr);
            }
        } catch (compileError) {
            console.error('❌ Compilation failed!');
            console.error('Error message:', compileError.message);
            if (compileError.stdout) {
                console.error('Stdout:', compileError.stdout);
            }
            if (compileError.stderr) {
                console.error('Stderr:', compileError.stderr);
            }
            throw new Error(`Hardhat compilation failed: ${compileError.message}`);
        }

        console.log('✅ Compilation complete!');

        // Read the artifact to get bytecode
        console.log('📖 Reading compiled artifact...');
        const possibleArtifactPaths = [
            resolve(projectRoot, 'artifacts', 'contracts', `${contractName}.sol`, `${contractName}.json`),
            resolve(projectRoot, 'artifacts', 'contracts', 'DCO.sol', `${contractName}.json`),
            resolve(projectRoot, 'artifacts', `${contractName}.sol`, `${contractName}.json`),
        ];

        let artifact = null;
        let artifactPath = null;

        for (const path of possibleArtifactPaths) {
            try {
                const content = await readFile(path, 'utf-8');
                artifact = JSON.parse(content);
                artifactPath = path;
                console.log(`✅ Found artifact at: ${path}`);
                break;
            } catch (e) {
                // Try next path
            }
        }

        if (!artifact) {
            throw new Error(`❌ Could not find artifact for ${contractName}. Searched paths:\n${possibleArtifactPaths.map(p => `  - ${p}`).join('\n')}`);
        }

        // Extract bytecode
        const bytecode = artifact.bytecode;
        if (!bytecode || bytecode === '0x') {
            throw new Error(`❌ No bytecode found in artifact. The contract may not have compiled successfully.`);
        }

        console.log('\n✅✅✅ SUCCESS ✅✅✅');
        console.log(`📏 Bytecode length: ${bytecode.length} characters`);
        console.log(`📏 Bytecode (first 100 chars): ${bytecode.substring(0, 100)}...`);
        console.log(`\n📦 Full bytecode:`);
        console.log(bytecode);
        console.log(`\n💾 Artifact location: ${artifactPath}`);

        return {
            success: true,
            contractName,
            bytecode,
            artifactPath,
            bytecodeLength: bytecode.length
        };

    } catch (error) {
        console.error('\n❌❌❌ COMPILATION FAILED ❌❌❌');
        console.error('Error:', error.message);
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        return {
            success: false,
            error: error.message,
            stack: error.stack
        };
    }
}

export { compileContract };

// Only run if this file is executed directly (not imported)
// Get the current file path and the script being executed
const currentFile = fileURLToPath(import.meta.url);
const scriptFile = process.argv[1] ? fileURLToPath(`file://${process.argv[1]}`) : null;

// Check if this file is being run directly (not imported)
const isMainModule = scriptFile && currentFile === scriptFile;

if (isMainModule) {
    // Run the compilation
    const contractName = process.argv[2] || 'DCOLock';
    compileContract(contractName)
        .then(result => {
            if (result.success) {
                console.log('\n🎉 Compilation completed successfully!');
                process.exit(0);
            } else {
                console.log('\n💥 Compilation failed!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Unexpected error:', error);
            process.exit(1);
        });
}

