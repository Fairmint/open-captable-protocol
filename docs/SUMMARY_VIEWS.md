# Cap Table Generation Using RxJS

## Overview

The Fairmint cap table system uses Reactive Extensions for JavaScript (RxJS) to process transaction data and generate real-time cap table summaries. This reactive approach allows the system to maintain an accurate, up-to-date view of a company's capital structure by processing transactions in a streaming fashion and deriving the current state.

## Architecture

The cap table generation architecture consists of several key components:

1. **Transaction Data Sources**: Raw transaction data from the database representing stock issuances, cancellations, conversions, etc.
2. **RxJS Streaming Pipeline**: A reactive pipeline that processes transactions in sequence and derives state
3. **State Reducers**: Specialized processors for different transaction types
4. **Component State Management**: Specific state management for dashboard, cap table, and stakeholder views
5. **API Endpoints**: RESTful endpoints exposing the derived state

## Core Components

### 1. RxJS Implementation

The core RxJS implementation resides in `src/rxjs/index.js` and consists of:

- **Stream Creation**: Converting transaction arrays into observable streams
- **Transaction Processing**: Applying reducers to process each transaction type
- **State Aggregation**: Building a complete state representation from transactions
- **Error Handling**: Tracking and reporting validation issues

```javascript
export const captableStats = async ({ issuer, stockClasses, stockPlans, stakeholders, transactions }) => {
    // Creates initial state with all base entities
    const initialState = createInitialState(issuer, stockClasses, stockPlans, stakeholders);
    
    // Create an observable from transaction array
    const source = from(transactions);
    
    // Process transactions through RxJS pipeline
    const result = await lastValueFrom(
        source.pipe(
            // Apply each transaction to the accumulating state
            scan((state, transaction) => 
                processTransaction(state, transaction, stakeholders, stockClasses, stockPlans), 
                initialState
            ),
            // Take the last (final) state after all transactions
            last(),
            // Perform final calculations and derivations
            map(recalculatePercentages)
        )
    );
    
    return result;
};
```

### 2. State Model

The system maintains state in a hierarchical structure:

- **Initial State**: Base state derived from issuer, stock classes, and stock plans
- **Transactional State**: State after applying all transactions
- **Derived State**: Calculated metrics like percentages, totals, and summary statistics

```javascript
const createInitialState = (issuer, stockClasses, stockPlans, stakeholders) => ({
    issuer: {
        id: issuer._id,
        sharesAuthorized: parseInt(issuer.initial_shares_authorized),
        sharesIssued: 0,
    },
    stockClasses: { ... },
    stockPlans: { ... },
    equityCompensation: { exercises: {} },
    // Additional state components
    summary: {
        common: { rows: [] },
        preferred: { rows: [] },
        founderPreferred: null,
        warrantsAndNonPlanAwards: { rows: [] },
        stockPlans: { rows: [] },
        totals: {}
    },
    convertibles: {
        isEmpty: true,
        convertiblesSummary: {},
        totals: {}
    },
    transactions: [],
    errors: new Set()
});
```

### 3. Transaction Processors

The system includes specialized processors for different transaction types, implemented as pure functions:

- **Stock Issuance**: `processStockIssuance` - Handles common/preferred stock issuances
- **Convertible Issuance**: `processConvertibleIssuance` - Processes SAFEs, notes, etc.
- **Equity Compensation**: `processEquityCompensationIssuance` - Manages options and RSUs
- **Stock Cancellations**: `processStockCancellation` - Handles share repurchases and cancellations
- **Authorization Changes**: `processIssuerAdjustment` and `processStockClassAdjustment` - Manages changes to authorized shares

Example processor:

```javascript
const processStockIssuance = (state, transaction, stakeholder, originalStockClass) => {
    const { stock_class_id, quantity } = transaction;
    const numShares = parseInt(quantity);
    
    // Update issuer metrics
    const newIssuer = {
        ...state.issuer,
        sharesIssued: state.issuer.sharesIssued + numShares
    };
    
    // Update stock class metrics
    const newStockClasses = {
        ...state.stockClasses,
        [stock_class_id]: {
            ...state.stockClasses[stock_class_id],
            sharesIssued: state.stockClasses[stock_class_id].sharesIssued + numShares
        }
    };
    
    // Process dashboard-specific state
    const dashboardState = processDashboardStockIssuance(state, transaction, stakeholder);
    
    // Process cap table-specific state
    const captableState = processCaptableStockIssuance(state, transaction, stakeholder, originalStockClass);
    
    return {
        ...state,
        issuer: newIssuer,
        stockClasses: newStockClasses,
        ...dashboardState,
        ...captableState
    };
};
```

## Dashboard and Cap Table Views

The system generates two main types of derived views:

### 1. Dashboard View

The dashboard view provides a high-level summary of the cap table, focusing on:

- Total shares issued and authorized
- Investor distribution by relationship
- Latest valuations and share prices
- Capital raised metrics
- Stakeholder positions

### 2. Cap Table View

The cap table view provides a detailed breakdown of the capital structure:

- Common stock breakdown by class
- Preferred stock breakdown by class and series
- Warrants and non-plan awards
- Stock plans (options, RSUs, etc.)
- Convertible securities (SAFEs, notes)
- Fully-diluted calculations and percentages

```javascript
// Sample cap table state
{
  summary: {
    common: {
      rows: [
        {
          name: "Common Stock",
          sharesAuthorized: 10000000,
          outstandingShares: 5000000,
          fullyDilutedShares: 5000000,
          fullyDilutedPercentage: 50,
          liquidation: 0,
          votingPower: 5000000
        }
      ]
    },
    preferred: {
      rows: [
        {
          name: "Series A Preferred",
          sharesAuthorized: 2000000,
          outstandingShares: 1500000,
          fullyDilutedShares: 1500000,
          fullyDilutedPercentage: 15,
          liquidation: 3000000,
          votingPower: 1500000
        }
      ]
    },
    // Additional sections...
    totals: {
      totalSharesAuthorized: 15000000,
      totalOutstandingShares: 8000000,
      totalFullyDilutedShares: 10000000,
      totalLiquidation: 3500000,
      totalVotingPower: 8000000
    }
  }
}
```

## API Integration

The cap table generation system is exposed through two main API endpoints:

```javascript
// Dashboard stats endpoint
stats.get("/rxjs/dashboard", async (req, res) => {
    const { issuerId } = req.query;
    const issuerData = await getAllStateMachineObjectsById(issuerId);
    const rxjsData = await dashboardStats(issuerData);
    res.status(200).send(rxjsData);
});

// Cap table stats endpoint
stats.get("/rxjs/captable", async (req, res) => {
    const { issuerId } = req.query;
    const issuerData = await getAllStateMachineObjectsById(issuerId);
    const rxjsData = await captableStats(issuerData);
    res.status(200).send(rxjsData);
});
```

## Data Flow

The complete data flow for cap table generation:

1. **Data Retrieval**: Company data is loaded from the database, including all entities and transactions
2. **Initial State Creation**: Base state is constructed from core entities
3. **Transaction Processing**: Each transaction is processed through the RxJS pipeline
4. **State Derivation**: Final calculations are performed (percentages, totals)
5. **Validation**: Consistency checks are performed on the derived state
6. **Response**: The derived state is returned to the client for display

## Key Benefits of the RxJS Approach

1. **Streaming Processing**: Handles large transaction volumes efficiently
2. **Immutable State Updates**: Ensures data consistency during processing
3. **Functional Programming**: Uses pure functions for predictable behavior
4. **Time-Travel Capability**: Can recreate the cap table at any point in time
5. **Error Isolation**: Identifies and reports specific transaction issues
6. **Composition**: Separates concerns between different processors

## Performance Considerations

For companies with extensive transaction histories, performance optimizations include:

1. **Checkpointing**: Periodically caching derived state to avoid reprocessing
2. **Lazy Loading**: Loading transactions in batches or on-demand
3. **Memoization**: Caching results of expensive calculations
4. **Worker Threads**: Using Node.js worker threads for parallel processing
5. **Database Indexing**: Optimizing queries for transaction retrieval

## Error Handling

The system tracks errors during processing and reports them in a structured format:

```javascript
if (rxjsData?.errors?.size > 0) {
    return res.status(500).send({ 
        errors: Array.from(rxjsData.errors) 
    });
}
```

Common error types include:
- Missing stakeholder references
- Stock class inconsistencies
- Share count discrepancies
- Invalid transaction sequences
- Authorization limit violations

## Conclusion

The RxJS-based cap table generation system provides a flexible, efficient way to process transaction data and derive real-time cap table views. By treating the transaction history as a stream of events, the system can handle complex scenarios while maintaining data consistency and auditability.
