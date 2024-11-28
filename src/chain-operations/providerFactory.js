import { ethers } from "ethers";
import { getChainConfig } from "../config/chains.js";

/**
 * Factory class for managing blockchain providers across different networks
 * Implements singleton pattern to ensure only one provider instance per chain
 */
class ProviderFactory {
  constructor() {
    this.providers = new Map();
    this.wsProviders = new Map();
    this.reconnectAttempts = new Map();
    this.MAX_RECONNECT_ATTEMPTS = 5;
    this.RECONNECT_INTERVAL = 5000; // 5 seconds
  }

  /**
   * Get JSON RPC provider for a specific chain
   * @param {number} chainId - The blockchain network ID
   * @returns {ethers.JsonRpcProvider} Provider instance
   */
  getProvider(chainId) {
    if (this.providers.has(chainId)) {
      return this.providers.get(chainId);
    }

    const chainConfig = getChainConfig(chainId);
    if (!chainConfig) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
    this.providers.set(chainId, provider);
    return provider;
  }

  /**
   * Get WebSocket provider for a specific chain with auto-reconnect
   * @param {number} chainId - The blockchain network ID
   * @returns {ethers.WebSocketProvider} WebSocket provider instance
   */
  getWebSocketProvider(chainId) {
    if (this.wsProviders.has(chainId)) {
      return this.wsProviders.get(chainId);
    }

    const chainConfig = getChainConfig(chainId);
    if (!chainConfig) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    const provider = this._createWebSocketProvider(chainId, chainConfig.wsUrl);
    this.wsProviders.set(chainId, provider);
    return provider;
  }

  /**
   * Create WebSocket provider with auto-reconnect capability
   * @private
   */
  _createWebSocketProvider(chainId, wsUrl) {
    const provider = new ethers.WebSocketProvider(wsUrl);

    provider._websocket.on('close', async () => {
      console.log(`WebSocket connection closed for chain ${chainId}`);
      await this._handleReconnect(chainId, wsUrl);
    });

    provider._websocket.on('error', async (error) => {
      console.error(`WebSocket error for chain ${chainId}:`, error);
      await this._handleReconnect(chainId, wsUrl);
    });

    return provider;
  }

  /**
   * Handle WebSocket reconnection with exponential backoff
   * @private
   */
  async _handleReconnect(chainId, wsUrl) {
    const attempts = this.reconnectAttempts.get(chainId) || 0;

    if (attempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error(`Max reconnection attempts reached for chain ${chainId}`);
      this.reconnectAttempts.delete(chainId);
      return;
    }

    this.reconnectAttempts.set(chainId, attempts + 1);
    const backoffTime = this.RECONNECT_INTERVAL * Math.pow(2, attempts);

    console.log(`Attempting to reconnect to chain ${chainId} in ${backoffTime}ms`);

    setTimeout(async () => {
      try {
        const newProvider = this._createWebSocketProvider(chainId, wsUrl);
        this.wsProviders.set(chainId, newProvider);
        this.reconnectAttempts.delete(chainId);
        console.log(`Successfully reconnected to chain ${chainId}`);
      } catch (error) {
        console.error(`Failed to reconnect to chain ${chainId}:`, error);
        await this._handleReconnect(chainId, wsUrl);
      }
    }, backoffTime);
  }

  /**
   * Clean up provider instances
   * @param {number} chainId - The blockchain network ID
   */
  async cleanup(chainId) {
    const wsProvider = this.wsProviders.get(chainId);
    if (wsProvider) {
      await wsProvider.destroy();
      this.wsProviders.delete(chainId);
    }
    this.providers.delete(chainId);
    this.reconnectAttempts.delete(chainId);
  }

  /**
   * Clean up all provider instances
   */
  async cleanupAll() {
    for (const chainId of this.wsProviders.keys()) {
      await this.cleanup(chainId);
    }
  }
}

// Export singleton instance
export const providerFactory = new ProviderFactory();

// Cleanup on process exit
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, cleaning up providers...');
  await providerFactory.cleanupAll();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, cleaning up providers...');
  await providerFactory.cleanupAll();
  process.exit(0);
});
