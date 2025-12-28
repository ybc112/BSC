import { useState } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { FiUsers, FiCopy, FiCheck, FiGift, FiAward, FiShare2, FiUserPlus, FiChevronDown, FiChevronUp, FiExternalLink, FiTarget, FiLayers } from 'react-icons/fi';
import { formatNumber, formatAddress } from '../utils/constants';

export default function ReferralPage({
  account,
  lpMiningData,
  contracts,
  onRefresh
}) {
  const [referrerAddress, setReferrerAddress] = useState('');
  const [isSettingReferrer, setIsSettingReferrer] = useState(false);
  const [isClaimingReferral, setIsClaimingReferral] = useState(false);
  const [isClaimingTeam, setIsClaimingTeam] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const { userInfo, referrals, teamConfig } = lpMiningData || {};

  // 复制推荐链接
  const copyReferralLink = () => {
    const link = `${window.location.origin}?ref=${account}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('推荐链接已复制');
    setTimeout(() => setCopied(false), 2000);
  };

  // 设置推荐人
  const handleSetReferrer = async () => {
    if (!contracts?.lpMining || !referrerAddress) return;

    if (!ethers.isAddress(referrerAddress)) {
      toast.error('无效的地址格式');
      return;
    }

    setIsSettingReferrer(true);
    try {
      const tx = await contracts.lpMining.setReferrer(referrerAddress);
      toast.loading('设置推荐人中...', { id: 'setReferrer' });
      await tx.wait();
      toast.success('推荐人设置成功', { id: 'setReferrer' });
      setReferrerAddress('');
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '设置失败', { id: 'setReferrer' });
    } finally {
      setIsSettingReferrer(false);
    }
  };

  // 领取推荐奖励
  const handleClaimReferral = async () => {
    if (!contracts?.lpMining) return;
    setIsClaimingReferral(true);
    try {
      const tx = await contracts.lpMining.claimReferralRewards();
      toast.loading('领取推荐奖励中...', { id: 'claimReferral' });
      await tx.wait();
      toast.success('领取成功', { id: 'claimReferral' });
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '领取失败', { id: 'claimReferral' });
    } finally {
      setIsClaimingReferral(false);
    }
  };

  // 领取团队奖励
  const handleClaimTeam = async () => {
    if (!contracts?.lpMining) return;
    setIsClaimingTeam(true);
    try {
      const tx = await contracts.lpMining.claimTeamRewards();
      toast.loading('领取团队奖励中...', { id: 'claimTeam' });
      await tx.wait();
      toast.success('领取成功', { id: 'claimTeam' });
      onRefresh?.();
    } catch (err) {
      toast.error(err.reason || '领取失败', { id: 'claimTeam' });
    } finally {
      setIsClaimingTeam(false);
    }
  };

  const hasReferrer = userInfo?.referrer && userInfo.referrer !== ethers.ZeroAddress;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00D9A5] to-[#FFB800] flex items-center justify-center shadow-lg shadow-[#00D9A5]/20">
            <FiUsers className="w-7 h-7 text-[#0B1120]" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">推荐奖励</h1>
            <p className="text-white/50">邀请好友，共享收益</p>
          </div>
        </div>
        <div className="badge-glow">
          <FiGift className="w-4 h-4 mr-2" />
          最高 35% 额外收益
        </div>
      </div>

      {/* Referral Link Card */}
      {account && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-white/10"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#00D9A5]/10 via-[#FFB800]/10 to-[#00D9A5]/10" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.02%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
          <div className="relative p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00D9A5] to-[#FFB800] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#00D9A5]/30">
                <FiShare2 className="w-10 h-10 text-[#0B1120]" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold mb-2 text-white">我的专属推荐链接</h2>
                <p className="text-white/50">分享链接邀请好友参与挖矿，获得三级推荐奖励</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={copyReferralLink}
                className="btn-premium flex items-center gap-2"
              >
                {copied ? <FiCheck className="w-5 h-5" /> : <FiCopy className="w-5 h-5" />}
                <span>{copied ? '已复制' : '复制链接'}</span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '直推人数', value: userInfo?.referralCount || 0, suffix: '人', icon: <FiUserPlus className="w-5 h-5" />, color: 'primary' },
          { label: '团队业绩', value: userInfo?.teamPerformance, suffix: 'LP', icon: <FiLayers className="w-5 h-5" />, color: 'gold' },
          { label: '小区业绩', value: userInfo?.smallAreaPerformance, suffix: 'LP', icon: <FiTarget className="w-5 h-5" />, color: 'primary' },
          { label: '团队等级', value: `${userInfo?.teamLevel || 0} 级`, suffix: '', icon: <FiAward className="w-5 h-5" />, color: 'gold', highlight: true },
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
            <div className={`text-2xl font-bold ${stat.highlight ? 'text-gradient-gold' : 'text-white'}`}>
              {typeof stat.value === 'string' ? stat.value : formatNumber(stat.value)}
              {stat.suffix && <span className="text-white/40 text-sm ml-1">{stat.suffix}</span>}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Cards */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Referrer & Referral Rewards */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="neon-card"
        >
          <div className="neon-card-inner">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#00D9A5]/20 flex items-center justify-center">
                <FiUserPlus className="w-5 h-5 text-[#00D9A5]" />
              </span>
              我的推荐人
            </h2>

            {hasReferrer ? (
              <div className="p-4 rounded-xl mb-6 bg-white/5 border border-white/5">
                <div className="text-white/50 text-sm mb-2">推荐人地址</div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg text-white">{formatAddress(userInfo.referrer)}</span>
                  <a
                    href={`https://testnet.bscscan.com/address/${userInfo.referrer}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[#00D9A5] hover:text-[#00FFB8] transition-colors"
                  >
                    <FiExternalLink className="w-4 h-4" />
                    <span className="text-sm">查看</span>
                  </a>
                </div>
              </div>
            ) : (
              <>
                <p className="text-white/50 text-sm mb-4">
                  设置推荐人后，您的推荐人将获得您挖矿收益的推荐奖励
                </p>
                <div className="space-y-4 mb-6">
                  <input
                    type="text"
                    value={referrerAddress}
                    onChange={(e) => setReferrerAddress(e.target.value)}
                    placeholder="输入推荐人地址 (0x...)"
                    className="input-premium font-mono text-sm"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSetReferrer}
                    disabled={isSettingReferrer || !referrerAddress || !account}
                    className="w-full btn-premium disabled:opacity-50"
                  >
                    <span>{isSettingReferrer ? '设置中...' : '设置推荐人'}</span>
                  </motion.button>
                </div>
              </>
            )}

            {/* Divider */}
            <div className="divider-glow my-6" />

            {/* Referral Rewards */}
            <h3 className="font-semibold mb-4 text-white/80 flex items-center gap-2">
              <FiGift className="text-[#00D9A5]" /> 推荐奖励
            </h3>

            <div className="relative p-6 rounded-2xl mb-4 overflow-hidden bg-gradient-to-br from-[#1A2332] to-[#111827] border border-white/5">
              <div className="absolute inset-0 bg-gradient-to-br from-[#00D9A5]/5 to-[#FFB800]/5" />
              <div className="relative text-center">
                <div className="text-white/50 text-sm mb-2">待领取推荐奖励</div>
                <div className="text-4xl font-bold text-gradient-premium mb-1">
                  {formatNumber(userInfo?.referralRewards, 4)}
                </div>
                <div className="text-white/40">RWT</div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleClaimReferral}
              disabled={isClaimingReferral || parseFloat(userInfo?.referralRewards || '0') <= 0}
              className="w-full btn-premium disabled:opacity-50"
            >
              <span className="flex items-center justify-center gap-2">
                <FiGift className="w-5 h-5" />
                {isClaimingReferral ? '领取中...' : '领取推荐奖励'}
              </span>
            </motion.button>
          </div>
        </motion.div>

        {/* Team Rewards */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="neon-card"
        >
          <div className="neon-card-inner">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#FFB800]/20 flex items-center justify-center">
                <FiAward className="w-5 h-5 text-[#FFB800]" />
              </span>
              团队奖励
            </h2>

            {/* Team Level Progress */}
            <div className="space-y-4 mb-6">
              {teamConfig?.thresholds?.map((threshold, i) => {
                const rate = teamConfig.rates[i];
                const isAchieved = parseFloat(userInfo?.smallAreaPerformance || '0') >= parseFloat(threshold);
                const progress = Math.min(
                  (parseFloat(userInfo?.smallAreaPerformance || '0') / parseFloat(threshold)) * 100,
                  100
                );

                return (
                  <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium flex items-center gap-2 text-white">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isAchieved
                            ? 'bg-gradient-to-r from-[#00D9A5] to-[#00B88A] text-[#0B1120]'
                            : 'bg-white/10 text-white/60'
                        }`}>
                          {i + 1}
                        </span>
                        等级 {i + 1}
                      </span>
                      <span className={isAchieved ? 'text-[#00D9A5] font-medium' : 'text-white/50'}>
                        {isAchieved ? '已达成' : `需 ${formatNumber(threshold)} LP`}
                      </span>
                    </div>
                    <div className="progress-glow mb-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5 }}
                        className="progress-glow-bar"
                        style={{
                          background: isAchieved
                            ? 'linear-gradient(90deg, #00D9A5, #00B88A)'
                            : 'linear-gradient(90deg, #FFB800, #FF8A00)'
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40">奖励比例</span>
                      <span className="text-[#FFB800] font-medium">{rate}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Team Rewards Claim */}
            <div className="relative p-6 rounded-2xl mb-4 overflow-hidden bg-gradient-to-br from-[#1A2332] to-[#111827] border border-white/5">
              <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/5 to-[#FF8A00]/5" />
              <div className="relative text-center">
                <div className="text-white/50 text-sm mb-2">待领取团队奖励</div>
                <div className="text-4xl font-bold text-gradient-gold mb-1">
                  {formatNumber(userInfo?.teamRewards, 4)}
                </div>
                <div className="text-white/40">RWT</div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleClaimTeam}
              disabled={isClaimingTeam || parseFloat(userInfo?.teamRewards || '0') <= 0}
              className="w-full btn-premium disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #FFB800, #FF8A00)' }}
            >
              <span className="flex items-center justify-center gap-2">
                <FiAward className="w-5 h-5" />
                {isClaimingTeam ? '领取中...' : '领取团队奖励'}
              </span>
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* My Referrals List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-premium p-6"
      >
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
          <FiUsers className="text-[#00D9A5]" />
          我的直推列表
          {referrals?.length > 0 && (
            <span className="text-sm font-normal text-white/40 ml-2">
              共 {referrals.length} 人
            </span>
          )}
        </h2>

        {referrals && referrals.length > 0 ? (
          <div className="space-y-3">
            {referrals.slice(0, 10).map((ref, index) => (
              <motion.div
                key={ref}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-[#00D9A5]/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00D9A5]/20 to-[#FFB800]/20 flex items-center justify-center text-sm font-medium text-[#00D9A5]">
                    #{index + 1}
                  </span>
                  <span className="font-mono text-white">{formatAddress(ref)}</span>
                </div>
                <a
                  href={`https://testnet.bscscan.com/address/${ref}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[#00D9A5] hover:text-[#00FFB8] transition-colors"
                >
                  <span className="text-sm">查看</span>
                  <FiExternalLink className="w-4 h-4" />
                </a>
              </motion.div>
            ))}
            {referrals.length > 10 && (
              <div className="text-center text-white/50 text-sm py-3">
                还有 {referrals.length - 10} 位直推用户...
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <FiUsers className="w-10 h-10 text-white/20" />
            </div>
            <p className="text-white/50 mb-2">暂无直推用户</p>
            <p className="text-white/30 text-sm">分享您的推荐链接邀请好友</p>
          </div>
        )}
      </motion.div>

      {/* Rules Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-premium overflow-hidden"
      >
        <button
          onClick={() => setShowRules(!showRules)}
          className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <span className="font-semibold flex items-center gap-2 text-white">
            <FiGift className="w-5 h-5 text-[#00D9A5]" />
            奖励规则说明
          </span>
          {showRules ? <FiChevronUp className="text-white/50" /> : <FiChevronDown className="text-white/50" />}
        </button>

        {showRules && (
          <div className="p-5 pt-0">
            <div className="divider-glow mb-6" />

            <div className="grid md:grid-cols-2 gap-6">
              {/* Referral Rates */}
              <div className="space-y-4">
                <h4 className="font-semibold text-[#00D9A5] flex items-center gap-2">
                  <FiGift className="w-4 h-4" />
                  推荐奖励 (从35%奖励池分配)
                </h4>
                <div className="space-y-2">
                  {[
                    { level: '1代推荐人', rate: '20%', total: '总收益的 7%' },
                    { level: '2代推荐人', rate: '10%', total: '总收益的 3.5%' },
                    { level: '3代推荐人', rate: '5%', total: '总收益的 1.75%' },
                  ].map((item) => (
                    <div key={item.level} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-white/60">{item.level}</span>
                      <div className="text-right">
                        <span className="font-medium text-[#00D9A5]">{item.rate}</span>
                        <span className="text-white/40 text-sm ml-2">({item.total})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team Rewards Rules */}
              <div className="space-y-4">
                <h4 className="font-semibold text-[#FFB800] flex items-center gap-2">
                  <FiAward className="w-4 h-4" />
                  团队奖励 (极差制)
                </h4>
                <div className="space-y-2 text-sm text-white/70">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-start gap-2">
                      <span className="text-[#FFB800] mt-0.5">1.</span>
                      <span>根据小区业绩确定您的团队等级</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-start gap-2">
                      <span className="text-[#FFB800] mt-0.5">2.</span>
                      <span>上级只获得与下级的等级差额奖励（极差制）</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-start gap-2">
                      <span className="text-[#FFB800] mt-0.5">3.</span>
                      <span>最高可获得 <span className="text-[#FFB800] font-medium">2%</span> 网体收益</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
