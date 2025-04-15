# Open Cap Table Protocol Configuration System

This document provides a comprehensive overview of the configuration system used in the Open Cap Table Protocol (OCP) repository.

## Configuration Architecture

OCP uses an environment-based configuration approach that combines:

1. **Environment-specific .env files** (.env.local, .env.dev, .env.prod)
2. **Runtime environment variables**
3. **Blockchain network configurations**

## Configuration Loading Process

1. The `setupEnv()` function in `src/utils/env.js` is called at application startup
2. If running in a Docker environment (DOCKER_ENV=true), the function uses runtime environment variables
3. Otherwise, it loads environment variables from the .env file specified by the USE_ENV_FILE environment variable (defaults to .env)
4. The environment file is located by searching upwards from the current working directory
5. Once loaded, the environment variables are accessible via `process.env`

## Environment Files

The repository uses different environment files for different deployment environments:

| File | Purpose |
|------|---------|
| `.env.local` | Local development environment settings |
| `.env.dev` | Development/testnet environment settings |
| `.env.prod` | Production/mainnet environment settings |

## Configuration Categories

### Database Configuration

MongoDB connection settings are configured through the DATABASE_URL environment variable:

```bash
# Offchain db connection string for mongodb
DATABASE_URL="mongodb://ocp:ocp@localhost:27017/mongo?authSource=admin&retryWrites=true&w=majority"
DATABASE_REPLSET="0"  # set to "1" if using --replSet option in mongo
DATABASE_OVERRIDE=""  # optional override for database name
```

The database connection is established in `src/db/config/mongoose.ts` using these parameters.

### Blockchain Network Configuration

The system supports multiple blockchain networks, configured through the following settings:

```bash
# RPC url for the network
RPC_URL=http://127.0.0.1:8545

# Chain ID of the target network
CHAIN_ID=31337

# Private key for contract deployment and transactions
PRIVATE_KEY=your_private_key_here
```

Supported networks are defined in `src/utils/chains.js`:

```javascript
export const SUPPORTED_CHAINS = {
    8453: {
        // Base Mainnet
        name: "Base Mainnet",
        rpcUrl: process.env.BASE_RPC_URL,
        wsUrl: (process.env.BASE_RPC_URL || "").replace("https://", "wss://"),
    },
    84532: {
        // Base Sepolia
        name: "Base Sepolia",
        rpcUrl: process.env.BASE_SEPOLIA_RPC_URL,
        wsUrl: (process.env.BASE_SEPOLIA_RPC_URL || "").replace("https://", "wss://"),
    },
    31337: {
        // Anvil
        name: "Anvil",
        rpcUrl: "http://localhost:8545",
        wsUrl: "ws://localhost:8545",
    },
};
```

### Multi-Chain Configuration

The system is designed to support multiple blockchain networks simultaneously. Each chain requires specific configuration:

```bash
# Base Mainnet RPC
BASE_RPC_URL=https://mainnet.base.org

# Base Sepolia Testnet RPC
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

Chain-specific middleware is implemented in `src/app.js` to handle routing requests to the appropriate blockchain network:

```javascript
const chainMiddleware = (req, res, next) => {
    const chainId = req.body.chain_id;
    if (!chainId) {
        return res.status(400).send("chain_id is required for issuer creation");
    }
    
    const chainConfig = getChainConfig(Number(chainId));
    if (!chainConfig) {
        return res.status(400).send(`Unsupported chain ID: ${chainId}`);
    }
    
    req.chain = Number(chainId);
    next();
};
```

### Websocket Configuration

The system includes a real-time event listener that monitors contract events across multiple blockchain networks. Configuration for the websocket system includes:

```bash
# Optional WebSocket specific configuration
WS_RECONNECT_INTERVAL=5000  # Reconnection interval in milliseconds
WS_MAX_RECONNECT_ATTEMPTS=10  # Maximum reconnection attempts
EVENT_FILTER_FROM_BLOCK=0  # Start listening from this block (0 = from deployment)
```

The websocket listener is configured in `src/utils/websocket.ts` and automatically groups contracts by chain ID to optimize connection management:

```javascript
// Group contracts by chain ID
const contractsByChain = contracts.reduce((acc, { address, chain_id }) => {
    if (!acc[chain_id]) acc[chain_id] = [];
    acc[chain_id].push(address);
    return acc;
}, {});
```

### Contract Caching Configuration

To improve performance, the system implements a contract instance caching mechanism:

```bash
# Contract cache configuration
CONTRACT_CACHE_TTL=3600  # Cache time-to-live in seconds (0 = no expiration)
MAX_CACHED_CONTRACTS=100  # Maximum number of cached contract instances
```

The contract cache is implemented in `src/app.js` using a middleware function:

```javascript
const contractMiddleware = async (req, res, next) => {
    if (!req.body.issuerId) {
        return res.status(400).send("issuerId is required");
    }
    
    const issuer = await readIssuerById(req.body.issuerId);
    if (!issuer) return res.status(404).send("issuer not found");
    
    const cacheKey = `${issuer.chain_id}-${req.body.issuerId}`;
    if (!contractCache[cacheKey]) {
        const contract = await getContractInstance(issuer.deployed_to, issuer.chain_id);
        contractCache[cacheKey] = { contract };
    }
    
    req.contract = contractCache[cacheKey].contract;
    next();
};
```

### Smart Contract Addresses

Contract addresses are stored in environment variables and updated during deployment:

```bash
# Factory and reference implementation addresses
FACTORY_ADDRESS=0x...
REFERENCE_DIAMOND=0x...

# Facet addresses for the diamond contract
DIAMOND_CUT_FACET=0x...
ISSUER_FACET=0x...
STAKEHOLDER_FACET=0x...
STOCK_CLASS_FACET=0x...
# ... other facets
```

These addresses are used when creating contract instances in `src/chain-operations/getContractInstances.js`.

### API Server Configuration

Server settings for the Express application:

```bash
# Server port
PORT=8293

# Optional Sentry error reporting
SENTRY_DSN=your_sentry_dsn
```

## Deployment Configurations

The system supports different deployment environments through the `deploy_factory.sh` script:

```bash
# Deploy to local environment
yarn deploy:local

# Deploy to testnet
yarn deploy:testnet

# Deploy to mainnet
yarn deploy:mainnet
```

Each deployment command loads the appropriate environment file:
- `deploy:local` uses `.env.local`
- `deploy:testnet` uses `.env.dev`
- `deploy:mainnet` uses `.env.prod`

The deployment script includes confirmation prompts and address verification for non-local environments to prevent accidental deployments.

## Configuration Management

### Adding New Configuration

When adding new configuration values:

1. Add the variable to all environment files (`.env.local`, `.env.dev`, `.env.prod`)
2. Access the variable in code via `process.env.YOUR_VARIABLE`
3. For sensitive values (like private keys), ensure they are not committed to source control

### Development vs. Production

Key differences between environments:

1. **Local (.env.local)**
   - Uses Anvil local blockchain (chain ID 31337)
   - MongoDB running in local Docker container
   - Default ports and simple configuration

2. **Development (.env.dev)**
   - Uses testnet (like Base Sepolia)
   - May use different MongoDB instance
   - Contains test accounts and settings

3. **Production (.env.prod)**
   - Uses mainnet (like Base Mainnet)
   - Production MongoDB instance
   - Real account credentials and settings
   - May include additional security measures

## Usage Examples

### Loading Environment Variables

```javascript
import { setupEnv } from "./utils/env.js";

// Load environment variables at application startup
setupEnv();

// Access configuration values
const port = process.env.PORT || 8080;
const databaseUrl = process.env.DATABASE_URL;
```

### Connecting to Blockchain

```javascript
import { ethers } from "ethers";
import { getChainConfig } from "./utils/chains.js";

// Get chain configuration
const chainId = Number(process.env.CHAIN_ID);
const chainConfig = getChainConfig(chainId);

// Create provider
const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);

// Use the provider for contract interactions
// ...
```

### Multi-Chain Provider Management

```javascript
// Import the necessary modules
import { getChainConfig } from "./utils/chains.js";

// Create a map to store providers by chain ID
const providers = new Map();

// Function to get or create provider for a chain
const getChainProvider = (chainId) => {
    if (!providers.has(chainId)) {
        const config = getChainConfig(chainId);
        providers.set(chainId, new ethers.JsonRpcProvider(config.rpcUrl));
    }
    return providers.get(chainId);
};

// Use different providers based on chain ID
const provider1 = getChainProvider("8453");  // Base Mainnet
const provider2 = getChainProvider("84532"); // Base Sepolia
```

### Setting Up Event Listeners

```javascript
import { startListener } from "./utils/websocket.ts";

// On server startup, set up listeners for all contracts
app.listen(PORT, async () => {
    console.log(`Server successfully launched at:${PORT}`);
    
    // Get all contracts that need to be monitored
    const contractsToWatch = issuers
        .filter(issuer => issuer?.deployed_to && issuer?.chain_id)
        .map(issuer => ({
            id: issuer.id,
            address: issuer.deployed_to,
            chain_id: issuer.chain_id
        }));
    
    // Start the websocket listeners, grouped by chain
    await startListener(contractsToWatch);
});
```

### Managing Contract Addresses

```javascript
// Get contract address from environment
const factoryAddress = process.env.FACTORY_ADDRESS;
const diamondAddress = process.env.REFERENCE_DIAMOND;

// Use addresses to create contract instances
// ...
```

## Best Practices

1. **Never commit sensitive data**: Private keys, API keys, and other secrets should never be committed to source control
2. **Use environment-specific configurations**: Different settings for local, development, and production environments
3. **Validate configuration**: Ensure required configuration is present before starting the application
4. **Use descriptive names**: Configuration variables should have clear, descriptive names
5. **Document changes**: Update this document when making changes to the configuration system
6. **Group chain-specific configuration**: Keep all configuration for a specific chain together
7. **Implement connection pooling**: For production, use connection pooling for blockchain providers
8. **Cache contract instances**: Use the contract caching middleware to improve performance
9. **Monitor event listener health**: Implement health checks for websocket connections




