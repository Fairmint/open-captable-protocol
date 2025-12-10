# Testing Guide

This guide covers testing practices, test structure, and how to write and run tests for the Open Cap Table Protocol (OCP).

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Smart Contract Testing](#smart-contract-testing)
- [API Testing](#api-testing)
- [Integration Testing](#integration-testing)
- [Writing Tests](#writing-tests)
- [Test Utilities](#test-utilities)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

OCP uses two testing frameworks:

- **Foundry (Forge)** - For smart contract testing
- **Jest** - For API and integration testing

Tests are organized by type:
- **Unit Tests** - Test individual functions/contracts in isolation
- **Integration Tests** - Test interactions between components
- **End-to-End Tests** - Test complete workflows

## Test Structure

### Smart Contract Tests

Location: `chain/test/`

```
chain/test/
├── TestBase.sol              # Base test contract with common setup
├── StockIssuance.t.sol       # Stock issuance tests
├── StockTransfer.t.sol       # Stock transfer tests
├── StakeholderPositions.t.sol
├── AccessControl.t.sol
└── mocks/                    # Mock contracts for testing
```

### API Tests

Location: `src/tests/`

```
src/tests/
├── errorHandling.test.js     # Error handling tests
├── transactionHash.test.js   # Transaction hash tests
└── integration/              # Integration tests
    └── utils.ts             # Test utilities
```

## Running Tests

### Smart Contract Tests

**Run all contract tests:**
```bash
yarn test:chain
# or
cd chain && forge test
```

**Run specific test file:**
```bash
cd chain
forge test --match-path test/StockIssuance.t.sol
```

**Run with verbosity:**
```bash
forge test -vvv  # Very verbose output
```

**Run specific test function:**
```bash
forge test --match-test testIssueStock
```

**Run with gas reporting:**
```bash
forge test --gas-report
```

**Run with coverage:**
```bash
forge coverage
```

### API Tests

**Run all JavaScript tests:**
```bash
yarn test:js
```

**Run integration tests:**
```bash
yarn test-js-integration
```

**Run specific test file:**
```bash
yarn jest src/tests/errorHandling.test.js
```

**Run in watch mode:**
```bash
yarn jest --watch
```

**Run with coverage:**
```bash
yarn jest --coverage
```

### Running Tests in CI/CD

Tests should pass before merging PRs. The CI pipeline runs:

```bash
yarn flightcheck  # Lint and format checks
yarn typecheck    # TypeScript type checking
yarn test:chain   # Smart contract tests
yarn test:js      # API tests
```

## Smart Contract Testing

### Test Setup

Smart contract tests extend `DiamondTestBase` which provides:

- Deployed factory and cap table contracts
- Helper functions for creating stakeholders, stock classes, etc.
- Common test fixtures

Example:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { IStockFacet } from "@interfaces/IStockFacet.sol";

contract MyTest is DiamondTestBase {
    function testMyFeature() public {
        // Test code here
    }
}
```

### Writing Contract Tests

**Basic Test Structure:**

```solidity
function testFeatureName() public {
    // Arrange - Set up test data
    bytes16 stakeholderId = createStakeholder();
    bytes16 stockClassId = createStockClass(0x123...);
    
    // Act - Execute the function
    IStockFacet(address(capTable)).issueStock(params);
    
    // Assert - Verify results
    assertEq(quantity, expectedQuantity);
}
```

**Testing Reverts:**

```solidity
function test_RevertInvalidInput() public {
    bytes16 invalidId = 0x00000000000000000000000000000000;
    
    vm.expectRevert(
        abi.encodeWithSignature("NoStakeholder(bytes16)", invalidId)
    );
    
    IStockFacet(address(capTable)).issueStock(params);
}
```

**Testing Events:**

```solidity
function testEmitsEvent() public {
    vm.expectEmit(true, true, false, true, address(capTable));
    emit StockIssued(stakeholderId, stockClassId, quantity, price);
    
    IStockFacet(address(capTable)).issueStock(params);
}
```

**Using Forge's Cheatcodes:**

```solidity
// Set block timestamp
vm.warp(block.timestamp + 1 days);

// Set block number
vm.roll(block.number + 100);

// Impersonate an address
vm.prank(userAddress);
contract.function();

// Deal tokens/ETH
vm.deal(address(this), 100 ether);

// Expect a call
vm.expectCall(address(target), abi.encodeWithSelector(...));
```

### Test Helpers

The `DiamondTestBase` contract provides helper functions:

```solidity
// Create a stakeholder
bytes16 stakeholderId = createStakeholder();

// Create a stock class
bytes16 stockClassId = createStockClass(0x123..., 100000);

// Create a stock plan
bytes16 stockPlanId = createStockPlan(stockClassIds);
```

## API Testing

### Test Setup

API tests use Jest and require:

- MongoDB connection (test database)
- Local blockchain (Anvil) running
- Contract deployment

Example setup:

```javascript
import { describe, test, beforeAll, afterAll, expect } from "@jest/globals";
import { connectDB } from "../db/config/mongoose";
import { deseedDatabase } from "../tests/integration/utils";

describe("Feature Tests", () => {
    beforeAll(async () => {
        // Connect to test database
        await connectDB();
        
        // Deploy contracts
        // Set up test data
    });
    
    afterAll(async () => {
        // Clean up
        await deseedDatabase();
        await disconnectDB();
    });
    
    test("should do something", async () => {
        // Test code
    });
});
```

### Writing API Tests

**Basic Test:**

```javascript
test("should create issuer", async () => {
    const response = await request(app)
        .post("/issuer")
        .send({
            chain_id: 31337,
            legal_name: "Test Company",
            // ... other fields
        });
    
    expect(response.status).toBe(200);
    expect(response.body.id).toBeDefined();
});
```

**Testing Error Cases:**

```javascript
test("should return 400 for invalid input", async () => {
    const response = await request(app)
        .post("/issuer")
        .send({
            // Missing required fields
        });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
});
```

**Testing Database Operations:**

```javascript
test("should save to database", async () => {
    const issuer = await createIssuer(issuerData);
    
    const found = await Issuer.findById(issuer.id);
    expect(found).toBeDefined();
    expect(found.legal_name).toBe("Test Company");
});
```

**Testing Contract Interactions:**

```javascript
test("should deploy contract", async () => {
    const { contract, address } = await deployCapTable(
        issuerIdBytes16,
        initialShares,
        chainId
    );
    
    expect(contract).toBeDefined();
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
});
```

### Test Utilities

**Database Utilities:**

```javascript
import { deseedDatabase, deleteIssuerData } from "./integration/utils";

// Clear entire database
await deseedDatabase();

// Delete specific issuer data
await deleteIssuerData(issuerId);
```

**Contract Utilities:**

```javascript
import { deployCapTable } from "../chain-operations/deployCapTable";
import { convertUUIDToBytes16 } from "../utils/convertUUID";
import { toScaledBigNumber } from "../utils/convertToFixedPointDecimals";

// Deploy a cap table
const { contract, address } = await deployCapTable(
    convertUUIDToBytes16(issuerId),
    "1000000",
    "31337"
);

// Convert values for contract calls
const quantity = toScaledBigNumber("1000");
```

**Error Decoding:**

```javascript
import { decodeError } from "../utils/errorDecoder";

try {
    await contract.issueStock(params);
} catch (error) {
    const decoded = decodeError(error);
    expect(decoded.name).toBe("NoStakeholder");
}
```

## Integration Testing

Integration tests verify interactions between:

- API endpoints and database
- API endpoints and smart contracts
- Database and blockchain events
- Complete workflows

### Example Integration Test

```javascript
describe("Stock Issuance Integration", () => {
    let contract;
    let issuerId;
    let stockClassId;
    let stakeholderId;
    
    beforeAll(async () => {
        // Set up complete environment
        issuerId = await createIssuer();
        contract = await deployCapTable(issuerId);
        stockClassId = await createStockClass(contract);
        stakeholderId = await createStakeholder(contract);
    });
    
    test("should issue stock end-to-end", async () => {
        // 1. Create issuance via API
        const response = await request(app)
            .post("/transactions/issuance")
            .send({
                issuerId,
                stockClassId,
                stakeholderId,
                quantity: "1000",
                // ...
            });
        
        expect(response.status).toBe(200);
        
        // 2. Verify on-chain
        const position = await contract.getPosition(
            stakeholderId,
            stockClassId
        );
        expect(position.quantity).toBe(toScaledBigNumber("1000"));
        
        // 3. Verify in database
        const transaction = await Issuance.findById(response.body.id);
        expect(transaction).toBeDefined();
        expect(transaction.quantity).toBe("1000");
    });
});
```

## Writing Tests

### Test Naming Conventions

**Smart Contracts:**
- `testFeatureName()` - Happy path tests
- `test_RevertReason()` - Revert tests
- `testFuzz_FeatureName()` - Fuzz tests

**API Tests:**
- `should do something` - Descriptive test names
- Use `describe` blocks to group related tests

### Test Organization

1. **Arrange** - Set up test data and environment
2. **Act** - Execute the code being tested
3. **Assert** - Verify the results

### Test Isolation

- Each test should be independent
- Clean up after tests (use `afterEach` or `afterAll`)
- Don't rely on test execution order
- Use unique IDs for test data

### Mocking

**Mocking External Services:**

```javascript
jest.mock("../utils/externalService", () => ({
    callExternalAPI: jest.fn().mockResolvedValue({ data: "test" })
}));
```

**Mocking Contract Calls:**

```javascript
const mockContract = {
    issueStock: jest.fn().mockResolvedValue({ hash: "0x..." })
};
```

## Test Utilities

### UUID Conversion

```javascript
import { convertUUIDToBytes16 } from "../utils/convertUUID";

const bytes16 = convertUUIDToBytes16(uuid);
```

### Fixed-Point Decimals

```javascript
import { toScaledBigNumber } from "../utils/convertToFixedPointDecimals";

const scaled = toScaledBigNumber("1000.50"); // Returns BigNumber
```

### Error Decoding

```javascript
import { decodeError } from "../utils/errorDecoder";

try {
    await contract.call();
} catch (error) {
    const decoded = decodeError(error);
    console.log(decoded.name, decoded.args);
}
```

### Waiting for Transactions

```javascript
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Wait for transaction to be mined
await wait(5000);
```

## Best Practices

### 1. Test Coverage

- Aim for high coverage of critical paths
- Test both happy paths and error cases
- Test edge cases and boundary conditions

### 2. Test Speed

- Keep tests fast (use mocks where appropriate)
- Run tests in parallel when possible
- Use separate test databases

### 3. Test Data

- Use factories or fixtures for test data
- Clean up test data after tests
- Use unique identifiers to avoid conflicts

### 4. Assertions

- Use descriptive assertion messages
- Test one thing per test
- Verify both positive and negative cases

### 5. Test Maintenance

- Keep tests up to date with code changes
- Refactor tests when refactoring code
- Remove obsolete tests

### 6. Documentation

- Add comments for complex test logic
- Document test setup requirements
- Explain test scenarios

## Troubleshooting

### Common Issues

**Tests Failing Intermittently:**

- Check for race conditions
- Ensure proper cleanup between tests
- Verify test isolation

**Contract Tests Failing:**

- Check Anvil is running (for integration tests)
- Verify contract addresses in test setup
- Check gas limits

**API Tests Failing:**

- Verify MongoDB is running
- Check database connection string
- Ensure test database is clean

**Timeout Errors:**

- Increase test timeout:
  ```javascript
  jest.setTimeout(30000); // 30 seconds
  ```
- Check for hanging promises
- Verify async/await usage

**Type Errors in Tests:**

- Run `yarn typecheck` to see all errors
- Ensure test files are included in `tsconfig.json`
- Check import paths

### Debugging Tests

**Smart Contract Tests:**

```bash
# Run with verbose output
forge test -vvv

# Run specific test
forge test --match-test testName -vvv

# Use console.log in tests
console.log("Value:", value);
```

**API Tests:**

```bash
# Run with verbose output
yarn jest --verbose

# Run specific test
yarn jest testName --verbose

# Use debugger
node --inspect-brk node_modules/.bin/jest --runInBand testName
```

**Debugging Database Issues:**

```javascript
// Log database operations
console.log("Issuer:", await Issuer.findById(id));

// Check connection
console.log("DB State:", mongoose.connection.readyState);
```

## Additional Resources

- [Foundry Testing Documentation](https://book.getfoundry.sh/forge/tests)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Developer Guide](./DEVELOPER_GUIDE.md) - Development setup
- [Architecture Documentation](./ARCHITECTURE.md) - System architecture
