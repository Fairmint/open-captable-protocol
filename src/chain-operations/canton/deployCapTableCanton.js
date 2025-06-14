import { client } from "./clientConfig";

// eslint-disable-next-line no-unused-vars
export async function deployCapTableCanton(issuerId, initial_shares_authorized, chainId, issuer) {
    console.log("🗽 | Deploying cap table on Canton...");

    // Create FairmintAdminService [One time]
    const { contractId } = await client.createFairmintAdminService();

    // Create new party for issuer [Once per issuer]
    const { partyId: issuerPartyId } = await client.createParty(issuerId);

    // Authorize issuer [Once per issuer]
    const authorizationContractId = await client.authorizeIssuer(contractId, issuerPartyId);

    // Issuer accepts authorization [Once per issuer]
    const issuerContractId = await client.acceptIssuerAuthorization(
        authorizationContractId,
        issuer.legal_name,
        initial_shares_authorized,
        issuerPartyId
    );

    return {
        partyId: issuerPartyId,
        // deployId: updateId, // TODO
        address: issuerContractId,
    };
}
