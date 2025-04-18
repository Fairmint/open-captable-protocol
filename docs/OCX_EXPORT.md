# OCX Export in Fairmint

## Overview

OCX (Open Cap Table) is a standardized file format for cap table data, developed by the Open Cap Table Coalition. The `.ocx` file extension represents data conforming to the Open Cap Table Format (OCF) standard. Fairmint implements OCX export functionality to allow companies to share their cap table data with third-party systems in a standardized format.

## Architecture

The OCX export functionality is primarily implemented in the OCP (Open Cap Table Protocol) repository, which serves as Fairmint's backend implementation of the OCF standard.

### Backend Components

The OCX export flow consists of:

1. **API Endpoint**: `/export/ocf` endpoint in the OCP service handles export requests
2. **Data Collection**: Retrieves all necessary cap table data from the database
3. **Formatting**: Structures the data according to OCF standard
4. **Response**: Returns the formatted data for download as an OCX file

### Data Model

The OCX export includes the following data entities:

- **Issuer**: Company information
- **Stakeholders**: Investors, employees, and other entities holding securities
- **Stock Classes**: Different classes of shares with their respective rights
- **Stock Plans**: Equity incentive plans (e.g., option pools)
- **Stock Legend Templates**: Legal text templates that appear on stock certificates
- **Valuations**: Historical company valuations
- **Vesting Terms**: Vesting schedules for equity grants

## Implementation Details

### Backend (OCP Service)

The main export functionality is implemented in `ocp/src/routes/export.js`:

```javascript
exportCaptable.get("/ocf", async (req, res) => {
    const { issuerId } = req.query;
    if (!issuerId) {
        console.log("❌ | No issuer ID");
        return res.status(400).send("issuerId is required");
    }

    try {
        const issuer = await Issuer.findById(issuerId);
        const stakeholders = await find(Stakeholder, { issuer: issuerId });
        const stockClasses = await find(StockClass, { issuer: issuerId });
        const stockPlans = await find(StockPlan, { issuer: issuerId });
        const stockLegendTemplates = await find(StockLegendTemplate, { issuer: issuerId });
        const valuations = await find(Valuation, { issuer: issuerId });
        const vestingTerms = await find(VestingTerm, { issuer: issuerId });

        res.status(200).json({
            issuer,
            stakeholders,
            stockClasses,
            stockPlans,
            stockLegendTemplates,
            valuations,
            vestingTerms,
        });
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).send("Failed to fetch data");
    }
});
```

### Frontend Integration (Studio App)

The Studio app provides a user interface for exporting cap tables in OCX format. The feature is accessible through:

1. **Quick Actions Menu**: "Export Captable OCX" option in the Dashboard
2. **File Format Support**: The app supports `.ocx` files for both import and export

## Usage

### Exporting a Cap Table

1. Log in to the Fairmint Studio app
2. Navigate to the Dashboard or Cap Table view
3. Click on "Quick Actions" or "Export"
4. Select "Export Captable OCX"
5. The system will generate an OCX file for download
6. Save the file to your local system

### Common Use Cases

- **Third-party Integration**: Share cap table data with legal counsel or financial advisors
- **Migration**: Move cap table data to another system
- **Backup**: Create a standardized backup of cap table information
- **Compliance**: Provide cap table information to regulatory bodies or investors

## Technical Details

### File Format

The OCX file is a JSON-based format following the OCF schema. The standard defines:

- Entity relationships
- Required and optional fields
- Data validation rules
- Versioning of the schema

### Validation

The OCP implementation includes validation for OCF-formatted data through the `/ocf/validate/transactions` endpoint.

## Troubleshooting

If you encounter issues with OCX export:

1. **Missing Data**: Ensure that all required cap table entities are properly defined
2. **Permission Issues**: Verify that you have appropriate permissions to export the cap table
3. **Server Errors**: Check the server logs for detailed error information
4. **Format Compatibility**: Ensure that the receiving system supports the OCF standard

## References

- [Open Cap Table Coalition](https://opencaptablecoalition.com/)
- [OCF Standard Specification](https://opencaptablecoalition.com/schema/)
