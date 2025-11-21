/** @type {import('hardhat/config').HardhatUserConfig} */
const config = {
    solidity: {
        version: "0.8.28",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    paths: {
        sources: "./contracts",
        artifacts: "./artifacts"
    },
    networks: {}
};

export default config;