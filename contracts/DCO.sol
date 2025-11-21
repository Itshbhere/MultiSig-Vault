// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-solidity/contracts/access/OwnableUpgradeable.sol";
import "openzeppelin-solidity/contracts/access/AccessControlUpgradeable.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuardUpgradeable.sol";
import "openzeppelin-solidity/contracts/proxy/utils/UUPSUpgradeable.sol";
import "openzeppelin-solidity/contracts/proxy/utils/Initializable.sol";

/**
 * @title ZKTC DCO Contract - UUPS Upgradeable
 * @dev A contract for managing an Donation Coin Offering (DCO) with role-based access control
 * @dev Allows token injection, price setting, and controlled token release
 * @dev Inherits from Ownable, AccessControl, and ReentrancyGuard for permission management
 * @dev Features UUPS upgradeability pattern for future contract upgrades
 */
contract DCOLock is
    Initializable,
    OwnableUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant WALLET_SUPPLIER_ROLE = keccak256("WALLET_SUPPLIER_ROLE");
    bytes32 public constant RELEASER_ROLE = keccak256("RELEASER_ROLE");
    IERC20 public zkToken;
    uint256 public tokenPrice;
    uint256 public tokenSold;
    uint256 public DCO_END_TIME;
    uint256 public SEVEN_MONTHS;
    uint256 public ONE_YEAR;

    uint256 public totalDonations = 0;
    uint256 public totalUsdGathered = 0;
    uint256 public incrementThreshold = 37500;
    uint256 public threshold = 137500;

    // Contract version for upgrade tracking
    uint256 public constant VERSION = 1;

    // Wallet supplier addresses
    string public btcAddress;
    address public ethAddress;
    string public solAddress;
    address public ZCW;

    // Struct to track locked tokens for each user
    struct LockedTokens {
        uint256 totalAmount; // Total amount locked
        uint256 sevenMonthAmount; // Amount released after 7 months (50%)
        uint256 oneYearAmount; // Amount released after 1 year (50%)
        uint256 sevenMonthClaimed; // Amount already claimed from 7-month release
        uint256 oneYearClaimed; // Amount already claimed from 1-year release
        uint256 lockTimestamp; // When tokens were locked
    }

    // Mapping to track locked tokens for each user
    mapping(address => LockedTokens) public userLockedTokens;

    error TokenPriceMustBeGreaterThanZero();
    error AmountMustBeGreaterThanZero();
    error NoTokensRemaining();
    error InsufficientBalance();
    error NoBalanceToWithdraw();
    error TransferFailed();
    error InsufficientTokens();
    error TransactionAlreadyProcessed();
    error GlobalReleaseTimeNotReached();
    error CannotWithdrawBeforeGlobalRelease();
    error DCONotActive();
    error InvalidAddress();
    error NoDonationsMade();
    error NoTokensToWithdraw();
    error SevenMonthReleaseNotAvailable();
    error OneYearReleaseNotAvailable();
    error InvalidTokenPrice();
    error InvalidTokenAddress();
    error InvalidZCWAddress();
    error InvalidDCOEndTime();
    error InvalidThreshold();
    error InvalidIncrementThreshold();
    error InvalidWalletAddress();
    error InvalidAmount();
    error InvalidTimeStamp();
    error OverflowDetected();
    error UnderflowDetected();

    event TokenPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event TokensInjected(uint256 amount, uint256 newRemaining);
    event ReleaserAdded(address indexed releaser);
    event ReleaserRemoved(address indexed releaser);
    event TokensReleased(address indexed buyer, uint256 amount, uint256 timestamp);
    event DCOEndTimeUpdated(uint256 oldTime, uint256 newTime);
    event TokensWithdrawn(address indexed owner, uint256 amount);
    event AllTokensWithdrawn(address indexed owner, uint256 amount);
    event DonationMade(address indexed buyer, uint256 amount, uint256 timestamp);
    event ZCWDonated(uint256 amount, uint256 timestamp);
    event PriceThresholdUpdated(uint256 newThreshold, uint256 tokenPrice);
    event TokensLocked(address indexed user, uint256 amount, uint256 lockTimestamp);
    event TokensWithdrawn(address indexed user, uint256 amount, uint256 releaseType);
    event ContractUpgraded(address indexed newImplementation, uint256 version);
    event TimePeriodsSet(uint256 sevenMonthsTime, uint256 oneYearTime);
    /// @custom:oz-upgrades-unsafe-allow constructor

    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract (replaces constructor for upgradeable contracts)
     * @param initialOwner The address that will own the contract
     * @param tokenPrice_ The initial price per token in USDT
     * @param zktcAddress The address of the ZKTC token
     * @param zcwAddress The address of the ZCW contract
     * @dev This function can only be called once during deployment
     */
    function initialize(address initialOwner, uint256 tokenPrice_, address zktcAddress, address zcwAddress)
        public
        initializer
    {
        require(initialOwner != address(0), "Owner cannot be zero address");
        require(tokenPrice_ > 0, "Token price must be greater than zero");
        require(zktcAddress != address(0), "ZKTC address cannot be zero");
        require(zcwAddress != address(0), "ZCW address cannot be zero");

        __Ownable_init(initialOwner);
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        tokenPrice = tokenPrice_;
        zkToken = IERC20(zktcAddress);
        ZCW = zcwAddress;

        // Initialize pricing thresholds in proxy storage
        // These cannot rely on state variable initializers when using proxies
        incrementThreshold = 37500;
        threshold = 137500;

        // Grant roles to the owner
        _grantRole(RELEASER_ROLE, initialOwner);
        _grantRole(WALLET_SUPPLIER_ROLE, initialOwner);

        // Set time periods
        DCO_END_TIME = block.timestamp + 101 days;
        SEVEN_MONTHS = block.timestamp + 187 days;
        ONE_YEAR = block.timestamp + 342 days;
    }

    /**
     * @dev Sets a new wallet supplier address with WALLET_SUPPLIER_ROLE
     * @param walletSupplier The address to grant the wallet supplier role to
     * @dev Only callable by the contract owner
     * @dev Reverts if the provided address is the zero address
     */
    function setWalletSupplier(address walletSupplier) public onlyOwner {
        if (walletSupplier == address(0)) revert InvalidAddress();
        _grantRole(WALLET_SUPPLIER_ROLE, walletSupplier);
    }

    /**
     * @dev Sets the wallet addresses for different cryptocurrencies
     * @param btcAddress_ The Bitcoin wallet address
     * @param ethAddress_ The Ethereum wallet address
     * @param solAddress_ The Solana wallet address
     * @dev Only callable by addresses with WALLET_SUPPLIER_ROLE
     * @dev Updates the contract's stored wallet addresses for donations
     */
    function setWalletAddresses(string memory btcAddress_, address ethAddress_, string memory solAddress_)
        public
        onlyRole(WALLET_SUPPLIER_ROLE)
    {
        if (ethAddress_ == address(0)) revert InvalidWalletAddress();
        if (bytes(btcAddress_).length == 0) revert InvalidWalletAddress();
        if (bytes(solAddress_).length == 0) revert InvalidWalletAddress();

        btcAddress = btcAddress_;
        ethAddress = ethAddress_;
        solAddress = solAddress_;
    }

    /**
     * @dev Sets the token price for the DCO
     * @param newTokenPrice The new price per token in USDT
     * @dev Only callable by the contract owner
     * @dev Emits TokenPriceUpdated event with old and new prices
     * @dev Reverts if token price is zero
     */
    function setTokenPrice(uint256 newTokenPrice) public onlyRole(RELEASER_ROLE) {
        if (newTokenPrice == 0) revert TokenPriceMustBeGreaterThanZero();

        uint256 oldPrice = tokenPrice;
        tokenPrice = newTokenPrice;
        emit TokenPriceUpdated(oldPrice, newTokenPrice);
    }

    /**
     * @dev Sets the end time for the DCO (Donation Coin Offering)
     * @param newDCOEndTime The new end time as a Unix timestamp
     * @dev Only callable by the contract owner
     * @dev Emits DCOEndTimeUpdated event with old and new end times
     * @dev After this time, the DCO will no longer be active
     */
    function setDCOEndTime(uint256 newDCOEndTime) public onlyOwner {
        DCO_END_TIME = newDCOEndTime;
        emit DCOEndTimeUpdated(DCO_END_TIME, newDCOEndTime);
    }

    /**
     * @dev Injects additional tokens into the DCO supply
     * @param amount The amount of tokens to inject
     * @dev Only callable by the contract owner
     * @dev Transfers tokens from owner to contract using transferFrom
     * @dev Updates tokenRemaining and emits TokensInjected event
     * @dev Reverts if amount is zero or transfer fails
     */
    function injectSupply(uint256 amount) public onlyOwner {
        if (amount == 0) revert AmountMustBeGreaterThanZero();

        zkToken.safeTransferFrom(msg.sender, address(this), amount);

        emit TokensInjected(amount, zkToken.balanceOf(address(this)));
    }

    /**
     * @dev Grants RELEASER_ROLE to a new address
     * @param releaser The address to grant the releaser role to
     * @dev Only callable by the contract owner
     * @dev Emits ReleaserAdded event
     */
    function addReleaser(address releaser) public onlyOwner {
        _grantRole(RELEASER_ROLE, releaser);
        emit ReleaserAdded(releaser);
    }

    /**
     * @dev Revokes RELEASER_ROLE from an address
     * @param releaser The address to revoke the releaser role from
     * @dev Only callable by the contract owner
     * @dev Emits ReleaserRemoved event
     */
    function removeReleaser(address releaser) public onlyOwner {
        _revokeRole(RELEASER_ROLE, releaser);
        emit ReleaserRemoved(releaser);
    }

    /**
     * @dev Returns the current token price
     * @return The current price per token in wei
     */
    function getTokenPrice() public view returns (uint256) {
        return tokenPrice;
    }

    /**
     * @dev Returns the remaining tokens available for sale
     * @return The number of tokens remaining in the DCO
     */
    function getTokenRemaining() public view returns (uint256) {
        return getAvailableForWithdrawal();
    }

    /**
     * @dev Returns the total number of tokens sold so far
     * @return The total number of tokens sold
     */
    function getTokenSold() public view returns (uint256) {
        return tokenSold;
    }

    /**
     * @dev Returns a quote for how many tokens would be received for a given USDT amount
     * @param usdtAmount The amount of USDT to calculate the quote for
     * @return tokensToReceive The number of tokens that would be received
     * @return donatedTokens The number of tokens that would be received for donation
     * @dev Calculates tokens based on current token price
     * @dev Returns 0 if USDT amount is 0 or if no tokens are available
     */
    function getQuote(uint256 usdtAmount, uint256 donationAmount)
        public
        view
        returns (uint256 tokensToReceive, uint256 donatedTokens)
    {
        if (usdtAmount == 0 && donationAmount == 0) {
            return (0, 0);
        }

        if (tokenPrice == 0) revert InvalidTokenPrice();

        tokensToReceive = (usdtAmount * 10 ** 18) / tokenPrice;
        donatedTokens = (donationAmount * 10 ** 18) / tokenPrice;

        if (usdtAmount == 0) {
            return (0, donatedTokens);
        }

        uint256 availableTokens = zkToken.balanceOf(address(this)) - totalDonations;

        if (availableTokens == 0) {
            return (0, donatedTokens);
        }
        // Ensure we don't return more tokens than available
        if (tokensToReceive + donatedTokens > availableTokens) {
            tokensToReceive = availableTokens - donatedTokens;
        }

        return (tokensToReceive, donatedTokens);
    }

    /**
     * @dev Locks tokens for the buyer based on the amount of USDT sent
     * @param amount The amount of USDT sent for token purchase
     * @param buyer The address of the buyer
     * @param donationAmount The amount of USDT sent for donation
     * @dev Only callable by addresses with RELEASER_ROLE
     * @dev Calculates tokens to buy based on current price
     * @dev Locks tokens for staged release (50% after 7 months, 50% after 1 year)
     * @dev Reverts if amount is zero or insufficient tokens available
     */
    function releaseZKTC(uint256 amount, address buyer, uint256 donationAmount)
        public
        onlyRole(RELEASER_ROLE)
        nonReentrant
    {
        if (block.timestamp > DCO_END_TIME) revert DCONotActive();
        if (amount == 0 && donationAmount == 0) revert AmountMustBeGreaterThanZero();
        if (buyer == address(0)) revert InvalidAddress();

        uint256 tokensToBuy = (amount * 10 ** 18) / tokenPrice;
        uint256 donation = (donationAmount * 10 ** 18) / tokenPrice;

        if (zkToken.balanceOf(address(this)) == 0) revert NoTokensRemaining();
        if (getAvailableForWithdrawal() < tokensToBuy + donation) revert InsufficientTokens();

        tokenSold += tokensToBuy + donation;

        totalUsdGathered += amount + donationAmount;

        while ((totalUsdGathered / 1000000) >= threshold) {
            tokenPrice += 1000;
            threshold += incrementThreshold;
            emit PriceThresholdUpdated(threshold, tokenPrice);
            if (tokenPrice == 7000) {
                threshold -= incrementThreshold;
                incrementThreshold = 325000;
                threshold += incrementThreshold;
                emit PriceThresholdUpdated(threshold, tokenPrice);
            }
            if (tokenPrice == 8000) {
                threshold -= incrementThreshold;
                incrementThreshold = 350000;
                threshold += incrementThreshold;
                emit PriceThresholdUpdated(threshold, tokenPrice);
            }
            if (tokenPrice == 11000) {
                threshold -= incrementThreshold;
                incrementThreshold = 400000;
                threshold += incrementThreshold;
                emit PriceThresholdUpdated(threshold, tokenPrice);
            }
        }

        // Lock tokens for staged release instead of direct transfer
        if (tokensToBuy > 0) {
            _lockTokensForUser(buyer, tokensToBuy);
            emit TokensReleased(buyer, tokensToBuy, block.timestamp);
        }

        if (donation > 0) {
            totalDonations += donation;
            emit DonationMade(buyer, donation, block.timestamp);
        }
    }

    /**
     * @dev Returns the amount of tokens available for withdrawal by owner
     * @return The amount of tokens that can be withdrawn (excludes locked tokens)
     */
    function getAvailableForWithdrawal() public view returns (uint256) {
        uint256 totalLocked = getTotalLockedTokens();
        return zkToken.balanceOf(address(this)) - totalDonations - totalLocked;
    }

    function updatePriceThresholds(uint256 incrementThreshold_) public onlyRole(RELEASER_ROLE) {
        if (incrementThreshold_ == 0) revert InvalidIncrementThreshold();
        incrementThreshold = incrementThreshold_;
    }

    /**
     * @dev Returns the total amount of tokens locked across all users
     * @return The total amount of locked tokens that cannot be withdrawn by owner
     * @dev This represents all tokens that have been sold and locked for users
     * @dev These tokens can only be withdrawn by their respective users after lock periods
     */
    function getTotalLockedTokens() public view returns (uint256) {
        // All sold tokens are locked for users, minus donations which are separate
        return tokenSold;
    }

    /**
     * @dev Transfers all accumulated donations to the ZCW (Zakat Charity Wallet) address
     * @dev Only callable by addresses with RELEASER_ROLE
     * @dev Protected by nonReentrant modifier to prevent reentrancy attacks
     * @dev Transfers all totalDonations to the ZCW address and resets the counter
     * @dev Emits ZCWDonated event with the amount and timestamp
     * @dev Reverts if no donations have been made
     */
    function DonateToZCW() external onlyRole(RELEASER_ROLE) nonReentrant {
        if (totalDonations == 0) revert NoDonationsMade();
        zkToken.safeTransfer(ZCW, totalDonations);
        totalDonations = 0;
        emit ZCWDonated(totalDonations, block.timestamp);
    }

    function UpdateAllocations(address user, uint256 amount) public onlyRole(RELEASER_ROLE) {
        userLockedTokens[user].totalAmount = 0;
        _lockTokensForUser(user, (amount * 10 ** 18));
    }
    /**
     * @dev Updates the ZCW (Zakat Charity Wallet) address for donations
     * @param newZCW The new ZCW address to receive donations
     * @dev Only callable by the contract owner
     * @dev Reverts if the provided address is the zero address
     * @dev This address will receive all donations when DonateToZCW is called
     */

    function updateZCW(address newZCW) external onlyOwner {
        if (newZCW == address(0)) revert InvalidAddress();
        ZCW = newZCW;
    }

    function updateThreshold(uint256 _threshold) external onlyRole(RELEASER_ROLE) {
        threshold = _threshold;
    }
    /**
     * @dev Returns the amount of tokens donated in DCO till now
     * @return The amount of tokens that can be donated
     */

    function getTotalDonations() public view returns (uint256) {
        return totalDonations;
    }

    /**
     * @dev Internal function to lock tokens for a user with staged release
     * @param user The address of the user to lock tokens for
     * @param amount The amount of tokens to lock
     * @dev Splits tokens 50/50 for 7-month and 1-year releases
     */
    function _lockTokensForUser(address user, uint256 amount) internal {
        if (user == address(0)) revert InvalidAddress();
        if (amount == 0) revert AmountMustBeGreaterThanZero();

        LockedTokens storage userLock = userLockedTokens[user];

        // If user already has locked tokens, add to existing amount
        if (userLock.totalAmount > 0) {
            // Check for overflow protection
            if (userLock.totalAmount > type(uint256).max - amount) revert OverflowDetected();
            userLock.totalAmount += amount;
            uint256 halfAmount = amount / 2;

            // Check for overflow in sevenMonthAmount
            if (userLock.sevenMonthAmount > type(uint256).max - halfAmount) revert OverflowDetected();
            userLock.sevenMonthAmount += halfAmount;

            // Check for overflow in oneYearAmount
            uint256 remainingAmount = amount - halfAmount;
            if (userLock.oneYearAmount > type(uint256).max - remainingAmount) revert OverflowDetected();
            userLock.oneYearAmount += remainingAmount;
        } else {
            // First time locking tokens for this user
            userLock.totalAmount = amount;
            uint256 halfAmount = amount / 2;
            userLock.sevenMonthAmount = halfAmount;
            userLock.oneYearAmount = amount - halfAmount;
            userLock.lockTimestamp = block.timestamp;
        }

        emit TokensLocked(user, amount, block.timestamp);
    }

    function updateUsdtGathered(uint256 newUsdtGathered) public onlyRole(RELEASER_ROLE) {
        totalUsdGathered = newUsdtGathered;
    }

    /**
     * @dev Allows users to withdraw their locked tokens based on release schedule
     * @dev Users can withdraw 50% after 7 months and remaining 50% after 1 year
     * @dev Only callable by the token holder
     */
    function withdraw() external nonReentrant {
        address user = msg.sender;
        LockedTokens storage userLock = userLockedTokens[user];

        if (userLock.totalAmount == 0) revert NoTokensToWithdraw();

        uint256 totalWithdrawable = 0;
        uint256 currentTime = block.timestamp;

        // Check if 7-month release is available
        if (currentTime >= SEVEN_MONTHS) {
            uint256 sevenMonthAvailable = userLock.sevenMonthAmount - userLock.sevenMonthClaimed;
            if (sevenMonthAvailable > 0) {
                // Check for underflow protection
                if (userLock.sevenMonthClaimed > userLock.sevenMonthAmount) revert UnderflowDetected();
                totalWithdrawable += sevenMonthAvailable;
                userLock.sevenMonthClaimed = userLock.sevenMonthAmount;
            }
        }

        // Check if 1-year release is available
        if (currentTime >= ONE_YEAR) {
            uint256 oneYearAvailable = userLock.oneYearAmount - userLock.oneYearClaimed;
            if (oneYearAvailable > 0) {
                // Check for underflow protection
                if (userLock.oneYearClaimed > userLock.oneYearAmount) revert UnderflowDetected();
                totalWithdrawable += oneYearAvailable;
                userLock.oneYearClaimed = userLock.oneYearAmount;
            }
        }

        if (totalWithdrawable == 0) {
            if (currentTime < SEVEN_MONTHS) {
                revert SevenMonthReleaseNotAvailable();
            } else if (currentTime < ONE_YEAR) {
                revert OneYearReleaseNotAvailable();
            }
        }

        // Additional validation for totalWithdrawable
        if (totalWithdrawable > zkToken.balanceOf(address(this))) revert InsufficientBalance();

        // Transfer tokens to user
        zkToken.safeTransfer(user, totalWithdrawable);

        emit TokensWithdrawn(user, totalWithdrawable, currentTime >= userLock.lockTimestamp + ONE_YEAR ? 2 : 1);
    }

    /**
     * @dev Returns the locked token information for a specific user
     * @param user The address of the user to check
     * @return totalAmount Total amount of tokens locked for the user
     * @return sevenMonthAmount Amount available after 7 months
     * @return oneYearAmount Amount available after 1 year
     * @return sevenMonthClaimed Amount already claimed from 7-month release
     * @return oneYearClaimed Amount already claimed from 1-year release
     * @return lockTimestamp When the tokens were first locked
     */
    function getUserLockedTokens(address user)
        external
        view
        returns (
            uint256 totalAmount,
            uint256 sevenMonthAmount,
            uint256 oneYearAmount,
            uint256 sevenMonthClaimed,
            uint256 oneYearClaimed,
            uint256 lockTimestamp
        )
    {
        if (user == address(0)) revert InvalidAddress();

        LockedTokens memory userLock = userLockedTokens[user];
        return (
            userLock.totalAmount,
            userLock.sevenMonthAmount,
            userLock.oneYearAmount,
            userLock.sevenMonthClaimed,
            userLock.oneYearClaimed,
            userLock.lockTimestamp
        );
    }

    /**
     * @dev Returns the amount of tokens a user can currently withdraw
     * @param user The address of the user to check
     * @return withdrawableAmount The amount of tokens currently available for withdrawal
     */
    function getWithdrawableAmount(address user) external view returns (uint256 withdrawableAmount) {
        if (user == address(0)) revert InvalidAddress();

        LockedTokens memory userLock = userLockedTokens[user];

        if (userLock.totalAmount == 0) {
            return 0;
        }

        uint256 currentTime = block.timestamp;
        withdrawableAmount = 0;

        // Check 7-month release
        if (currentTime >= userLock.lockTimestamp + SEVEN_MONTHS) {
            if (userLock.sevenMonthClaimed > userLock.sevenMonthAmount) revert UnderflowDetected();
            withdrawableAmount += userLock.sevenMonthAmount - userLock.sevenMonthClaimed;
        }

        // Check 1-year release
        if (currentTime >= userLock.lockTimestamp + ONE_YEAR) {
            if (userLock.oneYearClaimed > userLock.oneYearAmount) revert UnderflowDetected();
            withdrawableAmount += userLock.oneYearAmount - userLock.oneYearClaimed;
        }

        return withdrawableAmount;
    }

    /**
     * @dev Returns the time remaining until the next release for a user
     * @param user The address of the user to check
     * @return timeUntilSevenMonth Time until 7-month release (0 if already available)
     * @return timeUntilOneYear Time until 1-year release (0 if already available)
     */
    function getTimeUntilRelease(address user)
        external
        view
        returns (uint256 timeUntilSevenMonth, uint256 timeUntilOneYear)
    {
        if (user == address(0)) revert InvalidAddress();

        LockedTokens memory userLock = userLockedTokens[user];

        if (userLock.totalAmount == 0) {
            return (0, 0);
        }

        uint256 currentTime = block.timestamp;
        uint256 sevenMonthTime = userLock.lockTimestamp + SEVEN_MONTHS;
        uint256 oneYearTime = userLock.lockTimestamp + ONE_YEAR;

        // Check for underflow protection
        if (currentTime > sevenMonthTime) {
            timeUntilSevenMonth = 0;
        } else {
            timeUntilSevenMonth = sevenMonthTime - currentTime;
        }

        if (currentTime > oneYearTime) {
            timeUntilOneYear = 0;
        } else {
            timeUntilOneYear = oneYearTime - currentTime;
        }

        return (timeUntilSevenMonth, timeUntilOneYear);
    }

    /**
     * @dev Withdraws a specific amount of ZKTC from the contract
     * @param amount The amount of ZKTC to withdraw
     * @dev Only callable by the contract owner after DCO_END_TIME
     * @dev Cannot withdraw locked tokens - only available tokens
     * @dev Transfers ZKTC to the owner and emits TokensWithdrawn event
     * @dev Reverts if amount is zero, insufficient balance, or transfer fails
     */
    function withdrawParticularZKTC(uint256 amount) public onlyOwner nonReentrant {
        if (block.timestamp < DCO_END_TIME) revert CannotWithdrawBeforeGlobalRelease();
        if (amount == 0) revert AmountMustBeGreaterThanZero();
        if (amount > type(uint256).max / 2) revert InvalidAmount(); // Prevent overflow

        uint256 availableBalance = getAvailableForWithdrawal();
        if (amount > availableBalance) revert InsufficientBalance();
        if (amount > zkToken.balanceOf(address(this))) revert InsufficientBalance();

        zkToken.safeTransfer(msg.sender, amount);
        emit TokensWithdrawn(msg.sender, amount);
    }

    /**
     * @dev Withdraws all available tokens from the contract
     * @dev Only callable by the contract owner after DCO_END_TIME
     * @dev Cannot withdraw locked tokens - only available tokens
     * @dev Transfers all available tokens to the owner and emits AllTokensWithdrawn event
     * @dev Reverts if no balance or transfer fails
     */
    function withdrawAllZKTC() public onlyOwner nonReentrant {
        if (block.timestamp < DCO_END_TIME) revert CannotWithdrawBeforeGlobalRelease();

        uint256 availableBalance = getAvailableForWithdrawal();
        if (availableBalance == 0) revert NoBalanceToWithdraw();
        if (availableBalance > zkToken.balanceOf(address(this))) revert InsufficientBalance();

        zkToken.safeTransfer(msg.sender, availableBalance);

        emit AllTokensWithdrawn(msg.sender, availableBalance);
    }

    function setTimePeriods(uint256 sevenMonthsTime_, uint256 oneYearTime_) public onlyRole(RELEASER_ROLE) {
        SEVEN_MONTHS = sevenMonthsTime_;
        ONE_YEAR = oneYearTime_;
        emit TimePeriodsSet(sevenMonthsTime_, oneYearTime_);
    }

    function getTimePeriods() public view returns (uint256 sevenMonthsTime, uint256 oneYearTime) {
        return (SEVEN_MONTHS, ONE_YEAR);
    }

    function Status() public pure returns (string memory) {
        return "Multisig Worked";
    }

    /**
     * @notice Get the current contract version
     * @return The version number of this contract implementation
     */
    function getVersion() external pure returns (uint256) {
        return VERSION;
    }

    /**
     * @notice Check if contract has been initialized
     * @return True if contract is initialized, false otherwise
     */
    function isInitialized() external view returns (bool) {
        return _getInitializedVersion() > 0;
    }

    /**
     * @notice Authorize contract upgrades (required by UUPS)
     * @param newImplementation Address of the new implementation contract
     * @dev Only the owner can authorize upgrades
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // Additional upgrade authorization logic can be added here
        // For example: time delays, multi-sig requirements, etc.

        emit ContractUpgraded(newImplementation, VERSION);
    }

    // Prevent direct implementation calls
    receive() external payable {
        revert("Direct ETH transfers not allowed");
    }

    fallback() external payable {
        revert("Function not found");
    }
}
