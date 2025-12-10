# Deployment Guide

This guide covers deployment procedures for the Open Cap Table Protocol (OCP) across different environments.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Local Deployment](#local-deployment)
- [Testnet Deployment](#testnet-deployment)
- [Production Deployment](#production-deployment)
- [Post-Deployment](#post-deployment)
- [Verification](#verification)
- [Rollback Procedures](#rollback-procedures)

## Overview

OCP can be deployed to three environments:

- **Local** - Development environment using Anvil
- **Testnet** - Staging environment (e.g., Base Sepolia)
- **Production** - Mainnet environment (e.g., Base Mainnet)

Each environment requires:
1. Smart contract deployment
2. Environment configuration
3. Database setup
4. API server deployment

## Prerequisites

### Required Tools

- Foundry (Forge, Anvil, Cast)
- Node.js and Yarn
- Docker and Docker Compose
- Access to blockchain RPC endpoints
- Private key with sufficient funds for gas

### Environment Files

Ensure you have the appropriate environment file:

- `.env.local` - Local development
- `.env.dev` - Testnet deployment
- `.env.prod` - Production deployment

### Required Environment Variables

```bash
# Blockchain Configuration
RPC_URL=<rpc_endpoint>
CHAIN_ID=<chain_id>
PRIVATE_KEY=<deployer_private_key>

# Contract Verification (optional)
ETHERSCAN_L2_API_KEY=<api_key>
ETHERSCAN_L1_API_KEY=<api_key>

# Database
DATABASE_URL=<mongodb_connection_string>

# Server
PORT=8293
```

## Local Deployment

### Step 1: Start Local Blockchain

```bash
# Terminal 1: Start Anvil
anvil
```

Anvil will output:
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Private keys for testing

### Step 2: Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Update `.env.local`:

```bash
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
PRIVATE_KEY=<one_of_anvil_private_keys>
DATABASE_URL=mongodb://ocp:ocp@localhost:27017/mongo?authSource=admin&retryWrites=true&w=majority
PORT=8293
```

### Step 3: Deploy Contracts

```bash
yarn deploy:local
```

The script will:
1. Check if contracts already exist
2. Deploy factory contract
3. Deploy reference diamond and all facets
4. Output contract addresses

### Step 4: Update Environment File

Copy the contract addresses from the deployment output to `.env.local`:

```bash
FACTORY_ADDRESS=0x...
REFERENCE_DIAMOND=0x...
DIAMOND_CUT_FACET=0x...
ISSUER_FACET=0x...
STAKEHOLDER_FACET=0x...
STOCK_CLASS_FACET=0x...
STOCK_FACET=0x...
CONVERTIBLES_FACET=0x...
EQUITY_COMPENSATION_FACET=0x...
STOCK_PLAN_FACET=0x...
WARRANT_FACET=0x...
STAKEHOLDER_NFT_FACET=0x...
```

### Step 5: Start Services

**Terminal 2: MongoDB**
```bash
docker compose up
```

**Terminal 3: API Server**
```bash
yarn local
# or
USE_ENV_FILE=.env.local yarn dev
```

### Step 6: Verify Deployment

```bash
# Check API health
curl http://localhost:8293/health

# Should return: OK
```

## Testnet Deployment

### Step 1: Prepare Environment

1. **Get testnet RPC URL:**
   - Base Sepolia: Use public RPC or get from [Base](https://docs.base.org/tools/network-faucets)
   - Or use services like Alchemy, Infura

2. **Get testnet tokens:**
   - Use faucets to get testnet ETH for gas
   - Base Sepolia: [Base Sepolia Faucet](https://docs.base.org/tools/network-faucets)

3. **Configure `.env.dev`:**
   ```bash
   RPC_URL=https://sepolia.base.org
   CHAIN_ID=84532
   PRIVATE_KEY=<your_testnet_private_key>
   DATABASE_URL=<testnet_mongodb_url>
   ETHERSCAN_L2_API_KEY=<base_etherscan_api_key>
   ```

### Step 2: Deploy Contracts

```bash
yarn deploy:testnet
```

The script will:
1. Prompt for confirmation (non-local environments)
2. Deploy contracts to testnet
3. Output contract addresses and transaction hashes

**Important:** Save all contract addresses and transaction hashes for verification.

### Step 3: Verify Contracts (Optional)

```bash
yarn verify:prod --env=dev
```

This verifies contracts on Etherscan/BaseScan for transparency.

### Step 4: Update Environment

Update `.env.dev` with deployed contract addresses.

### Step 5: Deploy API Server

Deploy to your testnet server:

```bash
# On server
USE_ENV_FILE=.env.dev yarn start
```

Or use your deployment method (Docker, Kubernetes, etc.).

### Step 6: Sync Blockchain Events

Start the event listener to sync historical events:

```bash
yarn sync:testnet
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Environment variables configured
- [ ] Private key secured (use key management service)
- [ ] Sufficient funds for gas
- [ ] Backup of current deployment
- [ ] Rollback plan prepared

### Step 1: Final Verification

```bash
# Run all checks
yarn flightcheck
yarn typecheck
yarn test:chain
yarn test:js
```

### Step 2: Prepare Production Environment

1. **Secure private key:**
   - Use environment variable injection
   - Or key management service (AWS Secrets Manager, etc.)
   - Never commit private keys

2. **Configure `.env.prod`:**
   ```bash
   RPC_URL=https://mainnet.base.org
   CHAIN_ID=8453
   PRIVATE_KEY=<secure_production_key>
   DATABASE_URL=<production_mongodb_url>
   ETHERSCAN_L2_API_KEY=<production_api_key>
   SENTRY_DSN=<sentry_dsn_for_error_tracking>
   ```

### Step 3: Deploy Contracts

```bash
yarn deploy:mainnet
```

**Critical:** The script will prompt for confirmation. Verify:
- Correct network
- Correct private key
- Sufficient gas funds
- All addresses are correct

### Step 4: Verify Contracts

```bash
yarn verify:prod --env=prod
```

Verification is important for:
- Transparency
- Contract interaction tools
- Security audits

### Step 5: Update Production Environment

Update production environment variables with contract addresses.

### Step 6: Deploy API Server

Deploy using your production deployment method:

**Docker:**
```bash
docker build -t ocp-api .
docker run -d --env-file .env.prod -p 8293:8293 ocp-api
```

**Kubernetes:**
```bash
kubectl apply -f deploy.prod.yaml
```

**Other:** Follow your organization's deployment procedures.

### Step 7: Sync Historical Events

```bash
yarn sync:mainnet
```

This syncs all historical blockchain events to the database.

### Step 8: Monitor Deployment

- Check API health endpoints
- Monitor error logs (Sentry)
- Verify WebSocket connections
- Check database sync status

## Post-Deployment

### Health Checks

```bash
# API health
curl https://api.ocp.fairmint.co/health

# Database connection
# Check MongoDB connection in logs

# Blockchain connection
# Check RPC connection in logs
```

### Event Listener Status

Verify WebSocket listeners are running:
- Check application logs for "WebSocket connected" messages
- Monitor for event processing logs
- Verify events are being written to database

### Database Verification

```bash
# Connect to MongoDB
mongosh <connection_string>

# Check collections
show collections

# Verify issuer data
db.issuers.find().count()
```

### API Testing

Test key endpoints:

```bash
# Health check
curl https://api.ocp.fairmint.co/health

# Create issuer (test)
curl -X POST https://api.ocp.fairmint.co/issuer \
  -H "Content-Type: application/json" \
  -d '{"chain_id": 8453, ...}'
```

## Verification

### Contract Verification

Verify contracts are deployed correctly:

```bash
# Using Cast
cast code <CONTRACT_ADDRESS> --rpc-url <RPC_URL>

# Should return bytecode (not 0x)
```

### Address Verification

Verify all contract addresses:

1. Check factory can create new cap tables
2. Verify diamond proxy points to correct facets
3. Test key functions on deployed contracts

### Database Verification

1. Check MongoDB collections exist
2. Verify indexes are created
3. Test read/write operations

### API Verification

1. Test all endpoints
2. Verify CORS settings
3. Check authentication (if applicable)
4. Test error handling

## Rollback Procedures

### Smart Contract Rollback

**Note:** Smart contracts are immutable once deployed. Rollback means:
1. Deploying new contracts
2. Updating environment variables
3. Migrating data if necessary

### API Server Rollback

**Docker:**
```bash
# Rollback to previous image
docker pull ocp-api:<previous-tag>
docker stop ocp-api
docker run -d --env-file .env.prod -p 8293:8293 ocp-api:<previous-tag>
```

**Kubernetes:**
```bash
kubectl rollout undo deployment/ocp-api
```

**Other:** Follow your deployment system's rollback procedures.

### Database Rollback

1. Restore from backup
2. Re-sync blockchain events if needed
3. Verify data integrity

### Emergency Procedures

If critical issues occur:

1. **Stop API server** to prevent further issues
2. **Assess impact** - what's affected?
3. **Check logs** for error details
4. **Rollback** if necessary
5. **Document** the issue and resolution

## Deployment Scripts

### Available Scripts

```bash
# Local deployment
yarn deploy:local

# Testnet deployment
yarn deploy:testnet

# Mainnet deployment
yarn deploy:mainnet

# Contract verification
yarn verify:prod --env=<env>

# Sync blockchain events
yarn sync:local
yarn sync:testnet
yarn sync:mainnet
```

### Custom Deployment

For custom deployments, use the deployment script directly:

```bash
./scripts/deploy_factory.sh --env=<environment>
```

## Best Practices

1. **Always test locally first** before deploying to testnet/production
2. **Use separate private keys** for each environment
3. **Verify contracts** on block explorers
4. **Monitor deployments** closely
5. **Keep backups** of environment files and contract addresses
6. **Document changes** in deployment logs
7. **Use CI/CD** for automated deployments when possible
8. **Implement health checks** and monitoring
9. **Have rollback plans** ready
10. **Secure private keys** using key management services

## Troubleshooting

### Deployment Fails

- Check RPC connection
- Verify private key has sufficient funds
- Check contract compilation errors
- Review deployment script logs

### Contracts Not Verifying

- Ensure Etherscan API key is correct
- Check contract bytecode matches source
- Verify constructor arguments
- Wait for block confirmations

### API Server Won't Start

- Check environment variables
- Verify database connection
- Check port availability
- Review application logs

### Events Not Syncing

- Verify WebSocket RPC URL
- Check event filter configuration
- Review listener logs
- Ensure contracts are deployed

## Additional Resources

- [Configuration Guide](./CONFIG.md) - Environment configuration details
- [Developer Guide](./DEVELOPER_GUIDE.md) - Development setup
- [Foundry Documentation](https://book.getfoundry.sh/) - Smart contract deployment
- [Base Documentation](https://docs.base.org/) - Base network information
