# Developer Guide

This guide provides comprehensive information for developers working on the Open Cap Table Protocol (OCP) repository.

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Architecture Overview](#architecture-overview)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Standards](#code-standards)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version as specified in `package.json`)
- **Yarn** package manager
- **Foundry** (Forge, Anvil, Cast) - [Installation Guide](https://book.getfoundry.sh/getting-started/installation)
- **Docker** and **Docker Compose** (for MongoDB)
- **Git**

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Fairmint/open-captable-protocol.git
   cd open-captable-protocol
   ```

2. **Set up the smart contract dependencies:**
   ```bash
   ./setup.sh
   ```

3. **Install Node.js dependencies:**
   ```bash
   yarn install
   ```

4. **Configure environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

5. **Start local development:**
   - Terminal 1: Start Anvil (local blockchain)
     ```bash
     anvil
     ```
   - Terminal 2: Deploy contracts
     ```bash
     yarn deploy:local
     ```
   - Terminal 3: Start MongoDB
     ```bash
     docker compose up
     ```
   - Terminal 4: Start the server
     ```bash
     yarn dev
     ```

## Project Structure

```
open-captable-protocol/
├── chain/                    # Smart contracts (Solidity)
│   ├── src/
│   │   ├── facets/          # Facet contracts
│   │   ├── libraries/       # Shared libraries
│   │   ├── core/            # Core contracts
│   │   └── interfaces/      # Contract interfaces
│   └── script/              # Deployment scripts
├── src/                      # Server code (Node.js/TypeScript)
│   ├── app.js               # Application entry point
│   ├── routes/              # Route handlers
│   ├── controllers/         # Business logic controllers
│   ├── db/                  # MongoDB models and operations
│   ├── chain-operations/    # Blockchain interaction utilities
│   ├── utils/               # Utility functions
│   ├── tests/               # Test files
│   └── examples/            # Example scripts
├── docs/                     # Documentation
│   ├── DATA_MODEL.md        # Data model documentation
│   └── openapi.yaml         # OpenAPI specification
├── scripts/                  # Deployment and utility scripts
└── .github/                  # GitHub workflows and templates
```

## Development Setup

### Environment Configuration

The project uses environment-specific configuration files:

- `.env.local` - Local development
- `.env.dev` - Development/testnet environment
- `.env.prod` - Production/mainnet environment

Key environment variables:

```bash
# Database
DATABASE_URL="mongodb://ocp:ocp@localhost:27017/mongo?authSource=admin&retryWrites=true&w=majority"
DATABASE_REPLSET="0"
DATABASE_OVERRIDE=""  # Optional database name override

# Blockchain
RPC_URL="http://127.0.0.1:8545"
CHAIN_ID=31337  # 31337 for Anvil, 84532 for Base Sepolia, 8453 for Base Mainnet
PRIVATE_KEY="your_private_key_here"

# Server
PORT=8293

# Contract Addresses (set after deployment)
FACTORY_ADDRESS=
ISSUER_FACET=
# ... other facet addresses
```

See [CONFIG.md](./CONFIG.md) for detailed configuration information.

### Smart Contract Setup

1. **Install Foundry dependencies:**
   ```bash
   cd chain
   forge install
   ```

2. **Build contracts:**
   ```bash
   forge build
   ```

3. **Run tests:**
   ```bash
   forge test
   ```

4. **Format code:**
   ```bash
   forge fmt
   ```

### Database Setup

MongoDB runs in Docker. To start:

```bash
docker compose up -d
```

Connect using MongoDB Compass:
```
mongodb://ocp:ocp@localhost:27017/mongo?authSource=admin&retryWrites=true&w=majority
```

### Local Blockchain Setup

1. **Start Anvil:**
   ```bash
   anvil
   ```

2. **Copy a private key from Anvil output** and set it in `.env.local`:
   ```bash
   PRIVATE_KEY=<private_key_from_anvil>
   ```

3. **Deploy contracts:**
   ```bash
   yarn deploy:local
   ```

4. **Update `.env.local`** with the deployed contract addresses from the output.

## Architecture Overview

See [ARCHITECTURE.md](./ARCHITECTURE.md) for architecture details.

## Development Workflow

### Branch Strategy

- **`main`** - Production-ready code
- **`dev`** - Development branch (default for PRs)
- **Feature branches** - Created from `dev` for new features

**Important:** Never commit directly to `main` or `dev`. Always create a feature branch.

### Creating a Feature Branch

```bash
# Ensure you're on dev and up to date
git checkout dev
git pull origin dev

# Create and checkout new branch
git checkout -b feature/your-feature-name

# Make your changes and commit
git add .
git commit -m "feat(scope): description of changes"
```

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Example:
```
feat(stakeholder): add support for stakeholder transfers
```

### Pull Request Process

1. **Create PR** from your feature branch to `dev`
2. **PR Title** should follow Conventional Commits format:
   ```
   feat(ocf-validation): creates OCF validation helper for routes
   ```
3. **Ensure tests pass** and code is formatted
4. **Request review** from team members
5. **Address feedback** and update PR
6. **Merge** after approval

### Code Quality Checks

Before committing, run:

```bash
# Type checking
yarn typecheck

# Linting
yarn lint:check

# Format checking
yarn format:check

# All checks
yarn flightcheck
```

Auto-fix issues:

```bash
# Fix linting issues
yarn lint

# Fix formatting
yarn format
```

## Testing

### Running Tests

**Smart Contract Tests:**
```bash
yarn test:chain
# or
cd chain && forge test
```

**JavaScript/TypeScript Tests:**
```bash
yarn test:js
```

**Integration Tests:**
```bash
yarn test-js-integration
```

### Writing Tests

**Smart Contract Tests:**
- Located in `chain/test/`
- Use Foundry's testing framework
- Example:
  ```solidity
  function testExample() public {
      // Test code
  }
  ```

**Server Tests:**
- Located in `src/tests/`
- Use Jest testing framework
- Example:
  ```javascript
  describe('Feature', () => {
      it('should do something', async () => {
          // Test code
      });
  });
  ```

See [TESTING.md](./TESTING.md) for detailed testing guidelines.

## Code Standards

### TypeScript/JavaScript

- **Type Safety**: Avoid `any` and `unknown`. Use precise, explicit types.
- **Formatting**: Use Prettier (configured in `.prettierrc`)
- **Linting**: Follow ESLint rules (configured in `eslint.config.js`)
- **Imports**: Use ES6 import/export syntax
- **Error Handling**: Use try/catch blocks and proper error messages

### Solidity

- **Formatting**: Use `forge fmt`
- **Linting**: Follow Solhint rules (configured in `.solhintrc`)
- **Naming**: Use camelCase for variables, PascalCase for contracts
- **Documentation**: Add NatSpec comments for public functions

### File Organization

- Group related functionality together
- Keep files focused and single-purpose
- Use descriptive file and function names
- Add comments for complex logic

## Common Tasks

### Adding a New Route

1. **Create route handler** in `src/routes/`
2. **Create controller** in `src/controllers/`
3. **Add route** to `src/app.js`
4. **Update OpenAPI spec** in `docs/openapi.yaml` if applicable
5. **Add tests** in `src/tests/`

### Adding a New Smart Contract

1. **Create contract** in appropriate directory (`chain/src/core/`, `chain/src/facets/`, etc.)
2. **Define storage** if needed in `chain/src/core/Storage.sol`
3. **Add deployment script** in `chain/script/` if needed
4. **Update factory** if needed
5. **Add tests** in `chain/test/`

### Adding Support for a New Chain

1. **Add chain config** in `src/utils/chains.js`:
   ```javascript
   12345: {
       name: "New Chain",
       rpcUrl: process.env.NEW_CHAIN_RPC_URL,
       wsUrl: (process.env.NEW_CHAIN_RPC_URL || "").replace("https://", "wss://"),
   }
   ```
2. **Add RPC URL** to environment files
3. **Deploy contracts** to the new chain
4. **Update documentation**

### Resetting Local Environment

To reset your local database:

```bash
yarn deseed
```

This removes all test data from MongoDB.

### Viewing Logs

**API Server:**
- Logs are output to console
- Use `console.log()`, `console.error()` for debugging

**Smart Contracts:**
- Use Foundry's logging:
  ```solidity
  console.log("Value:", value);
  ```

## Troubleshooting

### Common Issues

**"Cannot connect to MongoDB"**
- Ensure Docker is running: `docker compose up`
- Check `DATABASE_URL` in `.env.local`
- Verify MongoDB container is healthy: `docker ps`

**"Contract not found"**
- Ensure contracts are deployed: `yarn deploy:local`
- Check contract addresses in `.env.local`
- Verify Anvil is running and on the correct chain ID

**"Type errors in TypeScript"**
- Run `yarn typecheck` to see all errors
- Ensure types are properly imported
- Check `tsconfig.json` configuration

**"Tests failing"**
- Ensure all services are running (Anvil, MongoDB)
- Check environment variables are set correctly
- Clear test database: `yarn deseed`

**"WebSocket connection issues"**
- Verify RPC URL supports WebSocket connections
- Check `WS_RECONNECT_INTERVAL` and `WS_MAX_RECONNECT_ATTEMPTS` in env
- Review logs for connection errors

### Getting Help

- Check existing documentation in `docs/`
- Review [CONFIG.md](./CONFIG.md) for configuration issues
- Check [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines
- Open an issue on GitHub for bugs or feature requests

## Additional Resources

- [OpenAPI Specification](./docs/openapi.yaml) - API specification
- [Data Model Documentation](./docs/DATA_MODEL.md) - Database schema
- [Configuration Guide](./CONFIG.md) - Environment configuration
- [Foundry Book](https://book.getfoundry.sh/) - Foundry documentation
- [OCF Standard](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF) - Open Cap Table Format specification
