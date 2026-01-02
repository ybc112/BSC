import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { FiDollarSign, FiPercent, FiTrendingUp, FiGift, FiInfo, FiChevronDown, FiChevronUp, FiZap, FiLayers, FiActivity, FiAlertTriangle } from 'react-icons/fi';
import { formatNumber, CONTRACTS, parseContractError } from '../utils/constants';

export default function TokenMiningPage({
  account,
  tokenMiningV2Data,
  tokenBalance,
  tokenAllowance,
  contracts,
  onRefresh
}) {
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  const { userInfo, miningStatus, pendingReward, dailyRate, apy, loading } = tokenMiningV2Data || {};

  const needsApproval = parseFloat(tokenAllowance) < parseFloat(depositAmount || '0');

  // 授权
  const handleApprove = async () => {
    if (!contracts?.rewardToken) return;
    setIsApproving(true);
    try {
      const tx = await contracts.rewardToken.approve(CONTRACTS.TOKEN_MINING_V2, ethers.MaxUint256);
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
      const tx = await contracts.tokenMiningV2.deposit(amount);
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

  // 提取
  const handleWithdraw = async () => {
    if (!contracts?.tokenMiningV2 || !withdrawAmount) return;
    setIsWithdrawing(true);
    try {
      const amount = ethers.parseEther(withdrawAmount);
      const tx = await contracts.tokenMiningV2.withdraw(amount);
      toast.loading('提取中...', { id: 'withdraw' });
      await tx.wait();
      toast.success('提取成功', { id: 'withdraw' });
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
    if (!contracts?.tokenMiningV2) return;
    setIsClaiming(true);
    try {
      const tx = await contracts.tokenMiningV2.claim();
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

  // 计算进度
  const progress = miningStatus
    ? (parseFloat(miningStatus.totalDistributed) / 30000000) * 100
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FFB800] to-[#FF8A00] flex items-center justify-center shadow-lg shadow-[#FFB800]/20">
            <FiDollarSign className="w-7 h-7 text-[#0B1120]" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">代币质押挖矿</h1>
            <p className="text-white/50">随进随出，{dailyRate || 0.5}%/天收益</p>
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

      {/* APY Display */}
      <div className="glass-premium p-6 text-center">
        <div className="text-white/50 text-sm mb-2">年化收益率 (APY)</div>
        <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFB800] to-[#00D9A5]">
          {apy || 182.5}%
        </div>
        <div className="text-white/40 text-sm mt-2">日收益率：{dailyRate || 0.5}%</div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '总质押量', value: miningStatus?.totalStaked, suffix: 'RWT', icon: <FiLayers className="w-5 h-5" />, color: 'primary' },
          { label: '已分发奖励', value: miningStatus?.totalDistributed, suffix: 'RWT', icon: <FiGift className="w-5 h-5" />, color: 'gold' },
          { label: '剩余奖励', value: miningStatus?.remainingRewards, suffix: 'RWT', icon: <FiZap className="w-5 h-5" />, color: 'primary' },
          { label: '我的待领取', value: pendingReward, suffix: 'RWT', icon: <FiTrendingUp className="w-5 h-5" />, color: 'gold' },
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
          <span>3000 万 RWT</span>
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
              <span className="w-10 h-10 rounded-xl bg-[#FFB800]/20 flex items-center justify-center">
                <FiDollarSign className="w-5 h-5 text-[#FFB800]" />
              </span>
              质押代币
            </h2>

            {/* Balance */}
            <div className="flex justify-between text-sm mb-3">
              <span className="text-white/50">可用余额</span>
              <span className="font-medium text-white">{formatNumber(tokenBalance, 4)} RWT</span>
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
                className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-[#FFB800]/20 text-[#FFB800] hover:bg-[#FFB800]/30"
              >
                MAX
              </button>
            </div>

            {/* Estimated Daily Reward */}
            {depositAmount && parseFloat(depositAmount) > 0 && (
              <div className="p-3 rounded-xl mb-4 text-sm bg-white/5 border border-white/5">
                <div className="flex justify-between mb-2">
                  <span className="text-white/50">预计每日收益</span>
                  <span className="font-medium text-[#FFB800]">
                    +{(parseFloat(depositAmount) * (dailyRate || 0.5) / 100).toFixed(4)} RWT
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">预计月收益</span>
                  <span className="text-white/70">
                    +{(parseFloat(depositAmount) * (dailyRate || 0.5) / 100 * 30).toFixed(2)} RWT
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
                style={{ background: 'linear-gradient(135deg, #FFB800, #FF8A00)' }}
              >
                <span>{isApproving ? '授权中...' : '授权 RWT 代币'}</span>
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDeposit}
                disabled={isDepositing || !depositAmount || parseFloat(depositAmount) <= 0 || miningStatus?.miningEnded}
                className="w-full btn-premium disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #FFB800, #FF8A00)' }}
              >
                <span>{isDepositing ? '质押中...' : '质押'}</span>
              </motion.button>
            )}

            {/* Info */}
            <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex gap-3">
                <FiInfo className="text-[#00D9A5] mt-0.5 flex-shrink-0" />
                <div className="text-sm text-white/70">
                  <p className="mb-2 font-medium text-white">质押规则：</p>
                  <ul className="list-disc list-inside space-y-1 text-white/50">
                    <li>随进随出，无锁仓期限</li>
                    <li>每天{dailyRate || 0.5}%收益，挖完为止</li>
                    <li>随时可提取本金和收益</li>
                    <li>不参与推荐和团队奖励</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Withdraw & Claim Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="neon-card"
        >
          <div className="neon-card-inner">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#00D9A5]/20 flex items-center justify-center">
                <FiGift className="w-5 h-5 text-[#00D9A5]" />
              </span>
              我的质押
            </h2>

            {/* User Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="text-sm text-white/50 mb-1">我的质押</div>
                <div className="text-xl font-bold text-white">{formatNumber(userInfo?.stakedAmount, 4)} RWT</div>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="text-sm text-white/50 mb-1">累计收益</div>
                <div className="text-xl font-bold text-[#00D9A5]">{formatNumber(userInfo?.totalClaimed, 4)} RWT</div>
              </div>
            </div>

            {/* Pending Reward */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-[#00D9A5]/10 to-[#FFB800]/10 border border-[#00D9A5]/20 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-white/50">待领取收益</div>
                  <div className="text-2xl font-bold text-[#00D9A5]">
                    {formatNumber(pendingReward, 6)} RWT
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClaim}
                  disabled={isClaiming || parseFloat(pendingReward) <= 0}
                  className="px-6 py-3 rounded-xl bg-[#00D9A5] text-[#0B1120] font-semibold hover:bg-[#00D9A5]/90 transition-colors disabled:opacity-50"
                >
                  {isClaiming ? '领取中...' : '领取收益'}
                </motion.button>
              </div>
              {userInfo?.dailyReward && parseFloat(userInfo.dailyReward) > 0 && (
                <div className="text-sm text-white/40 mt-2">
                  每日收益: +{formatNumber(userInfo.dailyReward, 4)} RWT
                </div>
              )}
            </div>

            {/* Withdraw Section */}
            <div className="border-t border-white/10 pt-6">
              <div className="flex justify-between text-sm mb-3">
                <span className="text-white/50">可提取数量</span>
                <span className="font-medium text-white">{formatNumber(userInfo?.stakedAmount, 4)} RWT</span>
              </div>

              <div className="relative mb-4">
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="输入提取数量"
                  className="input-premium pr-20"
                />
                <button
                  onClick={() => setWithdrawAmount(userInfo?.stakedAmount || '0')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-white/10 text-white/70 hover:bg-white/20"
                >
                  MAX
                </button>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleWithdraw}
                disabled={isWithdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > parseFloat(userInfo?.stakedAmount || '0')}
                className="w-full py-3 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                {isWithdrawing ? '提取中...' : '提取本金'}
              </motion.button>
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
                    <th className="text-center pb-3">日收益</th>
                    <th className="text-center pb-3">月收益</th>
                    <th className="text-center pb-3">年收益</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  {[1000, 10000, 100000, 1000000].map(amount => {
                    const rate = (dailyRate || 0.5) / 100;
                    return (
                      <tr key={amount} className="border-t border-white/5">
                        <td className="py-3 text-white/70">{formatNumber(amount)} RWT</td>
                        <td className="text-center py-3 text-[#FFB800]">+{formatNumber(amount * rate)}</td>
                        <td className="text-center py-3 text-white/70">+{formatNumber(amount * rate * 30)}</td>
                        <td className="text-center py-3 text-[#00D9A5]">+{formatNumber(amount * rate * 365)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
