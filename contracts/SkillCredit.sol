// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SkillCredit — Soul-Bound Skill Credits
 * @notice Non-transferable credits that prove skill work and unlock job tiers.
 *         Intentionally NOT ERC-20/TRC-20 compliant: no transfer/approve functions.
 *         This makes SkillCredit legally classified as "reputation points",
 *         NOT a digital asset under Thai SEC Act B.E. 2561.
 *
 * Design principles:
 * - Credits are EARNED by completing work (minted by authorized backend)
 * - Credits are NEVER transferable between users
 * - Credits are NEVER exchangeable for money or other assets
 * - Credits can be REVOKED by admin only in case of fraud/error
 * - Lifetime earned is tracked separately (never decreases, for titles/achievements)
 *
 * @custom:security-contact security@skillchain-rmutl.ac.th
 */
contract SkillCredit {
    // ============ Metadata ============
    string public constant name = "SkillCredit";
    string public constant symbol = "SC";
    uint8 public constant decimals = 0; // Integer points only
    string public constant version = "1.0.0";

    // ============ State ============
    address public admin;
    mapping(address => bool) public minters;       // Backend servers authorized to award credits
    mapping(address => uint256) public balanceOf;  // Current balance (can be revoked)
    mapping(address => uint256) public lifetimeEarned; // Total ever earned (immutable — for levels)
    uint256 public totalSupply;

    // Reason codes for awards
    enum AwardReason {
        JOB_COMPLETION,       // Completed a regular paid job
        TRAINING_COMPLETION,  // Completed a training course
        MENTORSHIP,           // Mentored another student
        VOLUNTEER,            // Volunteer work
        BONUS,                // Special recognition
        CORRECTION            // Data correction (admin only)
    }

    // ============ Events ============
    event CreditsAwarded(
        address indexed to,
        uint256 amount,
        AwardReason indexed reason,
        string jobOrCourseId,
        uint256 newBalance,
        uint256 newLifetimeEarned
    );

    event CreditsRevoked(
        address indexed from,
        uint256 amount,
        string reason,
        uint256 newBalance
    );

    event MinterAdded(address indexed minter, address indexed addedBy);
    event MinterRemoved(address indexed minter, address indexed removedBy);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    // ============ Errors ============
    error NonTransferable();       // Attempted transfer — always reverts
    error NotAdmin();
    error NotMinter();
    error InsufficientBalance(address user, uint256 requested, uint256 available);
    error ZeroAddress();
    error ZeroAmount();

    // ============ Modifiers ============
    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyMinter() {
        if (!minters[msg.sender] && msg.sender != admin) revert NotMinter();
        _;
    }

    modifier validAddress(address addr) {
        if (addr == address(0)) revert ZeroAddress();
        _;
    }

    // ============ Constructor ============
    constructor() {
        admin = msg.sender;
        minters[msg.sender] = true;
        emit MinterAdded(msg.sender, msg.sender);
    }

    // ============ Core Functions ============

    /**
     * @notice Award credits to a user. Called by backend after work verification.
     * @param to Recipient address
     * @param amount Credits to award (integer)
     * @param reason Why credits are being awarded
     * @param jobOrCourseId External reference ID (job UUID or course ID)
     */
    function award(
        address to,
        uint256 amount,
        AwardReason reason,
        string calldata jobOrCourseId
    ) external onlyMinter validAddress(to) {
        if (amount == 0) revert ZeroAmount();

        balanceOf[to] += amount;
        lifetimeEarned[to] += amount;
        totalSupply += amount;

        emit CreditsAwarded(to, amount, reason, jobOrCourseId, balanceOf[to], lifetimeEarned[to]);
    }

    /**
     * @notice Batch award for efficiency (e.g., multiple students in one job).
     */
    function awardBatch(
        address[] calldata recipients,
        uint256[] calldata amounts,
        AwardReason reason,
        string calldata jobOrCourseId
    ) external onlyMinter {
        require(recipients.length == amounts.length, "Length mismatch");

        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) continue;

            balanceOf[recipients[i]] += amounts[i];
            lifetimeEarned[recipients[i]] += amounts[i];
            totalSupply += amounts[i];

            emit CreditsAwarded(
                recipients[i],
                amounts[i],
                reason,
                jobOrCourseId,
                balanceOf[recipients[i]],
                lifetimeEarned[recipients[i]]
            );
        }
    }

    /**
     * @notice Revoke credits in case of fraud, error, or disciplinary action.
     * @dev Only admin can revoke. Lifetime earned is NOT reduced.
     */
    function revoke(
        address from,
        uint256 amount,
        string calldata reason
    ) external onlyAdmin validAddress(from) {
        if (amount == 0) revert ZeroAmount();
        if (balanceOf[from] < amount) {
            revert InsufficientBalance(from, amount, balanceOf[from]);
        }

        balanceOf[from] -= amount;
        totalSupply -= amount;

        emit CreditsRevoked(from, amount, reason, balanceOf[from]);
    }

    // ============ Admin Functions ============

    function addMinter(address minter) external onlyAdmin validAddress(minter) {
        minters[minter] = true;
        emit MinterAdded(minter, msg.sender);
    }

    function removeMinter(address minter) external onlyAdmin {
        minters[minter] = false;
        emit MinterRemoved(minter, msg.sender);
    }

    function transferAdmin(address newAdmin) external onlyAdmin validAddress(newAdmin) {
        address previous = admin;
        admin = newAdmin;
        minters[newAdmin] = true;
        emit AdminTransferred(previous, newAdmin);
    }

    // ============ View Functions ============

    /**
     * @notice Get user's current credit info.
     */
    function getCreditInfo(address user) external view returns (
        uint256 currentBalance,
        uint256 totalLifetimeEarned,
        uint256 totalRevoked
    ) {
        currentBalance = balanceOf[user];
        totalLifetimeEarned = lifetimeEarned[user];
        totalRevoked = lifetimeEarned[user] - balanceOf[user];
    }

    // ============ Blocked ERC-20 Functions (Soul-Bound) ============
    // These functions are intentionally implemented to revert,
    // ensuring SkillCredit cannot be treated as a transferable token
    // by wallets or DEXes.

    function transfer(address, uint256) external pure returns (bool) {
        revert NonTransferable();
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        revert NonTransferable();
    }

    function approve(address, uint256) external pure returns (bool) {
        revert NonTransferable();
    }

    function allowance(address, address) external pure returns (uint256) {
        return 0; // No allowance can ever exist
    }
}
