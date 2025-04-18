# Open Cap Table Protocol (OCP) Data Model

This document provides a comprehensive overview of the data models used in the Open Cap Table Protocol (OCP). The system has two primary data layers:

1. **MongoDB Database** - Stores off-chain data and serves as the primary API data source
2. **Blockchain Smart Contracts** - Stores on-chain data with the Diamond pattern for immutable, verifiable records

## MongoDB Data Model

### Core Entities

#### Issuer
The company or entity that issues securities. This is the root entity for the cap table.

```javascript
{
  _id: String (UUID),
  object_type: "ISSUER",
  legal_name: String,
  dba: String,
  formation_date: String,
  country_of_formation: String,
  country_subdivision_of_formation: String,
  tax_ids: Array,
  email: Object,
  phone: Object,
  address: Object,
  initial_shares_authorized: String,
  comments: Array of String,
  deployed_to: String, // Blockchain address of the CapTable contract
  last_processed_block: Number, // For blockchain event synchronization
  is_manifest_created: Boolean,
  chain_id: Number, // Blockchain network identifier
  tx_hash: String // Transaction hash of deployment
}
```

#### Stakeholder
Individuals or entities that own securities in the Issuer.

```javascript
{
  _id: String (UUID),
  object_type: "STAKEHOLDER",
  name: Object,
  stakeholder_type: String,
  issuer_assigned_id: String,
  current_relationship: String,
  primary_contact: Object,
  contact_info: Object,
  comments: Array of String,
  issuer: String, // Reference to Issuer._id
  is_onchain_synced: Boolean,
  addresses: Array of Object,
  tax_ids: Array of Object,
  tx_hash: String
}
```

#### StockClass
Represents a class of stock (e.g., Common, Preferred).

```javascript
{
  _id: String (UUID),
  object_type: "STOCK_CLASS",
  name: String,
  class_type: String,
  default_id_prefix: String,
  initial_shares_authorized: String,
  board_approval_date: String,
  votes_per_share: String,
  par_value: Object,
  price_per_share: Object,
  seniority: String,
  conversion_rights: Object,
  liquidation_preference_multiple: String,
  participation_cap_multiple: String,
  comments: Array of String,
  issuer: String, // Reference to Issuer._id
  is_onchain_synced: Boolean,
  tx_hash: String
}
```

#### StockPlan
Represents an equity incentive plan.

```javascript
{
  _id: String (UUID),
  object_type: "STOCK_PLAN",
  name: String,
  board_approval_date: String,
  initial_shares_reserved: String,
  stock_class_id: String,
  comments: Array of String,
  issuer: String, // Reference to Issuer._id
  is_onchain_synced: Boolean,
  tx_hash: String
}
```

#### VestingTerms
Defines vesting schedules for equity compensation.

```javascript
{
  _id: String (UUID),
  object_type: "VESTING_TERMS",
  name: String,
  description: String,
  comments: Array of String,
  issuer: String // Reference to Issuer._id
}
```

#### Valuation
Represents company valuation events.

```javascript
{
  _id: String (UUID),
  object_type: "VALUATION",
  issuer: String, // Reference to Issuer._id
  effective_date: String,
  post_money_valuation: Object,
  board_approval_date: String,
  comments: Array of String
}
```

### Transaction Entities

The system stores various transaction types in separate collections, each inheriting from a base transaction schema.

#### StockIssuance
Records issuance of stock to stakeholders.

```javascript
{
  _id: String (UUID),
  object_type: "TX_STOCK_ISSUANCE",
  stock_class_id: String,
  stock_plan_id: String,
  share_numbers_issued: Array of Object,
  share_price: Object,
  quantity: String,
  vesting_terms_id: String,
  cost_basis: Object,
  stock_legend_ids: Array of String,
  issuance_type: String,
  comments: Array of String,
  security_id: String,
  date: String,
  custom_id: String,
  stakeholder_id: String,
  board_approval_date: String,
  stockholder_approval_date: String,
  consideration_text: String,
  security_law_exemptions: Array of Object,
  issuer: String, // Reference to Issuer._id
  is_onchain_synced: Boolean,
  tx_hash: String
}
```

Other transaction types include:
- EquityCompensationIssuance
- ConvertibleIssuance
- WarrantIssuance
- StockTransfer
- StockCancellation
- StockConsolidation
- EquityCompensationExercise
- And many others (acceptance, adjustment, conversion, release, repurchase, return_to_pool, split, etc.)

### MongoDB Relationships

- **One-to-Many**: Issuer to Stakeholders, StockClasses, StockPlans, Valuations, etc.
- **Many-to-One**: Transactions to Stakeholders, StockClasses, etc.
- **References**: Objects reference each other using their UUID string IDs

### Synchronization Fields

All entities include fields to track blockchain synchronization:
- `is_onchain_synced`: Boolean indicating if the entity is synchronized to the blockchain
- `tx_hash`: Transaction hash of the blockchain transaction that created or updated the entity

## Blockchain Data Model

The blockchain data model implements the Diamond pattern, using multiple facets to interact with a central storage structure.

### Core Storage Structure

```solidity
struct Storage {
    // Access Control storage
    mapping(bytes32 => mapping(address => bool)) roles;
    mapping(bytes32 => bytes32) roleAdmin; // hierarchy of roles
    address currentAdmin; // Current admin address
    address pendingAdmin; // Pending admin address for ownership transfer
    
    // Cap Table storage
    Issuer issuer;
    bytes16[] stakeholders;
    mapping(bytes16 => uint256) stakeholderIndex;
    StockClass[] stockClasses;
    mapping(bytes16 => uint256) stockClassIndex;
    StockPlan[] stockPlans;
    mapping(bytes16 => uint256) stockPlanIndex;
    StockActivePositions stockActivePositions;
    ConvertibleActivePositions convertibleActivePositions;
    EquityCompensationActivePositions equityCompensationActivePositions;
    WarrantActivePositions warrantActivePositions;
    mapping(address => bytes16) addressToStakeholderId;
}
```

### Primary Entity Structures

#### Issuer
```solidity
struct Issuer {
    bytes16 id;
    uint256 shares_issued;
    uint256 shares_authorized;
}
```

#### StockClass
```solidity
struct StockClass {
    bytes16 id;
    string class_type; // ["COMMON", "PREFERRED"]
    uint256 shares_issued;
    uint256 price_per_share;
    uint256 shares_authorized;
}
```

#### StockPlan
```solidity
struct StockPlan {
    bytes16[] stock_class_ids;
    uint256 shares_reserved;
}
```

### Security Positions

The system tracks active positions for different security types:

#### StockActivePosition
```solidity
struct StockActivePosition {
    bytes16 stakeholder_id;
    bytes16 stock_class_id;
    uint256 quantity;
    uint256 share_price;
}
```

#### ConvertibleActivePosition
```solidity
struct ConvertibleActivePosition {
    bytes16 stakeholder_id;
    uint256 investment_amount;
}
```

#### EquityCompensationActivePosition
```solidity
struct EquityCompensationActivePosition {
    bytes16 stakeholder_id;
    uint256 quantity;
    uint40 timestamp;
    bytes16 stock_class_id;
    bytes16 stock_plan_id;
}
```

#### WarrantActivePosition
```solidity
struct WarrantActivePosition {
    bytes16 stakeholder_id;
    uint256 quantity;
}
```

### Transaction Parameters

Each transaction type has a corresponding parameter struct:

#### IssueStockParams
```solidity
struct IssueStockParams {
    bytes16 id;
    bytes16 stock_class_id;
    uint256 share_price;
    uint256 quantity;
    bytes16 stakeholder_id;
    bytes16 security_id;
    string custom_id;
    string stock_legend_ids_mapping;
    string security_law_exemptions_mapping;
}
```

Similar parameter structs exist for other transaction types like:
- IssueConvertibleParams
- IssueEquityCompensationParams
- IssueWarrantParams
- StockConsolidationTx
- StockTransferTx
- StockCancellationTx

### Diamond Pattern Implementation

The system uses the Diamond pattern to allow modular upgrades through facets:

1. **Diamond Storage**: Central storage used by all facets
2. **Facets**: Specialized contracts that provide specific functionality
   - StockFacet
   - StakeholderFacet
   - IssuerFacet
   - StockClassFacet
   - ConvertiblesFacet
   - EquityCompensationFacet
   - StockPlanFacet
   - WarrantFacet
   - AccessControlFacet
   - StakeholderNFTFacet

### Mappings and Relationships

Blockchain data structures use several mappings to maintain relationships:

- `stakeholderToSecurities`: Maps stakeholder ID to their security IDs
- `securities`: Maps security ID to security details
- `securityToStakeholder`: Maps security ID to stakeholder ID
- `addressToStakeholderId`: Maps blockchain address to stakeholder ID
- `stakeholderIndex`: Maps stakeholder ID to array index
- `stockClassIndex`: Maps stock class ID to array index
- `stockPlanIndex`: Maps stock plan ID to array index

### Access Control

The system implements role-based access control:

- **ADMIN_ROLE**: Full control over the cap table
- **OPERATOR_ROLE**: Can perform operations like issuing stock
- **INVESTOR_ROLE**: Limited access to view their own positions

## Event-Driven Data Flow

The system implements an event-driven architecture to synchronize data between blockchain and database:

### Event Listener Architecture

The event listener system, implemented in `src/utils/websocket.ts`, monitors blockchain events and updates the MongoDB database:

1. **Provider Management**: Providers are organized by chain ID to efficiently monitor multiple networks
2. **Event Filtering**: Events are filtered by contract address and event type
3. **Event Processing**: Each event type is processed by specialized handlers
4. **Database Synchronization**: Events update the corresponding entities in MongoDB

### Event Types

The system listens for the following event types:

1. **TxCreated**: Transaction events from various facets
2. **StakeholderCreated**: New stakeholder creation events
3. **StockClassCreated**: New stock class creation events
4. **StockPlanCreated**: New stock plan creation events

### Event Flow Process

1. **Event Detection**: Listeners detect events on the blockchain
2. **Event Decoding**: Event data is decoded using ABI and parameter types
3. **Event Routing**: Events are routed to appropriate handlers
4. **State Update**: Database entities are created or updated based on event data
5. **Synchronization Tracking**: Transaction hashes and block numbers are stored for tracking

## Reactive State Management

The system uses a reactive programming model with RxJS to process transactions and calculate derived state:

### Transaction Processing Pipeline

The transaction processing pipeline, implemented in `src/rxjs/index.js`, processes transactions in sequence:

1. **Initial State Creation**: Creates baseline state from core entities
2. **Transaction Application**: Applies each transaction to modify state
3. **State Derivation**: Calculates derived state and metrics
4. **Data Validation**: Validates state consistency and business rules

### Transaction Processors

The system includes specialized processors for different transaction types:

1. **Stock Issuance Processor**: Handles stock issuance transactions
2. **Stock Cancellation Processor**: Handles stock cancellation transactions
3. **Convertible Issuance Processor**: Handles convertible securities
4. **Equity Compensation Processor**: Handles equity compensation
5. **Warrant Processor**: Handles warrant issuance and exercise

### State Derivation

The system calculates several derived states:

#### Dashboard State
```javascript
{
  sharesIssuedByCurrentRelationship: {}, // Shares grouped by stakeholder relationship
  positions: [], // Array of stakeholder positions
  numOfStakeholders: Number, // Count of stakeholders
  totalRaised: Number, // Total capital raised
  latestSharePrice: Number, // Most recent share price
  valuations: {
    stock: { amount, createdAt, type: 'STOCK' }, // Latest stock valuation
    convertible: { amount, createdAt, type: 'CONVERTIBLE' } // Latest convertible valuation
  }
}
```

#### Cap Table State
```javascript
{
  summary: {
    common: { // Common stock summary
      rows: [], // Array of common stock classes with metrics
      totalSharesAuthorized: Number
    },
    preferred: { // Preferred stock summary
      rows: [], // Array of preferred stock classes with metrics
      totalSharesAuthorized: Number
    },
    founderPreferred: { // Founder preferred summary (if applicable)
      outstandingShares: Number,
      sharesAuthorized: Number,
      fullyDilutedShares: Number,
      liquidation: Number,
      votingPower: Number
    },
    warrantsAndNonPlanAwards: { // Warrants and non-plan awards
      rows: [] // Array of warrant/award entries with metrics
    },
    stockPlans: { // Stock plans summary
      rows: [], // Array of stock plan entries with metrics
      totalSharesAuthorized: Number
    },
    totals: { // Overall cap table totals
      totalSharesAuthorized: Number,
      totalOutstandingShares: Number,
      totalFullyDilutedShares: Number,
      totalLiquidation: Number,
      totalVotingPower: Number
    }
  },
  convertibles: { // Convertible securities summary
    convertiblesSummary: {}, // Grouped convertible securities
    totals: { // Convertible security totals
      outstandingAmount: Number
    }
  }
}
```

## Synchronization Between Layers

The two data layers are synchronized through:

1. **Event Listeners**: Monitoring blockchain events and updating MongoDB
2. **Transactions**: Writing MongoDB changes to the blockchain
3. **Synchronization Flags**: Tracking which entities are synced

Key fields involved in synchronization:
- `deployed_to`: Blockchain address of the cap table contract
- `chain_id`: Identifies which blockchain network the data is on
- `tx_hash`: Transaction hash for blockchain verification
- `is_onchain_synced`: Indicates if the entity is in sync with the blockchain
- `last_processed_block`: Tracks the last blockchain block processed by event listeners

## Data Flow

1. **API Requests**: Changes are first written to MongoDB
2. **Blockchain Transactions**: Critical changes are then propagated to the blockchain
3. **Event Monitoring**: Blockchain events are monitored and used to update MongoDB
4. **Two-way Verification**: Both layers validate each other for consistency
5. **Reactive Processing**: Transactions are processed reactively to calculate derived state
6. **Dashboard & Cap Table Generation**: Derived state is used to generate dashboards and cap tables
