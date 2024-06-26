// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/CapTableFactory.sol";
import "../src/CapTable.sol";
import "../src/interfaces/ICapTable.sol";

contract CapTableFactoryTest is Test {
    CapTableFactory private _capTableFactory;
    CapTable private _capTableImplementation;

    function setUp() public {
        // Deploy empty implementation
        _capTableImplementation = new CapTable();

        _capTableFactory = new CapTableFactory(address(_capTableImplementation));
    }

    function testRevertsInvalidImplementationAddress() public {
        vm.expectRevert("Invalid implementation address");
        _capTableFactory = new CapTableFactory(address(0));
    }

    function testCreateCapTable() public {
        bytes16 issuerId = 0xd3373e0a4dd9430f8a563281f2800e1e;
        uint256 issuerInitialSharesAuthorized = 1000000;

        address capTableProxy = _capTableFactory.createCapTable(issuerId, issuerInitialSharesAuthorized);

        // Assert the cap table was created
        CapTable capTable = CapTable(capTableProxy);

        (bytes16 id, uint256 shares_issued, uint256 initial_shares_authorized) = capTable.issuer();

        assertEq(id, issuerId);
        assertEq(shares_issued, 0);
        assertEq(initial_shares_authorized, issuerInitialSharesAuthorized);

        // Verify by creating a stakeholder
        bytes16 stakeholderId = 0xd3373e0a4dd940000000000000000010;
        string memory stakeholderType = "INDIVIDUAL";
        string memory stakeholderRelationship = "INVESTOR";

        capTable.createStakeholder(stakeholderId, stakeholderType, stakeholderRelationship);

        (bytes16 actualStakeolderId, string memory actualStakeholderType, string memory actualStakeholderRelationship) = capTable.getStakeholderById(
            stakeholderId
        );

        assertEq(actualStakeolderId, stakeholderId);
        assertEq(actualStakeholderType, stakeholderType);
        assertEq(actualStakeholderRelationship, stakeholderRelationship);

        // Testing that only owner can create stakeholder
        vm.prank(address(1));
        vm.expectRevert("Does not have admin role");
        capTable.createStakeholder(0xd3373e0a4dd940000000000000000005, "INDIVIDUAL", "EMPLOYEE");
    }

    function testUpdateCapTableImplementation() public {
        // Create cap table prior to upgrade
        bytes16 issuerId0 = 0xd3373e0a4dd9430f8a563281f2800333;
        uint256 issuerInitialSharesAuthorized0 = 1000000;

        address capTableProxy0 = _capTableFactory.createCapTable(issuerId0, issuerInitialSharesAuthorized0);

        // Assert the cap table was created
        CapTable capTable0 = CapTable(capTableProxy0);

        // Deploy new implementation
        CapTable newCapTableImplementation = new CapTable();

        // Update implementation
        _capTableFactory.updateCapTableImplementation(address(newCapTableImplementation));

        // Assert the implementation was updated
        assertEq(address(_capTableFactory.capTableImplementation()), address(newCapTableImplementation));
        assertEq(address(_capTableFactory.capTableBeacon().implementation()), address(newCapTableImplementation));

        // Create a cap table
        bytes16 issuerId = 0xd3373e0a4dd9430f8a563281f2800e1e;
        uint256 issuerInitialSharesAuthorized = 1000000;

        address capTableProxy = _capTableFactory.createCapTable(issuerId, issuerInitialSharesAuthorized);

        // Assert the cap table was created
        CapTable capTable = CapTable(capTableProxy);

        (bytes16 id, uint256 shares_issued, uint256 initial_shares_authorized) = capTable.issuer();

        assertEq(id, issuerId);
        assertEq(shares_issued, 0);
        assertEq(initial_shares_authorized, issuerInitialSharesAuthorized);

        // make sure previous cap table still works
        bytes16 stakeholderId = 0xd3373e0a4dd940000000000000000010;

        capTable0.createStakeholder(stakeholderId, "INDIVIDUAL", "INVESTOR");

        (bytes16 actualStakeolderId, string memory actualStakeholderType, string memory actualStakeholderRelationship) = capTable0.getStakeholderById(
            stakeholderId
        );

        assertEq(actualStakeolderId, stakeholderId);
        assertEq(actualStakeholderType, "INDIVIDUAL");
        assertEq(actualStakeholderRelationship, "INVESTOR");
    }
}
