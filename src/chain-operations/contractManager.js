import { ethers } from "ethers";
import { providerFactory } from './providerFactory.js';
import { getRequiredConfirmations } from '../config/chains.js';

// Import ABIs
import CAP_TABLE_FACTORY from "../../chain/out/DiamondCapTableFactory.sol/DiamondCapTableFactory.json" assert { type: "json" };
import STAKEHOLDER_FACET from "../../chain/out/StakeholderFacet.sol/StakeholderFacet.json" assert { type: "json" };
import ISSUER_FACET from "../../chain/out/IssuerFacet.sol/IssuerFacet.json" assert { type: "json" };
import STOCK_CLASS_FACET from "../../chain/out/StockClassFacet.sol/StockClassFacet.json" assert { type: "json" };
import STOCK_FACET from "../../chain/out/StockFacet.sol/StockFacet.json" assert { type: "json" };
import CONVERTIBLE_FACET from "../../chain/out/ConvertiblesFacet.sol/ConvertiblesFacet.json" assert { type: "json" };
import WARRANT_FACET from "../../chain/out/WarrantFacet.sol/WarrantFacet.json" assert { type: "json" };
import EQUITY_COMPENSATION_FACET from "../../chain/out/EquityCompensationFacet.sol/EquityCompensationFacet.json" assert { type: "json" };
import STOCK_PLAN_FACET from "../../chain/out/StockPlanFacet.sol/StockPlanFacet.json" assert { type: "json" };
import STAKEHOLDER_NFT_FACET from "../../chain/out/StakeholderNFTFacet.sol/StakeholderNFTFacet.json" assert { type: "json" };
import ACCESS_CONTROL_FACET from "../../chain/out/AccessControlFacet.sol/AccessControlFacet.json" assert { type: "json" };

/**
 * Manager class for handling contract instances across different chains
 * Implements caching and automatic transaction confirmation handling
 */
class ContractManager {
  constructor() {
    this.contractInstances = new Map();
    this.combinedABI = [
      ...CAP_TABLE_FACTORY.abi,
      ...STAKEHOLDER_FACET.abi,
      ...ISSUER_FACET.abi,
      ...STOCK_CLASS_FACET.abi,
      ...STOCK_FACET.abi,
      ...STOCK_PLAN_FACET.abi,
      ...CONVERTIBLE_FACET.abi,
      ...WARRANT_FACET.abi,
      ...EQUITY_COMPENSATION_FACET.abi,
      ...STAKEHOLDER_NFT_FACET.abi,
      ...ACCESS_CONTROL_FACET.abi
    ];
  }

  /**
   * Get contract instance for a specific address and chain
   * @param {string} address - Contract address
   * @param {number} chainId - Blockchain network ID
   * @returns {ethers.Contract} Contract instance
   */
  async getContractInstance(address, chainId) {
    const key = `${chainId}-${address}`;
    if (this.contractInstances.has(key)) {
      return this.contractInstances.get(key);
    }

    const provider = providerFactory.getProvider(chainId);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const contract = new ethers.Contract(
      address,
      this.combinedABI,
      wallet
    );

    // Wrap the contract to handle confirmations
    const wrappedContract = this._wrapContractWithConfirmations(contract, chainId);
    this.contractInstances.set(key, wrappedContract);
    return wrappedContract;
  }

  /**
   * Wrap contract methods to handle transaction confirmations
   * @private
   */
  _wrapContractWithConfirmations(contract, chainId) {
    const requiredConfirmations = getRequiredConfirmations(chainId);
    const handler = {
      get: (target, prop) => {
        const value = target[prop];
        if (typeof value !== 'function') {
          return value;
        }

        return async (...args) => {
          const result = await value.apply(target, args);

          // If the result is a transaction response, wait for confirmations
          if (result && typeof result.wait === 'function') {
            console.log(`Waiting for ${requiredConfirmations} confirmations on chain ${chainId}...`);
            return result.wait(requiredConfirmations);
          }

          return result;
        };
      }
    };

    return new Proxy(contract, handler);
  }

  /**
   * Remove contract instance from cache
   * @param {string} address - Contract address
   * @param {number} chainId - Blockchain network ID
   */
  removeContractInstance(address, chainId) {
    const key = `${chainId}-${address}`;
    this.contractInstances.delete(key);
  }

  /**
   * Clear all cached contract instances
   */
  clearCache() {
    this.contractInstances.clear();
  }

  /**
   * Get factory contract instance for deploying new cap tables
   * @param {number} chainId - Blockchain network ID
   * @param {string} factoryAddress - Factory contract address
   * @returns {ethers.Contract} Factory contract instance
   */
  async getFactoryInstance(chainId, factoryAddress) {
    const provider = providerFactory.getProvider(chainId);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    return new ethers.Contract(
      factoryAddress,
      CAP_TABLE_FACTORY.abi,
      wallet
    );
  }
}

// Export singleton instance
export const contractManager = new ContractManager();

// Clear cache on low memory
process.on('warning', (warning) => {
  if (warning.name === 'HeapSizeWarning') {
    console.log('Low memory warning received, clearing contract cache...');
    contractManager.clearCache();
  }
});
