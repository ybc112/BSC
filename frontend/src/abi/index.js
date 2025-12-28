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
  "function unallocatedPool() view returns (uint256)",

  // 用户信息
  "function userInfo(address) view returns (uint256 amount, uint256 rewardDebt, uint256 pendingRewards, uint256 totalClaimed, address referrer, uint256 referralRewards, uint256 teamRewards, uint256 teamPerformance, uint256 bigAreaPerformance, uint256 smallAreaPerformance, uint256 directReferrals)",
  "function pendingReward(address) view returns (uint256)",
  "function getUserInfo(address) view returns (uint256 stakedAmount, uint256 pendingRewards, uint256 referralRewards, uint256 teamRewards, uint256 totalClaimed, address referrer, uint256 referralCount, uint256 teamPerformance, uint256 smallAreaPerformance, uint256 teamLevel)",
  "function getMiningStatus() view returns (uint256 _totalStaked, uint256 _totalDistributed, uint256 _rewardPerSecond, uint256 _startTime, uint256 _endTime, uint256 _remainingRewards, bool _miningEnded)",
  "function getBonusStats() view returns (uint256 _totalBonusDistributed, uint256 _unallocatedPool)",
  "function getReferrals(address) view returns (address[])",
  "function getReferralsPaginated(address, uint256 offset, uint256 limit) view returns (address[] result, uint256 total)",
  "function getTeamLevelConfig() view returns (uint256[] thresholds, uint256[] rates)",
  "function hasReferrer(address) view returns (bool)",

  // 写入函数
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function claim()",
  "function setReferrer(address referrer)",
  "function claimReferralRewards()",
  "function claimTeamRewards()",

  // 事件
  "event Deposit(address indexed user, uint256 amount)",
  "event Withdraw(address indexed user, uint256 amount)",
  "event Claim(address indexed user, uint256 userAmount, uint256 bonusAmount)",
  "event ReferrerSet(address indexed user, address indexed referrer)",
  "event ReferralReward(address indexed user, address indexed referrer, uint256 level, uint256 amount)",
  "event TeamReward(address indexed user, uint256 amount)"
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
