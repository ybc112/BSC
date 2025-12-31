import { useState } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { FiTrendingUp, FiClock, FiUsers, FiGift, FiInfo, FiChevronDown, FiChevronUp, FiPercent, FiLayers, FiZap, FiLock, FiSettings, FiAlertTriangle } from 'react-icons/fi';
import { formatNumber, CONTRACTS, parseContractError } from '../utils/constants';

export default function LPMiningPage({
  account,
  lpMiningData,
  lpBalance,
  lpAllowance,
  contracts,
  onRefresh
}) {
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
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const { userInfo, miningStatus, pendingReward, teamConfig, contractConfig, lockStatus, isOwner } = lpMiningData || {};

  const needsApproval = parseFloat(lpAllowance) < parseFloat(depositAmount || '0');

  // 格式化锁仓剩余时间
  const formatLockTime = (seconds) => {
    if (!seconds || seconds <= 0) return '已解锁';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}天 ${hours}小时`;
    if (hours > 0) return `${hours}小时 ${mins}分钟`;
    return `${mins}分钟`;
  };

  // 授权
  const handleApprove = async () => {
    if (!contracts?.lpToken) return;
    setIsApproving(true);
    try {
      const tx = await contracts.lpToken.approve(CONTRACTS.LP_MINING, ethers.MaxUint256);
      toast.loading('授权中...', { id: 'approve' });
      await tx.wait();
      toast.success('授权成功', { id: 'approve' });
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
      toast.loading('质押中...', { id: 'deposit' });
      await tx.wait();
      toast.success('质押成功', { id: 'deposit' });
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
      toast.loading('解押中...', { id: 'withdraw' });
      await tx.wait();
      toast.success('解押成功', { id: 'withdraw' });
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
      toast.loading('领取中...', { id: 'claim' });
      await tx.wait();
      toast.success('领取成功', { id: 'claim' });
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

  // 计算剩余时间
  const getRemainingTime = () => {
    if (!miningStatus?.endTime) return '--';
    const now = Math.floor(Date.now() / 1000);
    const remaining = miningStatus.endTime - now;
    if (remaining <= 0) return '已结束';
    const days = Math.floor(remaining / 86400);
    return `${days} 天`;
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
            <h1 className="text-2xl md:text-3xl font-bold text-white">LP 质押挖矿</h1>
            <p className="text-white/50">质押 LP 代币，赚取挖矿奖励</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="badge-glow">
            <FiPercent className="w-4 h-4 mr-2" />
            用户收益 {contractConfig?.userBaseShare || 65}%
          </div>
          <div className="badge-glow" style={{ background: 'linear-gradient(135deg, rgba(255,184,0,0.2) 0%, rgba(255,138,0,0.2) 100%)', borderColor: 'rgba(255,184,0,0.3)' }}>
            <FiLock className="w-4 h-4 mr-2 text-[#FFB800]" />
            <span className="text-[#FFB800]">锁仓 {contractConfig?.lockDurationDays || 30} 天</span>
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
            <span className="text-[#FFB800] font-medium">锁仓中</span>
            <span className="text-white/60 ml-2">
              剩余时间：{formatLockTime(lockStatus.remainingTime)}
            </span>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '总质押量', value: miningStatus?.totalStaked, suffix: 'LP', icon: <FiLayers className="w-5 h-5" />, color: 'primary' },
          { label: '剩余奖励', value: miningStatus?.remainingRewards, suffix: 'RWT', icon: <FiGift className="w-5 h-5" />, color: 'gold' },
          { label: '剩余时间', value: getRemainingTime(), suffix: '', icon: <FiClock className="w-5 h-5" />, color: 'primary' },
          { label: '已分发', value: miningStatus?.totalDistributed, suffix: 'RWT', icon: <FiZap className="w-5 h-5" />, color: 'gold' },
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
              {typeof stat.value === 'string' ? stat.value : formatNumber(stat.value)}
              {stat.suffix && <span className="text-white/40 text-sm ml-1">{stat.suffix}</span>}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="glass-premium p-5">
        <div className="flex justify-between items-center mb-3">
          <span className="text-white/60 text-sm">挖矿进度</span>
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
          <span>{formatNumber(totalRewardsNum)} RWT</span>
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
              质押 LP
            </h2>

            {/* Balance */}
            <div className="flex justify-between text-sm mb-3">
              <span className="text-white/50">可用余额</span>
              <span className="font-medium text-white">{formatNumber(lpBalance, 4)} LP</span>
            </div>

            {/* Input */}
            <div className="relative mb-4">
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="输入质押数量"
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
                请先连接钱包
              </div>
            ) : needsApproval ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleApprove}
                disabled={isApproving}
                className="w-full btn-premium disabled:opacity-50"
              >
                <span>{isApproving ? '授权中...' : '授权 LP 代币'}</span>
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDeposit}
                disabled={isDepositing || !depositAmount || parseFloat(depositAmount) <= 0}
                className="w-full btn-premium disabled:opacity-50"
              >
                <span>{isDepositing ? '质押中...' : '质押'}</span>
              </motion.button>
            )}

            {/* Lock Reset Warning */}
            {parseFloat(userInfo?.stakedAmount || '0') > 0 && lockStatus?.isLocked && (
              <div className="mt-4 p-3 rounded-xl bg-[#FFB800]/10 border border-[#FFB800]/30">
                <div className="flex gap-2">
                  <FiAlertTriangle className="text-[#FFB800] mt-0.5 flex-shrink-0 w-4 h-4" />
                  <div className="text-xs">
                    <p className="text-[#FFB800] font-medium">锁仓期重置提醒</p>
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
            <h3 className="font-semibold mb-4 text-white/80">我的质押</h3>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-white/50">已质押数量</span>
              <span className="font-medium text-[#00D9A5]">{formatNumber(userInfo?.stakedAmount, 4)} LP</span>
            </div>

            <div className="relative mb-4">
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="输入解押数量"
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
              {lockStatus?.isLocked ? `锁仓中 (${formatLockTime(lockStatus.remainingTime)})` : isWithdrawing ? '解押中...' : '解押'}
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
              我的收益
            </h2>

            {/* Pending Reward */}
            <div className="relative p-6 rounded-2xl mb-6 overflow-hidden bg-gradient-to-br from-[#1A2332] to-[#111827] border border-white/5">
              <div className="absolute inset-0 bg-gradient-to-br from-[#00D9A5]/5 to-[#FFB800]/5" />
              <div className="relative text-center">
                <div className="text-white/50 text-sm mb-2">待领取收益</div>
                <div className="text-4xl md:text-5xl font-bold text-gradient-premium mb-1">
                  {formatNumber(pendingReward, 4)}
                </div>
                <div className="text-white/40">RWT</div>
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
                {isClaiming ? '领取中...' : '领取收益'}
              </span>
            </motion.button>

            {/* Rewards Stats */}
            <div className="space-y-3">
              <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5">
                <span className="text-white/50">累计已领取</span>
                <span className="font-medium text-white">{formatNumber(userInfo?.totalClaimed, 4)} RWT</span>
              </div>
              <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5">
                <span className="text-white/50 flex items-center gap-2">
                  <FiUsers className="w-4 h-4 text-[#00D9A5]" /> 推荐奖励
                </span>
                <span className="font-medium text-[#00D9A5]">{formatNumber(userInfo?.referralRewards, 4)} RWT</span>
              </div>
              <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5">
                <span className="text-white/50">团队奖励</span>
                <span className="font-medium text-[#FFB800]">{formatNumber(userInfo?.teamRewards, 4)} RWT</span>
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
            收益分配详情 & 团队信息
          </span>
          {showDetails ? <FiChevronUp className="text-white/50" /> : <FiChevronDown className="text-white/50" />}
        </button>

        {showDetails && (
          <div className="p-5 pt-0 space-y-6">
            <div className="divider-glow" />

            <div className="grid md:grid-cols-2 gap-6">
              {/* Referral Rates */}
              <div className="space-y-4">
                <h4 className="font-semibold text-[#00D9A5]">推荐奖励比例</h4>
                <div className="space-y-2">
                  {[
                    { level: '1代推荐人', rate: contractConfig?.referralLevel1 || 20 },
                    { level: '2代推荐人', rate: contractConfig?.referralLevel2 || 10 },
                    { level: '3代推荐人', rate: contractConfig?.referralLevel3 || 5 },
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
                <h4 className="font-semibold text-[#FFB800]">团队等级阈值</h4>
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
                          等级 {i + 1}
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
              <h4 className="font-semibold text-white">当前合约配置</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: '总奖励', value: `${formatNumber(contractConfig?.totalRewards)} RWT` },
                  { label: '挖矿周期', value: `${(contractConfig?.miningDurationDays / 365).toFixed(1)} 年` },
                  { label: '锁仓天数', value: `${contractConfig?.lockDurationDays || 30} 天` },
                  { label: '分流比例', value: `${contractConfig?.splitShare || 35}%` },
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
              <h4 className="font-semibold text-white">我的团队信息</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: '直推人数', value: userInfo?.referralCount || 0 },
                  { label: '团队业绩', value: `${formatNumber(userInfo?.teamPerformance)} LP` },
                  { label: '小区业绩', value: `${formatNumber(userInfo?.smallAreaPerformance)} LP` },
                  { label: '团队等级', value: `${userInfo?.teamLevel || 0} 级`, highlight: true },
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
              管理员配置面板
            </span>
            {showAdminPanel ? <FiChevronUp className="text-[#FFB800]" /> : <FiChevronDown className="text-[#FFB800]" />}
          </button>

          {showAdminPanel && (
            <div className="p-5 pt-0 space-y-6">
              <div className="divider-glow" />

              {/* 锁仓天数设置 */}
              <div className="space-y-3">
                <h4 className="font-semibold text-white">锁仓天数（当前：{contractConfig?.lockDurationDays} 天）</h4>
                <div className="flex gap-3">
                  <input
                    type="number"
                    value={adminConfig.lockDays}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, lockDays: e.target.value }))}
                    placeholder="输入天数"
                    className="input-premium flex-1"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSetLockDuration}
                    disabled={isUpdating || !adminConfig.lockDays}
                    className="btn-premium px-6 disabled:opacity-50"
                  >
                    设置
                  </motion.button>
                </div>
              </div>

              {/* 挖矿参数设置 */}
              <div className="space-y-3">
                <h4 className="font-semibold text-white">挖矿参数</h4>
                <div className="grid md:grid-cols-3 gap-3">
                  <input
                    type="number"
                    value={adminConfig.totalRewards}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, totalRewards: e.target.value }))}
                    placeholder="总奖励数量"
                    className="input-premium"
                  />
                  <input
                    type="number"
                    value={adminConfig.miningYears}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, miningYears: e.target.value }))}
                    placeholder="挖矿周期（年）"
                    className="input-premium"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSetMiningParams}
                    disabled={isUpdating || !adminConfig.totalRewards || !adminConfig.miningYears}
                    className="btn-premium disabled:opacity-50"
                  >
                    设置挖矿参数
                  </motion.button>
                </div>
              </div>

              {/* 分配比例设置 */}
              <div className="space-y-3">
                <h4 className="font-semibold text-white">分配比例（两者之和必须等于100%）</h4>
                <div className="grid md:grid-cols-3 gap-3">
                  <input
                    type="number"
                    value={adminConfig.userShare}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, userShare: e.target.value }))}
                    placeholder="用户占比%"
                    className="input-premium"
                  />
                  <input
                    type="number"
                    value={adminConfig.splitShare}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, splitShare: e.target.value }))}
                    placeholder="分流占比%"
                    className="input-premium"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSetDistributionRates}
                    disabled={isUpdating || !adminConfig.userShare || !adminConfig.splitShare}
                    className="btn-premium disabled:opacity-50"
                  >
                    设置分配比例
                  </motion.button>
                </div>
              </div>

              {/* 推荐比例设置 */}
              <div className="space-y-3">
                <h4 className="font-semibold text-white">推荐奖励比例</h4>
                <div className="grid md:grid-cols-4 gap-3">
                  <input
                    type="number"
                    value={adminConfig.ref1}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, ref1: e.target.value }))}
                    placeholder="1代%"
                    className="input-premium"
                  />
                  <input
                    type="number"
                    value={adminConfig.ref2}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, ref2: e.target.value }))}
                    placeholder="2代%"
                    className="input-premium"
                  />
                  <input
                    type="number"
                    value={adminConfig.ref3}
                    onChange={(e) => setAdminConfig(prev => ({ ...prev, ref3: e.target.value }))}
                    placeholder="3代%"
                    className="input-premium"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSetReferralRates}
                    disabled={isUpdating || !adminConfig.ref1 || !adminConfig.ref2 || !adminConfig.ref3}
                    className="btn-premium disabled:opacity-50"
                  >
                    设置推荐比例
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
