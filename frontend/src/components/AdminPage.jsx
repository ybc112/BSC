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

export default function AdminPage({
  account,
  contracts,
  lpMiningData,
  tokenMiningV2Data,
  onRefresh
}) {
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
      toast.loading('设置锁仓期...', { id: 'setLock' });
      await tx.wait();
      toast.success('锁仓期设置成功', { id: 'setLock' });
      setLpConfig(prev => ({ ...prev, lockDays: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '设置失败', { id: 'setLock' });
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
      toast.loading('设置挖矿参数...', { id: 'setParams' });
      await tx.wait();
      toast.success('挖矿参数设置成功', { id: 'setParams' });
      setLpConfig(prev => ({ ...prev, totalRewards: '', miningYears: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '设置失败', { id: 'setParams' });
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
      toast.loading('设置分配比例...', { id: 'setDist' });
      await tx.wait();
      toast.success('分配比例设置成功', { id: 'setDist' });
      setLpConfig(prev => ({ ...prev, userShare: '', splitShare: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '设置失败', { id: 'setDist' });
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
      toast.loading('设置推荐比例...', { id: 'setRef' });
      await tx.wait();
      toast.success('推荐比例设置成功', { id: 'setRef' });
      setLpConfig(prev => ({ ...prev, ref1: '', ref2: '', ref3: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '设置失败', { id: 'setRef' });
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
      toast.error('请至少填写一个有效地址');
      return;
    }

    setIsUpdating(true);
    try {
      // rates 转换为 basis points (如 10% = 1000)
      const ratesInBP = validRates.map(r => Math.floor(parseFloat(r) * 100));
      const tx = await contracts.lpMining.setSplitAddresses(validAddresses, ratesInBP);
      toast.loading('设置分流地址...', { id: 'setSplit' });
      await tx.wait();
      toast.success('分流地址设置成功', { id: 'setSplit' });
      setSplitConfig({ addresses: ['', '', ''], rates: ['', '', ''] });
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '设置失败', { id: 'setSplit' });
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
      toast.error('请至少填写一个等级配置');
      return;
    }

    setIsUpdating(true);
    try {
      // thresholds 转换为 wei, rates 转换为 basis points
      const thresholdsInWei = validThresholds.map(t => ethers.parseEther(t));
      const ratesInBP = validRates.map(r => Math.floor(parseFloat(r) * 100));
      const tx = await contracts.lpMining.setTeamLevels(thresholdsInWei, ratesInBP);
      toast.loading('设置团队等级...', { id: 'setTeamLevel' });
      await tx.wait();
      toast.success('团队等级设置成功', { id: 'setTeamLevel' });
      setTeamLevelConfig({ thresholds: ['', '', ''], rates: ['', '', ''] });
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '设置失败', { id: 'setTeamLevel' });
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
      toast.loading('设置总奖励...', { id: 'setTotalV2' });
      await tx.wait();
      toast.success('总奖励设置成功', { id: 'setTotalV2' });
      setTokenV2Config(prev => ({ ...prev, totalRewards: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '设置失败', { id: 'setTotalV2' });
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
      toast.loading(`设置档位${tier}费率...`, { id: 'setTier' });
      await tx.wait();
      toast.success(`档位${tier}费率设置成功`, { id: 'setTier' });
      setTokenV2Config(prev => ({ ...prev, [rateKey]: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '设置失败', { id: 'setTier' });
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
      toast.loading('设置滑点...', { id: 'setFees' });
      await tx.wait();
      toast.success('滑点设置成功', { id: 'setFees' });
      setTokenConfig(prev => ({ ...prev, buyFee: '', sellFee: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '设置失败', { id: 'setFees' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetPair = async () => {
    if (!contracts?.projectTokenV2 || !tokenConfig.pairAddress) return;
    if (!ethers.isAddress(tokenConfig.pairAddress)) {
      toast.error('无效的地址格式');
      return;
    }
    setIsUpdating(true);
    try {
      const tx = await contracts.projectTokenV2.setPair(tokenConfig.pairAddress, true);
      toast.loading('设置交易对...', { id: 'setPair' });
      await tx.wait();
      toast.success('交易对设置成功', { id: 'setPair' });
      setTokenConfig(prev => ({ ...prev, pairAddress: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '设置失败', { id: 'setPair' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetExcluded = async (exclude = true) => {
    if (!contracts?.projectTokenV2 || !tokenConfig.excludeAddress) return;
    if (!ethers.isAddress(tokenConfig.excludeAddress)) {
      toast.error('无效的地址格式');
      return;
    }
    setIsUpdating(true);
    try {
      const tx = await contracts.projectTokenV2.setExcludedFromFee(tokenConfig.excludeAddress, exclude);
      toast.loading(exclude ? '添加白名单...' : '移除白名单...', { id: 'setExclude' });
      await tx.wait();
      toast.success(exclude ? '已添加白名单' : '已移除白名单', { id: 'setExclude' });
      setTokenConfig(prev => ({ ...prev, excludeAddress: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '操作失败', { id: 'setExclude' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetFeeReceiver = async () => {
    if (!contracts?.projectTokenV2 || !tokenConfig.feeReceiver) return;
    if (!ethers.isAddress(tokenConfig.feeReceiver)) {
      toast.error('无效的地址格式');
      return;
    }
    setIsUpdating(true);
    try {
      const tx = await contracts.projectTokenV2.setFeeReceiver(tokenConfig.feeReceiver);
      toast.loading('设置手续费接收地址...', { id: 'setReceiver' });
      await tx.wait();
      toast.success('手续费接收地址设置成功', { id: 'setReceiver' });
      setTokenConfig(prev => ({ ...prev, feeReceiver: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '设置失败', { id: 'setReceiver' });
    } finally {
      setIsUpdating(false);
    }
  };

  // 复制地址
  const copyAddress = (address) => {
    navigator.clipboard.writeText(address);
    toast.success('已复制地址');
  };

  // 未连接或非owner
  if (!account) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <FiShield className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">管理员控制台</h2>
          <p className="text-white/50">请先连接钱包</p>
        </div>
      </div>
    );
  }

  if (loadingOwners) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#00D9A5]/30 border-t-[#00D9A5] rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">加载中...</h2>
          <p className="text-white/50">正在验证管理员权限</p>
        </div>
      </div>
    );
  }

  if (!isAnyOwner) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <FiAlertTriangle className="w-16 h-16 text-[#FF6B6B] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">无权访问</h2>
          <p className="text-white/50 mb-4">当前钱包不是任何合约的 Owner</p>
          <div className="text-left bg-white/5 rounded-xl p-4 max-w-md mx-auto">
            <p className="text-xs text-white/40 mb-2">调试信息:</p>
            <p className="text-xs text-white/60 mb-1">
              连接地址: <code className="text-[#00D9A5]">{account}</code>
            </p>
            <p className="text-xs text-white/60 mb-1">
              LP Mining Owner: <code className="text-[#FFB800]">{owners.lpMining || '未加载'}</code>
            </p>
            <p className="text-xs text-white/60 mb-1">
              TokenMiningV2 Owner: <code className="text-[#FFB800]">{owners.tokenMiningV2 || '未加载'}</code>
            </p>
            <p className="text-xs text-white/60">
              ProjectTokenV2 Owner: <code className="text-[#FFB800]">{owners.projectTokenV2 || '未加载'}</code>
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
            <h1 className="text-2xl md:text-3xl font-bold text-white">管理员控制台</h1>
            <p className="text-white/50">合约参数配置与管理</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
        >
          <FiRefreshCw className="w-4 h-4" />
          刷新数据
        </button>
      </div>

      {/* Warning Banner */}
      <div className="p-4 rounded-xl bg-[#FF6B6B]/10 border border-[#FF6B6B]/30">
        <div className="flex items-start gap-3">
          <FiAlertTriangle className="w-5 h-5 text-[#FF6B6B] mt-0.5" />
          <div>
            <p className="text-[#FF6B6B] font-medium">管理员操作注意事项</p>
            <p className="text-white/50 text-sm mt-1">
              修改合约参数会影响所有用户，请谨慎操作。部分参数修改后无法撤销。
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
                  当前配置
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-white/40 mb-1">锁仓期</div>
                    <div className="text-lg font-bold text-white">{contractConfig?.lockDurationDays || 30} 天</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-white/40 mb-1">总奖励</div>
                    <div className="text-lg font-bold text-white">{formatNumber(contractConfig?.totalRewards)} AGG</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-white/40 mb-1">用户/分成</div>
                    <div className="text-lg font-bold text-white">{contractConfig?.userBaseShare}% / {contractConfig?.splitShare}%</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-white/40 mb-1">推荐比例</div>
                    <div className="text-lg font-bold text-white">{contractConfig?.referralLevel1}% / {contractConfig?.referralLevel2}% / {contractConfig?.referralLevel3}%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Lock Duration */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiLock className="w-4 h-4 text-[#FFB800]" />
                锁仓期设置
              </h3>
              <div className="flex gap-3">
                <input
                  type="number"
                  placeholder="锁仓天数"
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
                  保存
                </button>
              </div>
            </div>

            {/* Mining Params */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiGift className="w-4 h-4 text-[#FFB800]" />
                挖矿参数
              </h3>
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <input
                  type="number"
                  placeholder="总奖励 (AGG)"
                  value={lpConfig.totalRewards}
                  onChange={(e) => setLpConfig(prev => ({ ...prev, totalRewards: e.target.value }))}
                  className="input-premium"
                />
                <input
                  type="number"
                  placeholder="挖矿时长 (年)"
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
                保存挖矿参数
              </button>
            </div>

            {/* Distribution Rates */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiPercent className="w-4 h-4 text-[#FFB800]" />
                分配比例 (总和 = 100%)
              </h3>
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <input
                  type="number"
                  placeholder="用户比例 %"
                  value={lpConfig.userShare}
                  onChange={(e) => setLpConfig(prev => ({ ...prev, userShare: e.target.value }))}
                  className="input-premium"
                />
                <input
                  type="number"
                  placeholder="分成比例 %"
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
                保存分配比例
              </button>
            </div>

            {/* Referral Rates */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiUsers className="w-4 h-4 text-[#FFB800]" />
                推荐比例
              </h3>
              <div className="grid md:grid-cols-3 gap-3 mb-3">
                <input
                  type="number"
                  placeholder="1代 %"
                  value={lpConfig.ref1}
                  onChange={(e) => setLpConfig(prev => ({ ...prev, ref1: e.target.value }))}
                  className="input-premium"
                />
                <input
                  type="number"
                  placeholder="2代 %"
                  value={lpConfig.ref2}
                  onChange={(e) => setLpConfig(prev => ({ ...prev, ref2: e.target.value }))}
                  className="input-premium"
                />
                <input
                  type="number"
                  placeholder="3代 %"
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
                保存推荐比例
              </button>
            </div>

            {/* Split Addresses - 分流地址配置 */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiLayers className="w-4 h-4 text-[#FFB800]" />
                分流地址配置 (35% 池分配)
              </h3>
              <p className="text-xs text-white/50 mb-4">
                配置收益分流地址和比例。总比例应等于 100%。
              </p>

              {/* 当前配置展示 */}
              {lpMiningData?.splitConfig?.addresses?.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-white/40 mb-2">当前配置:</div>
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
                    <span className="text-white/60 w-12 text-sm">地址{i + 1}</span>
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
                保存分流配置
              </button>
            </div>

            {/* Team Levels - 团队等级配置 */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiTarget className="w-4 h-4 text-[#FFB800]" />
                团队等级配置 (极差奖励)
              </h3>
              <p className="text-xs text-white/50 mb-4">
                配置团队等级的业绩阈值和对应奖励比例。
              </p>

              {/* 当前配置展示 */}
              {lpMiningData?.teamConfig?.thresholds?.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-white/40 mb-2">当前配置:</div>
                  <div className="grid grid-cols-3 gap-2">
                    {lpMiningData.teamConfig.thresholds.map((threshold, i) => (
                      <div key={i} className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-white/40">等级 {i + 1}</div>
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
                    <span className="text-white/60 w-12 text-sm">等级{i + 1}</span>
                    <input
                      type="number"
                      placeholder="阈值 (LP)"
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
                保存团队等级配置
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
                  当前配置
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-white/40 mb-1">总质押</div>
                    <div className="text-lg font-bold text-white">{formatNumber(tokenV2Status?.totalStaked)} AGG</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-white/40 mb-1">已分发</div>
                    <div className="text-lg font-bold text-white">{formatNumber(tokenV2Status?.totalDistributed)} AGG</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-white/40 mb-1">剩余奖励</div>
                    <div className="text-lg font-bold text-white">{formatNumber(tokenV2Status?.remainingRewards)} AGG</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-white/40 mb-1">状态</div>
                    <div className={`text-lg font-bold ${tokenV2Status?.miningEnded ? 'text-[#FF6B6B]' : 'text-[#00D9A5]'}`}>
                      {tokenV2Status?.miningEnded ? '已结束' : '进行中'}
                    </div>
                  </div>
                </div>
                <h4 className="text-sm text-white/60 mb-3">档位费率</h4>
                <div className="grid grid-cols-4 gap-3">
                  {['随进随出', '3个月', '6个月', '12个月'].map((name, i) => (
                    <div key={i} className="p-3 rounded-lg bg-white/5 text-center">
                      <div className="text-xs text-white/40 mb-1">{name}</div>
                      <div className="text-lg font-bold text-[#FFB800]">{tierConfigs?.dailyRates?.[i] || '-'}%</div>
                      <div className="text-xs text-white/30">每日</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Total Rewards */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiGift className="w-4 h-4 text-[#FFB800]" />
                总奖励设置
              </h3>
              <div className="flex gap-3">
                <input
                  type="number"
                  placeholder="总奖励数量 (AGG)"
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
                  保存
                </button>
              </div>
              <p className="text-xs text-white/40 mt-2">注意：新值必须大于已分发数量</p>
            </div>

            {/* Tier Configs */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiPercent className="w-4 h-4 text-[#FFB800]" />
                档位费率设置 (每日百分比)
              </h3>
              <div className="space-y-3">
                {[
                  { tier: 0, name: '随进随出', placeholder: '如: 0.4' },
                  { tier: 1, name: '3个月锁仓', placeholder: '如: 0.6' },
                  { tier: 2, name: '6个月锁仓', placeholder: '如: 0.8' },
                  { tier: 3, name: '12个月锁仓', placeholder: '如: 1.0' },
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
                      保存
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/40 mt-3">注意：费率最高不超过 10% (1000 basis points)</p>
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
                滑点设置 (买入/卖出)
              </h3>
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">买入滑点 %</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="如: 0"
                    value={tokenConfig.buyFee}
                    onChange={(e) => setTokenConfig(prev => ({ ...prev, buyFee: e.target.value }))}
                    className="input-premium w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">卖出滑点 %</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="如: 2.8"
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
                保存滑点设置
              </button>
              <p className="text-xs text-white/40 mt-2">最高 10%，当前: 买入 0% / 卖出 2.8%</p>
            </div>

            {/* Pair Settings */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiLayers className="w-4 h-4 text-[#FF8A00]" />
                交易对设置
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="交易对合约地址 (0x...)"
                  value={tokenConfig.pairAddress}
                  onChange={(e) => setTokenConfig(prev => ({ ...prev, pairAddress: e.target.value }))}
                  className="input-premium flex-1"
                />
                <button
                  onClick={handleSetPair}
                  disabled={isUpdating || !tokenConfig.pairAddress}
                  className="btn-premium px-6 disabled:opacity-50"
                >
                  添加
                </button>
              </div>
              <p className="text-xs text-white/40 mt-2">
                添加交易对后，用户向该地址转账（卖出）将收取滑点
              </p>
              {CONTRACTS.TOKEN_V2_PAIR && (
                <div className="mt-3 p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-white/40">当前交易对:</div>
                  <code className="text-xs text-[#00D9A5]">{CONTRACTS.TOKEN_V2_PAIR}</code>
                </div>
              )}
            </div>

            {/* Fee Receiver */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiDollarSign className="w-4 h-4 text-[#FF8A00]" />
                手续费接收地址
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="接收地址 (0x...)"
                  value={tokenConfig.feeReceiver}
                  onChange={(e) => setTokenConfig(prev => ({ ...prev, feeReceiver: e.target.value }))}
                  className="input-premium flex-1"
                />
                <button
                  onClick={handleSetFeeReceiver}
                  disabled={isUpdating || !tokenConfig.feeReceiver}
                  className="btn-premium px-6 disabled:opacity-50"
                >
                  设置
                </button>
              </div>
            </div>

            {/* Whitelist */}
            <div className="glass-premium p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <FiShield className="w-4 h-4 text-[#FF8A00]" />
                白名单管理 (免滑点)
              </h3>
              <div className="flex gap-3 mb-3">
                <input
                  type="text"
                  placeholder="钱包地址 (0x...)"
                  value={tokenConfig.excludeAddress}
                  onChange={(e) => setTokenConfig(prev => ({ ...prev, excludeAddress: e.target.value }))}
                  className="input-premium flex-1"
                />
                <button
                  onClick={() => handleSetExcluded(true)}
                  disabled={isUpdating || !tokenConfig.excludeAddress}
                  className="btn-premium px-4 disabled:opacity-50"
                >
                  添加
                </button>
                <button
                  onClick={() => handleSetExcluded(false)}
                  disabled={isUpdating || !tokenConfig.excludeAddress}
                  className="btn-ghost px-4 disabled:opacity-50"
                >
                  移除
                </button>
              </div>
              <p className="text-xs text-white/40">
                白名单地址在买卖时不收取滑点费用
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
