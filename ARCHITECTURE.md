# Architecture Overview

This document describes the architecture of the Open Cap Table Protocol (OCP).

## Smart Contract Architecture

### Diamond Pattern

OCP uses the Diamond pattern for smart contracts. See `docs/DIAMOND_PATTERN.md` for detailed information.

**Core Components:**
- `CapTable` - Main diamond contract
- `CapTableFactory` - Factory for creating cap tables
- Facets - Modular implementation contracts in `chain/src/facets/`
- Storage - Shared storage structure in `chain/src/core/Storage.sol`

## Codebase Structure

- `chain/` - Smart contracts (Solidity, Foundry)
- `src/` - Server code (Node.js/TypeScript)
  - `routes/` - Route handlers
  - `db/` - MongoDB models and operations
  - `chain-operations/` - Blockchain interaction utilities
  - `utils/` - Utility functions

## Related Documentation

- [Diamond Pattern](docs/DIAMOND_PATTERN.md) - Smart contract architecture details
- [Data Model](docs/DATA_MODEL.md) - Database schema
- [Configuration](CONFIG.md) - Environment setup
- [Developer Guide](DEVELOPER_GUIDE.md) - Development workflow
- [README](README.md) - Project overview
