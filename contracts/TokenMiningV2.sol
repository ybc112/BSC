// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TokenMiningV2
 * @dev 代币质押挖矿合约 V2
 *
 * 随进随出：0.5% 日收益，挖完为止
 * 不参与推荐和团队奖励分配
 */
contract TokenMiningV2 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public stakingToken;   // 质押代币
    IERC20 public rewardToken;    // 奖励代币

    // 挖矿参数
    uint256 public totalRewards = 30_000_000 * 1e18;  // 3000万代币
    uint256 public constant RATE_BASE = 10000;
    uint256 public constant SECONDS_PER_DAY = 86400;
    uint256 public dailyRate = 50;  // 0.5% = 50/10000

    uint256 public totalDistributed;
    uint256 public totalStaked;
    uint256 public startTime;
    bool public miningEnded;

    // 用户信息
    struct UserInfo {
        uint256 amount;           // 质押数量
        uint256 lastUpdateTime;   // 上次更新时间
        uint256 pendingRewards;   // 待领取奖励
        uint256 totalClaimed;     // 已领取总量
    }

    mapping(address => UserInfo) public userInfo;

    // 事件
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Claim(address indexed user, uint256 amount);
    event DailyRateUpdated(uint256 oldRate, uint256 newRate);
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
     * @dev 质押代币（随进随出，无锁仓）
     * @param _amount 质押数量
     */
    function deposit(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(block.timestamp >= startTime, "Mining not started");
        require(!miningEnded, "Mining ended");

        UserInfo storage user = userInfo[msg.sender];

        // 先结算之前的收益
        if (user.amount > 0) {
            uint256 pending = _calculateReward(msg.sender);
            user.pendingRewards += pending;
        }

        // 转入代币
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        // 更新用户信息
        user.amount += _amount;
        user.lastUpdateTime = block.timestamp;
        totalStaked += _amount;

        emit Deposit(msg.sender, _amount);
    }

    /**
     * @dev 解除质押（随时可取）
     * @param _amount 提取数量
     */
    function withdraw(uint256 _amount) external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, "Insufficient balance");
        require(_amount > 0, "Amount must be > 0");

        // 先结算收益
        uint256 pending = _calculateReward(msg.sender);
        uint256 totalPending = user.pendingRewards + pending;

        // 更新状态
        user.amount -= _amount;
        user.lastUpdateTime = block.timestamp;
        user.pendingRewards = 0;
        totalStaked -= _amount;

        // 转出本金
        stakingToken.safeTransfer(msg.sender, _amount);

        // 发放收益
        if (totalPending > 0) {
            _distributeReward(msg.sender, totalPending);
            user.totalClaimed += totalPending;
            emit Claim(msg.sender, totalPending);
        }

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

        user.pendingRewards = 0;
        user.lastUpdateTime = block.timestamp;

        _distributeReward(msg.sender, totalPending);
        user.totalClaimed += totalPending;

        emit Claim(msg.sender, totalPending);
    }

    /**
     * @dev 计算用户收益
     */
    function _calculateReward(address _user) internal view returns (uint256) {
        UserInfo storage user = userInfo[_user];

        if (user.amount == 0) {
            return 0;
        }

        if (miningEnded) {
            return 0;
        }

        uint256 duration = block.timestamp - user.lastUpdateTime;

        // 收益 = 本金 * 日收益率 * 天数
        uint256 reward = user.amount * dailyRate * duration / (RATE_BASE * SECONDS_PER_DAY);

        // 检查是否超出剩余奖励
        uint256 remaining = totalRewards - totalDistributed;
        if (reward > remaining) {
            reward = remaining;
        }

        return reward;
    }

    /**
     * @dev 分发奖励
     */
    function _distributeReward(address _user, uint256 _amount) internal {
        // 检查是否超出总量
        if (totalDistributed + _amount >= totalRewards) {
            _amount = totalRewards - totalDistributed;
            miningEnded = true;
            emit MiningEnded(totalRewards);
        }

        if (_amount > 0) {
            totalDistributed += _amount;
            rewardToken.safeTransfer(_user, _amount);
        }
    }

    // ============ 查询函数 ============

    /**
     * @dev 查询用户待领取收益
     */
    function pendingReward(address _user) external view returns (uint256) {
        UserInfo storage user = userInfo[_user];
        uint256 pending = _calculateReward(_user);
        return user.pendingRewards + pending;
    }

    /**
     * @dev 获取用户信息
     */
    function getUserInfo(address _user) external view returns (
        uint256 stakedAmount,
        uint256 _pendingRewards,
        uint256 _totalClaimed,
        uint256 _dailyReward
    ) {
        UserInfo storage user = userInfo[_user];
        stakedAmount = user.amount;
        _pendingRewards = user.pendingRewards + _calculateReward(_user);
        _totalClaimed = user.totalClaimed;
        _dailyReward = user.amount * dailyRate / RATE_BASE;
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
            totalRewards - totalDistributed,
            miningEnded,
            startTime
        );
    }

    /**
     * @dev 获取年化收益率 (APY)
     */
    function getAPY() external view returns (uint256) {
        return dailyRate * 365;  // 0.5% * 365 = 182.5%
    }

    // ============ 管理员功能 ============

    /**
     * @dev 设置日收益率
     */
    function setDailyRate(uint256 _dailyRate) external onlyOwner {
        require(_dailyRate <= 1000, "Rate too high");  // 最高10%
        uint256 oldRate = dailyRate;
        dailyRate = _dailyRate;
        emit DailyRateUpdated(oldRate, _dailyRate);
    }

    /**
     * @dev 设置总奖励
     */
    function setTotalRewards(uint256 _totalRewards) external onlyOwner {
        require(_totalRewards > totalDistributed, "Must be greater than distributed");
        totalRewards = _totalRewards;
    }

    /**
     * @dev 紧急提取
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(owner(), _amount);
    }
}
