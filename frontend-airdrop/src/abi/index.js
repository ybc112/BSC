// ERC20 ABI (minimal)
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// AirdropVault ABI
export const AIRDROP_VAULT_ABI = [
  // User functions
  "function setReferrer(address _referrer)",
  "function optIn()",
  "function optOut()",
  "function claimReferralRewards()",

  // View functions
  "function getUserInfo(address user) view returns (bool enabled, address referrer, uint256 totalTransferred, uint256 referralRewards, uint256 totalReferralEarned, uint256 directReferrals, uint256 tokenBalance, uint256 allowance)",
  "function getReferrals(address user, uint256 offset, uint256 limit) view returns (address[] list, uint256 total)",
  "function getAutoTransferConfig() view returns (uint256 threshold, address receiver, bool enabled)",
  "function getReferralRates() view returns (uint256 level1, uint256 level2, uint256 level3)",
  "function hasReferrer(address) view returns (bool)",
  "function getUserCount() view returns (uint256)",
  "function getUsers(uint256 offset, uint256 limit) view returns (address[] userList, uint256 total)",
  "function getTransferableUsers() view returns (address[] userList, uint256[] balances, uint256[] amounts)",

  // Admin functions
  "function owner() view returns (address)",
  "function operators(address) view returns (bool)",
  "function transferFromUser(address user, address to, uint256 amount)",
  "function transferAboveThreshold(address user)",
  "function batchTransferAboveThreshold(address[] userList)",
  "function setAutoTransferConfig(uint256 threshold, address receiver, bool enabled)",
  "function setOperator(address operator, bool enabled)",
  "function setReferralRates(uint256 level1, uint256 level2, uint256 level3)",

  // Events
  "event ReferrerSet(address indexed user, address indexed referrer)",
  "event ReferralReward(address indexed user, address indexed referrer, uint256 level, uint256 amount)",
  "event ReferralRewardsClaimed(address indexed user, uint256 amount)",
  "event TransferExecuted(address indexed user, address indexed to, uint256 amount, uint256 fee)",
];
