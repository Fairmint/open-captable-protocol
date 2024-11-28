/**
 * Configuration for supported blockchain networks
 * Each chain configuration includes:
 * - id: Chain ID
 * - name: Human readable name
 * - rpcUrl: HTTP RPC endpoint
 * - wsUrl: WebSocket endpoint for event listening
 * - explorer: Block explorer URL
 */

export const SUPPORTED_CHAINS = {
  BASE: {
    id: 8453,
    name: 'Base Mainnet',
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    wsUrl: process.env.BASE_WS_URL || 'wss://mainnet.base.org',
    explorer: 'https://basescan.org',
    confirmations: 12 // Number of block confirmations needed
  },
  BASE_SEPOLIA: {
    id: 84532,
    name: 'Base Sepolia',
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    wsUrl: process.env.BASE_SEPOLIA_WS_URL || 'wss://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    confirmations: 6 // Testnet needs fewer confirmations
  },
  ANVIL: {
    id: 31337,
    name: 'Anvil Local',
    rpcUrl: process.env.ANVIL_RPC_URL || 'http://127.0.0.1:8545',
    wsUrl: process.env.ANVIL_WS_URL || 'ws://127.0.0.1:8545',
    explorer: null,
    confirmations: 1, // Local network only needs 1 confirmation
    isTestnet: true
  }
};

/**
 * Get chain configuration by chain ID
 * @param {number} chainId - The blockchain network ID
 * @returns {Object|null} Chain configuration object or null if not supported
 */
export const getChainConfig = (chainId) => {
  return Object.values(SUPPORTED_CHAINS).find(chain => chain.id === parseInt(chainId));
};

/**
 * Get transaction explorer URL for a given chain
 * @param {number} chainId - The blockchain network ID
 * @param {string} txHash - Transaction hash
 * @returns {string|null} Explorer URL or null if not available
 */
export const getExplorerUrl = (chainId, txHash) => {
  const chain = getChainConfig(chainId);
  if (!chain || !chain.explorer) return null;
  return `${chain.explorer}/tx/${txHash}`;
};

/**
 * Get required confirmations for a given chain
 * @param {number} chainId - The blockchain network ID
 * @returns {number} Number of required confirmations
 */
export const getRequiredConfirmations = (chainId) => {
  const chain = getChainConfig(chainId);
  return chain?.confirmations || 12; // Default to 12 if not specified
};

/**
 * Validate if a chain ID is supported
 * @param {number} chainId - The blockchain network ID
 * @returns {boolean} True if chain is supported
 */
export const isChainSupported = (chainId) => {
  return getChainConfig(chainId) !== undefined;
};

/**
 * Check if a chain is a testnet
 * @param {number} chainId - The blockchain network ID
 * @returns {boolean} True if chain is a testnet
 */
export const isTestnet = (chainId) => {
  const chain = getChainConfig(chainId);
  return chain?.isTestnet || false;
};

/**
 * Get default chain ID based on environment
 * @returns {number} Default chain ID
 */
export const getDefaultChainId = () => {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'production') {
    return SUPPORTED_CHAINS.BASE.id;
  } else if (env === 'staging') {
    return SUPPORTED_CHAINS.BASE_SEPOLIA.id;
  } else {
    return SUPPORTED_CHAINS.ANVIL.id;
  }
};
