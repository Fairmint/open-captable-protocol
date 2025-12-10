# AGENTS.md

This file provides guidance to AI agents (OpenAI Codex, etc.) when working with this repository.

## Context

**Read `llms.txt` first** for complete project context, architecture decisions, and coding conventions.

## Project Overview

Open Cap Table Protocol (OCP) is a blockchain-based cap table management system implementing the Open Cap Table Coalition (OCF) standard. It consists of:

- **Smart Contract Layer**: Solidity contracts using Diamond pattern (Foundry)
- **API Server**: Express.js REST API with MongoDB (Node.js/TypeScript)
- **Event Synchronization**: WebSocket listeners for blockchain event sync

## Key Commands

- `yarn dev` - Start development server
- `yarn test:chain` - Run smart contract tests
- `yarn test:js` - Run API tests
- `yarn deploy:local` - Deploy contracts to local Anvil
- `yarn lint` - Run linting
- `yarn typecheck` - TypeScript type checking

## Important Notes

- Follow patterns in `llms.txt` - it's the source of truth
- Always validate against OCF schemas before saving data
- Use contract middleware for routes interacting with contracts
- Convert UUIDs to bytes16 for contract calls
- Use scaled BigNumber for quantities/prices
- Check `docs/DIAMOND_PATTERN.md` before modifying smart contracts
- Check `docs/DATA_MODEL.md` before modifying database models

## Architecture Constraints

- **Diamond Pattern**: All smart contracts use Diamond pattern with facets
- **OCF Standard**: All data must validate against OCF JSON schemas
- **Multi-Chain**: Support for multiple EVM networks (Base, Arbitrum, etc.)
- **Event Sync**: WebSocket listeners automatically sync blockchain events

## Testing Requirements

- Write tests for all new code
- Smart contract tests in `chain/test/` using Foundry
- API tests in `src/tests/` using Jest
- Integration tests verify end-to-end workflows

## Documentation

- Update `llms.txt` when adding features or patterns
- Update `docs/openapi.yaml` for API changes
- Create ADRs for architectural decisions
- Keep README and developer docs current
