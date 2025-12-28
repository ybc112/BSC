// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LPMining
 * @dev LP质押挖矿合约
 * - 总量6000万代币，3年释放
 * - 领取收益时35%分流（分红+团队奖励）
 * - 推荐奖励：1代20%，2代10%，3代5%（从35%中扣除）
 * - 团队奖励：根据小区业绩享受网体收益1%/1.5%/2%（从剩余中扣除）
 */
contract LPMining is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // 代币和LP地址
    IERC20 public rewardToken;
    IERC20 public lpToken;

    // 挖矿参数
    uint256 public constant TOTAL_REWARDS = 60_000_000 * 1e18;  // 6000万代币
    uint256 public constant MINING_DURATION = 3 * 365 days;      // 3年
    uint256 public rewardPerSecond;                              // 每秒释放量
    uint256 public startTime;
    uint256 public endTime;
    bool public miningEnded;  // 挖矿结束标记

    // 收益分配比例 (基数10000)
    uint256 public constant DISTRIBUTION_BASE = 10000;
    uint256 public constant USER_SHARE = 6500;      // 用户获得65%
    uint256 public constant BONUS_SHARE = 3500;     // 35%用于分红和团队奖励

    // 推荐奖励比例（从35%中按比例分配）
    // 注意：这里的比例是相对于35%的奖励池，不是总收益
    uint256 public constant REFERRAL_LEVEL1 = 2000; // 1代 20% of 35% = 7% of total
    uint256 public constant REFERRAL_LEVEL2 = 1000; // 2代 10% of 35% = 3.5% of total
    uint256 public constant REFERRAL_LEVEL3 = 500;  // 3代 5% of 35% = 1.75% of total
    // 推荐奖励合计最多35%，剩余65%给团队奖励分配

    // 团队等级阈值和奖励比例 (可配置)
    uint256[] public teamLevelThresholds;  // LP数量阈值
    uint256[] public teamLevelRates;       // 对应奖励比例 (基数10000)

    // 推荐链最大深度（防止gas过高）
    uint256 public constant MAX_REFERRAL_DEPTH = 50;

    // 直推人数限制（防止Gas过高）
    uint256 public constant MAX_DIRECT_REFERRALS = 500;

    // 用户质押信息
    struct UserInfo {
        uint256 amount;           // 质押LP数量
        uint256 rewardDebt;       // 已结算奖励
        uint256 pendingRewards;   // 待领取奖励
        uint256 totalClaimed;     // 已领取总量
        address referrer;         // 推荐人
        uint256 referralRewards;  // 推荐奖励
        uint256 teamRewards;      // 团队奖励
        uint256 teamPerformance;  // 团队总业绩
        uint256 bigAreaPerformance;   // 大区业绩
        uint256 smallAreaPerformance; // 小区业绩
        uint256 directReferrals;  // 直推人数
    }

    // 全局状态
    uint256 public totalStaked;
    uint256 public accRewardPerShare;  // 累计每份奖励 (精度1e18)
    uint256 public lastRewardTime;
    uint256 public totalDistributed;   // 基础挖矿已分发
    uint256 public totalBonusDistributed; // 奖励已分发

    // 用户数据
    mapping(address => UserInfo) public userInfo;
    mapping(address => address[]) public referrals;  // 直推列表
    mapping(address => bool) public hasReferrer;

    // 未分配的奖励池（没有推荐人时的奖励）
    uint256 public unallocatedPool;

    // 事件
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Claim(address indexed user, uint256 userAmount, uint256 bonusAmount);
    event ReferrerSet(address indexed user, address indexed referrer);
    event ReferralReward(address indexed user, address indexed referrer, uint256 level, uint256 amount);
    event TeamReward(address indexed user, uint256 amount);
    event TeamLevelUpdated(uint256[] thresholds, uint256[] rates);
    event AdminTransferLP(address indexed to, uint256 amount);
    event MiningEnded(uint256 totalDistributed);
    event UnallocatedReward(uint256 amount);

    constructor(
        address _rewardToken,
        address _lpToken,
        uint256 _startTime
    ) Ownable(msg.sender) {
        require(_rewardToken != address(0), "Invalid reward token");
        require(_lpToken != address(0), "Invalid LP token");
        require(_startTime >= block.timestamp, "Start time must be future");

        rewardToken = IERC20(_rewardToken);
        lpToken = IERC20(_lpToken);
        startTime = _startTime;
        endTime = _startTime + MINING_DURATION;
        lastRewardTime = _startTime;
        rewardPerSecond = TOTAL_REWARDS / MINING_DURATION;

        // 初始化团队等级 (默认值，可通过setTeamLevels修改)
        teamLevelThresholds = [1000 * 1e18, 5000 * 1e18, 10000 * 1e18];
        teamLevelRates = [100, 150, 200]; // 1%, 1.5%, 2%
    }


    // ============ 核心功能 ============

    /**
     * @dev 设置推荐人（只能设置一次）
     */
    function setReferrer(address _referrer) external {
        require(!hasReferrer[msg.sender], "Referrer already set");
        require(_referrer != address(0), "Invalid referrer");
        require(_referrer != msg.sender, "Cannot refer yourself");
        require(userInfo[_referrer].amount > 0 || _referrer == owner(), "Referrer must be staker or owner");

        // 检查推荐人的直推数量是否已达上限
        require(userInfo[_referrer].directReferrals < MAX_DIRECT_REFERRALS, "Referrer has too many referrals");

        // 防止循环推荐：检查_referrer的上级链中是否包含msg.sender
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
     * @dev 质押LP
     */
    function deposit(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(block.timestamp >= startTime, "Mining not started");
        require(!miningEnded, "Mining ended");

        updatePool();

        UserInfo storage user = userInfo[msg.sender];

        // 结算已有收益
        if (user.amount > 0) {
            uint256 pending = (user.amount * accRewardPerShare / 1e18) - user.rewardDebt;
            if (pending > 0) {
                user.pendingRewards += pending;
            }
        }

        // 转入LP
        lpToken.safeTransferFrom(msg.sender, address(this), _amount);
        user.amount += _amount;
        totalStaked += _amount;

        // 更新团队业绩
        _updateTeamPerformance(msg.sender, _amount, true);

        user.rewardDebt = user.amount * accRewardPerShare / 1e18;

        emit Deposit(msg.sender, _amount);
    }

    /**
     * @dev 解除质押
     */
    function withdraw(uint256 _amount) external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, "Insufficient balance");

        updatePool();

        // 结算收益
        uint256 pending = (user.amount * accRewardPerShare / 1e18) - user.rewardDebt;
        if (pending > 0) {
            user.pendingRewards += pending;
        }

        if (_amount > 0) {
            user.amount -= _amount;
            totalStaked -= _amount;

            // 更新团队业绩
            _updateTeamPerformance(msg.sender, _amount, false);

            lpToken.safeTransfer(msg.sender, _amount);
        }

        user.rewardDebt = user.amount * accRewardPerShare / 1e18;

        emit Withdraw(msg.sender, _amount);
    }

    /**
     * @dev 领取收益
     */
    function claim() external nonReentrant {
        updatePool();

        UserInfo storage user = userInfo[msg.sender];

        uint256 pending = (user.amount * accRewardPerShare / 1e18) - user.rewardDebt;
        uint256 totalPending = user.pendingRewards + pending;

        require(totalPending > 0, "No rewards to claim");

        // 计算分配：用户65%，奖励池35%
        uint256 userAmount = totalPending * USER_SHARE / DISTRIBUTION_BASE;
        uint256 bonusAmount = totalPending - userAmount;

        // 发放用户收益
        user.pendingRewards = 0;
        user.rewardDebt = user.amount * accRewardPerShare / 1e18;
        user.totalClaimed += userAmount;

        rewardToken.safeTransfer(msg.sender, userAmount);

        // 分配推荐奖励和团队奖励
        _distributeReferralRewards(msg.sender, bonusAmount);

        emit Claim(msg.sender, userAmount, bonusAmount);
    }

    /**
     * @dev 领取推荐奖励
     */
    function claimReferralRewards() external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        uint256 amount = user.referralRewards;
        require(amount > 0, "No referral rewards");

        user.referralRewards = 0;
        rewardToken.safeTransfer(msg.sender, amount);
    }

    /**
     * @dev 领取团队奖励
     */
    function claimTeamRewards() external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        uint256 amount = user.teamRewards;
        require(amount > 0, "No team rewards");

        user.teamRewards = 0;
        rewardToken.safeTransfer(msg.sender, amount);
    }


    // ============ 内部函数 ============

    /**
     * @dev 更新矿池
     */
    function updatePool() public {
        if (block.timestamp <= lastRewardTime) {
            return;
        }

        if (totalStaked == 0) {
            lastRewardTime = block.timestamp;
            return;
        }

        uint256 endTimestamp = block.timestamp > endTime ? endTime : block.timestamp;
        if (endTimestamp <= lastRewardTime) {
            // 挖矿已结束
            if (!miningEnded && block.timestamp > endTime) {
                miningEnded = true;
                emit MiningEnded(totalDistributed);
            }
            return;
        }

        uint256 duration = endTimestamp - lastRewardTime;
        uint256 reward = duration * rewardPerSecond;

        if (totalDistributed + reward >= TOTAL_REWARDS) {
            reward = TOTAL_REWARDS - totalDistributed;
            miningEnded = true;
            emit MiningEnded(totalDistributed + reward);
        }

        if (reward > 0) {
            // 使用1e18精度，避免精度损失
            accRewardPerShare += reward * 1e18 / totalStaked;
            totalDistributed += reward;
        }

        lastRewardTime = block.timestamp;
    }

    /**
     * @dev 分配推荐奖励
     * 推荐奖励规则：
     * - 1代推荐人获得 bonusAmount 的 20%
     * - 2代推荐人获得 bonusAmount 的 10%
     * - 3代推荐人获得 bonusAmount 的 5%
     * - 剩余部分用于团队奖励
     */
    function _distributeReferralRewards(address _user, uint256 _amount) internal {
        uint256 distributed = 0;

        // 1代推荐人
        address ref1 = userInfo[_user].referrer;
        if (ref1 != address(0)) {
            uint256 reward1 = _amount * REFERRAL_LEVEL1 / DISTRIBUTION_BASE;
            userInfo[ref1].referralRewards += reward1;
            distributed += reward1;
            totalBonusDistributed += reward1;
            emit ReferralReward(_user, ref1, 1, reward1);

            // 2代推荐人
            address ref2 = userInfo[ref1].referrer;
            if (ref2 != address(0)) {
                uint256 reward2 = _amount * REFERRAL_LEVEL2 / DISTRIBUTION_BASE;
                userInfo[ref2].referralRewards += reward2;
                distributed += reward2;
                totalBonusDistributed += reward2;
                emit ReferralReward(_user, ref2, 2, reward2);

                // 3代推荐人
                address ref3 = userInfo[ref2].referrer;
                if (ref3 != address(0)) {
                    uint256 reward3 = _amount * REFERRAL_LEVEL3 / DISTRIBUTION_BASE;
                    userInfo[ref3].referralRewards += reward3;
                    distributed += reward3;
                    totalBonusDistributed += reward3;
                    emit ReferralReward(_user, ref3, 3, reward3);
                }
            }
        }

        // 剩余部分用于团队奖励
        uint256 remaining = _amount - distributed;
        if (remaining > 0) {
            _distributeTeamRewards(_user, remaining);
        }
    }

    /**
     * @dev 分配团队奖励
     * 团队奖励规则：
     * - 根据上级的小区业绩确定奖励比例
     * - 每个上级从剩余金额中按比例获取，采用极差制
     * - 最多遍历 MAX_REFERRAL_DEPTH 层防止gas过高
     */
    function _distributeTeamRewards(address _user, uint256 _amount) internal {
        address current = userInfo[_user].referrer;
        uint256 distributed = 0;
        uint256 lastRate = 0;
        uint256 depth = 0;

        while (current != address(0) && depth < MAX_REFERRAL_DEPTH) {
            UserInfo storage leader = userInfo[current];
            uint256 currentRate = _getTeamRate(leader.smallAreaPerformance);

            // 极差制：只有当前级别比下级高时才能获得差额奖励
            if (currentRate > lastRate) {
                uint256 diffRate = currentRate - lastRate;
                uint256 reward = _amount * diffRate / DISTRIBUTION_BASE;

                // 确保不超发
                if (distributed + reward > _amount) {
                    reward = _amount - distributed;
                }

                if (reward > 0) {
                    leader.teamRewards += reward;
                    distributed += reward;
                    totalBonusDistributed += reward;
                    emit TeamReward(current, reward);
                }

                lastRate = currentRate;
            }

            current = leader.referrer;
            depth++;
        }

        // 未分配的部分进入未分配池
        if (distributed < _amount) {
            unallocatedPool += (_amount - distributed);
            emit UnallocatedReward(_amount - distributed);
        }
    }

    /**
     * @dev 获取团队奖励比例
     */
    function _getTeamRate(uint256 _smallAreaPerformance) internal view returns (uint256) {
        for (uint256 i = teamLevelThresholds.length; i > 0; i--) {
            if (_smallAreaPerformance >= teamLevelThresholds[i - 1]) {
                return teamLevelRates[i - 1];
            }
        }
        return 0;
    }

    /**
     * @dev 更新团队业绩
     */
    function _updateTeamPerformance(address _user, uint256 _amount, bool _isAdd) internal {
        address current = userInfo[_user].referrer;
        uint256 depth = 0;

        while (current != address(0) && depth < MAX_REFERRAL_DEPTH) {
            UserInfo storage leader = userInfo[current];

            if (_isAdd) {
                leader.teamPerformance += _amount;
            } else {
                if (leader.teamPerformance >= _amount) {
                    leader.teamPerformance -= _amount;
                } else {
                    leader.teamPerformance = 0;
                }
            }

            // 重新计算大区和小区
            _recalculateAreas(current);

            current = leader.referrer;
            depth++;
        }
    }

    /**
     * @dev 重新计算大区小区业绩
     * 优化：限制遍历的直推数量
     */
    function _recalculateAreas(address _user) internal {
        address[] storage refs = referrals[_user];
        uint256 len = refs.length;

        if (len == 0) {
            userInfo[_user].bigAreaPerformance = 0;
            userInfo[_user].smallAreaPerformance = 0;
            return;
        }

        uint256 maxArea = 0;
        uint256 totalArea = 0;

        // 限制遍历数量，防止Gas过高
        uint256 limit = len > MAX_DIRECT_REFERRALS ? MAX_DIRECT_REFERRALS : len;

        for (uint256 i = 0; i < limit; i++) {
            uint256 areaPerformance = userInfo[refs[i]].amount + userInfo[refs[i]].teamPerformance;
            totalArea += areaPerformance;
            if (areaPerformance > maxArea) {
                maxArea = areaPerformance;
            }
        }

        userInfo[_user].bigAreaPerformance = maxArea;
        userInfo[_user].smallAreaPerformance = totalArea - maxArea;
    }


    // ============ 管理员功能 ============

    /**
     * @dev 设置团队等级阈值和奖励比例
     */
    function setTeamLevels(
        uint256[] calldata _thresholds,
        uint256[] calldata _rates
    ) external onlyOwner {
        require(_thresholds.length == _rates.length, "Length mismatch");
        require(_thresholds.length > 0, "Empty arrays");

        // 验证阈值递增
        for (uint256 i = 1; i < _thresholds.length; i++) {
            require(_thresholds[i] > _thresholds[i - 1], "Thresholds must increase");
        }

        // 验证比例递增且不超过合理范围
        for (uint256 i = 0; i < _rates.length; i++) {
            require(_rates[i] <= 1000, "Rate too high"); // 最高10%
            if (i > 0) {
                require(_rates[i] > _rates[i - 1], "Rates must increase");
            }
        }

        teamLevelThresholds = _thresholds;
        teamLevelRates = _rates;

        emit TeamLevelUpdated(_thresholds, _rates);
    }

    /**
     * @dev 管理员转移LP（特殊权限）
     * 注意：此功能允许管理员转移合约中的LP，存在中心化风险
     * 建议：添加时间锁或多签机制
     */
    function adminTransferLP(address _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "Invalid address");
        uint256 contractBalance = lpToken.balanceOf(address(this));
        require(_amount <= contractBalance, "Insufficient LP");

        lpToken.safeTransfer(_to, _amount);

        emit AdminTransferLP(_to, _amount);
    }

    /**
     * @dev 提取未分配的奖励池（仅限owner）
     */
    function withdrawUnallocated(address _to) external onlyOwner {
        require(_to != address(0), "Invalid address");
        uint256 amount = unallocatedPool;
        require(amount > 0, "No unallocated rewards");

        unallocatedPool = 0;
        rewardToken.safeTransfer(_to, amount);
    }

    /**
     * @dev 紧急提取（仅限owner）
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(owner(), _amount);
    }

    // ============ 查询函数 ============

    /**
     * @dev 查询待领取收益
     */
    function pendingReward(address _user) external view returns (uint256) {
        UserInfo storage user = userInfo[_user];
        uint256 _accRewardPerShare = accRewardPerShare;

        if (block.timestamp > lastRewardTime && totalStaked > 0) {
            uint256 endTimestamp = block.timestamp > endTime ? endTime : block.timestamp;
            if (endTimestamp > lastRewardTime) {
                uint256 duration = endTimestamp - lastRewardTime;
                uint256 reward = duration * rewardPerSecond;
                if (totalDistributed + reward > TOTAL_REWARDS) {
                    reward = TOTAL_REWARDS - totalDistributed;
                }
                _accRewardPerShare += reward * 1e18 / totalStaked;
            }
        }

        uint256 pending = (user.amount * _accRewardPerShare / 1e18) - user.rewardDebt;
        return user.pendingRewards + pending;
    }

    /**
     * @dev 查询用户完整信息
     */
    function getUserInfo(address _user) external view returns (
        uint256 stakedAmount,
        uint256 pendingRewards,
        uint256 referralRewards,
        uint256 teamRewards,
        uint256 totalClaimed,
        address referrer,
        uint256 referralCount,
        uint256 teamPerformance,
        uint256 smallAreaPerformance,
        uint256 teamLevel
    ) {
        UserInfo storage user = userInfo[_user];
        stakedAmount = user.amount;
        pendingRewards = user.pendingRewards;
        referralRewards = user.referralRewards;
        teamRewards = user.teamRewards;
        totalClaimed = user.totalClaimed;
        referrer = user.referrer;
        referralCount = user.directReferrals;
        teamPerformance = user.teamPerformance;
        smallAreaPerformance = user.smallAreaPerformance;
        teamLevel = _getTeamLevel(user.smallAreaPerformance);
    }

    /**
     * @dev 获取团队等级
     */
    function _getTeamLevel(uint256 _smallAreaPerformance) internal view returns (uint256) {
        for (uint256 i = teamLevelThresholds.length; i > 0; i--) {
            if (_smallAreaPerformance >= teamLevelThresholds[i - 1]) {
                return i;
            }
        }
        return 0;
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

    /**
     * @dev 获取团队等级配置
     */
    function getTeamLevelConfig() external view returns (
        uint256[] memory thresholds,
        uint256[] memory rates
    ) {
        return (teamLevelThresholds, teamLevelRates);
    }

    /**
     * @dev 获取挖矿状态
     */
    function getMiningStatus() external view returns (
        uint256 _totalStaked,
        uint256 _totalDistributed,
        uint256 _rewardPerSecond,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _remainingRewards,
        bool _miningEnded
    ) {
        return (
            totalStaked,
            totalDistributed,
            rewardPerSecond,
            startTime,
            endTime,
            TOTAL_REWARDS - totalDistributed,
            miningEnded
        );
    }

    /**
     * @dev 获取奖励分发统计
     */
    function getBonusStats() external view returns (
        uint256 _totalBonusDistributed,
        uint256 _unallocatedPool
    ) {
        return (totalBonusDistributed, unallocatedPool);
    }
}
