// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TokenMiningV3
 * @dev 代币质押挖矿合约 V3
 *
 * 基于 TokenMiningV2 升级，新增推荐奖励系统：
 * - 保留多档锁仓收益率（随进随出/3个月/6个月/12个月）
 * - 新增推荐人绑定机制（无需推荐人质押）
 * - 支持最多20代推荐奖励，Owner可配置代数和每代比例
 * - 推荐奖励从3000万矿池中出（与挖矿收益共用）
 * - 用户claim时触发推荐奖励累积到推荐人账上
 * - 推荐人自己 claimReferralRewards() 领取
 */
contract TokenMiningV3 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public stakingToken;   // 质押代币
    IERC20 public rewardToken;    // 奖励代币

    // 挖矿参数
    uint256 public totalRewards = 30_000_000 * 1e18;  // 3000万代币
    uint256 public constant RATE_BASE = 10000;
    uint256 public constant SECONDS_PER_DAY = 86400;

    uint256 public totalDistributed;  // 已分发总量（挖矿 + 推荐奖励）
    uint256 public totalStaked;
    uint256 public startTime;
    bool public miningEnded;

    // 用户最大活跃质押数量限制（防止Gas过高）
    uint256 public constant MAX_ACTIVE_STAKES = 50;

    // 推荐系统参数
    uint256 public constant MAX_REFERRAL_LEVELS = 20;    // 最多20代推荐
    uint256 public constant MAX_REFERRAL_DEPTH = 50;     // 防循环检测最大深度
    uint256 public constant MAX_DIRECT_REFERRALS = 500;  // 直推人数上限

    // 推荐奖励比例数组（基数10000，例如 1000 = 10%）
    uint256[] public referralRates;

    // 推荐奖励统计
    uint256 public totalReferralDistributed;

    // 锁仓档位枚举
    enum LockTier { FLEXIBLE, THREE_MONTHS, SIX_MONTHS, TWELVE_MONTHS }

    // 锁仓配置
    struct TierConfig {
        uint256 duration;    // 锁仓时长（秒）
        uint256 dailyRate;   // 日收益率（基数10000）
    }

    // 各档位配置
    mapping(LockTier => TierConfig) public tierConfigs;

    // 用户质押记录（支持多笔）
    struct StakeRecord {
        uint256 amount;           // 质押数量
        uint256 lastUpdateTime;   // 上次更新时间
        uint256 pendingRewards;   // 待领取奖励
        uint256 unlockTime;       // 解锁时间
        LockTier tier;            // 锁仓档位
        bool active;              // 是否有效
    }

    // 用户信息
    struct UserInfo {
        uint256 totalStaked;      // 总质押量
        uint256 totalClaimed;     // 已领取总量（挖矿收益）
        uint256 stakeCount;       // 质押记录数
        uint256 activeStakeCount; // 活跃质押数量
        // 推荐相关
        address referrer;         // 推荐人
        uint256 directReferrals;  // 直推人数
        uint256 referralRewards;  // 待领取推荐奖励
        uint256 totalReferralClaimed; // 已领取推荐奖励总量
    }

    mapping(address => UserInfo) public userInfo;
    mapping(address => mapping(uint256 => StakeRecord)) public stakeRecords;
    mapping(address => bool) public hasReferrer;
    mapping(address => address[]) public referrals;  // 直推列表

    // 事件
    event Deposit(address indexed user, uint256 indexed stakeId, uint256 amount, LockTier tier, uint256 unlockTime);
    event Withdraw(address indexed user, uint256 indexed stakeId, uint256 amount);
    event Claim(address indexed user, uint256 indexed stakeId, uint256 amount);
    event ClaimAll(address indexed user, uint256 amount);
    event ReferrerSet(address indexed user, address indexed referrer);
    event ReferralReward(address indexed user, address indexed referrer, uint256 level, uint256 amount);
    event ClaimReferralRewards(address indexed user, uint256 amount);
    event ReferralRatesUpdated(uint256[] rates);
    event TierConfigUpdated(LockTier tier, uint256 duration, uint256 dailyRate);
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

        // 初始化锁仓配置
        tierConfigs[LockTier.FLEXIBLE] = TierConfig({
            duration: 0,
            dailyRate: 40  // 0.4% = 40/10000
        });

        tierConfigs[LockTier.THREE_MONTHS] = TierConfig({
            duration: 90 days,
            dailyRate: 60  // 0.6% = 60/10000
        });

        tierConfigs[LockTier.SIX_MONTHS] = TierConfig({
            duration: 180 days,
            dailyRate: 80  // 0.8% = 80/10000
        });

        tierConfigs[LockTier.TWELVE_MONTHS] = TierConfig({
            duration: 365 days,
            dailyRate: 100  // 1.0% = 100/10000
        });
    }

    // ============ 推荐系统 ============

    /**
     * @dev 设置推荐人（只能设置一次）
     * 无需推荐人质押，任何有效地址都可以作为推荐人
     */
    function setReferrer(address _referrer) external {
        require(!hasReferrer[msg.sender], "Referrer already set");
        require(_referrer != address(0), "Invalid referrer");
        require(_referrer != msg.sender, "Cannot refer yourself");
        require(userInfo[_referrer].directReferrals < MAX_DIRECT_REFERRALS, "Referrer has too many referrals");

        // 防止循环推荐
        require(!_isInReferralChain(_referrer, msg.sender), "Circular referral not allowed");

        userInfo[msg.sender].referrer = _referrer;
        hasReferrer[msg.sender] = true;
        referrals[_referrer].push(msg.sender);
        userInfo[_referrer].directReferrals++;

        emit ReferrerSet(msg.sender, _referrer);
    }

    /**
     * @dev 检查target是否在user的推荐链上游
     */
    function _isInReferralChain(address _user, address _target) internal view returns (bool) {
        address current = userInfo[_user].referrer;
        uint256 depth = 0;

        while (current != address(0) && depth < MAX_REFERRAL_DEPTH) {
            if (current == _target) {
                return true;
            }
            current = userInfo[current].referrer;
            depth++;
        }
        return false;
    }

    /**
     * @dev 领取推荐奖励
     */
    function claimReferralRewards() external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        uint256 amount = user.referralRewards;
        require(amount > 0, "No referral rewards");

        require(rewardToken.balanceOf(address(this)) >= amount, "Insufficient reward balance");

        user.referralRewards = 0;
        user.totalReferralClaimed += amount;
        rewardToken.safeTransfer(msg.sender, amount);

        emit ClaimReferralRewards(msg.sender, amount);
    }

    /**
     * @dev 分配推荐奖励（从矿池中出）
     * @param _user 产生收益的用户
     * @param _rewardAmount 用户本次领取的挖矿收益
     * @return distributed 实际分配的推荐奖励总额
     */
    function _distributeReferralRewards(address _user, uint256 _rewardAmount) internal returns (uint256 distributed) {
        if (referralRates.length == 0) return 0;

        uint256 remaining = totalRewards > totalDistributed ? totalRewards - totalDistributed : 0;
        if (remaining == 0) return 0;

        address current = userInfo[_user].referrer;
        distributed = 0;

        for (uint256 i = 0; i < referralRates.length && current != address(0); i++) {
            if (referralRates[i] > 0) {
                uint256 reward = _rewardAmount * referralRates[i] / RATE_BASE;

                // 检查矿池剩余
                if (distributed + reward > remaining) {
                    reward = remaining - distributed;
                }

                if (reward > 0) {
                    userInfo[current].referralRewards += reward;
                    distributed += reward;
                    emit ReferralReward(_user, current, i + 1, reward);
                }

                if (distributed >= remaining) break;
            }

            current = userInfo[current].referrer;
        }

        if (distributed > 0) {
            totalDistributed += distributed;
            totalReferralDistributed += distributed;
        }

        return distributed;
    }

    // ============ 质押功能 ============

    /**
     * @dev 质押代币（选择锁仓档位）
     * @param _amount 质押数量
     * @param _tier 锁仓档位
     */
    function deposit(uint256 _amount, LockTier _tier) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(block.timestamp >= startTime, "Mining not started");
        require(!miningEnded, "Mining ended");

        UserInfo storage user = userInfo[msg.sender];
        require(user.activeStakeCount < MAX_ACTIVE_STAKES, "Too many active stakes");

        uint256 stakeId = user.stakeCount;

        TierConfig memory config = tierConfigs[_tier];
        uint256 unlockTime = block.timestamp + config.duration;

        stakeRecords[msg.sender][stakeId] = StakeRecord({
            amount: _amount,
            lastUpdateTime: block.timestamp,
            pendingRewards: 0,
            unlockTime: unlockTime,
            tier: _tier,
            active: true
        });

        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        user.totalStaked += _amount;
        user.stakeCount++;
        user.activeStakeCount++;
        totalStaked += _amount;

        emit Deposit(msg.sender, stakeId, _amount, _tier, unlockTime);
    }

    /**
     * @dev 解除质押（指定记录）
     * @param _stakeId 质押记录ID
     */
    function withdraw(uint256 _stakeId) external nonReentrant {
        StakeRecord storage record = stakeRecords[msg.sender][_stakeId];
        require(record.active, "Stake not active");
        require(record.amount > 0, "No stake found");
        require(block.timestamp >= record.unlockTime, "Still in lock period");

        // 先结算收益
        uint256 pending = _calculateReward(msg.sender, _stakeId);
        uint256 totalPending = record.pendingRewards + pending;

        uint256 amount = record.amount;

        // 更新状态
        record.amount = 0;
        record.pendingRewards = 0;
        record.active = false;

        UserInfo storage user = userInfo[msg.sender];
        user.totalStaked -= amount;
        user.activeStakeCount--;
        totalStaked -= amount;

        // 转出本金
        stakingToken.safeTransfer(msg.sender, amount);

        // 发放收益
        if (totalPending > 0) {
            uint256 actualReward = _distributeReward(msg.sender, totalPending);
            user.totalClaimed += actualReward;

            // 分配推荐奖励（从矿池出，基于用户实际领到的收益计算）
            _distributeReferralRewards(msg.sender, actualReward);

            emit Claim(msg.sender, _stakeId, actualReward);
        }

        emit Withdraw(msg.sender, _stakeId, amount);
    }

    /**
     * @dev 领取单笔质押的收益
     * @param _stakeId 质押记录ID
     */
    function claim(uint256 _stakeId) external nonReentrant {
        StakeRecord storage record = stakeRecords[msg.sender][_stakeId];
        require(record.active, "Stake not active");

        uint256 pending = _calculateReward(msg.sender, _stakeId);
        uint256 totalPending = record.pendingRewards + pending;

        require(totalPending > 0, "No rewards to claim");

        record.pendingRewards = 0;
        record.lastUpdateTime = block.timestamp;

        uint256 actualReward = _distributeReward(msg.sender, totalPending);

        UserInfo storage user = userInfo[msg.sender];
        user.totalClaimed += actualReward;

        // 分配推荐奖励（从矿池出，基于用户实际领到的收益计算）
        _distributeReferralRewards(msg.sender, actualReward);

        emit Claim(msg.sender, _stakeId, actualReward);
    }

    /**
     * @dev 领取所有质押的收益
     */
    function claimAll() external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        uint256 totalPending = 0;

        uint256 currentDistributed = totalDistributed;
        uint256 remaining = totalRewards > currentDistributed ? totalRewards - currentDistributed : 0;

        for (uint256 i = 0; i < user.stakeCount; i++) {
            StakeRecord storage record = stakeRecords[msg.sender][i];
            if (record.active && record.amount > 0) {
                uint256 pending = _calculateRewardWithRemaining(msg.sender, i, remaining);
                uint256 stakePending = record.pendingRewards + pending;

                if (stakePending > remaining) {
                    stakePending = remaining;
                }
                if (remaining >= stakePending) {
                    remaining -= stakePending;
                } else {
                    remaining = 0;
                }

                totalPending += stakePending;
                record.pendingRewards = 0;
                record.lastUpdateTime = block.timestamp;
            }
        }

        require(totalPending > 0, "No rewards to claim");

        uint256 actualReward = _distributeReward(msg.sender, totalPending);
        user.totalClaimed += actualReward;

        // 分配推荐奖励（从矿池出，基于用户实际领到的收益计算）
        _distributeReferralRewards(msg.sender, actualReward);

        emit ClaimAll(msg.sender, actualReward);
    }

    // ============ 内部函数 ============

    /**
     * @dev 计算单笔质押收益
     */
    function _calculateReward(address _user, uint256 _stakeId) internal view returns (uint256) {
        uint256 remaining = totalRewards - totalDistributed;
        return _calculateRewardWithRemaining(_user, _stakeId, remaining);
    }

    /**
     * @dev 计算单笔质押收益（带剩余奖励参数）
     */
    function _calculateRewardWithRemaining(address _user, uint256 _stakeId, uint256 _remaining) internal view returns (uint256) {
        StakeRecord storage record = stakeRecords[_user][_stakeId];

        if (record.amount == 0 || !record.active) {
            return 0;
        }

        if (miningEnded || _remaining == 0) {
            return 0;
        }

        uint256 duration = block.timestamp - record.lastUpdateTime;
        TierConfig memory config = tierConfigs[record.tier];

        uint256 reward = record.amount * config.dailyRate * duration / (RATE_BASE * SECONDS_PER_DAY);

        if (reward > _remaining) {
            reward = _remaining;
        }

        return reward;
    }

    /**
     * @dev 分发挖矿奖励
     * @return actualAmount 实际发放的金额
     */
    function _distributeReward(address _user, uint256 _amount) internal returns (uint256 actualAmount) {
        actualAmount = _amount;

        // 检查是否超出总量
        if (totalDistributed + _amount >= totalRewards) {
            actualAmount = totalRewards - totalDistributed;
            miningEnded = true;
            emit MiningEnded(totalRewards);
        }

        if (actualAmount > 0) {
            totalDistributed += actualAmount;
            rewardToken.safeTransfer(_user, actualAmount);
        }

        return actualAmount;
    }

    // ============ 查询函数 ============

    /**
     * @dev 查询单笔质押的待领取收益
     */
    function pendingReward(address _user, uint256 _stakeId) external view returns (uint256) {
        StakeRecord storage record = stakeRecords[_user][_stakeId];
        uint256 pending = _calculateReward(_user, _stakeId);
        return record.pendingRewards + pending;
    }

    /**
     * @dev 查询用户所有待领取收益
     */
    function pendingRewardAll(address _user) external view returns (uint256) {
        UserInfo storage user = userInfo[_user];
        uint256 totalPending = 0;

        for (uint256 i = 0; i < user.stakeCount; i++) {
            StakeRecord storage record = stakeRecords[_user][i];
            if (record.active && record.amount > 0) {
                uint256 pending = _calculateReward(_user, i);
                totalPending += record.pendingRewards + pending;
            }
        }

        return totalPending;
    }

    /**
     * @dev 获取用户所有质押记录
     */
    function getUserStakes(address _user) external view returns (
        uint256[] memory stakeIds,
        uint256[] memory amounts,
        uint256[] memory unlockTimes,
        LockTier[] memory tiers,
        uint256[] memory pendingRewards,
        bool[] memory actives
    ) {
        UserInfo storage user = userInfo[_user];
        uint256 count = user.stakeCount;

        stakeIds = new uint256[](count);
        amounts = new uint256[](count);
        unlockTimes = new uint256[](count);
        tiers = new LockTier[](count);
        pendingRewards = new uint256[](count);
        actives = new bool[](count);

        for (uint256 i = 0; i < count; i++) {
            StakeRecord storage record = stakeRecords[_user][i];
            stakeIds[i] = i;
            amounts[i] = record.amount;
            unlockTimes[i] = record.unlockTime;
            tiers[i] = record.tier;
            pendingRewards[i] = record.pendingRewards + _calculateReward(_user, i);
            actives[i] = record.active;
        }
    }

    /**
     * @dev 获取用户活跃质押数量
     */
    function getUserActiveStakeCount(address _user) external view returns (uint256 activeCount) {
        UserInfo storage user = userInfo[_user];
        for (uint256 i = 0; i < user.stakeCount; i++) {
            if (stakeRecords[_user][i].active) {
                activeCount++;
            }
        }
    }

    /**
     * @dev 获取单个质押记录详情
     */
    function getStakeRecord(address _user, uint256 _stakeId) external view returns (
        uint256 amount,
        uint256 unlockTime,
        LockTier tier,
        uint256 pending,
        bool active
    ) {
        StakeRecord storage record = stakeRecords[_user][_stakeId];
        amount = record.amount;
        unlockTime = record.unlockTime;
        tier = record.tier;
        pending = record.pendingRewards + _calculateReward(_user, _stakeId);
        active = record.active;
    }

    /**
     * @dev 获取锁仓档位配置
     */
    function getTierConfig(LockTier _tier) external view returns (
        uint256 duration,
        uint256 dailyRate,
        uint256 annualAPY
    ) {
        TierConfig memory config = tierConfigs[_tier];
        duration = config.duration;
        dailyRate = config.dailyRate;
        annualAPY = config.dailyRate * 365;
    }

    /**
     * @dev 获取所有锁仓档位配置
     */
    function getAllTierConfigs() external view returns (
        uint256[4] memory durations,
        uint256[4] memory dailyRates,
        uint256[4] memory annualAPYs
    ) {
        for (uint256 i = 0; i < 4; i++) {
            LockTier tier = LockTier(i);
            TierConfig memory config = tierConfigs[tier];
            durations[i] = config.duration;
            dailyRates[i] = config.dailyRate;
            annualAPYs[i] = config.dailyRate * 365;
        }
    }

    /**
     * @dev 获取用户信息（包含推荐信息）
     */
    function getUserInfo(address _user) external view returns (
        uint256 _totalStaked,
        uint256 _totalClaimed,
        uint256 _stakeCount,
        uint256 _pendingRewards,
        uint256 _activeStakeCount,
        address _referrer,
        uint256 _directReferrals,
        uint256 _referralRewards,
        uint256 _totalReferralClaimed
    ) {
        UserInfo storage user = userInfo[_user];
        _totalStaked = user.totalStaked;
        _totalClaimed = user.totalClaimed;
        _stakeCount = user.stakeCount;
        _activeStakeCount = user.activeStakeCount;
        _referrer = user.referrer;
        _directReferrals = user.directReferrals;
        _referralRewards = user.referralRewards;
        _totalReferralClaimed = user.totalReferralClaimed;

        for (uint256 i = 0; i < user.stakeCount; i++) {
            StakeRecord storage record = stakeRecords[_user][i];
            if (record.active && record.amount > 0) {
                _pendingRewards += record.pendingRewards + _calculateReward(_user, i);
            }
        }
    }

    /**
     * @dev 获取挖矿状态
     */
    function getMiningStatus() external view returns (
        uint256 _totalStaked,
        uint256 _totalDistributed,
        uint256 _remainingRewards,
        bool _miningEnded,
        uint256 _startTime,
        uint256 _totalReferralDistributed
    ) {
        return (
            totalStaked,
            totalDistributed,
            totalRewards - totalDistributed,
            miningEnded,
            startTime,
            totalReferralDistributed
        );
    }

    /**
     * @dev 获取推荐奖励配置
     */
    function getReferralRates() external view returns (uint256[] memory) {
        return referralRates;
    }

    /**
     * @dev 获取推荐奖励代数
     */
    function getReferralLevels() external view returns (uint256) {
        return referralRates.length;
    }

    /**
     * @dev 获取直推列表
     */
    function getReferrals(address _user) external view returns (address[] memory) {
        return referrals[_user];
    }

    /**
     * @dev 获取直推列表（分页）
     */
    function getReferralsPaginated(address _user, uint256 _offset, uint256 _limit)
        external view returns (address[] memory result, uint256 total)
    {
        address[] storage refs = referrals[_user];
        total = refs.length;

        if (_offset >= total) {
            return (new address[](0), total);
        }

        uint256 end = _offset + _limit;
        if (end > total) {
            end = total;
        }

        result = new address[](end - _offset);
        for (uint256 i = _offset; i < end; i++) {
            result[i - _offset] = refs[i];
        }

        return (result, total);
    }

    // ============ 管理员功能 ============

    /**
     * @dev 设置推荐奖励代数和比例
     * @param _rates 每代奖励比例数组（基数10000，例如 [1000, 800, 500] = 1代10%, 2代8%, 3代5%）
     *
     * 示例：
     * - 3代推荐：[1000, 800, 500]  → 10%, 8%, 5%
     * - 5代推荐：[1000, 800, 500, 300, 100] → 10%, 8%, 5%, 3%, 1%
     * - 清空推荐：[] → 无推荐奖励
     */
    function setReferralRates(uint256[] calldata _rates) external onlyOwner {
        require(_rates.length <= MAX_REFERRAL_LEVELS, "Too many levels");

        // 验证每代比例不超过合理范围
        uint256 totalRate = 0;
        for (uint256 i = 0; i < _rates.length; i++) {
            require(_rates[i] <= 5000, "Single rate too high"); // 单代最高50%
            totalRate += _rates[i];
        }
        require(totalRate <= RATE_BASE, "Total rate exceeds 100%");

        referralRates = _rates;

        emit ReferralRatesUpdated(_rates);
    }

    /**
     * @dev 设置锁仓档位配置
     */
    function setTierConfig(LockTier _tier, uint256 _duration, uint256 _dailyRate) external onlyOwner {
        require(_dailyRate <= 1000, "Rate too high");  // 最高10%

        tierConfigs[_tier] = TierConfig({
            duration: _duration,
            dailyRate: _dailyRate
        });

        emit TierConfigUpdated(_tier, _duration, _dailyRate);
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
