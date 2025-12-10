# Architecture Overview

This document consolidates architecture information for the Open Cap Table Protocol (OCP).

## System Architecture

OCP follows a **dual-layer architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATIONS                       │
│         (Fairmint, External Integrations, etc.)              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    API SERVER LAYER                         │
│  Express.js REST API + MongoDB + WebSocket Event Listeners  │
│                                                             │
│  • Route Handlers (src/routes/)                             │
│  • Controllers (src/controllers/)                           │
│  • Database Models (src/db/objects/)                        │
│  • Event Synchronization (src/utils/websocket.ts)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  BLOCKCHAIN LAYER                            │
│         Diamond Pattern Smart Contracts (EVM)               │
│                                                             │
│  • CapTable (Diamond Contract)                              │
│  • Facets (Issuer, Stakeholder, StockClass, etc.)           │
│  • Factory (Deployment)                                     │
└─────────────────────────────────────────────────────────────┘
```

## Smart Contract Architecture

### Diamond Pattern

OCP uses the **Diamond pattern** for smart contracts, providing:

- **Modularity**: Separate facets for different functionality
- **Upgradability**: Add/remove/replace facets without data migration
- **Unlimited Size**: Bypass 24KB contract size limit
- **Shared Storage**: Single storage structure across all facets

**Core Components:**

1. **Diamond Contract (CapTable)**
   - Main entry point for all function calls
   - Delegates to appropriate facets via function selectors
   - Created by `CapTableFactory` for each issuer

2. **Facets** (Implementation Contracts)
   - `IssuerFacet` - Issuer data management
   - `StakeholderFacet` - Stakeholder operations
   - `StockClassFacet` - Stock class definitions
   - `StockFacet` - Stock issuance and transfers
   - `StockPlanFacet` - Equity compensation plans
   - `ConvertiblesFacet` - Convertible securities
   - `EquityCompensationFacet` - Equity compensation
   - `WarrantFacet` - Warrant management
   - `StakeholderNFTFacet` - NFT representation of positions

3. **Storage Library**
   - Shared storage structure in `Storage.sol`
   - Accessed via `StorageLib.get()` from all facets
   - Contains all cap table data in a single location

See `docs/DIAMOND_PATTERN.md` for detailed information.

### Factory Pattern

- `CapTableFactory` creates new cap table instances
- Uses reference diamond for facet addresses
- Each issuer gets a unique CapTable contract

## API Server Architecture

### Express.js Application

**Entry Point**: `src/app.js`

**Middleware Stack:**
1. CORS - Cross-origin resource sharing
2. Body parsing (JSON, URL-encoded)
3. Chain middleware - Validates chain ID for issuer creation
4. Contract middleware - Caches contract instances per issuer

**Route Organization:**
- `/issuer` - Issuer management
- `/stakeholder` - Stakeholder operations
- `/stock-class` - Stock class management
- `/stock-plan` - Equity plan management
- `/transactions/*` - Transaction processing
- `/stats/*` - Analytics and statistics
- `/export/*` - Data export
- `/ocf/*` - OCF format operations

### Database Architecture

**MongoDB Collections:**

- `issuers` - Company/issuer data
- `stakeholders` - Individual/entity stakeholders
- `stockclasses` - Stock class definitions
- `stockplans` - Equity compensation plans
- `stocklegends` - Stock legend templates
- `valuations` - Company valuations
- `vestingterms` - Vesting term definitions
- `transactions/*` - Transaction records (issuance, transfer, exercise, etc.)
- `fairmint` - Fairmint integration tracking

**Data Model:**
- Follows OCF standard structure
- UUIDs as primary keys
- References between entities
- Timestamps for audit trail

See `docs/DATA_MODEL.md` for complete schema.

### Event Synchronization

**WebSocket Listeners:**
- Monitor blockchain events for all deployed contracts
- Group contracts by chain ID for efficient connection management
- Automatically sync events to MongoDB
- Handle reconnections and error recovery

**Event Flow:**
```
Blockchain Event → WebSocket Listener → Event Handler → Database Update
```

## Multi-Chain Architecture

### Chain Configuration

Supported chains defined in `src/utils/chains.js`:

```javascript
SUPPORTED_CHAINS = {
    8453: { name: "Base Mainnet", rpcUrl, wsUrl },
    84532: { name: "Base Sepolia", rpcUrl, wsUrl },
    31337: { name: "Anvil", rpcUrl, wsUrl },
}
```

### Chain-Agnostic Design

- Contract instances cached per `chainId + issuerId`
- RPC providers created per chain
- WebSocket listeners grouped by chain
- Chain ID required for issuer creation

## Data Flow Patterns

### Creating an Issuer

```
1. API Request (POST /issuer/create)
   ↓
2. Validate OCF schema
   ↓
3. Deploy CapTable contract (chain)
   ↓
4. Save issuer to MongoDB (web)
   ↓
5. Start WebSocket listener for contract
   ↓
6. Return issuer data
```

### Issuing Stock

```
1. API Request (POST /transactions/issuance)
   ↓
2. Validate input
   ↓
3. Call contract.issueStock() (chain)
   ↓
4. Transaction mined
   ↓
5. WebSocket listener catches StockIssued event
   ↓
6. Save transaction to MongoDB (web)
   ↓
7. Return transaction data
```

### Event Synchronization

```
1. Blockchain event emitted
   ↓
2. WebSocket listener receives event
   ↓
3. Parse event data
   ↓
4. Update MongoDB document
   ↓
5. Log synchronization
```

## Security Architecture

### Access Control

- **On-Chain**: Role-based access control (RBAC) in smart contracts
- **Off-Chain**: API authentication (if implemented)
- **Admin Roles**: Contract admin, issuer admin, etc.

### Data Validation

- **OCF Schema Validation**: All data validated against OCF JSON schemas
- **Input Sanitization**: UUID validation, decimal scaling
- **Error Handling**: Comprehensive error decoding and reporting

### Contract Security

- **Diamond Pattern**: Upgradeable but controlled
- **Access Control**: Role-based permissions
- **Input Validation**: Revert on invalid inputs
- **Gas Optimization**: Efficient storage patterns

## Integration Points

### Fairmint Integration

- Bidirectional data reflection between OCP and Fairmint
- Webhook-based synchronization
- Portal/Issuer mapping
- See `docs/DATA_REFLECTION.md` for details

### OCF Standard

- Full OCF schema compliance
- Import/export OCF format files
- Validation against OCF schemas
- See `docs/OCX_EXPORT.md` for export details

## Performance Considerations

### Caching

- **Contract Instances**: Cached per `chainId + issuerId`
- **Preprocessor Cache**: Cached processed data
- **TTL Configuration**: Configurable cache expiration

### Database

- Indexed fields for fast queries
- Efficient aggregation pipelines
- Connection pooling

### Blockchain

- Batch operations where possible
- Gas optimization in contracts
- Efficient event filtering

## Scalability

### Horizontal Scaling

- Stateless API server (can scale horizontally)
- MongoDB replica sets
- Load-balanced RPC endpoints

### Vertical Scaling

- Database query optimization
- Contract gas optimization
- Efficient event processing

## Deployment Architecture

### Environments

- **Local**: Anvil + Local MongoDB
- **Testnet**: Base Sepolia + Test MongoDB
- **Production**: Base Mainnet + Production MongoDB

### Deployment Flow

```
1. Deploy Smart Contracts (Foundry)
   ↓
2. Update Environment Variables
   ↓
3. Deploy API Server
   ↓
4. Start WebSocket Listeners
   ↓
5. Sync Historical Events (if needed)
```

See `DEPLOYMENT.md` for detailed procedures.

## Monitoring & Observability

### Logging

- Structured logging with emoji prefixes
- Error tracking with Sentry
- Transaction hash logging

### Health Checks

- `/health` endpoint for API status
- Database connection monitoring
- WebSocket connection status

### Metrics

- Transaction counts
- Event processing rates
- Error rates
- Response times

## Future Architecture Considerations

### Potential Enhancements

- GraphQL API layer
- Event sourcing for audit trail
- Multi-signature support
- Advanced analytics
- Real-time notifications
- API rate limiting
- Authentication/authorization layer

## Related Documentation

- [Diamond Pattern](docs/DIAMOND_PATTERN.md) - Smart contract architecture
- [Data Model](docs/DATA_MODEL.md) - Database schema
- [Configuration](CONFIG.md) - Environment setup
- [Deployment](DEPLOYMENT.md) - Deployment procedures
- [Developer Guide](DEVELOPER_GUIDE.md) - Development workflow
