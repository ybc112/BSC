import { useState } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { FiDollarSign, FiPercent, FiTrendingUp, FiGift, FiInfo, FiChevronDown, FiChevronUp, FiZap, FiLayers, FiActivity } from 'react-icons/fi';
import { formatNumber, CONTRACTS } from '../utils/constants';

export default function TokenMiningPage({
  account,
  tokenMiningData,
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

  const { userInfo, miningStatus, pendingReward, apy } = tokenMiningData || {};

  const needsApproval = parseFloat(tokenAllowance) < parseFloat(depositAmount || '0');

  // 授权
  const handleApprove = async () => {
    if (!contracts?.rewardToken) return;
    setIsApproving(true);
    try {
      const tx = await contracts.rewardToken.approve(CONTRACTS.TOKEN_MINING, ethers.MaxUint256);
      toast.loading('授权中...', { id: 'approve' });
      await tx.wait();
      toast.success('授权成功', { id: 'approve' });
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '授权失败', { id: 'approve' });
    } finally {
      setIsApproving(false);
    }
  };

  // 质押
  const handleDeposit = async () => {
    if (!contracts?.tokenMining || !depositAmount) return;
    setIsDepositing(true);
    try {
      const amount = ethers.parseEther(depositAmount);
      const tx = await contracts.tokenMining.deposit(amount);
      toast.loading('质押中...', { id: 'deposit' });
      await tx.wait();
      toast.success('质押成功', { id: 'deposit' });
      setDepositAmount('');
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '质押失败', { id: 'deposit' });
    } finally {
      setIsDepositing(false);
    }
  };

  // 解押
  const handleWithdraw = async () => {
    if (!contracts?.tokenMining || !withdrawAmount) return;
    setIsWithdrawing(true);
    try {
      const amount = ethers.parseEther(withdrawAmount);
      const tx = await contracts.tokenMining.withdraw(amount);
      toast.loading('解押中...', { id: 'withdraw' });
      await tx.wait();
      toast.success('解押成功', { id: 'withdraw' });
      setWithdrawAmount('');
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '解押失败', { id: 'withdraw' });
    } finally {
      setIsWithdrawing(false);
    }
  };

  // 领取收益
  const handleClaim = async () => {
    if (!contracts?.tokenMining) return;
    setIsClaiming(true);
    try {
      const tx = await contracts.tokenMining.claim();
      toast.loading('领取中...', { id: 'claim' });
      await tx.wait();
      toast.success('领取成功', { id: 'claim' });
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '领取失败', { id: 'claim' });
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
            <p className="text-white/50">质押 RWT 代币，每日 0.5% 收益</p>
          </div>
        </div>
        <div className={`badge-glow ${miningStatus?.miningEnded ? 'bg-[#FF6B6B]/15 border-[#FF6B6B]/30 !text-[#FF6B6B]' : ''}`}>
          <FiActivity className="w-4 h-4 mr-2" />
          {miningStatus?.miningEnded ? '已结束' : '进行中'}
        </div>
      </div>

      {/* APY Highlight Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-white/10"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#FFB800]/10 via-[#00D9A5]/10 to-[#FFB800]/10" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.02%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
        <div className="relative p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FFB800] to-[#FF8A00] flex items-center justify-center shadow-lg shadow-[#FFB800]/30 animate-pulse-glow">
                <FiPercent className="w-10 h-10 text-[#0B1120]" />
              </div>
              <div className="text-center md:text-left">
                <div className="text-white/50 text-sm mb-1">年化收益率 (APY)</div>
                <div className="text-5xl md:text-6xl font-bold text-gradient-gold">{apy || 182.5}%</div>
              </div>
            </div>
            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-white/50 text-sm mb-1">每日收益率</div>
                <div className="text-3xl font-bold text-[#00D9A5]">0.5%</div>
              </div>
              <div className="text-center">
                <div className="text-white/50 text-sm mb-1">奖池份额</div>
                <div className="text-3xl font-bold text-white">30%</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '总质押量', value: miningStatus?.totalStaked, suffix: 'RWT', icon: <FiLayers className="w-5 h-5" />, color: 'primary' },
          { label: '已分发奖励', value: miningStatus?.totalDistributed, suffix: 'RWT', icon: <FiGift className="w-5 h-5" />, color: 'gold' },
          { label: '剩余奖励', value: miningStatus?.remainingRewards, suffix: 'RWT', icon: <FiZap className="w-5 h-5" />, color: 'primary' },
          { label: '我的日收益', value: userInfo?.dailyReward, suffix: 'RWT', icon: <FiTrendingUp className="w-5 h-5" />, color: 'gold' },
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
                className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-[#FFB800]/20 text-[#FFB800] text-sm font-medium hover:bg-[#FFB800]/30 transition-colors"
              >
                MAX
              </button>
            </div>

            {/* Estimated Daily Reward */}
            {depositAmount && parseFloat(depositAmount) > 0 && (
              <div className="p-3 rounded-xl mb-4 text-sm bg-white/5 border border-white/5">
                <div className="flex justify-between">
                  <span className="text-white/50">预计每日收益</span>
                  <span className="text-[#00D9A5] font-medium">
                    +{(parseFloat(depositAmount) * 0.005).toFixed(4)} RWT
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

            {/* Divider */}
            <div className="divider-glow my-6" style={{ background: 'linear-gradient(90deg, transparent, rgba(255, 184, 0, 0.4), transparent)' }} />

            {/* My Staking */}
            <h3 className="font-semibold mb-4 text-white/80">我的质押</h3>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-white/50">已质押数量</span>
              <span className="font-medium text-[#FFB800]">{formatNumber(userInfo?.stakedAmount, 4)} RWT</span>
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
              disabled={isWithdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
              className="w-full btn-ghost disabled:opacity-50"
            >
              {isWithdrawing ? '解押中...' : '解押'}
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
              <span className="w-10 h-10 rounded-xl bg-[#00D9A5]/20 flex items-center justify-center">
                <FiGift className="w-5 h-5 text-[#00D9A5]" />
              </span>
              我的收益
            </h2>

            {/* Pending Reward */}
            <div className="relative p-6 rounded-2xl mb-6 overflow-hidden bg-gradient-to-br from-[#1A2332] to-[#111827] border border-white/5">
              <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/5 to-[#00D9A5]/5" />
              <div className="relative text-center">
                <div className="text-white/50 text-sm mb-2">待领取收益</div>
                <div className="text-4xl md:text-5xl font-bold text-gradient-gold mb-1">
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

            {/* Stats */}
            <div className="space-y-3">
              <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5">
                <span className="text-white/50">累计已领取</span>
                <span className="font-medium text-white">{formatNumber(userInfo?.totalClaimed, 4)} RWT</span>
              </div>
              <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5">
                <span className="text-white/50">预计每日收益</span>
                <span className="font-medium text-[#00D9A5]">+{formatNumber(userInfo?.dailyReward, 4)} RWT</span>
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex gap-3">
                <FiInfo className="text-[#00D9A5] mt-0.5 flex-shrink-0" />
                <div className="text-sm text-white/70">
                  <p className="mb-2 font-medium text-white">代币挖矿规则：</p>
                  <ul className="list-disc list-inside space-y-1 text-white/50">
                    <li>每日收益 = 质押数量 × 0.5%</li>
                    <li>收益按秒累计，随时可领取</li>
                    <li>总奖励 3000 万代币，挖完即止</li>
                  </ul>
                </div>
              </div>
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { amount: 1000, label: '1千' },
                { amount: 10000, label: '1万' },
                { amount: 100000, label: '10万' },
                { amount: 1000000, label: '100万' },
              ].map((item) => (
                <div key={item.amount} className="text-center p-5 rounded-xl bg-white/5 border border-white/5 hover:border-[#FFB800]/30 transition-colors">
                  <div className="text-white/50 text-sm mb-2">质押 {item.label} RWT</div>
                  <div className="text-xl font-bold text-[#00D9A5] mb-1">
                    日 +{formatNumber(item.amount * 0.005)}
                  </div>
                  <div className="text-sm text-white/40">
                    月 +{formatNumber(item.amount * 0.005 * 30)}
                  </div>
                  <div className="text-xs text-[#FFB800]/60 mt-1">
                    年 +{formatNumber(item.amount * 0.005 * 365)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
