# API Reference

This document provides API usage examples and reference for the Open Cap Table Protocol (OCP) API.

## Base URL

- **Local**: `http://localhost:8293`
- **Development**: `https://api.ocp-dev.fairmint.co`
- **Staging**: `https://api.ocp-staging.fairmint.co`
- **Production**: `https://api.ocp.fairmint.co`

## Authentication

Currently, the API does not require authentication for most endpoints. Future versions may implement API keys or OAuth.

## Content Type

All requests should use `Content-Type: application/json`.

## Common Response Formats

### Success Response
```json
{
  "issuer": { ... },
  "id": "uuid-here"
}
```

### Error Response
```json
{
  "error": "Error message here"
}
```

## Core Endpoints

### Health Check

**GET** `/health`

Check if the API is operational.

**Response:**
```
OK
```

**Example:**
```bash
curl http://localhost:8293/health
```

---

### Create Issuer

**POST** `/issuer/create`

Create a new issuer (company) and deploy a cap table contract.

**Request Body:**
```json
{
  "chain_id": 31337,
  "legal_name": "Acme Corporation",
  "dba": "Acme",
  "formation_date": "2020-01-01",
  "country_of_formation": "US",
  "country_subdivision_of_formation": "DE",
  "initial_shares_authorized": "1000000"
}
```

**Response:**
```json
{
  "issuer": {
    "_id": "uuid-here",
    "legal_name": "Acme Corporation",
    "deployed_to": "0x...",
    "chain_id": 31337,
    "tx_hash": "0x...",
    ...
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:8293/issuer/create \
  -H "Content-Type: application/json" \
  -d '{
    "chain_id": 31337,
    "legal_name": "Acme Corporation",
    "initial_shares_authorized": "1000000"
  }'
```

**Notes:**
- `chain_id` is required (31337=Anvil, 84532=Base Sepolia, 8453=Base Mainnet)
- Contract is automatically deployed
- WebSocket listener is started automatically

---

### Get Issuer

**GET** `/issuer/id/:id`

Get issuer information by ID.

**Response:**
```json
{
  "issuerId": "uuid-here",
  "type": "ISSUER",
  "role": "admin"
}
```

**Example:**
```bash
curl http://localhost:8293/issuer/id/uuid-here
```

---

### Create Stakeholder

**POST** `/stakeholder/create`

Create a new stakeholder on-chain.

**Request Body:**
```json
{
  "issuerId": "uuid-here",
  "name": {
    "legal_name": "John Doe"
  },
  "stakeholder_type": "INDIVIDUAL"
}
```

**Response:**
```json
{
  "stakeholder": {
    "_id": "uuid-here",
    "name": { ... },
    ...
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:8293/stakeholder/create \
  -H "Content-Type: application/json" \
  -d '{
    "issuerId": "issuer-uuid",
    "name": { "legal_name": "John Doe" },
    "stakeholder_type": "INDIVIDUAL"
  }'
```

**Notes:**
- Requires `issuerId` to identify the cap table
- Stakeholder is created both on-chain and in database

---

### Create Stock Class

**POST** `/stock-class/create`

Create a new stock class.

**Request Body:**
```json
{
  "issuerId": "uuid-here",
  "class_type": "COMMON",
  "price_per_share": {
    "amount": "1.00",
    "currency": "USD"
  },
  "initial_shares_authorized": "100000"
}
```

**Response:**
```json
{
  "stockClass": {
    "_id": "uuid-here",
    "class_type": "COMMON",
    ...
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:8293/stock-class/create \
  -H "Content-Type: application/json" \
  -d '{
    "issuerId": "issuer-uuid",
    "class_type": "COMMON",
    "price_per_share": { "amount": "1.00", "currency": "USD" },
    "initial_shares_authorized": "100000"
  }'
```

---

## Transaction Endpoints

### Issue Stock

**POST** `/transactions/issuance`

Issue stock to a stakeholder.

**Request Body:**
```json
{
  "issuerId": "uuid-here",
  "stock_class_id": "stock-class-uuid",
  "stakeholder_id": "stakeholder-uuid",
  "quantity": "1000",
  "share_price": {
    "amount": "10.00",
    "currency": "USD"
  }
}
```

**Response:**
```json
{
  "transaction": {
    "_id": "uuid-here",
    "object_type": "TX_STOCK_ISSUANCE",
    "quantity": "1000",
    ...
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:8293/transactions/issuance \
  -H "Content-Type: application/json" \
  -d '{
    "issuerId": "issuer-uuid",
    "stock_class_id": "stock-class-uuid",
    "stakeholder_id": "stakeholder-uuid",
    "quantity": "1000",
    "share_price": { "amount": "10.00", "currency": "USD" }
  }'
```

---

### Transfer Stock

**POST** `/transactions/transfer`

Transfer stock between stakeholders.

**Request Body:**
```json
{
  "issuerId": "uuid-here",
  "from_stakeholder_id": "stakeholder-uuid-1",
  "to_stakeholder_id": "stakeholder-uuid-2",
  "stock_class_id": "stock-class-uuid",
  "quantity": "100",
  "share_price": {
    "amount": "10.00",
    "currency": "USD"
  }
}
```

**Response:**
```json
{
  "transaction": {
    "_id": "uuid-here",
    "object_type": "TX_STOCK_TRANSFER",
    ...
  }
}
```

---

### Exercise Equity Compensation

**POST** `/transactions/exercise`

Exercise equity compensation (options, RSUs, etc.).

**Request Body:**
```json
{
  "issuerId": "uuid-here",
  "equity_compensation_id": "equity-comp-uuid",
  "quantity": "500"
}
```

---

### Cancel Stock

**POST** `/transactions/cancellation`

Cancel stock (repurchase, forfeiture, etc.).

**Request Body:**
```json
{
  "issuerId": "uuid-here",
  "stock_class_id": "stock-class-uuid",
  "stakeholder_id": "stakeholder-uuid",
  "quantity": "100"
}
```

---

## Statistics Endpoints

### Get Cap Table Stats

**GET** `/stats/cap-table/:issuerId`

Get cap table statistics for an issuer.

**Response:**
```json
{
  "total_shares": "1000000",
  "issued_shares": "500000",
  "outstanding_shares": "500000",
  "stakeholders": 10,
  "stock_classes": 2
}
```

---

## Export Endpoints

### Export Cap Table

**GET** `/export/cap-table/:issuerId`

Export cap table data in various formats.

**Query Parameters:**
- `format` - Export format (json, csv, xlsx, ocf)

**Example:**
```bash
curl http://localhost:8293/export/cap-table/uuid-here?format=ocf
```

---

## OCF Endpoints

### Verify Cap Table

**POST** `/verify-cap-table`

Verify cap table data against OCF standard.

**Request:**
- Multipart form data with OCF manifest file

**Response:**
```json
{
  "valid": true,
  "errors": []
}
```

---

## Error Handling

### Common Error Codes

- `400` - Bad Request (missing/invalid parameters)
- `404` - Not Found (issuer/stakeholder not found)
- `500` - Internal Server Error

### Error Response Format

```json
{
  "error": "Error message here"
}
```

### Contract Errors

When contract calls fail, errors are decoded and returned:

```json
{
  "error": "NoStakeholder: Stakeholder not found",
  "details": {
    "name": "NoStakeholder",
    "args": {
      "stakeholder_id": "0x..."
    }
  }
}
```

## Rate Limiting

Currently, there are no rate limits. Future versions may implement rate limiting.

## WebSocket Events

The API automatically starts WebSocket listeners for deployed contracts. Events are synced to the database automatically.

**Event Types:**
- `StockIssued`
- `StockTransferred`
- `StakeholderCreated`
- `StockClassCreated`
- And more...

## Complete API Specification

For the complete OpenAPI specification, see `docs/openapi.yaml`.

## Example Workflows

### Complete Cap Table Setup

```bash
# 1. Create issuer
ISSUER_ID=$(curl -X POST http://localhost:8293/issuer/create \
  -H "Content-Type: application/json" \
  -d '{"chain_id": 31337, "legal_name": "Acme Corp", "initial_shares_authorized": "1000000"}' \
  | jq -r '.issuer._id')

# 2. Create stakeholder
STAKEHOLDER_ID=$(curl -X POST http://localhost:8293/stakeholder/create \
  -H "Content-Type: application/json" \
  -d "{\"issuerId\": \"$ISSUER_ID\", \"name\": {\"legal_name\": \"John Doe\"}, \"stakeholder_type\": \"INDIVIDUAL\"}" \
  | jq -r '.stakeholder._id')

# 3. Create stock class
STOCK_CLASS_ID=$(curl -X POST http://localhost:8293/stock-class/create \
  -H "Content-Type: application/json" \
  -d "{\"issuerId\": \"$ISSUER_ID\", \"class_type\": \"COMMON\", \"price_per_share\": {\"amount\": \"1.00\", \"currency\": \"USD\"}, \"initial_shares_authorized\": \"100000\"}" \
  | jq -r '.stockClass._id')

# 4. Issue stock
curl -X POST http://localhost:8293/transactions/issuance \
  -H "Content-Type: application/json" \
  -d "{\"issuerId\": \"$ISSUER_ID\", \"stock_class_id\": \"$STOCK_CLASS_ID\", \"stakeholder_id\": \"$STAKEHOLDER_ID\", \"quantity\": \"1000\", \"share_price\": {\"amount\": \"10.00\", \"currency\": \"USD\"}}"
```

## Testing

See `TESTING.md` for testing guidelines and examples.

## Related Documentation

- [Developer Guide](DEVELOPER_GUIDE.md) - Development workflow
- [Deployment Guide](DEPLOYMENT.md) - Deployment procedures
- [OpenAPI Specification](docs/openapi.yaml) - Complete API spec
- [Data Model](docs/DATA_MODEL.md) - Database schema
