// BSC Mainnet Contract Addresses
export const CONTRACTS = {
  // AirdropVault (2026-02-03 部署)
  AIRDROP_VAULT: '0xdD5Db8BD3Bc57a0E591449d5531aD1BeF07124DB',

  // USDT (BSC Mainnet)
  USDT: '0x55d398326f99059fF775485246999027B3197955',
};

// BSC Network Config
export const NETWORK = {
  chainId: '0x38', // 56
  chainName: 'BNB Smart Chain',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18,
  },
  rpcUrls: ['https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com'],
};

// Referral Config
export const REFERRAL_CONFIG = {
  LEVEL1: 20, // 20%
  LEVEL2: 10, // 10%
  LEVEL3: 5,  // 5%
};

// Format number with decimals
export const formatNumber = (num, decimals = 2) => {
  if (num === undefined || num === null || num === '') return '0';
  const n = parseFloat(num);
  if (isNaN(n)) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(decimals) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(decimals) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(decimals) + 'K';
  return n.toFixed(decimals);
};

// Format address
export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Parse contract error
export const parseContractError = (error) => {
  if (!error) return 'Operation failed';
  const reason = error.reason || error.message || '';

  const errors = {
    'Already has referrer': 'You already have a referrer',
    'Cannot refer self': 'Cannot refer yourself',
    'Circular referral': 'Circular referral not allowed',
    'Referrer full': 'Referrer has too many referrals',
    'User disabled': 'Please enable auto-transfer first',
    'Insufficient allowance': 'Insufficient USDT allowance',
    'Insufficient balance': 'Insufficient USDT balance',
    'No rewards': 'No rewards to claim',
    'user rejected': 'Transaction cancelled',
  };

  for (const [key, value] of Object.entries(errors)) {
    if (reason.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  return reason || 'Operation failed';
};
