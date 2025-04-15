# Data Reflection Between OCP and Fairmint

This document describes how data is reflected and synchronized between the Open Cap Table Protocol (OCP) and the Fairmint API. The two systems work together to maintain consistent cap table data across both platforms.

## Overview

OCP serves as the source of truth for cap table data, storing information both on-chain (using the Diamond pattern) and off-chain (in MongoDB). Fairmint's API system integrates with OCP to reflect this data in the Fairmint database, allowing Fairmint's user interfaces to display accurate cap table information while leveraging OCP's blockchain capabilities.

## Architecture

The data reflection system follows a bidirectional pattern:

1. **OCP to Fairmint**: When cap table data is created or updated in OCP, it triggers reflection calls to Fairmint's API
2. **Fairmint to OCP**: When new investments or grants are created in Fairmint, they trigger creation of corresponding records in OCP

The integration uses a webhook-based approach, with each system calling specific endpoints on the other to maintain data consistency.

## Data Models

### OCP Fairmint Model

OCP includes a dedicated Fairmint model to track the relationship between OCP entities and Fairmint records:

```javascript
const FairmintSchema = new mongoose.Schema(
    {
        _id: { type: String, default: () => uuid() },
        tx_id: { type: String, default: null },
        series_id: { type: String, default: null },
        object_type: { type: String, default: null },
        security_id: { type: String, default: null },
        stakeholder_id: { type: String, default: null },
        attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
        date: { type: String, default: null },
        issuer: {
            type: String,
            ref: "Issuer",
        },
    },
    { timestamps: true }
);
```

### Fairmint Portal Model

Fairmint's database tracks OCP integration with a flag in the Portal model:

```sql
captable_minted: boolean
```

This flag indicates whether a portal's cap table is managed by OCP. When true, changes to the cap table are synchronized with OCP.

## Key Integration Points

### 1. Issuer/Portal Creation

When a new portal is created in Fairmint with cap table management enabled:

1. Fairmint API calls OCP's `/issuer/create-fairmint-reflection` endpoint
2. OCP creates an Issuer entity in MongoDB and deploys a CapTable contract
3. OCP creates a Fairmint record to track the relationship
4. OCP calls Fairmint's `/ocp/reflectCaptable` webhook to confirm creation

```javascript
// OCP side
issuer.post("/create-fairmint-reflection", async (req, res) => {
    // ... validation and processing
    const issuer = await createIssuer(incomingIssuerForDB);
    await createFairmintData({ id: issuer._id });
    await reflectPortal({ portalId: issuer._id });
    // ...
});

// Fairmint side
async function coreHandler(event, context, callback) {
    // ... validation
    await knex("portal")
      .where({ id: portalId })
      .update({ captable_minted: true });
    // ...
}
```

### 2. Stakeholder Creation

When a new stakeholder (investor or grantee) needs access to a portal:

1. Fairmint API calls OCP's `/stakeholder/create-fairmint-reflection` endpoint
2. OCP creates a Stakeholder entity and deploys it on-chain
3. OCP creates a Fairmint record linking the stakeholder
4. OCP calls Fairmint's `/ocp/reflectStakeholder` webhook

```javascript
// Fairmint side (called during investment)
export const getOrCreateStakeholderId = async (investor, portalId, company) => {
  // Check if stakeholder already exists
  // If not, create new stakeholder via OCP
  const stakeholder = await createStakeholderOnOCPWithReflection({
    issuerId: portalId,
    data: stakeholderData
  });
  return stakeholder.id;
};

// OCP side
router.post("/create-fairmint-reflection", async (req, res) => {
    // ... validation and processing
    const stakeholder = await createStakeholder(incomingStakeholderForDB);
    const fairmintData = await createFairmintData({ stakeholder_id: stakeholder._id });
    // ...
});
```

### 3. Investment Synchronization

When an investment is made in Fairmint:

1. Fairmint calls the appropriate OCP endpoint based on security type:
   - `/transactions/issuance/stock-fairmint-reflection`
   - `/transactions/issuance/convertible-fairmint-reflection`
2. OCP creates the transaction record and stores a link to the Fairmint security
3. OCP deploys the transaction on-chain

```javascript
// Fairmint side
export const syncNewInvestmentToOCP = async ({ investmentItem, knex }) => {
  // ... processing
  const stakeholderId = await getOrCreateStakeholderId(investor, portal.id, company);
  const tx = constructConvertibleIssuancePayload({...});
  const convertibleIssuance = await makeConvertibleIssuanceApiCall(tx);
  await knex("investment").where({ id: investmentItem.id }).update({ security_id: convertibleIssuance.security_id });
  // ...
};

// OCP side
fairmintTransactions.post("/issuance/convertible-fairmint-reflection", async (req, res) => {
    // ... validation and processing
    await upsertFairmintDataBySecurityId(incomingConvertibleIssuance.security_id, {
        issuer: issuerId,
        security_id: incomingConvertibleIssuance.security_id,
        series_id: payload.series_id,
        date: incomingConvertibleIssuance.date,
        attributes: {
            series_name: payload.series_name,
        },
    });
    // ...
});
```

### 4. Equity Grant Synchronization

When an equity grant is created in Fairmint:

1. Fairmint calls OCP's `/transactions/issuance/equity-compensation-fairmint-reflection` endpoint
2. OCP creates the grant record and links it to the Fairmint security
3. OCP deploys the grant on-chain

```javascript
// Fairmint side
export const syncNewGrantToOCP = async ({ grantItem, knex, vestings }) => {
  // ... processing
  const tx = constructEquityCompensationPayload({...});
  const equityCompensation = await makeEquityCompensationApiCall(tx);
  await knex("equity_grant").where({ id: grantItem.id }).update({ security_id: equityCompensation.security_id });
  // ...
};
```

### 5. Grant Exercise Synchronization

When a grant is exercised in Fairmint:

1. Fairmint calls OCP's `/transactions/exercise/equity-compensation-fairmint-reflection` endpoint
2. OCP creates the exercise record and links it to the Fairmint security
3. OCP deploys the exercise on-chain
4. OCP reflects the exercise back to Fairmint via the `/ocp/reflectGrantExercise` webhook

```javascript
// OCP side - reflection back to Fairmint
export const reflectGrantExercise = async ({ security_id, issuerId, quantity, date, resulting_security_ids }) => {
    const webHookUrl = `${API_URL}/ocp/reflectGrantExercise?portalId=${issuerId}`;
    // ... API call to Fairmint
};
```

### 6. Cap Table Statistics

Fairmint displays cap table statistics from OCP by:

1. Calling OCP's `/stats/rxjs/dashboard` or `/stats/rxjs/captable` endpoints
2. Combining OCP data with Fairmint-specific data (like SAFEs valuation caps)
3. Presenting a unified view to users

```javascript
// Fairmint side
export async function coreHandler(event, context, callback) {
  // ... processing
  resp = await axios.get(`${config_ocpUrl}/stats/rxjs/${page}?issuerId=${portalId}`);
  // Combine with additional Fairmint data
  // ...
}
```

## Blockchain Event Handling

When on-chain events occur in OCP (like transaction confirmations):

1. OCP's event listener system detects the event
2. OCP updates its MongoDB database with the event data
3. If a Fairmint record exists for the entity, OCP reflects the update to Fairmint

```javascript
// Event handler for stakeholder creation
export const handleStakeholder = async (id, hash) => {
    try {
        const stakeholder = await upsertStakeholderById(incomingStakeholderId, { is_onchain_synced: true, tx_hash: hash });
        // fairmint data reflection
        const fairmintData = await readFairmintDataByStakeholderId(incomingStakeholderId);
        if (fairmintData && fairmintData._id) {
            await reflectStakeholder({ stakeholder, issuerId: stakeholder.issuer });
        }
    } catch (error) {
        throw Error("Error handing Stakeholder On Chain", error);
    }
};
```

## Security and Data Integrity

To maintain data integrity between the systems:

1. **Verification Checks**: Each system verifies the existence of entities in the other system before proceeding with operations
2. **Transaction Tracing**: Blockchain transaction hashes are stored for verification
3. **Error Logging**: Comprehensive error logging tracks failed synchronizations

```javascript
// Example of verification check in OCP
if (!stakeholder || !stakeholder._id) {
    return res.status(404).send({ error: "Stakeholder not found on OCP" });
}

await checkStakeholderExistsOnFairmint({ stakeholder_id: stakeholder._id, portal_id: issuerId });
```

## Configuration

The integration is configured through environment variables in both systems:

### OCP Configuration

```javascript
// src/fairmint/config.js
export const API_URL = process.env.FAIRMINT_API_URL || "https://api.fairmint.co";
```

### Fairmint Configuration

```javascript
// service-layer/source/config/index.js
export const config_ocpUrl = process.env.OCP_URL || "https://api.opencaptable.io";
```

## Conclusion

The data reflection system between OCP and Fairmint provides a seamless integration that leverages the strengths of both platforms. OCP provides the blockchain-based cap table with immutable transaction history, while Fairmint provides the user interface and additional features for investment management. Together, they enable companies to maintain accurate and legally compliant cap tables with a modern user experience.
