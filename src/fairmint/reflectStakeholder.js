import axios from "axios";
import get from "lodash/get";
import { API_URL } from "./config";

export const reflectStakeholder = async ({ issuerId, stakeholder }) => {
    console.log("Reflecting Stakeholder into fairmint...");

    let webHookUrl = `${API_URL}/ocp/reflectStakeholder?portalId=${issuerId}`;
    try {
        const address = get(stakeholder, "addresses.0");
        const body = {
            // use primary contact if the main name info not available
            legal_name: get(stakeholder, "name.legal_name", null) || get(stakeholder, "primary_contact.name.legal_name"),
            firstname: get(stakeholder, "name.first_name", null) || get(stakeholder, "primary_contact.name.first_name"),
            lastname: get(stakeholder, "name.last_name", null) || get(stakeholder, "primary_contact.name.last_name"),
            stakeholder_id: get(stakeholder, "_id"),
            stakeholder_type: get(stakeholder, "stakeholder_type"),
            email: get(stakeholder, "contact_info.emails.0.email_address"),
            address: get(address, "street_suite"),
            city: get(address, "city"),
            state_code: get(address, "country_subdivision"),
            zipcode: get(address, "postal_code"),
            country_code: get(address, "country"),
            tax_id: get(stakeholder, "tax_ids.0.tax_id"),
        };

        const resp = await axios.post(webHookUrl, body);
        console.log(`Successfully reflected Stakeholder ${stakeholder._id} into Fairmint webhook`);

        return resp.data;
    } catch (error) {
        if (error.response) {
            const formattedError = {
                status: error.response.status,
                endpoint: webHookUrl,
                data: get(error, "response.data"),
            };
            throw Error(`Error reflecting Stakeholder into Fairmint: ${JSON.stringify(formattedError, null, 2)}`);
        } else {
            throw Error(`Error reflecting Stakeholder into Fairmint: ${error.message}`);
        }
    }
};
