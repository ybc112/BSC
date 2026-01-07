import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { FiDollarSign, FiPercent, FiTrendingUp, FiGift, FiInfo, FiChevronDown, FiChevronUp, FiZap, FiLayers, FiActivity, FiLock, FiUnlock, FiClock, FiAlertTriangle } from 'react-icons/fi';
import { formatNumber, CONTRACTS, parseContractError } from '../utils/constants';

// 默认档位配置（当链上数据未加载时使用）
const DEFAULT_TIER_CONFIG = [
  { id: 0, name: '随进随出', duration: 0, rate: 0.4, color: '#00D9A5' },
  { id: 1, name: '3个月', duration: 90, rate: 0.6, color: '#FFB800' },
  { id: 2, name: '6个月', duration: 180, rate: 0.8, color: '#FF8A00' },
  { id: 3, name: '12个月', duration: 365, rate: 1.0, color: '#FF6B6B' },
];

export default function TokenMiningPage({
  account,
  tokenMiningV2Data,
  tokenBalance,
  tokenAllowance,
  contracts,
  onRefresh
}) {
  const [depositAmount, setDepositAmount] = useState('');
  const [selectedTier, setSelectedTier] = useState(0);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isClaimingAll, setIsClaimingAll] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [withdrawingStakeId, setWithdrawingStakeId] = useState(null);
  const [claimingStakeId, setClaimingStakeId] = useState(null);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // 更新当前时间用于倒计时
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const { userInfo, stakes, miningStatus, tierConfigs, pendingRewardAll, loading } = tokenMiningV2Data || {};

  // 从链上数据构建档位配置，使用合约返回的APY（简单年化 = 日收益 × 365）
  const TIER_CONFIG = useMemo(() => {
    if (!tierConfigs?.dailyRates || tierConfigs.dailyRates.length === 0) {
      // 使用默认配置，简单年化计算
      return DEFAULT_TIER_CONFIG.map(tier => ({
        ...tier,
        apy: Math.round(tier.rate * 365) // 简单年化：日收益 × 365
      }));
    }

    // 从链上数据构建配置，使用合约返回的annualAPYs
    return [
      { id: 0, name: '随进随出', duration: tierConfigs.durations?.[0] || 0, rate: tierConfigs.dailyRates[0], color: '#00D9A5' },
      { id: 1, name: '3个月', duration: tierConfigs.durations?.[1] || 90, rate: tierConfigs.dailyRates[1], color: '#FFB800' },
      { id: 2, name: '6个月', duration: tierConfigs.durations?.[2] || 180, rate: tierConfigs.dailyRates[2], color: '#FF8A00' },
      { id: 3, name: '12个月', duration: tierConfigs.durations?.[3] || 365, rate: tierConfigs.dailyRates[3], color: '#FF6B6B' },
    ].map((tier, index) => ({
      ...tier,
      apy: tierConfigs.annualAPYs?.[index] || Math.round(tier.rate * 365) // 使用合约返回的APY
    }));
  }, [tierConfigs]);

  const needsApproval = parseFloat(tokenAllowance) < parseFloat(depositAmount || '0');

  // 授权 - TokenMiningV2 使用 ProjectTokenV2 代币
  const handleApprove = async () => {
    if (!contracts?.projectTokenV2) return;
    setIsApproving(true);
    try {
      const tx = await contracts.projectTokenV2.approve(CONTRACTS.TOKEN_MINING_V2, ethers.MaxUint256);
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
    if (!contracts?.tokenMiningV2 || !depositAmount) return;
    setIsDepositing(true);
    try {
      const amount = ethers.parseEther(depositAmount);
      const tx = await contracts.tokenMiningV2.deposit(amount, selectedTier);
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

  // 提取单个质押
  const handleWithdraw = async (stakeId) => {
    if (!contracts?.tokenMiningV2) return;
    setWithdrawingStakeId(stakeId);
    try {
      const tx = await contracts.tokenMiningV2.withdraw(stakeId);
      toast.loading('提取中...', { id: 'withdraw' });
      await tx.wait();
      toast.success('提取成功', { id: 'withdraw' });
      onRefresh?.();
    } catch (err) {
      toast.error(parseContractError(err), { id: 'withdraw' });
    } finally {
      setWithdrawingStakeId(null);
    }
  };

  // 领取单个质押收益
  const handleClaim = async (stakeId) => {
    if (!contracts?.tokenMiningV2) return;
    setClaimingStakeId(stakeId);
    try {
      const tx = await contracts.tokenMiningV2.claim(stakeId);
      toast.loading('领取中...', { id: 'claim' });
      await tx.wait();
      toast.success('领取成功', { id: 'claim' });
      onRefresh?.();
    } catch (err) {
      toast.error(parseContractError(err), { id: 'claim' });
    } finally {
      setClaimingStakeId(null);
    }
  };

  // 一键领取所有收益
  const handleClaimAll = async () => {
    if (!contracts?.tokenMiningV2) return;
    setIsClaimingAll(true);
    try {
      const tx = await contracts.tokenMiningV2.claimAll();
      toast.loading('领取全部收益中...', { id: 'claimAll' });
      await tx.wait();
      toast.success('领取成功', { id: 'claimAll' });
      onRefresh?.();
    } catch (err) {
      toast.error(parseContractError(err), { id: 'claimAll' });
    } finally {
      setIsClaimingAll(false);
    }
  };

  // 格式化剩余时间
  const formatTimeRemaining = (unlockTime) => {
    const remaining = unlockTime - now;
    if (remaining <= 0) return '已解锁';

    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;

    if (days > 0) return `${days}天 ${hours}时`;
    if (hours > 0) return `${hours}时 ${minutes}分`;
    return `${minutes}分 ${seconds}秒`;
  };

  // 检查是否可以提取
  const canWithdraw = (stake) => {
    if (stake.tier === 0) return true; // 灵活质押随时可取
    return now >= stake.unlockTime;
  };

  // 计算进度
  const progress = miningStatus
    ? (parseFloat(miningStatus.totalDistributed) / 30000000) * 100
    : 0;

  // 当前选择的档位配置
  const currentTier = TIER_CONFIG[selectedTier];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FFB800] to-[#FF8A00] flex items-center justify-center shadow-lg shadow-[#FFB800]/20">
            <FiDollarSign className="w-7 h-7 text-[#0B1120]" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">代币质押挖矿 V2</h1>
            <p className="text-white/50">多档锁仓，收益更高</p>
          </div>
        </div>
        <div className={`badge-glow ${miningStatus?.miningEnded ? 'bg-[#FF6B6B]/15 border-[#FF6B6B]/30 !text-[#FF6B6B]' : ''}`}>
          <FiActivity className="w-4 h-4 mr-2" />
          {miningStatus?.miningEnded ? '已结束' : '进行中'}
        </div>
      </div>

      {/* Mining Ended Warning */}
      {miningStatus?.miningEnded && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-[#FF6B6B]/10 border border-[#FF6B6B]/30"
        >
          <div className="flex items-start gap-3">
            <FiAlertTriangle className="w-5 h-5 text-[#FF6B6B] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[#FF6B6B] font-medium">挖矿已结束</p>
              <p className="text-white/50 text-sm mt-1">
                奖励池已耗尽，无法进行新的质押。您仍可以提取已质押的本金和已产生的收益。
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tier Selection Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {TIER_CONFIG.map((tier) => (
          <motion.button
            key={tier.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedTier(tier.id)}
            className={`relative p-5 rounded-2xl border transition-all duration-300 text-left ${
              selectedTier === tier.id
                ? 'bg-white/10 border-white/30 shadow-lg'
                : 'bg-white/5 border-white/10 hover:bg-white/8'
            }`}
            style={{
              boxShadow: selectedTier === tier.id ? `0 0 30px ${tier.color}20` : 'none',
            }}
          >
            {selectedTier === tier.id && (
              <div
                className="absolute top-2 right-2 w-3 h-3 rounded-full"
                style={{ backgroundColor: tier.color }}
              />
            )}
            <div className="flex items-center gap-2 mb-3">
              {tier.duration === 0 ? (
                <FiUnlock className="w-4 h-4" style={{ color: tier.color }} />
              ) : (
                <FiLock className="w-4 h-4" style={{ color: tier.color }} />
              )}
              <span className="text-sm text-white/60">{tier.name}</span>
            </div>
            <div className="text-2xl font-bold mb-1" style={{ color: tier.color }}>
              {tier.apy}%
            </div>
            <div className="text-xs text-white/40">
              日收益 {tier.rate}%
            </div>
            {tier.duration > 0 && (
              <div className="text-xs text-white/30 mt-1">
                锁仓 {tier.duration} 天
              </div>
            )}
          </motion.button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '总质押量', value: miningStatus?.totalStaked, suffix: 'AGG', icon: <FiLayers className="w-5 h-5" />, color: 'primary' },
          { label: '已分发奖励', value: miningStatus?.totalDistributed, suffix: 'AGG', icon: <FiGift className="w-5 h-5" />, color: 'gold' },
          { label: '剩余奖励', value: miningStatus?.remainingRewards, suffix: 'AGG', icon: <FiZap className="w-5 h-5" />, color: 'primary' },
          { label: '我的待领取', value: pendingRewardAll, suffix: 'AGG', icon: <FiTrendingUp className="w-5 h-5" />, color: 'gold' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="stat-card-premium"
          >
            <div className={`flex items-center gap-2 mb-3 ${stat.color === 'primary' ? 'text-[#00D9A5]' : 'text-[#FFB800]'}`}>
              {stat.icon}
              <span className="text-white/40 text-sm">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {formatNumber(stat.value)}
              <span className="text-white/40 text-sm ml-1">{stat.suffix}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="glass-premium p-5">
        <div className="flex justify-between items-center mb-3">
          <span className="text-white/60 text-sm">奖励发放进度</span>
          <span className="text-sm font-medium text-[#FFB800]">{progress.toFixed(2)}%</span>
        </div>
        <div className="progress-glow">
          <motion.div
            className="progress-glow-bar"
            style={{ background: 'linear-gradient(90deg, #FFB800, #00D9A5)' }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/40 mt-2">
          <span>0</span>
          <span>3000 万 AGG</span>
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
              <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${currentTier.color}20` }}>
                <FiDollarSign className="w-5 h-5" style={{ color: currentTier.color }} />
              </span>
              质押代币 - {currentTier.name}
            </h2>

            {/* Selected Tier Info */}
            <div className="p-4 rounded-xl mb-4 bg-white/5 border border-white/10">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-white/50">选择的档位</div>
                  <div className="text-lg font-bold" style={{ color: currentTier.color }}>{currentTier.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white/50">年化收益</div>
                  <div className="text-2xl font-bold text-white">{currentTier.apy}%</div>
                </div>
              </div>
              {currentTier.duration > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-sm text-white/50">
                  <FiClock className="w-4 h-4" />
                  <span>锁仓期 {currentTier.duration} 天，到期后可提取本金</span>
                </div>
              )}
            </div>

            {/* Balance */}
            <div className="flex justify-between text-sm mb-3">
              <span className="text-white/50">可用余额</span>
              <span className="font-medium text-white">{formatNumber(tokenBalance, 4)} AGG</span>
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
                onClick={() => setDepositAmount(tokenBalance)}
                className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: `${currentTier.color}20`, color: currentTier.color }}
              >
                MAX
              </button>
            </div>

            {/* Estimated Daily Reward */}
            {depositAmount && parseFloat(depositAmount) > 0 && (
              <div className="p-3 rounded-xl mb-4 text-sm bg-white/5 border border-white/5">
                <div className="flex justify-between mb-2">
                  <span className="text-white/50">预计每日收益</span>
                  <span className="font-medium" style={{ color: currentTier.color }}>
                    +{(parseFloat(depositAmount) * currentTier.rate / 100).toFixed(4)} AGG
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">预计月收益</span>
                  <span className="text-white/70">
                    +{(parseFloat(depositAmount) * currentTier.rate / 100 * 30).toFixed(2)} AGG
                  </span>
                </div>
              </div>
            )}

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
                style={{ background: `linear-gradient(135deg, ${currentTier.color}, ${currentTier.color}CC)` }}
              >
                <span>{isApproving ? '授权中...' : '授权 AGG 代币'}</span>
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDeposit}
                disabled={isDepositing || !depositAmount || parseFloat(depositAmount) <= 0 || miningStatus?.miningEnded}
                className="w-full btn-premium disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${currentTier.color}, ${currentTier.color}CC)` }}
              >
                <span>{isDepositing ? '质押中...' : `质押 (${currentTier.name})`}</span>
              </motion.button>
            )}

            {/* Info */}
            <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex gap-3">
                <FiInfo className="text-[#00D9A5] mt-0.5 flex-shrink-0" />
                <div className="text-sm text-white/70">
                  <p className="mb-2 font-medium text-white">多档质押规则：</p>
                  <ul className="list-disc list-inside space-y-1 text-white/50">
                    <li>随进随出：{TIER_CONFIG[0]?.rate || 0.4}%/天，随时可取</li>
                    <li>3个月锁仓：{TIER_CONFIG[1]?.rate || 0.6}%/天，90天后可取</li>
                    <li>6个月锁仓：{TIER_CONFIG[2]?.rate || 0.8}%/天，180天后可取</li>
                    <li>12个月锁仓：{TIER_CONFIG[3]?.rate || 1.0}%/天，365天后可取</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Slippage Warning */}
            <div className="mt-4 p-4 rounded-xl bg-[#FFB800]/10 border border-[#FFB800]/30">
              <div className="flex gap-3">
                <FiAlertTriangle className="text-[#FFB800] mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-[#FFB800]">滑点提醒</p>
                  <p className="text-white/50 mt-1">
                    AGG 代币在 DEX 卖出时有 <span className="text-[#FFB800] font-medium">2.8%</span> 滑点（买入 0%）。
                    质押和领取收益不受滑点影响。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* My Stakes Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="neon-card"
        >
          <div className="neon-card-inner">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-[#00D9A5]/20 flex items-center justify-center">
                  <FiGift className="w-5 h-5 text-[#00D9A5]" />
                </span>
                我的质押
              </h2>
              {stakes?.length > 0 && parseFloat(pendingRewardAll) > 0 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClaimAll}
                  disabled={isClaimingAll}
                  className="px-4 py-2 rounded-lg bg-[#00D9A5]/20 text-[#00D9A5] text-sm font-medium hover:bg-[#00D9A5]/30 transition-colors disabled:opacity-50"
                >
                  {isClaimingAll ? '领取中...' : '一键领取全部'}
                </motion.button>
              )}
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="text-sm text-white/50 mb-1">总质押</div>
                <div className="text-xl font-bold text-white">{formatNumber(userInfo?.totalStaked, 4)} AGG</div>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="text-sm text-white/50 mb-1">累计收益</div>
                <div className="text-xl font-bold text-[#00D9A5]">{formatNumber(userInfo?.totalClaimed, 4)} AGG</div>
              </div>
            </div>

            {/* Stakes List */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {!stakes || stakes.length === 0 ? (
                <div className="text-center py-8 text-white/40">
                  <FiLayers className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>暂无质押记录</p>
                  <p className="text-sm mt-1">选择档位并质押代币开始赚取收益</p>
                </div>
              ) : (
                stakes.map((stake) => {
                  const tierInfo = TIER_CONFIG[stake.tier];
                  const isLocked = !canWithdraw(stake);

                  return (
                    <div
                      key={stake.stakeId}
                      className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          {isLocked ? (
                            <FiLock className="w-4 h-4" style={{ color: tierInfo.color }} />
                          ) : (
                            <FiUnlock className="w-4 h-4" style={{ color: tierInfo.color }} />
                          )}
                          <span className="font-medium" style={{ color: tierInfo.color }}>
                            {tierInfo.name}
                          </span>
                          <span className="text-xs text-white/40">#{stake.stakeId}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-white/50">日收益率</div>
                          <div className="font-medium" style={{ color: tierInfo.color }}>{tierInfo.rate}%</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <div className="text-xs text-white/40 mb-1">质押数量</div>
                          <div className="font-medium text-white">{formatNumber(stake.amount, 4)} AGG</div>
                        </div>
                        <div>
                          <div className="text-xs text-white/40 mb-1">待领取收益</div>
                          <div className="font-medium text-[#00D9A5]">+{formatNumber(stake.pendingReward, 4)} AGG</div>
                        </div>
                      </div>

                      {/* Lock Status */}
                      {stake.tier > 0 && (
                        <div className={`flex items-center gap-2 text-xs mb-3 ${isLocked ? 'text-[#FFB800]' : 'text-[#00D9A5]'}`}>
                          <FiClock className="w-3 h-3" />
                          <span>{isLocked ? `剩余: ${formatTimeRemaining(stake.unlockTime)}` : '已解锁'}</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleClaim(stake.stakeId)}
                          disabled={claimingStakeId === stake.stakeId || parseFloat(stake.pendingReward) <= 0}
                          className="flex-1 py-2 rounded-lg bg-[#00D9A5]/20 text-[#00D9A5] text-sm font-medium hover:bg-[#00D9A5]/30 transition-colors disabled:opacity-50"
                        >
                          {claimingStakeId === stake.stakeId ? '领取中...' : '领取收益'}
                        </button>
                        <button
                          onClick={() => handleWithdraw(stake.stakeId)}
                          disabled={withdrawingStakeId === stake.stakeId || isLocked}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                            isLocked
                              ? 'bg-white/5 text-white/30 cursor-not-allowed'
                              : 'bg-white/10 text-white/70 hover:bg-white/20'
                          }`}
                        >
                          {withdrawingStakeId === stake.stakeId ? '提取中...' : isLocked ? '锁仓中' : '提取本金'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Calculator Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-premium overflow-hidden"
      >
        <button
          onClick={() => setShowCalculator(!showCalculator)}
          className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <span className="font-semibold flex items-center gap-2 text-white">
            <FiTrendingUp className="w-5 h-5 text-[#FFB800]" />
            收益计算器
          </span>
          {showCalculator ? <FiChevronUp className="text-white/50" /> : <FiChevronDown className="text-white/50" />}
        </button>

        {showCalculator && (
          <div className="p-5 pt-0">
            <div className="divider-glow mb-6" style={{ background: 'linear-gradient(90deg, transparent, rgba(255, 184, 0, 0.4), transparent)' }} />

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/50">
                    <th className="text-left pb-3">质押数量</th>
                    {TIER_CONFIG.map(tier => (
                      <th key={tier.id} className="text-center pb-3" style={{ color: tier.color }}>
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-white">
                  {[1000, 10000, 100000, 1000000].map(amount => (
                    <tr key={amount} className="border-t border-white/5">
                      <td className="py-3 text-white/70">{formatNumber(amount)} AGG</td>
                      {TIER_CONFIG.map(tier => (
                        <td key={tier.id} className="text-center py-3">
                          <div style={{ color: tier.color }}>日 +{formatNumber(amount * tier.rate / 100)}</div>
                          <div className="text-xs text-white/40">月 +{formatNumber(amount * tier.rate / 100 * 30)}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
