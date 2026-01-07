// BSC 主网合约地址 (2026-01-07 部署)
export const CONTRACTS = {
  // AGG 代币 (ProjectTokenV2)
  REWARD_TOKEN: '0xCd339aec4797790A8e387eF10035df0000d3a815',
  PROJECT_TOKEN_V2: '0xCd339aec4797790A8e387eF10035df0000d3a815',

  // TokenMiningV2 (多档锁仓挖矿)
  TOKEN_MINING_V2: '0xB4089956A0b775638e8F9F2E17deaE35B102c860',

  // LP 相关 (创建流动性后填入)
  LP_TOKEN: '',           // PancakeSwap LP Token 地址
  LP_MINING: '',          // LPMiningV2 合约地址
  TOKEN_V2_PAIR: '',      // AGG/WBNB 交易对地址

  // 旧版合约 (不使用)
  TOKEN_MINING: '',
};

// BSC 网络配置
export const NETWORKS = {
  BSC_TESTNET: {
    chainId: '0x61', // 97 in hex
    chainName: 'BSC Testnet',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'tBNB',
      decimals: 18,
    },
    rpcUrls: [
      'https://data-seed-prebsc-1-s1.binance.org:8545/',
      'https://data-seed-prebsc-2-s1.binance.org:8545/',
      'https://data-seed-prebsc-1-s2.binance.org:8545/',
      'https://data-seed-prebsc-2-s2.binance.org:8545/',
      'https://data-seed-prebsc-1-s3.binance.org:8545/',
      'https://bsc-testnet.publicnode.com',
      'https://endpoints.omniatech.io/v1/bsc/testnet/public',
      'https://bsc-testnet.blockpi.network/v1/rpc/public'
    ],
    blockExplorerUrls: ['https://testnet.bscscan.com'],
  },
  BSC_MAINNET: {
    chainId: '0x38', // 56 in hex
    chainName: 'BNB Smart Chain',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
    rpcUrls: [
      'https://bsc-dataseed.binance.org/',
      'https://bsc-dataseed1.binance.org/',
      'https://bsc-dataseed2.binance.org/',
      'https://bsc.publicnode.com',
      'https://bsc.blockpi.network/v1/rpc/public'
    ],
    blockExplorerUrls: ['https://bscscan.com'],
  },
};

// 当前使用的网络 - 主网
export const CURRENT_NETWORK = NETWORKS.BSC_MAINNET;

// 挖矿参数
export const MINING_CONFIG = {
  LP_MINING: {
    TOTAL_REWARDS: 70_000_000,
    DURATION_DAYS: 1095, // 3年
    USER_SHARE: 65, // 65%
    BONUS_SHARE: 35, // 35%
  },
  TOKEN_MINING: {
    TOTAL_REWARDS: 30_000_000,
    DAILY_RATE: 0.5, // 0.5%
    APY: 182.5, // 0.5% * 365
  },
  // V2 代币挖矿 - 多档锁仓
  TOKEN_MINING_V2: {
    TOTAL_REWARDS: 30_000_000,
    DAILY_RATE: 0.5, // 0.5%
    APY: 182.5, // 0.5% * 365
    LOCK_PERIOD: 0, // 无锁仓
  },
  // V2 代币 - 买卖滑点
  TOKEN_V2: {
    BUY_FEE: 0,      // 买入滑点 0%
    SELL_FEE: 2.8,   // 卖出滑点 2.8%
  },
  REFERRAL: {
    LEVEL1: 20, // 20%
    LEVEL2: 10, // 10%
    LEVEL3: 5,  // 5%
  },
  TEAM: {
    LEVEL1: { threshold: 1000, rate: 1 },
    LEVEL2: { threshold: 5000, rate: 1.5 },
    LEVEL3: { threshold: 10000, rate: 2 },
  },
};

// APY计算工具 - 复利公式（仅供参考，实际显示使用合约的简单年化）
// 合约使用简单年化：APY = 日收益% × 365
// 复利公式：APY = (1 + r)^365 - 1（实际收益会更高）
export const calculateAPY = (dailyRate) => {
  // dailyRate 是百分比，如 0.4 表示 0.4%
  // 复利公式: APY = (1 + r)^365 - 1
  const r = dailyRate / 100; // 转换为小数
  const apy = (Math.pow(1 + r, 365) - 1) * 100;
  return Math.round(apy); // 返回整数百分比
};

// 简单年化计算（与合约一致）
export const calculateSimpleAPY = (dailyRate) => {
  // dailyRate 是百分比，如 0.4 表示 0.4%
  // 简单年化: APY = 日收益% × 365
  return Math.round(dailyRate * 365);
};

// 格式化工具
export const formatNumber = (num, decimals = 2) => {
  if (num === undefined || num === null || num === '') return '0';
  const n = parseFloat(num);
  if (isNaN(n)) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(decimals) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(decimals) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(decimals) + 'K';
  // 小于1000的数字，最多显示4位小数
  if (n < 1) return n.toFixed(Math.min(decimals + 2, 6));
  return n.toFixed(decimals);
};

export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatEther = (value, decimals = 4) => {
  if (!value) return '0';
  const num = parseFloat(value) / 1e18;
  return num.toFixed(decimals);
};

// 合约错误消息映射 - 提供友好的中文提示
export const CONTRACT_ERRORS = {
  // LPMiningV2 错误
  'Already has referrer': '您已设置过推荐人，无法更改',
  'Cannot refer self': '不能将自己设为推荐人',
  'Referrer must be staker or owner': '推荐人必须是已质押用户或合约所有者',
  'Referrer has too many referrals': '该推荐人的直推人数已达上限',
  'Circular referral not allowed': '不允许循环推荐',
  'Lock duration not passed': '锁仓期未到，无法提取',
  'Amount exceeds staked': '提取数量超过已质押数量',
  'Mining not started': '挖矿尚未开始',
  'Mining ended': '挖矿已结束',
  'No rewards to claim': '暂无可领取收益',
  'No referral rewards': '暂无推荐奖励',
  'No team rewards': '暂无团队奖励',
  'Insufficient balance': '余额不足',
  'Insufficient allowance': '授权额度不足',

  // TokenMiningV2 错误
  'Invalid tier': '无效的锁仓档位',
  'Stake not found': '质押记录不存在',
  'Stake already withdrawn': '该质押已提取',
  'Lock period not ended': '锁仓期未结束',
  'No pending rewards': '暂无待领取收益',
  'Rewards depleted': '奖励池已耗尽',
  'Too many active stakes': '活跃质押数量已达上限（最多50笔）',
  'Stake not active': '该质押记录已失效',

  // ProjectTokenV2 错误
  'Fee too high': '滑点设置过高（最高10%）',
  'Invalid address': '无效的地址',

  // 通用错误
  'user rejected transaction': '您取消了交易',
  'insufficient funds': '钱包余额不足以支付 Gas 费',
  'execution reverted': '交易执行失败',
};

// 解析错误消息
export const parseContractError = (error) => {
  if (!error) return '操作失败';

  // 尝试从 error.reason 获取
  const reason = error.reason || error.message || '';

  // 检查是否匹配已知错误
  for (const [key, value] of Object.entries(CONTRACT_ERRORS)) {
    if (reason.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // 检查用户拒绝
  if (reason.includes('user rejected') || reason.includes('denied')) {
    return '您取消了交易';
  }

  // 返回原始错误或默认消息
  return reason || '操作失败，请稍后重试';
};
