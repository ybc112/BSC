import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import {
  FiSettings, FiShield, FiDollarSign, FiUsers, FiLock, FiPercent,
  FiChevronDown, FiChevronUp, FiAlertTriangle, FiCheck, FiCopy,
  FiLayers, FiGift, FiActivity, FiEdit3, FiSave, FiRefreshCw, FiPlus, FiMinus, FiTarget
} from 'react-icons/fi';
import { formatNumber, CONTRACTS } from '../utils/constants';
import { useLanguage } from '../contexts/LanguageContext';

export default function AdminPage({
  account,
  contracts,
  lpMiningData,
  tokenMiningV2Data,
  onRefresh
}) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('lp-mining');
  const [isUpdating, setIsUpdating] = useState(false);

  // LP Mining 配置
  const [lpConfig, setLpConfig] = useState({
    lockDays: '',
    totalRewards: '',
    miningYears: '',
    userShare: '',
    splitShare: '',
    ref1: '',
    ref2: '',
    ref3: '',
  });

  // 分流地址配置
  const [splitConfig, setSplitConfig] = useState({
    addresses: ['', '', ''],
    rates: ['', '', ''],
  });

  // 团队等级配置
  const [teamLevelConfig, setTeamLevelConfig] = useState({
    thresholds: ['', '', ''],
    rates: ['', '', ''],
  });

  // TokenMiningV2 配置
  const [tokenV2Config, setTokenV2Config] = useState({
    totalRewards: '',
    tier0Rate: '',
    tier1Rate: '',
    tier2Rate: '',
    tier3Rate: '',
  });

  // ProjectTokenV2 配置
  const [tokenConfig, setTokenConfig] = useState({
    buyFee: '',
    sellFee: '',
    pairAddress: '',
    excludeAddress: '',
    feeReceiver: '',
  });

  // Owner 状态
  const [owners, setOwners] = useState({
    lpMining: null,
    tokenMiningV2: null,
    projectTokenV2: null,
  });
  const [loadingOwners, setLoadingOwners] = useState(true);

  // 加载 owner 信息
  useEffect(() => {
    const loadOwners = async () => {
      setLoadingOwners(true);
      try {
        const results = await Promise.all([
          contracts.lpMining?.owner().catch(() => null),
          contracts.tokenMiningV2?.owner().catch(() => null),
          contracts.projectTokenV2?.owner().catch(() => null),
        ]);
        console.log('Loaded owners:', results);
        console.log('Current account:', account);
        setOwners({
          lpMining: results[0],
          tokenMiningV2: results[1],
          projectTokenV2: results[2],
        });
      } catch (err) {
        console.error('Load owners error:', err);
      } finally {
        setLoadingOwners(false);
      }
    };
    if (contracts.lpMining || contracts.tokenMiningV2 || contracts.projectTokenV2) {
      loadOwners();
    }
  }, [contracts.lpMining, contracts.tokenMiningV2, contracts.projectTokenV2, account]);

  const isOwner = (contract) => {
    const owner = owners[contract];
    return owner && account && owner.toLowerCase() === account.toLowerCase();
  };

  const isAnyOwner = isOwner('lpMining') || isOwner('tokenMiningV2') || isOwner('projectTokenV2');

  // ============ LP Mining 管理函数 ============
  const handleSetLockDuration = async () => {
    if (!contracts?.lpMining || !lpConfig.lockDays) return;
    setIsUpdating(true);
    try {
      const duration = parseInt(lpConfig.lockDays) * 86400;
      const tx = await contracts.lpMining.setLockDuration(duration);
      toast.loading(t('toast.settingLockPeriod'), { id: 'setLock' });
      await tx.wait();
      toast.success(t('toast.lockPeriodSuccess'), { id: 'setLock' });
      setLpConfig(prev => ({ ...prev, lockDays: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || t('toast.settingFailed'), { id: 'setLock' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetMiningParams = async () => {
    if (!contracts?.lpMining || !lpConfig.totalRewards || !lpConfig.miningYears) return;
    setIsUpdating(true);
    try {
      const totalRewards = ethers.parseEther(lpConfig.totalRewards);
      const duration = parseFloat(lpConfig.miningYears) * 365 * 86400;
      const tx = await contracts.lpMining.setMiningParams(totalRewards, Math.floor(duration));
      toast.loading(t('toast.settingParams'), { id: 'setParams' });
      await tx.wait();
      toast.success(t('toast.paramsSuccess'), { id: 'setParams' });
      setLpConfig(prev => ({ ...prev, totalRewards: '', miningYears: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || t('toast.settingFailed'), { id: 'setParams' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetDistributionRates = async () => {
    if (!contracts?.lpMining || !lpConfig.userShare || !lpConfig.splitShare) return;
    setIsUpdating(true);
    try {
      const userShare = parseInt(lpConfig.userShare) * 100;
      const splitShare = parseInt(lpConfig.splitShare) * 100;
      const tx = await contracts.lpMining.setDistributionRates(userShare, splitShare);
      toast.loading(t('toast.settingDistribution'), { id: 'setDist' });
      await tx.wait();
      toast.success(t('toast.distributionSuccess'), { id: 'setDist' });
      setLpConfig(prev => ({ ...prev, userShare: '', splitShare: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || t('toast.settingFailed'), { id: 'setDist' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetReferralRates = async () => {
    if (!contracts?.lpMining || !lpConfig.ref1 || !lpConfig.ref2 || !lpConfig.ref3) return;
    setIsUpdating(true);
    try {
      const ref1 = parseInt(lpConfig.ref1) * 100;
      const ref2 = parseInt(lpConfig.ref2) * 100;
      const ref3 = parseInt(lpConfig.ref3) * 100;
      const tx = await contracts.lpMining.setReferralRates(ref1, ref2, ref3);
      toast.loading(t('toast.settingReferralRates'), { id: 'setRef' });
      await tx.wait();
      toast.success(t('toast.referralRatesSuccess'), { id: 'setRef' });
      setLpConfig(prev => ({ ...prev, ref1: '', ref2: '', ref3: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || t('toast.settingFailed'), { id: 'setRef' });
    } finally {
      setIsUpdating(false);
    }
  };

  // 设置分流地址
  const handleSetSplitAddresses = async () => {
    if (!contracts?.lpMining) return;
    const validAddresses = splitConfig.addresses.filter(a => ethers.isAddress(a));
    const validRates = splitConfig.rates.filter((r, i) => ethers.isAddress(splitConfig.addresses[i]) && r);

    if (validAddresses.length === 0) {
      toast.error(t('toast.fillValidAddress'));
      return;
    }

    setIsUpdating(true);
    try {
      // rates 转换为 basis points (如 10% = 1000)
      const ratesInBP = validRates.map(r => Math.floor(parseFloat(r) * 100));
      const tx = await contracts.lpMining.setSplitAddresses(validAddresses, ratesInBP);
      toast.loading(t('toast.settingSplitAddresses'), { id: 'setSplit' });
      await tx.wait();
      toast.success(t('toast.splitAddressesSuccess'), { id: 'setSplit' });
      setSplitConfig({ addresses: ['', '', ''], rates: ['', '', ''] });
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || t('toast.settingFailed'), { id: 'setSplit' });
    } finally {
      setIsUpdating(false);
    }
  };

  // 设置团队等级
  const handleSetTeamLevels = async () => {
    if (!contracts?.lpMining) return;
    const validThresholds = teamLevelConfig.thresholds.filter(t => t);
    const validRates = teamLevelConfig.rates.filter((r, i) => teamLevelConfig.thresholds[i] && r);

    if (validThresholds.length === 0) {
      toast.error(t('toast.fillLevelConfig'));
      return;
    }

    setIsUpdating(true);
    try {
      // thresholds 转换为 wei, rates 转换为 basis points
      const thresholdsInWei = validThresholds.map(t => ethers.parseEther(t));
      const ratesInBP = validRates.map(r => Math.floor(parseFloat(r) * 100));
      const tx = await contracts.lpMining.setTeamLevels(thresholdsInWei, ratesInBP);
      toast.loading(t('toast.settingTeamLevels'), { id: 'setTeamLevel' });
      await tx.wait();
      toast.success(t('toast.teamLevelsSuccess'), { id: 'setTeamLevel' });
      setTeamLevelConfig({ thresholds: ['', '', ''], rates: ['', '', ''] });
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || t('toast.settingFailed'), { id: 'setTeamLevel' });
    } finally {
      setIsUpdating(false);
    }
  };

  // ============ TokenMiningV2 管理函数 ============
  const handleSetTotalRewardsV2 = async () => {
    if (!contracts?.tokenMiningV2 || !tokenV2Config.totalRewards) return;
    setIsUpdating(true);
    try {
      const totalRewards = ethers.parseEther(tokenV2Config.totalRewards);
      const tx = await contracts.tokenMiningV2.setTotalRewards(totalRewards);
      toast.loading(t('toast.settingTotalRewards'), { id: 'setTotalV2' });
      await tx.wait();
      toast.success(t('toast.totalRewardsSuccess'), { id: 'setTotalV2' });
      setTokenV2Config(prev => ({ ...prev, totalRewards: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || t('toast.settingFailed'), { id: 'setTotalV2' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetTierConfig = async (tier) => {
    const rateKey = `tier${tier}Rate`;
    const rate = tokenV2Config[rateKey];
    if (!contracts?.tokenMiningV2 || !rate) return;
    setIsUpdating(true);
    try {
      // rate 是百分比如 0.4，需要转换为 40 (basis points)
      const dailyRate = Math.floor(parseFloat(rate) * 100);
      // 获取当前档位的 duration
      const tierConfig = await contracts.tokenMiningV2.getTierConfig(tier);
      const tx = await contracts.tokenMiningV2.setTierConfig(tier, tierConfig.duration, dailyRate);
      toast.loading(t('toast.settingTierRate'), { id: 'setTier' });
      await tx.wait();
      toast.success(t('toast.tierRateSuccess'), { id: 'setTier' });
      setTokenV2Config(prev => ({ ...prev, [rateKey]: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || t('toast.settingFailed'), { id: 'setTier' });
    } finally {
      setIsUpdating(false);
    }
  };

  // ============ ProjectTokenV2 管理函数 ============
  const handleSetFees = async () => {
    if (!contracts?.projectTokenV2 || tokenConfig.buyFee === '' || tokenConfig.sellFee === '') return;
    setIsUpdating(true);
    try {
      const buyFee = Math.floor(parseFloat(tokenConfig.buyFee) * 100);
      const sellFee = Math.floor(parseFloat(tokenConfig.sellFee) * 100);
      const tx = await contracts.projectTokenV2.setFees(buyFee, sellFee);
      toast.loading(t('toast.settingFees'), { id: 'setFees' });
      await tx.wait();
      toast.success(t('toast.feesSuccess'), { id: 'setFees' });
      setTokenConfig(prev => ({ ...prev, buyFee: '', sellFee: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || t('toast.settingFailed'), { id: 'setFees' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetPair = async () => {
    if (!contracts?.projectTokenV2 || !tokenConfig.pairAddress) return;
    if (!ethers.isAddress(tokenConfig.pairAddress)) {
      toast.error(t('toast.invalidAddress'));
      return;
    }
    setIsUpdating(true);
    try {
      const tx = await contracts.projectTokenV2.setPair(tokenConfig.pairAddress, true);
      toast.loading(t('toast.settingPair'), { id: 'setPair' });
      await tx.wait();
      toast.success(t('toast.pairSuccess'), { id: 'setPair' });
      setTokenConfig(prev => ({ ...prev, pairAddress: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || t('toast.settingFailed'), { id: 'setPair' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetExcluded = async (exclude = true) => {
    if (!contracts?.projectTokenV2 || !tokenConfig.excludeAddress) return;
    if (!ethers.isAddress(tokenConfig.excludeAddress)) {
      toast.error(t('toast.invalidAddress'));
      return;
    }
    setIsUpdating(true);
    try {
      const tx = await contracts.projectTokenV2.setExcludedFromFee(tokenConfig.excludeAddress, exclude);
      toast.loading(exclude ? t('toast.addingWhitelist') : t('toast.removingWhitelist'), { id: 'setExclude' });
      await tx.wait();
      toast.success(exclude ? t('toast.whitelistAdded') : t('toast.whitelistRemoved'), { id: 'setExclude' });
      setTokenConfig(prev => ({ ...prev, excludeAddress: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || t('toast.operationFailed'), { id: 'setExclude' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetFeeReceiver = async () => {
    if (!contracts?.projectTokenV2 || !tokenConfig.feeReceiver) return;
    if (!ethers.isAddress(tokenConfig.feeReceiver)) {
      toast.error(t('toast.invalidAddress'));
      return;
    }
    setIsUpdating(true);
    try {
      const tx = await contracts.projectTokenV2.setFeeReceiver(tokenConfig.feeReceiver);
      toast.loading(t('toast.settingFeeReceiver'), { id: 'setReceiver' });
      await tx.wait();
      toast.success(t('toast.feeReceiverSuccess'), { id: 'setReceiver' });
      setTokenConfig(prev => ({ ...prev, feeReceiver: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || t('toast.settingFailed'), { id: 'setReceiver' });
    } finally {
      setIsUpdating(false);
    }
  };

  // 复制地址
  const copyAddress = (address) => {
    navigator.clipboard.writeText(address);
    toast.success(t('toast.addressCopied'));
  };

  // 未连接或非owner
  if (!account) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <FiShield className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">{t('admin.title')}</h2>
          <p className="text-white/50">{t('admin.pleaseConnect')}</p>
        </div>
      </div>
    );
  }

  if (loadingOwners) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#00D9A5]/30 border-t-[#00D9A5] rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">{t('admin.loading')}</h2>
          <p className="text-white/50">{t('admin.verifyingAdmin')}</p>
        </div>
      </div>
    );
  }

  if (!isAnyOwner) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <FiAlertTriangle className="w-16 h-16 text-[#FF6B6B] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">{t('admin.noAccess')}</h2>
          <p className="text-white/50 mb-4">{t('admin.notOwner')}</p>
          <div className="text-left bg-white/5 rounded-xl p-4 max-w-md mx-auto">
            <p className="text-xs text-white/40 mb-2">{t('admin.debugInfo')}</p>
            <p className="text-xs text-white/60 mb-1">
              {t('admin.connectedAddress')} <code className="text-[#00D9A5]">{account}</code>
            </p>
            <p className="text-xs text-white/60 mb-1">
              {t('admin.lpMiningOwner')} <code className="text-[#FFB800]">{owners.lpMining || t('admin.notLoaded')}</code>
            </p>
            <p className="text-xs text-white/60 mb-1">
              {t('admin.tokenMiningV2Owner')} <code className="text-[#FFB800]">{owners.tokenMiningV2 || t('admin.notLoaded')}</code>
            </p>
            <p className="text-xs text-white/60">
              {t('admin.projectTokenV2Owner')} <code className="text-[#FFB800]">{owners.projectTokenV2 || t('admin.notLoaded')}</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { contractConfig } = lpMiningData || {};
  const { tierConfigs, miningStatus: tokenV2Status } = tokenMiningV2Data || {};

  const tabs = [
    { id: 'lp-mining', name: 'LP Mining', icon: <FiLayers />, hasAccess: isOwner('lpMining') },
    { id: 'token-mining-v2', name: 'TokenMining V2', icon: <FiDollarSign />, hasAccess: isOwner('tokenMiningV2') },
    { id: 'project-token-v2', name: 'ProjectToken V2', icon: <FiPercent />, hasAccess: isOwner('projectTokenV2') },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF6B6B] to-[#FF8A00] flex items-center justify-center shadow-lg shadow-[#FF6B6B]/20">
            <FiShield className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{t('admin.title')}</h1>
            <p className="text-white/50">{t('admin.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
        >
          <FiRefreshCw className="w-4 h-4" />
          {t('admin.refreshData')}
        </button>
      </div>

      {/* Warning Banner */}
      <div className="p-4 rounded-xl bg-[#FF6B6B]/10 border border-[#FF6B6B]/30">
        <div className="flex items-start gap-3">
          <FiAlertTriangle className="w-5 h-5 text-[#FF6B6B] mt-0.5" />
          <div>
            <p className="text-[#FF6B6B] font-medium">{t('admin.warning')}</p>
            <p className="text-white/50 text-sm mt-1">
              {t('admin.warningDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* Contract Addresses */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { name: 'LP Mining', address: CONTRACTS.LP_MINING, isOwner: isOwner('lpMining') },
          { name: 'TokenMining V2', address: CONTRACTS.TOKEN_MINING_V2, isOwner: isOwner('tokenMiningV2') },
          { name: 'ProjectToken V2', address: CONTRACTS.PROJECT_TOKEN_V2, isOwner: isOwner('projectTokenV2') },
        ].map((contract) => (
          <div key={contract.name} className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/50">{contract.name}</span>
              {contract.isOwner ? (
                <span className="px-2 py-0.5 rounded text-xs bg-[#00D9A5]/20 text-[#00D9A5]">Owner</span>
              ) : (
                <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/40">Non-Owner</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs text-white/70 truncate flex-1">{contract.address}</code>
              <button
                onClick={() => copyAddress(contract.address)}
                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
              >
                <FiCopy className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.filter(t => t.hasAccess).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-white/50 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.name}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* LP Mining Tab */}
        {activeTab === 'lp-mining' && isOwner('lpMining') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Current Config */}
            <div className="neon-card">
              <div className="neon-card-inner">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <FiActivity className="w-5 h-5 text-[#00D9A5]" />
                  {t('admin.currentConfig')}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-white/40 mb-1">{t('admin.lockPeriod')}</div>
                    <div className="text-lg font-bold text-white">{contractConfig?.lockDurationDays || 30} {t('admin.days')}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-white/40 mb-1">{t('admin.totalRewards')}</div>
                    <div className="text-lg font-bold text-white">{formatNumber(contractConfig?.totalRewards)} AGG</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-white/40 mb-1">{t('admin.userSplit')}</div>
                    <div className="text-lg font-bold text-white">{contractConfig?.userBaseShare}% / {contractConfig?.splitShare}%</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-white/40 mb-1">{t('admin.referralRates')}</div>
                    <div className="text-lg font-bold text-white">{contractConfig?.referralLevel1}% / {contractConfig?.referralLevel2}% / {contractConfig?.referralLevel3}%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Lock Duration */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiLock className="w-4 h-4 text-[#FFB800]" />
                {t('admin.lockPeriodSetting')}
              </h3>
              <div className="flex gap-3">
                <input
                  type="number"
                  placeholder={t('admin.lockDays')}
                  value={lpConfig.lockDays}
                  onChange={(e) => setLpConfig(prev => ({ ...prev, lockDays: e.target.value }))}
                  className="input-premium flex-1"
                />
                <button
                  onClick={handleSetLockDuration}
                  disabled={isUpdating || !lpConfig.lockDays}
                  className="btn-premium px-6 disabled:opacity-50"
                >
                  <FiSave className="w-4 h-4 mr-2" />
                  {t('admin.save')}
                </button>
              </div>
            </div>

            {/* Mining Params */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiGift className="w-4 h-4 text-[#FFB800]" />
                {t('admin.miningParams')}
              </h3>
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <input
                  type="number"
                  placeholder={t('admin.totalRewardAmount')}
                  value={lpConfig.totalRewards}
                  onChange={(e) => setLpConfig(prev => ({ ...prev, totalRewards: e.target.value }))}
                  className="input-premium"
                />
                <input
                  type="number"
                  placeholder={t('admin.miningDuration')}
                  value={lpConfig.miningYears}
                  onChange={(e) => setLpConfig(prev => ({ ...prev, miningYears: e.target.value }))}
                  className="input-premium"
                />
              </div>
              <button
                onClick={handleSetMiningParams}
                disabled={isUpdating || !lpConfig.totalRewards || !lpConfig.miningYears}
                className="btn-premium w-full disabled:opacity-50"
              >
                <FiSave className="w-4 h-4 mr-2" />
                {t('admin.saveMiningParams')}
              </button>
            </div>

            {/* Distribution Rates */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiPercent className="w-4 h-4 text-[#FFB800]" />
                {t('admin.distributionRates')}
              </h3>
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <input
                  type="number"
                  placeholder={t('admin.userRate')}
                  value={lpConfig.userShare}
                  onChange={(e) => setLpConfig(prev => ({ ...prev, userShare: e.target.value }))}
                  className="input-premium"
                />
                <input
                  type="number"
                  placeholder={t('admin.splitRate')}
                  value={lpConfig.splitShare}
                  onChange={(e) => setLpConfig(prev => ({ ...prev, splitShare: e.target.value }))}
                  className="input-premium"
                />
              </div>
              <button
                onClick={handleSetDistributionRates}
                disabled={isUpdating || !lpConfig.userShare || !lpConfig.splitShare}
                className="btn-premium w-full disabled:opacity-50"
              >
                <FiSave className="w-4 h-4 mr-2" />
                {t('admin.saveDistributionRates')}
              </button>
            </div>

            {/* Referral Rates */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiUsers className="w-4 h-4 text-[#FFB800]" />
                {t('admin.referralRatesSetting')}
              </h3>
              <div className="grid md:grid-cols-3 gap-3 mb-3">
                <input
                  type="number"
                  placeholder={t('admin.level1')}
                  value={lpConfig.ref1}
                  onChange={(e) => setLpConfig(prev => ({ ...prev, ref1: e.target.value }))}
                  className="input-premium"
                />
                <input
                  type="number"
                  placeholder={t('admin.level2')}
                  value={lpConfig.ref2}
                  onChange={(e) => setLpConfig(prev => ({ ...prev, ref2: e.target.value }))}
                  className="input-premium"
                />
                <input
                  type="number"
                  placeholder={t('admin.level3')}
                  value={lpConfig.ref3}
                  onChange={(e) => setLpConfig(prev => ({ ...prev, ref3: e.target.value }))}
                  className="input-premium"
                />
              </div>
              <button
                onClick={handleSetReferralRates}
                disabled={isUpdating || !lpConfig.ref1 || !lpConfig.ref2 || !lpConfig.ref3}
                className="btn-premium w-full disabled:opacity-50"
              >
                <FiSave className="w-4 h-4 mr-2" />
                {t('admin.saveReferralRates')}
              </button>
            </div>

            {/* Split Addresses - 分流地址配置 */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiLayers className="w-4 h-4 text-[#FFB800]" />
                {t('admin.splitAddressConfig')}
              </h3>
              <p className="text-xs text-white/50 mb-4">
                {t('admin.splitAddressDesc')}
              </p>

              {/* 当前配置展示 */}
              {lpMiningData?.splitConfig?.addresses?.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-white/40 mb-2">{t('admin.currentConfigLabel')}</div>
                  {lpMiningData.splitConfig.addresses.map((addr, i) => (
                    <div key={i} className="flex justify-between text-sm mb-1">
                      <span className="text-white/60 font-mono">{addr.slice(0, 10)}...{addr.slice(-6)}</span>
                      <span className="text-[#FFB800]">{lpMiningData.splitConfig.rates[i]}%</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 mb-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <span className="text-white/60 w-12 text-sm">{t('admin.address')}{i + 1}</span>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={splitConfig.addresses[i]}
                      onChange={(e) => {
                        const newAddresses = [...splitConfig.addresses];
                        newAddresses[i] = e.target.value;
                        setSplitConfig(prev => ({ ...prev, addresses: newAddresses }));
                      }}
                      className="input-premium flex-1 font-mono text-sm"
                    />
                    <input
                      type="number"
                      placeholder="%"
                      value={splitConfig.rates[i]}
                      onChange={(e) => {
                        const newRates = [...splitConfig.rates];
                        newRates[i] = e.target.value;
                        setSplitConfig(prev => ({ ...prev, rates: newRates }));
                      }}
                      className="input-premium w-20"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={handleSetSplitAddresses}
                disabled={isUpdating || !splitConfig.addresses.some(a => ethers.isAddress(a))}
                className="btn-premium w-full disabled:opacity-50"
              >
                <FiSave className="w-4 h-4 mr-2" />
                {t('admin.saveSplitConfig')}
              </button>
            </div>

            {/* Team Levels - 团队等级配置 */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiTarget className="w-4 h-4 text-[#FFB800]" />
                {t('admin.teamLevelConfig')}
              </h3>
              <p className="text-xs text-white/50 mb-4">
                {t('admin.teamLevelDesc')}
              </p>

              {/* 当前配置展示 */}
              {lpMiningData?.teamConfig?.thresholds?.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-white/40 mb-2">{t('admin.currentConfigLabel')}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {lpMiningData.teamConfig.thresholds.map((threshold, i) => (
                      <div key={i} className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-white/40">{t('admin.level')} {i + 1}</div>
                        <div className="text-sm text-white">{formatNumber(threshold)} LP</div>
                        <div className="text-xs text-[#FFB800]">{lpMiningData.teamConfig.rates[i]}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3 mb-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <span className="text-white/60 w-12 text-sm">{t('admin.level')}{i + 1}</span>
                    <input
                      type="number"
                      placeholder={t('admin.threshold')}
                      value={teamLevelConfig.thresholds[i]}
                      onChange={(e) => {
                        const newThresholds = [...teamLevelConfig.thresholds];
                        newThresholds[i] = e.target.value;
                        setTeamLevelConfig(prev => ({ ...prev, thresholds: newThresholds }));
                      }}
                      className="input-premium flex-1"
                    />
                    <input
                      type="number"
                      step="0.1"
                      placeholder="%"
                      value={teamLevelConfig.rates[i]}
                      onChange={(e) => {
                        const newRates = [...teamLevelConfig.rates];
                        newRates[i] = e.target.value;
                        setTeamLevelConfig(prev => ({ ...prev, rates: newRates }));
                      }}
                      className="input-premium w-20"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={handleSetTeamLevels}
                disabled={isUpdating || !teamLevelConfig.thresholds.some(t => t)}
                className="btn-premium w-full disabled:opacity-50"
              >
                <FiSave className="w-4 h-4 mr-2" />
                {t('admin.saveTeamLevelConfig')}
              </button>
            </div>
          </motion.div>
        )}

        {/* TokenMiningV2 Tab */}
        {activeTab === 'token-mining-v2' && isOwner('tokenMiningV2') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Current Config */}
            <div className="neon-card">
              <div className="neon-card-inner">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <FiActivity className="w-5 h-5 text-[#FFB800]" />
                  {t('admin.currentConfig')}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-white/40 mb-1">{t('admin.totalStaked')}</div>
                    <div className="text-lg font-bold text-white">{formatNumber(tokenV2Status?.totalStaked)} AGG</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-white/40 mb-1">{t('admin.distributed')}</div>
                    <div className="text-lg font-bold text-white">{formatNumber(tokenV2Status?.totalDistributed)} AGG</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-white/40 mb-1">{t('admin.remainingRewards')}</div>
                    <div className="text-lg font-bold text-white">{formatNumber(tokenV2Status?.remainingRewards)} AGG</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-white/40 mb-1">{t('admin.status')}</div>
                    <div className={`text-lg font-bold ${tokenV2Status?.miningEnded ? 'text-[#FF6B6B]' : 'text-[#00D9A5]'}`}>
                      {tokenV2Status?.miningEnded ? t('admin.ended') : t('admin.inProgress')}
                    </div>
                  </div>
                </div>
                <h4 className="text-sm text-white/60 mb-3">{t('admin.tierRates')}</h4>
                <div className="grid grid-cols-4 gap-3">
                  {[t('admin.flexible'), t('admin.months3'), t('admin.months6'), t('admin.months12')].map((name, i) => (
                    <div key={i} className="p-3 rounded-lg bg-white/5 text-center">
                      <div className="text-xs text-white/40 mb-1">{name}</div>
                      <div className="text-lg font-bold text-[#FFB800]">{tierConfigs?.dailyRates?.[i] || '-'}%</div>
                      <div className="text-xs text-white/30">{t('admin.daily')}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Total Rewards */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiGift className="w-4 h-4 text-[#FFB800]" />
                {t('admin.totalRewardsSetting')}
              </h3>
              <div className="flex gap-3">
                <input
                  type="number"
                  placeholder={t('admin.totalRewardAmount2')}
                  value={tokenV2Config.totalRewards}
                  onChange={(e) => setTokenV2Config(prev => ({ ...prev, totalRewards: e.target.value }))}
                  className="input-premium flex-1"
                />
                <button
                  onClick={handleSetTotalRewardsV2}
                  disabled={isUpdating || !tokenV2Config.totalRewards}
                  className="btn-premium px-6 disabled:opacity-50"
                >
                  <FiSave className="w-4 h-4 mr-2" />
                  {t('admin.save')}
                </button>
              </div>
              <p className="text-xs text-white/40 mt-2">{t('admin.noteLarger')}</p>
            </div>

            {/* Tier Configs */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiPercent className="w-4 h-4 text-[#FFB800]" />
                {t('admin.tierRateSetting')}
              </h3>
              <div className="space-y-3">
                {[
                  { tier: 0, name: t('admin.flexibleLock'), placeholder: `${t('admin.eg')} 0.4` },
                  { tier: 1, name: t('admin.months3Lock'), placeholder: `${t('admin.eg')} 0.6` },
                  { tier: 2, name: t('admin.months6Lock'), placeholder: `${t('admin.eg')} 0.8` },
                  { tier: 3, name: t('admin.months12Lock'), placeholder: `${t('admin.eg')} 1.0` },
                ].map(({ tier, name, placeholder }) => (
                  <div key={tier} className="flex gap-3 items-center">
                    <span className="text-white/60 w-24 text-sm">{name}</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder={placeholder}
                      value={tokenV2Config[`tier${tier}Rate`]}
                      onChange={(e) => setTokenV2Config(prev => ({ ...prev, [`tier${tier}Rate`]: e.target.value }))}
                      className="input-premium flex-1"
                    />
                    <button
                      onClick={() => handleSetTierConfig(tier)}
                      disabled={isUpdating || !tokenV2Config[`tier${tier}Rate`]}
                      className="btn-ghost px-4 disabled:opacity-50"
                    >
                      {t('admin.save')}
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/40 mt-3">{t('admin.noteMaxRate')}</p>
            </div>
          </motion.div>
        )}

        {/* ProjectTokenV2 Tab */}
        {activeTab === 'project-token-v2' && isOwner('projectTokenV2') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Fee Settings */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiPercent className="w-4 h-4 text-[#FF8A00]" />
                {t('admin.slippageSetting')}
              </h3>
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">{t('admin.buySlippage')}</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder={`${t('admin.eg')} 0`}
                    value={tokenConfig.buyFee}
                    onChange={(e) => setTokenConfig(prev => ({ ...prev, buyFee: e.target.value }))}
                    className="input-premium w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">{t('admin.sellSlippage')}</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder={`${t('admin.eg')} 2.8`}
                    value={tokenConfig.sellFee}
                    onChange={(e) => setTokenConfig(prev => ({ ...prev, sellFee: e.target.value }))}
                    className="input-premium w-full"
                  />
                </div>
              </div>
              <button
                onClick={handleSetFees}
                disabled={isUpdating || tokenConfig.buyFee === '' || tokenConfig.sellFee === ''}
                className="btn-premium w-full disabled:opacity-50"
              >
                <FiSave className="w-4 h-4 mr-2" />
                {t('admin.saveSlippageSetting')}
              </button>
              <p className="text-xs text-white/40 mt-2">{t('admin.maxSlippage')}</p>
            </div>

            {/* Pair Settings */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiLayers className="w-4 h-4 text-[#FF8A00]" />
                {t('admin.pairSetting')}
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder={t('admin.pairAddress')}
                  value={tokenConfig.pairAddress}
                  onChange={(e) => setTokenConfig(prev => ({ ...prev, pairAddress: e.target.value }))}
                  className="input-premium flex-1"
                />
                <button
                  onClick={handleSetPair}
                  disabled={isUpdating || !tokenConfig.pairAddress}
                  className="btn-premium px-6 disabled:opacity-50"
                >
                  {t('admin.add')}
                </button>
              </div>
              <p className="text-xs text-white/40 mt-2">
                {t('admin.pairDesc')}
              </p>
              {CONTRACTS.TOKEN_V2_PAIR && (
                <div className="mt-3 p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-white/40">{t('admin.currentPair')}</div>
                  <code className="text-xs text-[#00D9A5]">{CONTRACTS.TOKEN_V2_PAIR}</code>
                </div>
              )}
            </div>

            {/* Fee Receiver */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiDollarSign className="w-4 h-4 text-[#FF8A00]" />
                {t('admin.feeReceiver')}
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder={t('admin.receiverAddress')}
                  value={tokenConfig.feeReceiver}
                  onChange={(e) => setTokenConfig(prev => ({ ...prev, feeReceiver: e.target.value }))}
                  className="input-premium flex-1"
                />
                <button
                  onClick={handleSetFeeReceiver}
                  disabled={isUpdating || !tokenConfig.feeReceiver}
                  className="btn-premium px-6 disabled:opacity-50"
                >
                  {t('admin.set')}
                </button>
              </div>
            </div>

            {/* Whitelist */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiShield className="w-4 h-4 text-[#FF8A00]" />
                {t('admin.whitelist')}
              </h3>
              <div className="flex gap-3 mb-3">
                <input
                  type="text"
                  placeholder={t('admin.walletAddress')}
                  value={tokenConfig.excludeAddress}
                  onChange={(e) => setTokenConfig(prev => ({ ...prev, excludeAddress: e.target.value }))}
                  className="input-premium flex-1"
                />
                <button
                  onClick={() => handleSetExcluded(true)}
                  disabled={isUpdating || !tokenConfig.excludeAddress}
                  className="btn-premium px-4 disabled:opacity-50"
                >
                  {t('admin.add')}
                </button>
                <button
                  onClick={() => handleSetExcluded(false)}
                  disabled={isUpdating || !tokenConfig.excludeAddress}
                  className="btn-ghost px-4 disabled:opacity-50"
                >
                  {t('admin.remove')}
                </button>
              </div>
              <p className="text-xs text-white/40">
                {t('admin.whitelistDesc')}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
