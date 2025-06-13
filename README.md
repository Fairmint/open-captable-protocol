<div align="center">
  <a href="https://github.com/victormimo/open-captable-protocol/blob/main/LICENSE">
    <img alt="License" src="https://img.shields.io/github/license/victormimo/open-captable-protocol">
  </a>
</div>

# Open Cap Table Protocol (OCP)

The Open Cap Table Protocol (OCP) is a comprehensive solution for managing capitalization tables on the blockchain. It implements the [Open Cap Table Coalition](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF) standard (OCF), providing a secure, transparent, and standardized way to manage equity ownership and transactions across multiple EVM-compatible chains.

## Repository Organization

- **`src/`** → Server files (routes, MongoDB models, utils, etc.)
- **`chain/`** → Smart contracts (Diamond pattern with facets)

## Architecture Overview

OCP consists of two main components:

1. **Smart Contract Layer (Chain)**
   - Solidity contracts built with Foundry
   - On-chain representation of cap table data using Diamond pattern
   - Secure transaction processing for equity movements
   - Support for multiple EVM-compatible blockchain networks

2. **API Server (Web)**
   - Express.js-based REST API
   - MongoDB database for off-chain data storage
   - WebSocket-based event listeners for blockchain events
   - OCF standard validation and processing

## Key Features

- **Full OCF Standard Implementation**: Compliant with the Open Cap Table Coalition format
- **Blockchain Agnostic**: Support for multiple EVM-compatible networks
- **Comprehensive Data Model**: Complete representation of cap table entities
- **Real-time Event Monitoring**: WebSocket integration for blockchain events
- **Data Validation**: Schema validation against the OCF standard
- **Import/Export Capabilities**: Support for standard file formats

## Prerequisites

- [Node.js](https://nodejs.org/) (version as specified in package.json)
- [Yarn](https://yarnpkg.com/)
- [Forge](https://book.getfoundry.sh/) (Foundry's smart contract development tool)
- [Anvil](https://book.getfoundry.sh/) (Foundry's local Ethereum node)
- MongoDB (via Docker)

## Setup & Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/Fairmint/open-captable-protocol.git
   cd open-captable-protocol
   ```

2. Copy environment template and configure:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. Install dependencies:
   ```bash
   yarn install
   ```

4. Start services (in separate terminals):

   - **Terminal 1:** Start Anvil (local blockchain)
     ```bash
     anvil
     ```
     - Take one of the output's "Private Keys" and set your `.env.local` file's `PRIVATE_KEY`

   - **Terminal 2:** Deploy contracts
     ```bash
     yarn deploy:local
     ```
     - Set your `.env.local` file's variables using output of deploy script:
     ```
     DIAMOND_CUT_FACET=
     ISSUER_FACET=
     STAKEHOLDER_FACET=
     STOCK_CLASS_FACET=
     STOCK_FACET=
     CONVERTIBLES_FACET=
     EQUITY_COMPENSATION_FACET=
     STOCK_PLAN_FACET=
     WARRANT_FACET=
     STAKEHOLDER_NFT_FACET=
     ```

   - **Terminal 3:** Run the MongoDB instance
     ```bash
     docker compose up
     ```

   - **Terminal 4:** Run the backend server
     ```bash
     yarn dev
     ```

## MongoDB Access

Connect to MongoDB using MongoDB Compass with the following connection string:

```
mongodb://ocp:ocp@localhost:27017/mongo?authSource=admin&retryWrites=true&w=majority
```

## Multi-Chain Support

This repository supports deploying cap tables to different EVM chains.

- Check `/src/utils/chains.js` and configure the required chain keys
- When making API requests:
  - **Issuer creation** → Pass `chainId` in the request body
  - **Other transactions** (e.g., creating stakeholders, issuing stock) → Pass `issuerId` in the request body
- See `/src/routes` for implementation details

## Usage

1. Create an **issuer** first
2. Add **stakeholders**, stock classes, and other relevant data
3. For quick testing, use the example script:
   ```bash
   node src/examples/testTransfer.mjs
   ```

## Resetting Local Testing

If you are frequently testing locally, reset the database before redeploying:

```bash
yarn deseed
```

## Deployment

Use the appropriate command to deploy contracts:

- **Local:**
  ```bash
  # Clear envvars in .env.local if they exist from a previous deployment
  yarn deploy:local
  ```
- **Testnet:**
  ```bash
  yarn deploy:testnet
  ```
- **Mainnet:**
  ```bash
  yarn deploy:mainnet
  ```

## Contributing

We welcome all contributions. Please read our [CONTRIBUTING](./CONTRIBUTING.md) guidelines to understand the process.


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
