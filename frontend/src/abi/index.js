export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

export const LP_MINING_ABI = [
  // 读取函数
  "function rewardToken() view returns (address)",
  "function lpToken() view returns (address)",
  "function totalStaked() view returns (uint256)",
  "function startTime() view returns (uint256)",
  "function endTime() view returns (uint256)",
  "function miningEnded() view returns (bool)",
  "function rewardPerSecond() view returns (uint256)",
  "function accRewardPerShare() view returns (uint256)",
  "function lastRewardTime() view returns (uint256)",
  "function totalDistributed() view returns (uint256)",
  "function totalReferralDistributed() view returns (uint256)",
  "function totalTeamDistributed() view returns (uint256)",
  "function totalSplitDistributed() view returns (uint256)",

  // 可配置参数（新增）
  "function lockDuration() view returns (uint256)",
  "function totalRewards() view returns (uint256)",
  "function miningDuration() view returns (uint256)",
  "function userBaseShare() view returns (uint256)",
  "function splitShare() view returns (uint256)",
  "function referralLevel1() view returns (uint256)",
  "function referralLevel2() view returns (uint256)",
  "function referralLevel3() view returns (uint256)",

  // 用户信息
  "function userInfo(address) view returns (uint256 amount, uint256 rewardDebt, uint256 pendingRewards, uint256 totalClaimed, address referrer, uint256 referralRewards, uint256 teamRewards, uint256 teamPerformance, uint256 bigAreaPerformance, uint256 smallAreaPerformance, uint256 directReferrals, uint256 unlockTime)",
  "function pendingReward(address) view returns (uint256)",
  "function getUserInfo(address) view returns (uint256 stakedAmount, uint256 pendingRewards, uint256 referralRewards, uint256 teamRewards, uint256 totalClaimed, address referrer, uint256 referralCount, uint256 teamPerformance, uint256 smallAreaPerformance, uint256 teamLevel, uint256 unlockTime, bool isLocked)",
  "function getLockStatus(address) view returns (uint256 unlockTime, uint256 remainingTime, bool isLocked)",
  "function getMiningStatus() view returns (uint256 _totalStaked, uint256 _totalDistributed, uint256 _rewardPerSecond, uint256 _startTime, uint256 _endTime, uint256 _remainingRewards, bool _miningEnded)",
  "function getDistributionStats() view returns (uint256 _totalReferralDistributed, uint256 _totalTeamDistributed, uint256 _totalSplitDistributed)",
  "function getReferrals(address) view returns (address[])",
  "function getReferralsPaginated(address, uint256 offset, uint256 limit) view returns (address[] result, uint256 total)",
  "function getTeamLevelConfig() view returns (uint256[] thresholds, uint256[] rates)",
  "function getSplitConfig() view returns (address[] addresses, uint256[] rates)",
  "function hasReferrer(address) view returns (bool)",
  "function owner() view returns (address)",

  // 写入函数
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function claim()",
  "function setReferrer(address referrer)",
  "function claimReferralRewards()",
  "function claimTeamRewards()",

  // 管理员函数（新增）
  "function setLockDuration(uint256 duration)",
  "function setMiningParams(uint256 _totalRewards, uint256 _miningDuration)",
  "function setDistributionRates(uint256 _userBaseShare, uint256 _splitShare)",
  "function setReferralRates(uint256 _level1, uint256 _level2, uint256 _level3)",
  "function setTeamLevels(uint256[] thresholds, uint256[] rates)",
  "function setSplitAddresses(address[] addresses, uint256[] rates)",
  "function adminTransferLP(address _to, uint256 _amount)",

  // 事件
  "event Deposit(address indexed user, uint256 amount, uint256 unlockTime)",
  "event Withdraw(address indexed user, uint256 amount)",
  "event Claim(address indexed user, uint256 userAmount, uint256 splitAmount)",
  "event ReferrerSet(address indexed user, address indexed referrer)",
  "event ReferralReward(address indexed user, address indexed referrer, uint256 level, uint256 amount)",
  "event TeamReward(address indexed user, uint256 amount)",
  "event SplitDistributed(address indexed to, uint256 amount)",
  "event LockDurationUpdated(uint256 oldDuration, uint256 newDuration)",
  "event MiningParamsUpdated(uint256 totalRewards, uint256 miningDuration, uint256 rewardPerSecond)",
  "event DistributionRatesUpdated(uint256 userBaseShare, uint256 splitShare)",
  "event ReferralRatesUpdated(uint256 level1, uint256 level2, uint256 level3)"
];

export const TOKEN_MINING_ABI = [
  // 读取函数
  "function stakingToken() view returns (address)",
  "function rewardToken() view returns (address)",
  "function totalStaked() view returns (uint256)",
  "function totalDistributed() view returns (uint256)",
  "function startTime() view returns (uint256)",
  "function miningEnded() view returns (bool)",

  // 常量
  "function TOTAL_REWARDS() view returns (uint256)",
  "function DAILY_RATE() view returns (uint256)",
  "function RATE_BASE() view returns (uint256)",

  // 用户信息
  "function userInfo(address) view returns (uint256 amount, uint256 lastUpdateTime, uint256 pendingRewards, uint256 totalClaimed)",
  "function pendingReward(address) view returns (uint256)",
  "function getUserInfo(address) view returns (uint256 stakedAmount, uint256 pendingRewards, uint256 totalClaimed, uint256 dailyReward)",
  "function getMiningStatus() view returns (uint256 _totalStaked, uint256 _totalDistributed, uint256 _remainingRewards, bool _miningEnded, uint256 _startTime)",
  "function getAPY() view returns (uint256)",

  // 写入函数
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function claim()",

  // 事件
  "event Deposit(address indexed user, uint256 amount)",
  "event Withdraw(address indexed user, uint256 amount)",
  "event Claim(address indexed user, uint256 amount)",
  "event MiningEnded(uint256 totalDistributed)"
];

// TokenMiningV2 ABI - 多档锁仓挖矿
export const TOKEN_MINING_V2_ABI = [
  // 读取函数
  "function stakingToken() view returns (address)",
  "function rewardToken() view returns (address)",
  "function totalStaked() view returns (uint256)",
  "function totalDistributed() view returns (uint256)",
  "function startTime() view returns (uint256)",
  "function miningEnded() view returns (bool)",
  "function totalRewards() view returns (uint256)",
  "function RATE_BASE() view returns (uint256)",
  "function SECONDS_PER_DAY() view returns (uint256)",
  "function owner() view returns (address)",

  // 用户信息
  "function userInfo(address) view returns (uint256 totalStaked, uint256 totalClaimed, uint256 stakeCount)",
  "function stakeRecords(address, uint256) view returns (uint256 amount, uint256 lastUpdateTime, uint256 pendingRewards, uint256 unlockTime, uint8 tier, bool active)",
  "function pendingReward(address user, uint256 stakeId) view returns (uint256)",
  "function pendingRewardAll(address user) view returns (uint256)",
  "function getUserStakes(address user) view returns (uint256[] stakeIds, uint256[] amounts, uint256[] unlockTimes, uint8[] tiers, uint256[] pendingRewards, bool[] actives)",
  "function getStakeRecord(address user, uint256 stakeId) view returns (uint256 amount, uint256 unlockTime, uint8 tier, uint256 pending, bool active)",
  "function getUserInfo(address user) view returns (uint256 _totalStaked, uint256 _totalClaimed, uint256 _stakeCount, uint256 _pendingRewards, uint256 _activeStakeCount)",
  "function getUserActiveStakeCount(address user) view returns (uint256 activeCount)",
  "function getMiningStatus() view returns (uint256 _totalStaked, uint256 _totalDistributed, uint256 _remainingRewards, bool _miningEnded, uint256 _startTime)",

  // 档位配置
  "function tierConfigs(uint8) view returns (uint256 duration, uint256 dailyRate)",
  "function getTierConfig(uint8 tier) view returns (uint256 duration, uint256 dailyRate, uint256 annualAPY)",
  "function getAllTierConfigs() view returns (uint256[4] durations, uint256[4] dailyRates, uint256[4] annualAPYs)",

  // 写入函数
  "function deposit(uint256 amount, uint8 tier)",
  "function withdraw(uint256 stakeId)",
  "function claim(uint256 stakeId)",
  "function claimAll()",

  // 管理员函数
  "function setTierConfig(uint8 tier, uint256 duration, uint256 dailyRate)",
  "function setTotalRewards(uint256 _totalRewards)",
  "function emergencyWithdraw(address token, uint256 amount)",

  // 事件
  "event Deposit(address indexed user, uint256 indexed stakeId, uint256 amount, uint8 tier, uint256 unlockTime)",
  "event Withdraw(address indexed user, uint256 indexed stakeId, uint256 amount)",
  "event Claim(address indexed user, uint256 indexed stakeId, uint256 amount)",
  "event ClaimAll(address indexed user, uint256 amount)",
  "event TierConfigUpdated(uint8 tier, uint256 duration, uint256 dailyRate)",
  "event MiningEnded(uint256 totalDistributed)"
];

// ProjectTokenV2 ABI - 带滑点代币
export const PROJECT_TOKEN_V2_ABI = [
  // ERC20基础
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",

  // 滑点配置
  "function buyFee() view returns (uint256)",
  "function sellFee() view returns (uint256)",
  "function feeReceiver() view returns (address)",
  "function FEE_BASE() view returns (uint256)",
  "function isPair(address) view returns (bool)",
  "function isExcludedFromFee(address) view returns (bool)",
  "function getFeeConfig() view returns (uint256 _buyFee, uint256 _sellFee, address _feeReceiver)",
  "function calculateSellAmount(uint256 amount) view returns (uint256 feeAmount, uint256 receiveAmount)",
  "function calculateBuyAmount(uint256 amount) view returns (uint256 feeAmount, uint256 receiveAmount)",

  // 管理员函数
  "function setPair(address pair, bool status)",
  "function setPairsBatch(address[] pairs, bool status)",
  "function setFees(uint256 _buyFee, uint256 _sellFee)",
  "function setFeeReceiver(address _feeReceiver)",
  "function setExcludedFromFee(address account, bool status)",
  "function setExcludedFromFeeBatch(address[] accounts, bool status)",
  "function burn(uint256 amount)",
  "function owner() view returns (address)",

  // 事件
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event PairUpdated(address indexed pair, bool status)",
  "event FeeReceiverUpdated(address indexed oldReceiver, address indexed newReceiver)",
  "event FeesUpdated(uint256 buyFee, uint256 sellFee)",
  "event ExcludedFromFee(address indexed account, bool status)",
  "event FeeCollected(address indexed from, address indexed to, uint256 amount, bool isSell)"
];
