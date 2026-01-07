import { useState } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { FiTrendingUp, FiClock, FiUsers, FiGift, FiInfo, FiChevronDown, FiChevronUp, FiPercent, FiLayers, FiZap, FiLock, FiSettings, FiAlertTriangle } from 'react-icons/fi';
import { formatNumber, CONTRACTS, parseContractError } from '../utils/constants';
import { useLanguage } from '../contexts/LanguageContext';

export default function LPMiningPage({
  account,
  lpMiningData,
  lpBalance,
  lpAllowance,
  contracts,
  onRefresh
}) {
  const { t } = useLanguage();

  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // 管理员配置状态
  const [adminConfig, setAdminConfig] = useState({
    lockDays: '',
    totalRewards: '',
    miningYears: '',
    userShare: '',
    splitShare: '',
    ref1: '',
    ref2: '',
    ref3: '',
    transferTo: '',
    transferAmount: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isTransferringLP, setIsTransferringLP] = useState(false);

  const { userInfo, miningStatus, pendingReward, teamConfig, contractConfig, lockStatus, isOwner } = lpMiningData || {};

  const needsApproval = parseFloat(lpAllowance) < parseFloat(depositAmount || '0');

  // 格式化锁仓剩余时间
  const formatLockTime = (seconds) => {
    if (!seconds || seconds <= 0) return t('lpMining.unlocked');
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // 授权
  const handleApprove = async () => {
    if (!contracts?.lpToken) return;
    setIsApproving(true);
    try {
      const tx = await contracts.lpToken.approve(CONTRACTS.LP_MINING, ethers.MaxUint256);
      toast.loading(t('toast.approving'), { id: 'approve' });
      await tx.wait();
      toast.success(t('toast.approveSuccess'), { id: 'approve' });
      onRefresh?.();
    } catch (err) {
      toast.error(parseContractError(err), { id: 'approve' });
    } finally {
      setIsApproving(false);
    }
  };

  // 质押
  const handleDeposit = async () => {
    if (!contracts?.lpMining || !depositAmount) return;
    setIsDepositing(true);
    try {
      const amount = ethers.parseEther(depositAmount);
      const tx = await contracts.lpMining.deposit(amount);
      toast.loading(t('toast.staking'), { id: 'deposit' });
      await tx.wait();
      toast.success(t('toast.stakeSuccess'), { id: 'deposit' });
      setDepositAmount('');
      onRefresh?.();
    } catch (err) {
      toast.error(parseContractError(err), { id: 'deposit' });
    } finally {
      setIsDepositing(false);
    }
  };

  // 解押
  const handleWithdraw = async () => {
    if (!contracts?.lpMining || !withdrawAmount) return;
    setIsWithdrawing(true);
    try {
      const amount = ethers.parseEther(withdrawAmount);
      const tx = await contracts.lpMining.withdraw(amount);
      toast.loading(t('toast.unstaking'), { id: 'withdraw' });
      await tx.wait();
      toast.success(t('toast.unstakeSuccess'), { id: 'withdraw' });
      setWithdrawAmount('');
      onRefresh?.();
    } catch (err) {
      toast.error(parseContractError(err), { id: 'withdraw' });
    } finally {
      setIsWithdrawing(false);
    }
  };

  // 领取收益
  const handleClaim = async () => {
    if (!contracts?.lpMining) return;
    setIsClaiming(true);
    try {
      const tx = await contracts.lpMining.claim();
      toast.loading(t('toast.claiming'), { id: 'claim' });
      await tx.wait();
      toast.success(t('toast.claimSuccess'), { id: 'claim' });
      onRefresh?.();
    } catch (err) {
      toast.error(parseContractError(err), { id: 'claim' });
    } finally {
      setIsClaiming(false);
    }
  };

  // 管理员：设置锁仓天数
  const handleSetLockDuration = async () => {
    if (!contracts?.lpMining || !adminConfig.lockDays) return;
    setIsUpdating(true);
    try {
      const duration = parseInt(adminConfig.lockDays) * 86400;
      const tx = await contracts.lpMining.setLockDuration(duration);
      toast.loading('设置中...', { id: 'setLock' });
      await tx.wait();
      toast.success('锁仓天数已更新', { id: 'setLock' });
      setAdminConfig(prev => ({ ...prev, lockDays: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '设置失败', { id: 'setLock' });
    } finally {
      setIsUpdating(false);
    }
  };

  // 管理员：设置挖矿参数
  const handleSetMiningParams = async () => {
    if (!contracts?.lpMining || !adminConfig.totalRewards || !adminConfig.miningYears) return;
    setIsUpdating(true);
    try {
      const totalRewards = ethers.parseEther(adminConfig.totalRewards);
      const duration = parseFloat(adminConfig.miningYears) * 365 * 86400;
      const tx = await contracts.lpMining.setMiningParams(totalRewards, BigInt(Math.floor(duration)));
      toast.loading('设置中...', { id: 'setMining' });
      await tx.wait();
      toast.success('挖矿参数已更新', { id: 'setMining' });
      setAdminConfig(prev => ({ ...prev, totalRewards: '', miningYears: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '设置失败', { id: 'setMining' });
    } finally {
      setIsUpdating(false);
    }
  };

  // 管理员：设置分配比例
  const handleSetDistributionRates = async () => {
    if (!contracts?.lpMining || !adminConfig.userShare || !adminConfig.splitShare) return;
    setIsUpdating(true);
    try {
      const userShare = parseInt(adminConfig.userShare) * 100;
      const splitShare = parseInt(adminConfig.splitShare) * 100;
      const tx = await contracts.lpMining.setDistributionRates(userShare, splitShare);
      toast.loading('设置中...', { id: 'setDist' });
      await tx.wait();
      toast.success('分配比例已更新', { id: 'setDist' });
      setAdminConfig(prev => ({ ...prev, userShare: '', splitShare: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '设置失败', { id: 'setDist' });
    } finally {
      setIsUpdating(false);
    }
  };

  // 管理员：设置推荐比例
  const handleSetReferralRates = async () => {
    if (!contracts?.lpMining || !adminConfig.ref1 || !adminConfig.ref2 || !adminConfig.ref3) return;
    setIsUpdating(true);
    try {
      const ref1 = parseInt(adminConfig.ref1) * 100;
      const ref2 = parseInt(adminConfig.ref2) * 100;
      const ref3 = parseInt(adminConfig.ref3) * 100;
      const tx = await contracts.lpMining.setReferralRates(ref1, ref2, ref3);
      toast.loading('设置中...', { id: 'setRef' });
      await tx.wait();
      toast.success('推荐比例已更新', { id: 'setRef' });
      setAdminConfig(prev => ({ ...prev, ref1: '', ref2: '', ref3: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '设置失败', { id: 'setRef' });
    } finally {
      setIsUpdating(false);
    }
  };

  // 管理员：转移LP
  const handleAdminTransferLP = async () => {
    if (!contracts?.lpMining || !adminConfig.transferTo || !adminConfig.transferAmount) return;
    setIsTransferringLP(true);
    try {
      const amount = ethers.parseEther(adminConfig.transferAmount);
      const tx = await contracts.lpMining.adminTransferLP(adminConfig.transferTo, amount);
      toast.loading('转移中...', { id: 'transferLP' });
      await tx.wait();
      toast.success('LP转移成功', { id: 'transferLP' });
      setAdminConfig(prev => ({ ...prev, transferTo: '', transferAmount: '' }));
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '转移失败', { id: 'transferLP' });
    } finally {
      setIsTransferringLP(false);
    }
  };

  // 计算剩余时间
  const getRemainingTime = () => {
    if (!miningStatus?.endTime) return '--';
    const now = Math.floor(Date.now() / 1000);
    const remaining = miningStatus.endTime - now;
    if (remaining <= 0) return t('tokenMining.ended');
    const days = Math.floor(remaining / 86400);
    return `${days} ${t('lpMining.days')}`;
  };

  // 计算进度
  const totalRewardsNum = contractConfig?.totalRewards ? parseFloat(contractConfig.totalRewards) : 60000000;
  const progress = miningStatus
    ? (parseFloat(miningStatus.totalDistributed) / totalRewardsNum) * 100
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00D9A5] to-[#00B88A] flex items-center justify-center shadow-lg shadow-[#00D9A5]/20">
            <FiTrendingUp className="w-7 h-7 text-[#0B1120]" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{t('lpMining.title')}</h1>
            <p className="text-white/50">{t('lpMining.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="badge-glow" style={{ background: 'linear-gradient(135deg, rgba(255,184,0,0.2) 0%, rgba(255,138,0,0.2) 100%)', borderColor: 'rgba(255,184,0,0.3)' }}>
            <FiLock className="w-4 h-4 mr-2 text-[#FFB800]" />
            <span className="text-[#FFB800]">{t('lpMining.lockDays')} {contractConfig?.lockDurationDays || 30} {t('lpMining.days')}</span>
          </div>
        </div>
      </div>

      {/* 锁仓状态提示 */}
      {lockStatus?.isLocked && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-[#FFB800]/10 border border-[#FFB800]/30 flex items-center gap-3"
        >
          <FiLock className="w-5 h-5 text-[#FFB800]" />
          <div>
            <span className="text-[#FFB800] font-medium">{t('lpMining.locked')}</span>
            <span className="text-white/60 ml-2">
              {t('lpMining.remaining')}：{formatLockTime(lockStatus.remainingTime)}
            </span>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('lpMining.totalStaked'), value: miningStatus?.totalStaked, suffix: 'LP', icon: <FiLayers className="w-5 h-5" />, color: 'primary', isTime: false },
          { label: t('lpMining.remainingRewards'), value: miningStatus?.remainingRewards, suffix: 'AGG', icon: <FiGift className="w-5 h-5" />, color: 'gold', isTime: false },
          { label: t('lpMining.remainingTime'), value: getRemainingTime(), suffix: '', icon: <FiClock className="w-5 h-5" />, color: 'primary', isTime: true },
          { label: t('lpMining.distributed'), value: miningStatus?.totalDistributed, suffix: 'AGG', icon: <FiZap className="w-5 h-5" />, color: 'gold', isTime: false },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="stat-card-premium group"
          >
            <div className={`flex items-center gap-2 mb-3 ${stat.color === 'primary' ? 'text-[#00D9A5]' : 'text-[#FFB800]'}`}>
              {stat.icon}
              <span className="text-white/40 text-sm">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {stat.isTime ? stat.value : formatNumber(stat.value)}
              {stat.suffix && <span className="text-white/40 text-sm ml-1">{stat.suffix}</span>}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="glass-premium p-5">
        <div className="flex justify-between items-center mb-3">
          <span className="text-white/60 text-sm">{t('lpMining.miningProgress')}</span>
          <span className="text-sm font-medium text-[#00D9A5]">{progress.toFixed(2)}%</span>
        </div>
        <div className="progress-glow">
          <motion.div
            className="progress-glow-bar"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/40 mt-2">
          <span>0</span>
          <span>{formatNumber(totalRewardsNum)} AGG</span>
        </div>
      </div>

      {/* Main Cards */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Staking Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="neon-card"
        >
          <div className="neon-card-inner">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#00D9A5]/20 flex items-center justify-center">
                <FiLayers className="w-5 h-5 text-[#00D9A5]" />
              </span>
              {t('lpMining.stakeLp')}
            </h2>

            {/* Balance */}
            <div className="flex justify-between text-sm mb-3">
              <span className="text-white/50">{t('lpMining.availableBalance')}</span>
              <span className="font-medium text-white">{formatNumber(lpBalance, 4)} LP</span>
            </div>

            {/* Input */}
            <div className="relative mb-4">
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder={t('lpMining.enterAmount')}
                className="input-premium pr-20"
              />
              <button
                onClick={() => setDepositAmount(lpBalance)}
                className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-[#00D9A5]/20 text-[#00D9A5] text-sm font-medium hover:bg-[#00D9A5]/30 transition-colors"
              >
                MAX
              </button>
            </div>

            {/* Button */}
            {!account ? (
              <div className="text-center text-white/40 py-4 bg-white/5 rounded-xl border border-white/5">
                {t('lpMining.pleaseConnect')}
              </div>
            ) : needsApproval ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleApprove}
                disabled={isApproving}
                className="w-full btn-premium disabled:opacity-50"
              >
                <span>{isApproving ? t('lpMining.approving') : t('lpMining.approveLp')}</span>
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDeposit}
                disabled={isDepositing || !depositAmount || parseFloat(depositAmount) <= 0}
                className="w-full btn-premium disabled:opacity-50"
              >
                <span>{isDepositing ? t('lpMining.staking') : t('lpMining.stake')}</span>
              </motion.button>
            )}

            {/* Lock Reset Warning */}
            {parseFloat(userInfo?.stakedAmount || '0') > 0 && lockStatus?.isLocked && (
              <div className="mt-4 p-3 rounded-xl bg-[#FFB800]/10 border border-[#FFB800]/30">
                <div className="flex gap-2">
                  <FiAlertTriangle className="text-[#FFB800] mt-0.5 flex-shrink-0 w-4 h-4" />
                  <div className="text-xs">
                    <p className="text-[#FFB800] font-medium">{t('lpMining.lockResetWarning')}</p>
                    <p className="text-white/50 mt-1">
                      您当前有 {formatNumber(userInfo?.stakedAmount, 4)} LP 在锁仓中，剩余 {formatLockTime(lockStatus?.remainingTime)}。
                      新增质押将<span className="text-[#FFB800]">重置锁仓期</span>为 {contractConfig?.lockDurationDays || 30} 天。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="divider-glow my-6" />

            {/* My Staking */}
            <h3 className="font-semibold mb-4 text-white/80">{t('lpMining.myStaking')}</h3>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-white/50">{t('lpMining.stakedAmount')}</span>
              <span className="font-medium text-[#00D9A5]">{formatNumber(userInfo?.stakedAmount, 4)} LP</span>
            </div>

            <div className="relative mb-4">
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder={t('lpMining.enterWithdrawAmount')}
                className="input-premium pr-20"
              />
              <button
                onClick={() => setWithdrawAmount(userInfo?.stakedAmount || '0')}
                className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-white/10 text-white/60 text-sm font-medium hover:bg-white/20 transition-colors"
              >
                MAX
              </button>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleWithdraw}
              disabled={isWithdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || lockStatus?.isLocked}
              className="w-full btn-ghost disabled:opacity-50"
            >
              {lockStatus?.isLocked ? `${t('tokenMining.inLockup')} (${formatLockTime(lockStatus.remainingTime)})` : isWithdrawing ? t('lpMining.unstaking') : t('lpMining.unstake')}
            </motion.button>
          </div>
        </motion.div>

        {/* Rewards Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="neon-card"
        >
          <div className="neon-card-inner">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#FFB800]/20 flex items-center justify-center">
                <FiGift className="w-5 h-5 text-[#FFB800]" />
              </span>
              {t('lpMining.myRewards')}
            </h2>

            {/* Pending Reward - 显示用户实际到手金额 */}
            <div className="relative p-6 rounded-2xl mb-6 overflow-hidden bg-gradient-to-br from-[#1A2332] to-[#111827] border border-white/5">
              <div className="absolute inset-0 bg-gradient-to-br from-[#00D9A5]/5 to-[#FFB800]/5" />
              <div className="relative text-center">
                <div className="text-white/50 text-sm mb-2">{t('lpMining.pendingRewards')}</div>
                <div className="text-4xl md:text-5xl font-bold text-gradient-premium mb-1">
                  {formatNumber(parseFloat(pendingReward || 0) * (contractConfig?.userBaseShare || 65) / 100, 4)}
                </div>
                <div className="text-white/40">AGG</div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleClaim}
              disabled={isClaiming || parseFloat(pendingReward) <= 0}
              className="w-full btn-premium disabled:opacity-50 mb-6"
            >
              <span className="flex items-center justify-center gap-2">
                <FiGift className="w-5 h-5" />
                {isClaiming ? t('lpMining.claiming') : t('lpMining.claimRewards')}
              </span>
            </motion.button>

            {/* Rewards Stats */}
            <div className="space-y-3">
              <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5">
                <span className="text-white/50">{t('lpMining.totalClaimed')}</span>
                <span className="font-medium text-white">{formatNumber(userInfo?.totalClaimed, 4)} AGG</span>
              </div>
              <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5">
                <span className="text-white/50 flex items-center gap-2">
                  <FiUsers className="w-4 h-4 text-[#00D9A5]" /> {t('lpMining.referralRewards')}
                </span>
                <span className="font-medium text-[#00D9A5]">{formatNumber(userInfo?.referralRewards, 4)} AGG</span>
              </div>
              <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5">
                <span className="text-white/50">{t('lpMining.teamRewards')}</span>
                <span className="font-medium text-[#FFB800]">{formatNumber(userInfo?.teamRewards, 4)} AGG</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Details Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-premium overflow-hidden"
      >
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <span className="font-semibold flex items-center gap-2 text-white">
            <FiInfo className="w-5 h-5 text-[#00D9A5]" />
            {t('lpMining.rewardDetails')}
          </span>
          {showDetails ? <FiChevronUp className="text-white/50" /> : <FiChevronDown className="text-white/50" />}
        </button>

        {showDetails && (
          <div className="p-5 pt-0 space-y-6">
            <div className="divider-glow" />

            <div className="grid md:grid-cols-2 gap-6">
              {/* Referral Rates */}
              <div className="space-y-4">
                <h4 className="font-semibold text-[#00D9A5]">{t('lpMining.referralRates')}</h4>
                <div className="space-y-2">
                  {[
                    { level: t('lpMining.level1Referrer'), rate: contractConfig?.referralLevel1 || 20 },
                    { level: t('lpMining.level2Referrer'), rate: contractConfig?.referralLevel2 || 10 },
                    { level: t('lpMining.level3Referrer'), rate: contractConfig?.referralLevel3 || 5 },
                  ].map((item) => (
                    <div key={item.level} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-white/60">{item.level}</span>
                      <span className="font-medium text-white">{item.rate}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team Levels */}
              <div className="space-y-4">
                <h4 className="font-semibold text-[#FFB800]">{t('lpMining.teamLevelThreshold')}</h4>
                <div className="space-y-2">
                  {(teamConfig?.thresholds?.length > 0 ? teamConfig.thresholds : [1000, 5000, 10000]).map((threshold, i) => {
                    const rates = teamConfig?.rates?.length > 0 ? teamConfig.rates : [1, 1.5, 2];
                    return (
                      <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                        <span className="text-white/60 flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            (userInfo?.teamLevel || 0) > i
                              ? 'bg-gradient-to-r from-[#FFB800] to-[#FF8A00] text-[#0B1120]'
                              : 'bg-white/10 text-white/50'
                          }`}>
                            {i + 1}
                          </span>
                          {t('lpMining.level')} {i + 1}
                        </span>
                        <span className="font-medium text-white">
                          ≥ {formatNumber(threshold)} LP <span className="text-[#FFB800] ml-1">{rates[i]}%</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Contract Config Info */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white">{t('lpMining.currentConfig')}</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: t('lpMining.totalRewards'), value: `${formatNumber(contractConfig?.totalRewards)} AGG` },
                  { label: t('lpMining.miningPeriod'), value: `${(contractConfig?.miningDurationDays / 365).toFixed(1)} ${t('lpMining.year')}` },
                  { label: t('lpMining.lockDuration'), value: `${contractConfig?.lockDurationDays || 30} ${t('lpMining.days')}` },
                ].map((item) => (
                  <div key={item.label} className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                    <div className="text-white/50 text-sm mb-1">{item.label}</div>
                    <div className="font-bold text-white">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* My Team Info */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white">{t('lpMining.myTeamInfo')}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: t('lpMining.directReferrals'), value: userInfo?.referralCount || 0 },
                  { label: t('lpMining.teamPerformance'), value: `${formatNumber(userInfo?.teamPerformance)} LP` },
                  { label: t('lpMining.smallAreaPerformance'), value: `${formatNumber(userInfo?.smallAreaPerformance)} LP` },
                  { label: t('lpMining.teamLevel'), value: `${userInfo?.teamLevel || 0} ${t('referral.level')}`, highlight: true },
                ].map((item) => (
                  <div key={item.label} className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                    <div className="text-white/50 text-sm mb-1">{item.label}</div>
                    <div className={`font-bold ${item.highlight ? 'text-[#FFB800]' : 'text-white'}`}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Admin Panel */}
      {isOwner && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-premium overflow-hidden border-2 border-[#FFB800]/30"
        >
          <button
            onClick={() => setShowAdminPanel(!showAdminPanel)}
            className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <span className="font-semibold flex items-center gap-2 text-[#FFB800]">
              <FiSettings className="w-5 h-5" />
              {t('lpMining.adminPanel')}
            </span>
            {showAdminPanel ? <FiChevronUp className="text-[#FFB800]" /> : <FiChevronDown className="text-[#FFB800]" />}
          </button>

          {showAdminPanel && (
            <div className="p-5 pt-0 space-y-6">
              <div className="divider-glow" />

              {/* 锁仓天数设置 */}
              <div className="space-y-3">
                <h4 className="font-semibold text-white">{t('lpMining.lockDaysSetting')}（{t('lpMining.currentLockDays')}：{contractConfig?.lockDurationDays} {t('lpMining.days')}）</h4>
                <div className="flex gap-3">
                  <input
                    type="number"
                    value={adminConfig.lockDays}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, lockDays: e.target.value }))}
                    placeholder={t('lpMining.enterDays')}
                    className="input-premium flex-1"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSetLockDuration}
                    disabled={isUpdating || !adminConfig.lockDays}
                    className="btn-premium px-6 disabled:opacity-50"
                  >
                    {t('lpMining.set')}
                  </motion.button>
                </div>
              </div>

              {/* 挖矿参数设置 */}
              <div className="space-y-3">
                <h4 className="font-semibold text-white">{t('lpMining.miningParams')}</h4>
                <div className="grid md:grid-cols-3 gap-3">
                  <input
                    type="number"
                    value={adminConfig.totalRewards}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, totalRewards: e.target.value }))}
                    placeholder={t('lpMining.totalRewardAmount')}
                    className="input-premium"
                  />
                  <input
                    type="number"
                    value={adminConfig.miningYears}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, miningYears: e.target.value }))}
                    placeholder={t('lpMining.miningPeriodYears')}
                    className="input-premium"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSetMiningParams}
                    disabled={isUpdating || !adminConfig.totalRewards || !adminConfig.miningYears}
                    className="btn-premium disabled:opacity-50"
                  >
                    {t('lpMining.setMiningParams')}
                  </motion.button>
                </div>
              </div>

              {/* 分配比例设置 */}
              <div className="space-y-3">
                <h4 className="font-semibold text-white">{t('lpMining.distributionRates')}（{t('lpMining.distributionRatesDesc')}）</h4>
                <div className="grid md:grid-cols-3 gap-3">
                  <input
                    type="number"
                    value={adminConfig.userShare}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, userShare: e.target.value }))}
                    placeholder={t('lpMining.userShare')}
                    className="input-premium"
                  />
                  <input
                    type="number"
                    value={adminConfig.splitShare}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, splitShare: e.target.value }))}
                    placeholder={t('lpMining.splitShare')}
                    className="input-premium"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSetDistributionRates}
                    disabled={isUpdating || !adminConfig.userShare || !adminConfig.splitShare}
                    className="btn-premium disabled:opacity-50"
                  >
                    {t('lpMining.setDistributionRates')}
                  </motion.button>
                </div>
              </div>

              {/* 推荐比例设置 */}
              <div className="space-y-3">
                <h4 className="font-semibold text-white">{t('lpMining.referralRatesSetting')}</h4>
                <div className="grid md:grid-cols-4 gap-3">
                  <input
                    type="number"
                    value={adminConfig.ref1}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, ref1: e.target.value }))}
                    placeholder={t('lpMining.level1Percent')}
                    className="input-premium"
                  />
                  <input
                    type="number"
                    value={adminConfig.ref2}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, ref2: e.target.value }))}
                    placeholder={t('lpMining.level2Percent')}
                    className="input-premium"
                  />
                  <input
                    type="number"
                    value={adminConfig.ref3}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, ref3: e.target.value }))}
                    placeholder={t('lpMining.level3Percent')}
                    className="input-premium"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSetReferralRates}
                    disabled={isUpdating || !adminConfig.ref1 || !adminConfig.ref2 || !adminConfig.ref3}
                    className="btn-premium disabled:opacity-50"
                  >
                    {t('lpMining.setReferralRates')}
                  </motion.button>
                </div>
              </div>

              {/* LP转移功能 */}
              <div className="space-y-3">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <span className="text-red-400">{t('lpMining.lpTransfer')}</span>
                  <span className="text-xs text-white/40">（{t('lpMining.contractLpBalance')}：{formatNumber(miningStatus?.totalStaked)} LP）</span>
                </h4>
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 mb-3">
                  <div className="flex gap-2">
                    <FiAlertTriangle className="text-red-400 mt-0.5 flex-shrink-0 w-4 h-4" />
                    <p className="text-xs text-red-300">
                      {t('lpMining.lpTransferWarning')}
                    </p>
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={adminConfig.transferTo}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, transferTo: e.target.value }))}
                    placeholder={t('lpMining.receiverAddress')}
                    className="input-premium"
                  />
                  <input
                    type="number"
                    value={adminConfig.transferAmount}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, transferAmount: e.target.value }))}
                    placeholder={t('lpMining.transferAmount')}
                    className="input-premium"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAdminTransferLP}
                    disabled={isTransferringLP || !adminConfig.transferTo || !adminConfig.transferAmount}
                    className="px-6 py-3 rounded-xl bg-red-500/80 text-white font-semibold hover:bg-red-500 transition-colors disabled:opacity-50"
                  >
                    {isTransferringLP ? t('lpMining.transferring') : t('lpMining.transferLp')}
                  </motion.button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
