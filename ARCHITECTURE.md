# Architecture Overview

This document describes the architecture of the Open Cap Table Protocol (OCP).

## Codebase Structure

- `chain/` - Smart contracts (Solidity, Foundry)
  - `src/core/` - Core contracts (CapTable, CapTableFactory, Storage)
  - `src/facets/` - Facet contracts
  - `src/libraries/` - Shared libraries
  - `src/interfaces/` - Contract interfaces
  - `test/` - Foundry tests

- `src/` - Server code (Node.js/TypeScript)
  - `routes/` - Route handlers
  - `controllers/` - Business logic controllers
  - `db/` - MongoDB models and operations
  - `chain-operations/` - Blockchain interaction utilities
  - `utils/` - Utility functions
  - `fairmint/` - Fairmint integration
  - `rxjs/` - Reactive data processing

## Related Documentation

- [Data Model](docs/DATA_MODEL.md) - Database schema
- [Configuration](CONFIG.md) - Environment setup
- [Developer Guide](DEVELOPER_GUIDE.md) - Development workflow
- [README](README.md) - Project overview
