import { isChainSupported } from '../config/chains.js';
import { contractManager } from '../chain-operations/contractManager.js';
import Issuer from '../db/objects/Issuer.js';

/**
 * Middleware to get or create contract instance
 * Requires issuerId in request body
 */
export const contractMiddleware = async (req, res, next) => {
  try {
    if (!req.body.issuerId) {
      return res.status(400).json({ error: 'issuerId is required' });
    }

    // Fetch issuer
    const issuer = await Issuer.findById(req.body.issuerId);
    if (!issuer) {
      return res.status(404).json({ error: 'Issuer not found' });
    }

    // Get chain ID from issuer's chain name
    const chainId = issuer.getChainId();
    if (!chainId) {
      return res.status(400).json({
        error: `Chain ${issuer.chain} is not supported`
      });
    }

    if (!isChainSupported(chainId)) {
      return res.status(400).json({
        error: `Chain ID ${chainId} is no longer supported`
      });
    }

    if (issuer.deployment_status !== 'deployed') {
      return res.status(400).json({
        error: `Issuer contract not fully deployed. Status: ${issuer.deployment_status}`
      });
    }

    // Get contract instance for this chain
    const contract = await contractManager.getContractInstance(
      issuer.deployed_to,
      chainId
    );

    // Attach to request object
    req.contract = contract;
    req.issuer = issuer;
    req.chainId = chainId;

    next();
  } catch (error) {
    console.error('Contract middleware error:', error);
    res.status(500).json({
      error: 'Error getting contract instance',
      details: error.message
    });
  }
};

/**
 * Middleware to validate transaction parameters for the specific chain
 * Handles gas limits appropriate for each chain
 */
export const transactionMiddleware = async (req, res, next) => {
  try {
    const chainId = req.chainId;

    // Add transaction overrides based on chain
    req.txOverrides = {
      // Base and Sepolia use standard gas limits
      gasLimit: 2000000,
      // Add other chain-specific parameters as needed
    };

    next();
  } catch (error) {
    console.error('Transaction middleware error:', error);
    res.status(500).json({
      error: 'Error processing transaction parameters',
      details: error.message
    });
  }
};
