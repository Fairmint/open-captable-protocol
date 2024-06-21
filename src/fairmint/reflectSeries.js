import { API_URL } from "../chain-operations/utils";
import axios from "axios";

export const reflectSeries = async ({ issuerId, series_id, series_name, stock_class_id, stock_plan_id }) => {
    console.log("Reflecting Series in fairmint...");
    console.log({ issuerId, series_id, series_name, stock_class_id, stock_plan_id });

    const reflectSeriesResponse = await axios.post(`${API_URL}/ocp/reflectSeries?portalId=${issuerId}`, {
        series_id,
        series_name,
        stock_class_id,
        stock_plan_id,
    });

    console.log("Successfully reflected Series into Fairmint");

    return reflectSeriesResponse.data.data;
};