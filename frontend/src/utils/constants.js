// BSC Testnet 合约地址 (2025-12-26 部署)
export const CONTRACTS = {
  REWARD_TOKEN: '0xc128619A2a2509d4d43BccC16a1180532D033A74',
  LP_TOKEN: '0xEF6363Af32A6fD4BA6A2d8f6C396F5707849A0be',
  LP_MINING: '0xCd339aec4797790A8e387eF10035df0000d3a815',
  TOKEN_MINING: '0xB4089956A0b775638e8F9F2E17deaE35B102c860',
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
    rpcUrls: ['https://bsc-testnet-rpc.publicnode.com'],
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
    rpcUrls: ['https://bsc-dataseed.binance.org/'],
    blockExplorerUrls: ['https://bscscan.com'],
  },
};

// 当前使用的网络
export const CURRENT_NETWORK = NETWORKS.BSC_TESTNET;

// 挖矿参数
export const MINING_CONFIG = {
  LP_MINING: {
    TOTAL_REWARDS: 60_000_000,
    DURATION_DAYS: 1095, // 3年
    USER_SHARE: 65, // 65%
    BONUS_SHARE: 35, // 35%
  },
  TOKEN_MINING: {
    TOTAL_REWARDS: 30_000_000,
    DAILY_RATE: 0.5, // 0.5%
    APY: 182.5, // 0.5% * 365
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

// 格式化工具
export const formatNumber = (num, decimals = 2) => {
  if (num === undefined || num === null) return '0';
  const n = parseFloat(num);
  if (n >= 1e9) return (n / 1e9).toFixed(decimals) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(decimals) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(decimals) + 'K';
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
