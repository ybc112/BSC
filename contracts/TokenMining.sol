// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TokenMining
 * @dev 代币质押挖矿合约
 * - 总量3000万代币
 * - 每日0.5%收益，挖完为止
 * - 不参与推荐奖励分配
 */
contract TokenMining is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public stakingToken;   // 质押代币
    IERC20 public rewardToken;    // 奖励代币（可以是同一个）

    // 挖矿参数
    uint256 public constant TOTAL_REWARDS = 30_000_000 * 1e18;  // 3000万代币
    uint256 public constant DAILY_RATE = 50;                     // 0.5% = 50/10000
    uint256 public constant RATE_BASE = 10000;
    uint256 public constant SECONDS_PER_DAY = 86400;

    uint256 public totalDistributed;
    uint256 public totalStaked;
    uint256 public startTime;
    bool public miningEnded;

    struct UserInfo {
        uint256 amount;           // 质押数量
        uint256 lastUpdateTime;   // 上次更新时间
        uint256 pendingRewards;   // 待领取奖励
        uint256 totalClaimed;     // 已领取总量
    }

    mapping(address => UserInfo) public userInfo;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Claim(address indexed user, uint256 amount);
    event MiningEnded(uint256 totalDistributed);

    constructor(
        address _stakingToken,
        address _rewardToken,
        uint256 _startTime
    ) Ownable(msg.sender) {
        require(_stakingToken != address(0), "Invalid staking token");
        require(_rewardToken != address(0), "Invalid reward token");
        require(_startTime >= block.timestamp, "Start time must be future");

        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        startTime = _startTime;
    }

    /**
     * @dev 质押代币
     */
    function deposit(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(block.timestamp >= startTime, "Mining not started");
        require(!miningEnded, "Mining ended");

        UserInfo storage user = userInfo[msg.sender];

        // 结算已有收益
        if (user.amount > 0) {
            uint256 pending = _calculateReward(msg.sender);
            user.pendingRewards += pending;
        }

        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        user.amount += _amount;
        user.lastUpdateTime = block.timestamp;
        totalStaked += _amount;

        emit Deposit(msg.sender, _amount);
    }

    /**
     * @dev 解除质押
     */
    function withdraw(uint256 _amount) external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, "Insufficient balance");

        // 结算收益
        uint256 pending = _calculateReward(msg.sender);
        user.pendingRewards += pending;

        if (_amount > 0) {
            user.amount -= _amount;
            totalStaked -= _amount;
            stakingToken.safeTransfer(msg.sender, _amount);
        }

        user.lastUpdateTime = block.timestamp;

        emit Withdraw(msg.sender, _amount);
    }

    /**
     * @dev 领取收益
     */
    function claim() external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];

        uint256 pending = _calculateReward(msg.sender);
        uint256 totalPending = user.pendingRewards + pending;

        require(totalPending > 0, "No rewards to claim");

        // 检查是否超出总量
        if (totalDistributed + totalPending >= TOTAL_REWARDS) {
            totalPending = TOTAL_REWARDS - totalDistributed;
            miningEnded = true;
            emit MiningEnded(TOTAL_REWARDS);
        }

        user.pendingRewards = 0;
        user.lastUpdateTime = block.timestamp;
        user.totalClaimed += totalPending;
        totalDistributed += totalPending;

        rewardToken.safeTransfer(msg.sender, totalPending);

        emit Claim(msg.sender, totalPending);
    }


    /**
     * @dev 计算用户收益
     */
    function _calculateReward(address _user) internal view returns (uint256) {
        UserInfo storage user = userInfo[_user];

        if (user.amount == 0 || user.lastUpdateTime == 0) {
            return 0;
        }

        if (miningEnded) {
            return 0;
        }

        uint256 duration = block.timestamp - user.lastUpdateTime;
        // 每日0.5%收益 = amount * 0.5% * days
        // 使用更高精度计算：先乘后除
        uint256 reward = user.amount * DAILY_RATE * duration / (RATE_BASE * SECONDS_PER_DAY);

        // 检查是否超出剩余奖励
        uint256 remaining = TOTAL_REWARDS - totalDistributed;
        if (reward > remaining) {
            reward = remaining;
        }

        return reward;
    }

    // ============ 查询函数 ============

    /**
     * @dev 查询待领取收益
     */
    function pendingReward(address _user) external view returns (uint256) {
        UserInfo storage user = userInfo[_user];
        uint256 pending = _calculateReward(_user);
        uint256 totalPending = user.pendingRewards + pending;

        // 检查是否超出剩余奖励
        uint256 remaining = TOTAL_REWARDS - totalDistributed;
        if (totalPending > remaining) {
            totalPending = remaining;
        }

        return totalPending;
    }

    /**
     * @dev 查询用户信息
     */
    function getUserInfo(address _user) external view returns (
        uint256 stakedAmount,
        uint256 pendingRewards,
        uint256 totalClaimed,
        uint256 dailyReward
    ) {
        UserInfo storage user = userInfo[_user];
        stakedAmount = user.amount;
        pendingRewards = user.pendingRewards + _calculateReward(_user);
        totalClaimed = user.totalClaimed;
        dailyReward = user.amount * DAILY_RATE / RATE_BASE;
    }

    /**
     * @dev 获取挖矿状态
     */
    function getMiningStatus() external view returns (
        uint256 _totalStaked,
        uint256 _totalDistributed,
        uint256 _remainingRewards,
        bool _miningEnded,
        uint256 _startTime
    ) {
        return (
            totalStaked,
            totalDistributed,
            TOTAL_REWARDS - totalDistributed,
            miningEnded,
            startTime
        );
    }

    /**
     * @dev 计算预估APY
     */
    function getAPY() external pure returns (uint256) {
        // 每日0.5% * 365天 = 182.5% APY
        return DAILY_RATE * 365;
    }

    // ============ 管理员功能 ============

    /**
     * @dev 紧急提取（仅限owner）
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(owner(), _amount);
    }
}
