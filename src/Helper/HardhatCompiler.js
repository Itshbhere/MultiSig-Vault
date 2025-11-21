import { resolve } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * @title Hardhat Compiler Helper
 * @notice Compiles Solidity contracts using Hardhat and extracts bytecode
 * @dev This creates a programmatic Hardhat instance to compile contracts
 */
export async function getContractBytecode(contractName, contractPath = null) {
    try {
        console.log('🔧 Initializing Hardhat compiler...');

        // Find the project root by looking for hardhat.config.cjs or hardhat.config.js
        const fs = await import('fs/promises');
        const path = await import('path');
        let projectRoot = process.cwd();
        let configFound = false;

        // Try to find the config file by going up the directory tree
        let currentDir = projectRoot;
        while (currentDir !== path.dirname(currentDir)) {
            const configCjs = path.join(currentDir, 'hardhat.config.cjs');
            const configJs = path.join(currentDir, 'hardhat.config.js');
            try {
                await fs.access(configCjs);
                projectRoot = currentDir;
                configFound = true;
                break;
            } catch {
                try {
                    await fs.access(configJs);
                    projectRoot = currentDir;
                    configFound = true;
                    break;
                } catch {
                    // Continue searching
                }
            }
            currentDir = path.dirname(currentDir);
        }

        if (!configFound) {
            throw new Error('Could not find hardhat.config.cjs or hardhat.config.js. Make sure you are running from a Hardhat project directory.');
        }

        // Check if Hardhat is installed by trying to run it
        try {
            await execAsync('npx hardhat --version');
        } catch (error) {
            throw new Error(
                'Hardhat is not installed. Please install it with: npm install --save-dev hardhat\n' +
                'Or if using a different package manager: yarn add -D hardhat'
            );
        }

        // Create a simple hre-like object that uses subprocess for compilation
        const hre = {
            run: async (taskName, taskArgs) => {
                if (taskName === 'compile') {
                    const forceFlag = taskArgs?.force ? '--force' : '';
                    const command = `npx hardhat compile ${forceFlag}`.trim();
                    try {
                        const { stdout, stderr } = await execAsync(command, {
                            cwd: projectRoot, // Use project root instead of process.cwd()
                            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
                        });
                        if (stderr && !stderr.includes('Warning')) {
                            console.warn('Hardhat stderr:', stderr);
                        }
                    } catch (compileError) {
                        throw new Error(`Hardhat compilation failed: ${compileError.message}`);
                    }
                    return;
                }
                throw new Error(`Task ${taskName} not implemented`);
            },
            artifacts: {
                readArtifact: async (contractName) => {
                    // Try different artifact paths relative to project root
                    const possibleArtifactPaths = [
                        resolve(projectRoot, 'artifacts', 'contracts', `${contractName}.sol`, `${contractName}.json`),
                        resolve(projectRoot, 'artifacts', `${contractName}.sol`, `${contractName}.json`),
                    ];

                    for (const artifactPath of possibleArtifactPaths) {
                        try {
                            const content = await fs.readFile(artifactPath, 'utf-8');
                            return JSON.parse(content);
                        } catch (e) {
                            // Try next path
                        }
                    }
                    throw new Error(`Could not find artifact for ${contractName}`);
                }
            }
        };

        // If contractPath is provided, use it; otherwise search for the contract
        let fullContractPath = contractPath;

        if (!fullContractPath) {
            // Try to find the contract in common locations relative to project root
            const possiblePaths = [
                resolve(projectRoot, 'contracts', `${contractName}.sol`),
                resolve(projectRoot, 'src', 'contracts', `${contractName}.sol`),
            ];

            for (const path of possiblePaths) {
                try {
                    await fs.access(path);
                    fullContractPath = path;
                    console.log(`📁 Found contract at: ${fullContractPath}`);
                    break;
                } catch (e) {
                    // Path doesn't exist, try next
                }
            }

            if (!fullContractPath) {
                console.warn(`⚠️  Could not find ${contractName}.sol in common locations. Hardhat will search its configured paths.`);
            }
        } else {
            console.log(`📁 Using provided contract path: ${fullContractPath}`);
        }

        console.log(`📝 Compiling contract: ${contractName}`);

        // Compile contracts using Hardhat
        console.log('⏳ Compiling with Hardhat...');
        try {
            await hre.run('compile', {
                force: true, // Force recompilation
                quiet: false
            });
        } catch (compileError) {
            throw new Error(`Compilation failed: ${compileError.message}. Make sure your Hardhat config is set up correctly.`);
        }

        console.log('✅ Compilation complete');

        // Get the compiled contract artifact using Hardhat's API
        let artifact;
        try {
            artifact = await hre.artifacts.readArtifact(contractName);
        } catch (artifactError) {
            // If readArtifact fails, try reading from file system
            try {
                const fs = await import('fs/promises');
                // Try different artifact paths relative to project root
                const possibleArtifactPaths = [
                    resolve(projectRoot, 'artifacts', 'contracts', `${contractName}.sol`, `${contractName}.json`),
                    resolve(projectRoot, 'artifacts', `${contractName}.sol`, `${contractName}.json`),
                ];

                for (const artifactPath of possibleArtifactPaths) {
                    try {
                        const artifactContent = await fs.readFile(artifactPath, 'utf-8');
                        artifact = JSON.parse(artifactContent);
                        console.log(`📁 Found artifact at: ${artifactPath}`);
                        break;
                    } catch (e) {
                        // Try next path
                    }
                }

                if (!artifact) {
                    throw new Error(`Could not find artifact for ${contractName}. Make sure the contract compiled successfully.`);
                }
            } catch (fileError) {
                throw new Error(`Could not read artifact for ${contractName}: ${artifactError.message}`);
            }
        }

        if (!artifact || !artifact.bytecode || artifact.bytecode === '0x') {
            throw new Error(`No bytecode found for ${contractName}. The contract may not have compiled successfully.`);
        }

        console.log('✅ Bytecode extracted successfully');
        console.log(`📏 Bytecode length: ${artifact.bytecode.length} characters`);

        return artifact.bytecode;

    } catch (error) {
        console.error('❌ Hardhat compilation failed:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        throw error;
    }
}

/**
 * @title Get Contract Bytecode with Custom Hardhat Config
 * @notice Compiles contract using a custom Hardhat configuration
 */
export async function getContractBytecodeWithConfig(contractName, hardhatConfigPath = null) {
    try {
        // If custom config path is provided, we need to load it
        if (hardhatConfigPath) {
            // Dynamically import the hardhat config
            const configPath = resolve(process.cwd(), hardhatConfigPath);
            await import(configPath);
        }

        return await getContractBytecode(contractName);
    } catch (error) {
        console.error('❌ Failed to compile with custom config:', error);
        throw error;
    }
}

/**
 * @title Compile Contract from Source
 * @notice Compiles a contract directly from source code string
 */
export async function compileContractFromSource(contractName, sourceCode, contractPath = null) {
    try {
        console.log('🔧 Compiling contract from source...');

        // Find project root first
        const fs = await import('fs/promises');
        const path = await import('path');
        let projectRoot = process.cwd();

        // Find the project root by looking for hardhat.config.cjs or hardhat.config.js
        let currentDir = projectRoot;
        while (currentDir !== path.dirname(currentDir)) {
            const configCjs = path.join(currentDir, 'hardhat.config.cjs');
            const configJs = path.join(currentDir, 'hardhat.config.js');
            try {
                await fs.access(configCjs);
                projectRoot = currentDir;
                break;
            } catch {
                try {
                    await fs.access(configJs);
                    projectRoot = currentDir;
                    break;
                } catch {
                    // Continue searching
                }
            }
            currentDir = path.dirname(currentDir);
        }

        // Write source to contracts directory temporarily
        const contractsDir = resolve(projectRoot, 'contracts');
        const tempContractPath = path.join(contractsDir, `${contractName}.sol`);

        // Ensure contracts directory exists
        try {
            await fs.access(contractsDir);
        } catch {
            await fs.mkdir(contractsDir, { recursive: true });
        }

        // Write the contract file
        await fs.writeFile(tempContractPath, sourceCode, 'utf-8');

        try {
            // Compile using the standard method
            const bytecode = await getContractBytecode(contractName);

            // Cleanup: remove the temporary contract file
            await fs.unlink(tempContractPath).catch(() => {
                // Ignore cleanup errors
            });

            return bytecode;
        } catch (compileError) {
            // Cleanup on error
            await fs.unlink(tempContractPath).catch(() => {
                // Ignore cleanup errors
            });
            throw compileError;
        }

    } catch (error) {
        console.error('❌ Source compilation failed:', error);
        throw error;
    }
}

