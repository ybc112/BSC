// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LPMiningV2
 * @dev LP质押挖矿合约 V2
 *
 * 新的收益分配逻辑：
 * - 65% 基础部分：推荐奖励和团队奖励从这里扣，剩余归用户
 * - 35% 分流部分：固定分流到配置的多个地址
 *
 * 推荐奖励（从65%中扣除）：
 * - 1代推荐人：20%
 * - 2代推荐人：10%
 * - 3代推荐人：5%
 * - 没有推荐人则归用户自己
 *
 * 团队极差奖励（从65%中扣除）：
 * - 根据小区业绩享受1%/1.5%/2%
 *
 * 锁仓功能：
 * - 用户质押后有固定锁仓期
 * - 锁仓期内不能提取LP
 * - 锁仓期由管理员配置
 */
contract LPMiningV2 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // 代币和LP地址
    IERC20 public rewardToken;
    IERC20 public lpToken;

    // 挖矿参数（可配置）
    uint256 public totalRewards = 60_000_000 * 1e18;  // 6000万代币，可配置
    uint256 public miningDuration = 3 * 365 days;      // 3年，可配置
    uint256 public rewardPerSecond;                              // 每秒释放量
    uint256 public startTime;
    uint256 public endTime;
    bool public miningEnded;

    // 锁仓参数（无上限）
    uint256 public lockDuration = 30 days;  // 默认锁仓30天，可配置，无上限

    // 收益分配比例 (基数10000，可配置)
    uint256 public constant DISTRIBUTION_BASE = 10000;
    uint256 public userBaseShare = 6500;      // 65% 基础部分，可配置
    uint256 public splitShare = 3500;          // 35% 分流部分，可配置

    // 推荐奖励比例（从基础部分中扣除，可配置）
    uint256 public referralLevel1 = 2000; // 1代 20%
    uint256 public referralLevel2 = 1000; // 2代 10%
    uint256 public referralLevel3 = 500;  // 3代 5%

    // 团队等级阈值和奖励比例 (可配置)
    uint256[] public teamLevelThresholds;  // LP数量阈值
    uint256[] public teamLevelRates;       // 对应奖励比例 (基数10000)

    // 35%分流地址配置
    struct SplitAddress {
        address addr;
        uint256 rate;  // 占35%的比例 (基数10000)
    }
    SplitAddress[] public splitAddresses;
    uint256 public totalSplitRate;  // 所有分流比例之和

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
        uint256 unlockTime;       // 解锁时间（锁仓到期时间）
    }

    // 全局状态
    uint256 public totalStaked;
    uint256 public accRewardPerShare;  // 累计每份奖励 (精度1e18)
    uint256 public lastRewardTime;
    uint256 public totalDistributed;   // 基础挖矿已分发
    uint256 public totalReferralDistributed;  // 推荐奖励已分发
    uint256 public totalTeamDistributed;      // 团队奖励已分发
    uint256 public totalSplitDistributed;     // 分流已分发

    // 用户数据
    mapping(address => UserInfo) public userInfo;
    mapping(address => address[]) public referrals;  // 直推列表
    mapping(address => bool) public hasReferrer;

    // 事件
    event Deposit(address indexed user, uint256 amount, uint256 unlockTime);
    event Withdraw(address indexed user, uint256 amount);
    event Claim(address indexed user, uint256 userAmount, uint256 splitAmount);
    event ReferrerSet(address indexed user, address indexed referrer);
    event ReferralReward(address indexed user, address indexed referrer, uint256 level, uint256 amount);
    event TeamReward(address indexed user, uint256 amount);
    event TeamLevelUpdated(uint256[] thresholds, uint256[] rates);
    event SplitAddressUpdated(address[] addresses, uint256[] rates);
    event SplitDistributed(address indexed to, uint256 amount);
    event AdminTransferLP(address indexed to, uint256 amount);
    event MiningEnded(uint256 totalDistributed);
    event LockDurationUpdated(uint256 oldDuration, uint256 newDuration);
    event MiningParamsUpdated(uint256 totalRewards, uint256 miningDuration, uint256 rewardPerSecond);
    event DistributionRatesUpdated(uint256 userBaseShare, uint256 splitShare);
    event ReferralRatesUpdated(uint256 level1, uint256 level2, uint256 level3);

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
        endTime = _startTime + miningDuration;
        lastRewardTime = _startTime;
        rewardPerSecond = totalRewards / miningDuration;

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

        // 更新锁仓时间（每次质押都会重置锁仓期）
        uint256 newUnlockTime = block.timestamp + lockDuration;
        user.unlockTime = newUnlockTime;

        // 更新团队业绩
        _updateTeamPerformance(msg.sender, _amount, true);

        user.rewardDebt = user.amount * accRewardPerShare / 1e18;

        emit Deposit(msg.sender, _amount, newUnlockTime);
    }

    /**
     * @dev 解除质押
     */
    function withdraw(uint256 _amount) external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, "Insufficient balance");
        require(block.timestamp >= user.unlockTime, "Still in lock period");

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
     *
     * 收益分配逻辑（优化版）：
     *
     * 65%基础部分：
     * - 推荐奖励（有则分配，无则归用户）
     * - 团队奖励（极差制，未分配部分进分流）
     * - 剩余归用户
     *
     * 35%分流部分：
     * - 原35% + 未分配的团队奖励
     * - 全部分配到配置的分流地址
     */
    function claim() external nonReentrant {
        updatePool();

        UserInfo storage user = userInfo[msg.sender];

        uint256 pending = (user.amount * accRewardPerShare / 1e18) - user.rewardDebt;
        uint256 totalPending = user.pendingRewards + pending;

        require(totalPending > 0, "No rewards to claim");

        // 检查合约奖励代币余额是否足够
        uint256 rewardBalance = rewardToken.balanceOf(address(this));
        require(rewardBalance >= totalPending, "Insufficient reward balance");

        // 计算基础部分和分流部分
        uint256 baseAmount = totalPending * userBaseShare / DISTRIBUTION_BASE;
        uint256 baseSplitAmount = totalPending - baseAmount;  // 35%分流部分

        // === 分配推荐奖励（从65%基础部分扣除）===
        // 有推荐人则分配，没有推荐人则归用户自己
        uint256 referralDistributed = _distributeReferralRewards(msg.sender, baseAmount);

        // === 计算团队预留（最高等级比例，用于极差制分配）===
        uint256 teamReserveRate = teamLevelRates.length > 0 ? teamLevelRates[teamLevelRates.length - 1] : 0;
        uint256 teamReserve = baseAmount * teamReserveRate / DISTRIBUTION_BASE;

        // === 分配团队奖励（从团队预留中分配）===
        uint256 teamDistributed = _distributeTeamRewards(msg.sender, baseAmount);

        // === 计算用户获得金额 ===
        // 用户获得 = 65%基础部分 - 实际分配的推荐奖励 - 团队预留
        uint256 userAmount = baseAmount - referralDistributed - teamReserve;

        // === 计算未分配的团队奖励，转入35%分流 ===
        uint256 unallocatedTeam = teamReserve > teamDistributed ? teamReserve - teamDistributed : 0;

        // 更新用户状态
        user.pendingRewards = 0;
        user.rewardDebt = user.amount * accRewardPerShare / 1e18;
        user.totalClaimed += userAmount;

        // 发放用户收益
        if (userAmount > 0) {
            rewardToken.safeTransfer(msg.sender, userAmount);
        }

        // === 分配35%分流部分 ===
        // 总分流 = 原35% + 未分配的团队奖励
        uint256 totalSplitAmount = baseSplitAmount + unallocatedTeam;
        _distributeSplitAmount(totalSplitAmount);

        emit Claim(msg.sender, userAmount, totalSplitAmount);
    }

    /**
     * @dev 领取推荐奖励
     */
    function claimReferralRewards() external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        uint256 amount = user.referralRewards;
        require(amount > 0, "No referral rewards");

        // 检查余额
        require(rewardToken.balanceOf(address(this)) >= amount, "Insufficient reward balance");

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

        // 检查余额
        require(rewardToken.balanceOf(address(this)) >= amount, "Insufficient reward balance");

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
            if (!miningEnded && block.timestamp > endTime) {
                miningEnded = true;
                emit MiningEnded(totalDistributed);
            }
            return;
        }

        uint256 duration = endTimestamp - lastRewardTime;
        uint256 reward = duration * rewardPerSecond;

        if (totalDistributed + reward >= totalRewards) {
            reward = totalRewards - totalDistributed;
            miningEnded = true;
            emit MiningEnded(totalDistributed + reward);
        }

        if (reward > 0) {
            accRewardPerShare += reward * 1e18 / totalStaked;
            totalDistributed += reward;
        }

        lastRewardTime = block.timestamp;
    }

    /**
     * @dev 分配推荐奖励（从65%基础部分扣除）
     * @return deducted 实际扣除的推荐奖励总额
     */
    function _distributeReferralRewards(address _user, uint256 _baseAmount) internal returns (uint256 deducted) {
        deducted = 0;

        // 1代推荐人
        address ref1 = userInfo[_user].referrer;
        if (ref1 != address(0)) {
            uint256 reward1 = _baseAmount * referralLevel1 / DISTRIBUTION_BASE;
            userInfo[ref1].referralRewards += reward1;
            deducted += reward1;
            totalReferralDistributed += reward1;
            emit ReferralReward(_user, ref1, 1, reward1);

            // 2代推荐人
            address ref2 = userInfo[ref1].referrer;
            if (ref2 != address(0)) {
                uint256 reward2 = _baseAmount * referralLevel2 / DISTRIBUTION_BASE;
                userInfo[ref2].referralRewards += reward2;
                deducted += reward2;
                totalReferralDistributed += reward2;
                emit ReferralReward(_user, ref2, 2, reward2);

                // 3代推荐人
                address ref3 = userInfo[ref2].referrer;
                if (ref3 != address(0)) {
                    uint256 reward3 = _baseAmount * referralLevel3 / DISTRIBUTION_BASE;
                    userInfo[ref3].referralRewards += reward3;
                    deducted += reward3;
                    totalReferralDistributed += reward3;
                    emit ReferralReward(_user, ref3, 3, reward3);
                }
            }
        }
        // 如果没有推荐人，不扣除任何金额，全部归用户

        return deducted;
    }

    /**
     * @dev 分配团队奖励（从65%基础部分扣除，极差制）
     * @return deducted 实际扣除的团队奖励总额
     */
    function _distributeTeamRewards(address _user, uint256 _amount) internal returns (uint256 deducted) {
        address current = userInfo[_user].referrer;
        deducted = 0;
        uint256 lastRate = 0;
        uint256 depth = 0;

        while (current != address(0) && depth < MAX_REFERRAL_DEPTH) {
            UserInfo storage leader = userInfo[current];
            uint256 currentRate = _getTeamRate(leader.smallAreaPerformance);

            // 极差制：只有当前级别比下级高时才能获得差额奖励
            if (currentRate > lastRate) {
                uint256 diffRate = currentRate - lastRate;
                uint256 reward = _amount * diffRate / DISTRIBUTION_BASE;

                if (reward > 0) {
                    leader.teamRewards += reward;
                    deducted += reward;
                    totalTeamDistributed += reward;
                    emit TeamReward(current, reward);
                }

                lastRate = currentRate;
            }

            current = leader.referrer;
            depth++;
        }

        return deducted;
    }

    /**
     * @dev 分配35%分流部分到配置的地址
     */
    function _distributeSplitAmount(uint256 _amount) internal {
        if (splitAddresses.length == 0 || totalSplitRate == 0) {
            // 没有配置分流地址，转给owner
            rewardToken.safeTransfer(owner(), _amount);
            totalSplitDistributed += _amount;
            emit SplitDistributed(owner(), _amount);
            return;
        }

        uint256 distributed = 0;
        for (uint256 i = 0; i < splitAddresses.length; i++) {
            uint256 share = _amount * splitAddresses[i].rate / totalSplitRate;
            if (share > 0 && splitAddresses[i].addr != address(0)) {
                rewardToken.safeTransfer(splitAddresses[i].addr, share);
                distributed += share;
                emit SplitDistributed(splitAddresses[i].addr, share);
            }
        }

        // 如果有剩余（精度损失），转给最后一个地址
        if (distributed < _amount && splitAddresses.length > 0) {
            uint256 remaining = _amount - distributed;
            address lastAddr = splitAddresses[splitAddresses.length - 1].addr;
            if (lastAddr != address(0)) {
                rewardToken.safeTransfer(lastAddr, remaining);
                distributed += remaining;
            }
        }

        totalSplitDistributed += distributed;
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

            _recalculateAreas(current);

            current = leader.referrer;
            depth++;
        }
    }

    /**
     * @dev 重新计算大区小区业绩
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

        // 验证推荐+团队最高比例不超过用户基础部分（65%）
        uint256 totalReferral = referralLevel1 + referralLevel2 + referralLevel3;
        uint256 maxTeamRate = _rates[_rates.length - 1];
        require(totalReferral + maxTeamRate <= userBaseShare, "Referral + team rate exceeds user base share");

        teamLevelThresholds = _thresholds;
        teamLevelRates = _rates;

        emit TeamLevelUpdated(_thresholds, _rates);
    }

    /**
     * @dev 设置35%分流地址和比例
     * @param _addresses 分流地址数组
     * @param _rates 对应比例数组（基数10000，总和应为10000）
     */
    function setSplitAddresses(
        address[] calldata _addresses,
        uint256[] calldata _rates
    ) external onlyOwner {
        require(_addresses.length == _rates.length, "Length mismatch");
        require(_addresses.length <= 10, "Too many addresses"); // 最多10个分流地址

        // 清空旧配置
        delete splitAddresses;
        totalSplitRate = 0;

        // 添加新配置
        for (uint256 i = 0; i < _addresses.length; i++) {
            require(_addresses[i] != address(0), "Invalid address");
            require(_rates[i] > 0, "Rate must be > 0");

            splitAddresses.push(SplitAddress({
                addr: _addresses[i],
                rate: _rates[i]
            }));
            totalSplitRate += _rates[i];
        }

        emit SplitAddressUpdated(_addresses, _rates);
    }

    /**
     * @dev 设置锁仓时长（仅管理员，无上限）
     * @param _duration 锁仓时长（秒）
     */
    function setLockDuration(uint256 _duration) external onlyOwner {
        uint256 oldDuration = lockDuration;
        lockDuration = _duration;

        emit LockDurationUpdated(oldDuration, _duration);
    }

    /**
     * @dev 设置挖矿参数（仅管理员）
     * @param _totalRewards 总奖励数量
     * @param _miningDuration 挖矿周期（秒）
     * 注意：修改后会重新计算每秒释放量和结束时间
     */
    function setMiningParams(uint256 _totalRewards, uint256 _miningDuration) external onlyOwner {
        require(_totalRewards > 0, "Total rewards must be > 0");
        require(_miningDuration > 0, "Duration must be > 0");
        require(!miningEnded, "Mining already ended");

        totalRewards = _totalRewards;
        miningDuration = _miningDuration;
        rewardPerSecond = _totalRewards / _miningDuration;
        endTime = startTime + _miningDuration;

        emit MiningParamsUpdated(_totalRewards, _miningDuration, rewardPerSecond);
    }

    /**
     * @dev 设置收益分配比例（仅管理员）
     * @param _userBaseShare 用户基础部分比例（基数10000）
     * @param _splitShare 分流部分比例（基数10000）
     * 注意：两者之和必须等于10000
     */
    function setDistributionRates(uint256 _userBaseShare, uint256 _splitShare) external onlyOwner {
        require(_userBaseShare + _splitShare == DISTRIBUTION_BASE, "Must sum to 10000");
        require(_userBaseShare > 0, "User share must be > 0");

        userBaseShare = _userBaseShare;
        splitShare = _splitShare;

        emit DistributionRatesUpdated(_userBaseShare, _splitShare);
    }

    /**
     * @dev 设置推荐奖励比例（仅管理员）
     * @param _level1 1代推荐比例（基数10000）
     * @param _level2 2代推荐比例（基数10000）
     * @param _level3 3代推荐比例（基数10000）
     */
    function setReferralRates(uint256 _level1, uint256 _level2, uint256 _level3) external onlyOwner {
        uint256 totalReferral = _level1 + _level2 + _level3;
        require(totalReferral <= DISTRIBUTION_BASE, "Total rate too high");

        // 验证推荐+团队最高比例不超过用户基础部分（65%）
        uint256 maxTeamRate = teamLevelRates.length > 0 ? teamLevelRates[teamLevelRates.length - 1] : 0;
        require(totalReferral + maxTeamRate <= userBaseShare, "Referral + team rate exceeds user base share");

        referralLevel1 = _level1;
        referralLevel2 = _level2;
        referralLevel3 = _level3;

        emit ReferralRatesUpdated(_level1, _level2, _level3);
    }

    /**
     * @dev 管理员转移LP（仅限多余的LP，不能转移用户质押的LP）
     */
    function adminTransferLP(address _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "Invalid address");
        uint256 contractBalance = lpToken.balanceOf(address(this));

        // 只能转移多余的LP（合约余额 - 用户质押总量）
        uint256 excessLP = contractBalance > totalStaked ? contractBalance - totalStaked : 0;
        require(_amount <= excessLP, "Cannot transfer user staked LP");

        lpToken.safeTransfer(_to, _amount);

        emit AdminTransferLP(_to, _amount);
    }

    /**
     * @dev 紧急提取
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
                if (totalDistributed + reward > totalRewards) {
                    reward = totalRewards - totalDistributed;
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
        uint256 teamLevel,
        uint256 unlockTime,
        bool isLocked
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
        unlockTime = user.unlockTime;
        isLocked = block.timestamp < user.unlockTime;
    }

    /**
     * @dev 查询用户锁仓状态
     */
    function getLockStatus(address _user) external view returns (
        uint256 unlockTime,
        uint256 remainingTime,
        bool isLocked
    ) {
        UserInfo storage user = userInfo[_user];
        unlockTime = user.unlockTime;
        isLocked = block.timestamp < user.unlockTime;
        remainingTime = isLocked ? user.unlockTime - block.timestamp : 0;
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
     * @dev 获取分流地址配置
     */
    function getSplitConfig() external view returns (
        address[] memory addresses,
        uint256[] memory rates
    ) {
        addresses = new address[](splitAddresses.length);
        rates = new uint256[](splitAddresses.length);

        for (uint256 i = 0; i < splitAddresses.length; i++) {
            addresses[i] = splitAddresses[i].addr;
            rates[i] = splitAddresses[i].rate;
        }

        return (addresses, rates);
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
            totalRewards - totalDistributed,
            miningEnded
        );
    }

    /**
     * @dev 获取奖励分发统计
     */
    function getDistributionStats() external view returns (
        uint256 _totalReferralDistributed,
        uint256 _totalTeamDistributed,
        uint256 _totalSplitDistributed
    ) {
        return (totalReferralDistributed, totalTeamDistributed, totalSplitDistributed);
    }
}
