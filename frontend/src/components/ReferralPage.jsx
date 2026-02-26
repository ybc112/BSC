import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { FiUsers, FiCopy, FiCheck, FiGift, FiAward, FiShare2, FiUserPlus, FiChevronDown, FiChevronUp, FiExternalLink, FiTarget, FiLayers, FiChevronRight, FiRefreshCw, FiInfo } from 'react-icons/fi';
import { formatNumber, formatAddress, parseContractError } from '../utils/constants';
import { useLanguage } from '../contexts/LanguageContext';

const MAX_LEVELS = 15;

// 根据层级返回颜色配置
function getLevelColor(level) {
  if (level === 1) return { gradient: 'from-[#00D9A5] to-[#00B88A]', text: 'text-[#00D9A5]', bg: 'bg-[#00D9A5]', border: 'border-[#00D9A5]', hover: 'hover:border-[#00D9A5]/30' };
  if (level === 2) return { gradient: 'from-[#FFB800] to-[#FF8A00]', text: 'text-[#FFB800]', bg: 'bg-[#FFB800]', border: 'border-[#FFB800]', hover: 'hover:border-[#FFB800]/30' };
  if (level === 3) return { gradient: 'from-[#FF6B6B] to-[#FF8A00]', text: 'text-[#FF6B6B]', bg: 'bg-[#FF6B6B]', border: 'border-[#FF6B6B]', hover: 'hover:border-[#FF6B6B]/30' };
  // 4+ 渐变紫色系
  const hue = 270 + (level - 4) * 10; // 从紫色渐变
  const color1 = `hsl(${hue}, 70%, 60%)`;
  const color2 = `hsl(${hue + 20}, 70%, 50%)`;
  return { gradient: `from-purple-500 to-violet-600`, text: 'text-purple-400', bg: 'bg-purple-500', border: 'border-purple-500', hover: 'hover:border-purple-500/30', custom: { color1, color2 } };
}

// 根据层级返回每页获取数量
function getPageSizeForLevel(level) {
  if (level <= 3) return 10;
  if (level <= 7) return 5;
  return 3;
}

export default function ReferralPage({
  account,
  lpMiningData,
  tokenMiningV3Data,
  contracts,
  onRefresh
}) {
  const { t, language } = useLanguage();
  const [referrerAddress, setReferrerAddress] = useState('');
  const [isSettingReferrer, setIsSettingReferrer] = useState(false);
  const [isClaimingReferral, setIsClaimingReferral] = useState(false);
  const [isClaimingTeam, setIsClaimingTeam] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // 多层级团队数据 - 15层数组
  const [teamLevels, setTeamLevels] = useState([]); // Array of arrays, teamLevels[0]=1代, ..., teamLevels[14]=15代
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0); // 已加载层数
  const [expandedMembers, setExpandedMembers] = useState({});
  const [activeLevel, setActiveLevel] = useState('all');

  // 分页状态（1代直推分页）
  const [level1Page, setLevel1Page] = useState({ offset: 0, total: 0, hasMore: true });
  const PAGE_SIZE = 20;

  const { userInfo, referrals, teamConfig } = lpMiningData || {};

  // 动态层级名称
  const getLevelName = (level) => {
    if (language === 'zh') return `${level}代`;
    return `L${level}`;
  };

  // 使用分页方式获取多层级团队成员（前3层自动加载，4+层需展开触发）
  const fetchTeamMembers = useCallback(async (reset = false) => {
    if (!contracts?.tokenMiningV3 || !account) return;

    setLoadingTeam(true);
    setLoadingProgress(0);
    try {
      const newLevels = [];
      const batchSize = 5;

      // 获取1代（直推）
      const offset = reset ? 0 : level1Page.offset;
      const { result: level1Members, total } = await contracts.tokenMiningV3.getReferralsPaginated(
        account, offset, PAGE_SIZE
      );

      const newOffset = offset + level1Members.length;
      setLevel1Page({ offset: newOffset, total: Number(total), hasMore: newOffset < Number(total) });

      const level1 = level1Members.map(addr => ({ address: addr }));
      newLevels.push(level1);
      setLoadingProgress(1);

      // 逐层获取 2~MAX_LEVELS 代
      let prevLevelMembers = level1Members; // 上一层的地址列表

      for (let lvl = 2; lvl <= MAX_LEVELS; lvl++) {
        if (prevLevelMembers.length === 0) break;

        const pageSize = getPageSizeForLevel(lvl);
        const currentLevelMembers = [];

        // 分批并发请求
        for (let i = 0; i < prevLevelMembers.length; i += batchSize) {
          const batch = prevLevelMembers.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map(async (parentAddr) => {
              try {
                const { result: subs } = await contracts.tokenMiningV3.getReferralsPaginated(parentAddr, 0, pageSize);
                return subs.map(addr => ({ address: addr, parent: parentAddr }));
              } catch {
                return [];
              }
            })
          );
          currentLevelMembers.push(...batchResults.flat());
        }

        newLevels.push(currentLevelMembers);
        setLoadingProgress(lvl);

        // 下一层的输入是当前层的所有地址
        prevLevelMembers = currentLevelMembers.map(m => m.address);

        // 如果当前层没数据，后续层也不会有
        if (currentLevelMembers.length === 0) break;
      }

      if (reset) {
        setTeamLevels(newLevels);
      } else {
        setTeamLevels(prev => {
          const merged = [...prev];
          // 追加1代数据
          if (merged.length > 0) {
            merged[0] = [...merged[0], ...newLevels[0]];
          } else {
            merged.push(newLevels[0]);
          }
          // 2代及以后替换（因为是基于新1代成员重新获取的）
          for (let i = 1; i < newLevels.length; i++) {
            if (i < merged.length) {
              merged[i] = [...merged[i], ...newLevels[i]];
            } else {
              merged.push(newLevels[i]);
            }
          }
          return merged;
        });
      }
    } catch (err) {
      console.error('Fetch team members error:', err);
    } finally {
      setLoadingTeam(false);
    }
  }, [contracts?.tokenMiningV3, account, level1Page.offset]);

  // 加载更多（1代分页）
  const loadMore = () => {
    if (!loadingTeam && level1Page.hasMore) {
      fetchTeamMembers(false);
    }
  };

  // 初始加载团队数据
  useEffect(() => {
    if (contracts?.tokenMiningV3 && account) {
      setLevel1Page({ offset: 0, total: 0, hasMore: true });
      setTeamLevels([]);
      fetchTeamMembers(true);
    }
  }, [contracts?.tokenMiningV3, account]);

  // 刷新按钮
  const handleRefreshTeam = () => {
    setLevel1Page({ offset: 0, total: 0, hasMore: true });
    setTeamLevels([]);
    fetchTeamMembers(true);
  };

  // 切换成员展开状态
  const toggleExpand = (address) => {
    setExpandedMembers(prev => ({ ...prev, [address]: !prev[address] }));
  };

  // 获取某个成员在下一层的子成员
  const getSubMembers = (address, level) => {
    // level是当前成员所在层级(1-based)，子成员在level+1层
    const nextLevelIndex = level; // teamLevels[level] 就是 level+1 代
    if (nextLevelIndex >= teamLevels.length) return [];
    return teamLevels[nextLevelIndex].filter(m => m.parent === address);
  };

  // 统计数据
  const teamStats = {
    total: teamLevels.reduce((sum, level) => sum + level.length, 0),
    levels: teamLevels.map(level => level.length),
  };

  // 有数据的层级列表
  const activeLevelsWithData = teamLevels
    .map((level, index) => ({ level: index + 1, count: level.length }))
    .filter(l => l.count > 0);

  // 复制推荐链接
  const copyReferralLink = async () => {
    const link = `${window.location.origin}?ref=${account}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = link;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success(t('toast.referralLinkCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = link;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        toast.success(t('toast.referralLinkCopied'));
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        toast.error('复制失败，请手动复制: ' + link);
      }
    }
  };

  // 设置推荐人（仅绑定 Token Mining V3）
  const handleSetReferrer = async () => {
    if (!referrerAddress) return;
    if (!contracts?.tokenMiningV3) return;

    if (!ethers.isAddress(referrerAddress)) {
      toast.error(t('toast.invalidAddress'));
      return;
    }

    if (referrerAddress.toLowerCase() === account?.toLowerCase()) {
      toast.error(t('toast.cannotReferSelf'));
      return;
    }

    setIsSettingReferrer(true);
    try {
      let hasRef = true;
      try {
        hasRef = await contracts.tokenMiningV3.hasReferrer(account);
      } catch {}

      if (hasRef) {
        toast.success(t('toast.bindSuccess'));
      } else {
        toast.loading(t('toast.settingReferrer'), { id: 'setReferrer' });
        const tx = await contracts.tokenMiningV3.setReferrer(referrerAddress);
        await tx.wait();
        toast.success(t('toast.setReferrerSuccess'), { id: 'setReferrer' });
      }

      setReferrerAddress('');
      onRefresh?.();
    } catch (err) {
      toast.error(parseContractError(err), { id: 'setReferrer' });
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
      toast.loading(t('toast.claimingReferral'), { id: 'claimReferral' });
      await tx.wait();
      toast.success(t('toast.claimSuccess'), { id: 'claimReferral' });
      onRefresh?.();
    } catch (err) {
      toast.error(parseContractError(err), { id: 'claimReferral' });
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
      toast.loading(t('toast.claimingTeam'), { id: 'claimTeam' });
      await tx.wait();
      toast.success(t('toast.claimSuccess'), { id: 'claimTeam' });
      onRefresh?.();
    } catch (err) {
      toast.error(parseContractError(err), { id: 'claimTeam' });
    } finally {
      setIsClaimingTeam(false);
    }
  };

  const v3HasReferrer = tokenMiningV3Data?.userInfo?.referrer && tokenMiningV3Data.userInfo.referrer !== ethers.ZeroAddress;
  const hasReferrer = userInfo?.referrer && userInfo.referrer !== ethers.ZeroAddress;
  const hasAnyReferrer = v3HasReferrer || hasReferrer;
  const displayedReferrer = v3HasReferrer ? tokenMiningV3Data.userInfo.referrer : (hasReferrer ? userInfo.referrer : null);

  // 递归树形成员行组件
  const TeamMemberRow = ({ member, level, maxExpandLevel }) => {
    const color = getLevelColor(level);
    const subMembers = getSubMembers(member.address, level);
    const hasSubMembers = subMembers.length > 0;
    const isExpanded = expandedMembers[member.address];
    const canExpand = level < maxExpandLevel;

    return (
      <div className="space-y-2">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className={`flex items-center justify-between p-3 sm:p-4 rounded-xl bg-white/5 border border-white/5 ${hasSubMembers && canExpand ? 'cursor-pointer ' + color.hover : ''} transition-colors`}
          onClick={() => hasSubMembers && canExpand && toggleExpand(member.address)}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {hasSubMembers && canExpand ? (
              <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} className="text-white/40 flex-shrink-0">
                <FiChevronRight className="w-4 h-4" />
              </motion.div>
            ) : (
              <div className="w-4 flex-shrink-0" />
            )}
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br ${color.gradient} flex items-center justify-center text-[#0B1120] text-xs font-bold flex-shrink-0`}
              style={color.custom ? { background: `linear-gradient(135deg, ${color.custom.color1}, ${color.custom.color2})` } : undefined}
            >
              {level}
            </div>
            <span className="font-mono text-white text-sm truncate">{formatAddress(member.address)}</span>
            {hasSubMembers && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${color.bg}/20 ${color.text} flex-shrink-0`}
                style={{ backgroundColor: color.custom ? `${color.custom.color1}20` : undefined, color: color.custom ? color.custom.color1 : undefined }}
              >
                +{subMembers.length}
              </span>
            )}
          </div>
          <a
            href={`https://bscscan.com/address/${member.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1 ${color.text} transition-colors flex-shrink-0`}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-sm hidden sm:inline">{t('referral.view')}</span>
            <FiExternalLink className="w-4 h-4" />
          </a>
        </motion.div>

        {/* 递归子成员 */}
        <AnimatePresence>
          {isExpanded && canExpand && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pl-4 sm:pl-8 space-y-2"
            >
              {subMembers.map((sub) => (
                <TeamMemberRow key={sub.address} member={sub} level={level + 1} maxExpandLevel={maxExpandLevel} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // 平铺视图成员行
  const FlatMemberRow = ({ member, level }) => {
    const color = getLevelColor(level);
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={`flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 ${color.hover} transition-colors`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-8 h-8 rounded-full bg-gradient-to-br ${color.gradient} flex items-center justify-center text-[#0B1120] text-xs font-bold flex-shrink-0`}
            style={color.custom ? { background: `linear-gradient(135deg, ${color.custom.color1}, ${color.custom.color2})` } : undefined}
          >
            {level}
          </div>
          <div className="min-w-0">
            <span className="font-mono text-white truncate block">{formatAddress(member.address)}</span>
            {member.parent && (
              <div className="text-xs text-white/40">
                {t('referral.superior')}: {formatAddress(member.parent)}
              </div>
            )}
          </div>
        </div>
        <a
          href={`https://bscscan.com/address/${member.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-1 ${color.text} transition-colors flex-shrink-0`}
        >
          <span className="text-sm hidden sm:inline">{t('referral.view')}</span>
          <FiExternalLink className="w-4 h-4" />
        </a>
      </motion.div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00D9A5] to-[#FFB800] flex items-center justify-center shadow-lg shadow-[#00D9A5]/20">
            <FiUsers className="w-7 h-7 text-[#0B1120]" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{t('referral.title')}</h1>
            <p className="text-white/50">{t('referral.subtitle')}</p>
          </div>
        </div>
        <div className="badge-glow">
          <FiGift className="w-4 h-4 mr-2" />
          {t('referral.maxBonus')}
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
          <div className="relative p-4 sm:p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-16 sm:w-20 h-16 sm:h-20 rounded-2xl bg-gradient-to-br from-[#00D9A5] to-[#FFB800] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#00D9A5]/30">
                <FiShare2 className="w-8 sm:w-10 h-8 sm:h-10 text-[#0B1120]" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl sm:text-2xl font-bold mb-2 text-white">{t('referral.myReferralLink')}</h2>
                <p className="text-white/50">{t('referral.shareLinkDesc')}</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={copyReferralLink}
                className="btn-premium flex items-center gap-2"
              >
                {copied ? <FiCheck className="w-5 h-5" /> : <FiCopy className="w-5 h-5" />}
                <span>{copied ? t('referral.copied') : t('referral.copyLink')}</span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('referral.directReferrals'), value: tokenMiningV3Data?.userInfo?.directReferrals || userInfo?.referralCount || 0, suffix: t('referral.person'), icon: <FiUserPlus className="w-5 h-5" />, color: 'primary' },
          { label: t('referral.teamPerformance'), value: userInfo?.teamPerformance, suffix: 'LP', icon: <FiLayers className="w-5 h-5" />, color: 'gold' },
          { label: t('referral.smallAreaPerformance'), value: userInfo?.smallAreaPerformance, suffix: 'LP', icon: <FiTarget className="w-5 h-5" />, color: 'primary' },
          { label: t('referral.teamLevel'), value: `${userInfo?.teamLevel || 0} ${t('referral.level')}`, suffix: '', icon: <FiAward className="w-5 h-5" />, color: 'gold', highlight: true },
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
            <div className={`text-lg sm:text-2xl font-bold ${stat.highlight ? 'text-gradient-gold' : 'text-white'}`}>
              {typeof stat.value === 'string' ? stat.value : formatNumber(stat.value)}
              {stat.suffix && <span className="text-white/40 text-xs sm:text-sm ml-1">{stat.suffix}</span>}
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
              {t('referral.myReferrer')}
            </h2>

            {hasAnyReferrer ? (
              <div className="p-4 rounded-xl mb-6 bg-white/5 border border-white/5">
                <div className="text-white/50 text-sm mb-2">{t('referral.referrerAddress')}</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-lg text-white truncate min-w-0">{formatAddress(displayedReferrer)}</span>
                  <a
                    href={`https://bscscan.com/address/${displayedReferrer}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[#00D9A5] hover:text-[#00FFB8] transition-colors flex-shrink-0"
                  >
                    <FiExternalLink className="w-4 h-4" />
                    <span className="text-sm">{t('referral.view')}</span>
                  </a>
                </div>
              </div>
            ) : (
              <>
                <p className="text-white/50 text-sm mb-4">
                  {t('referral.setReferrerDesc')}
                </p>
                {/* 推荐人提示 */}
                <div className="p-3 rounded-xl bg-[#00D9A5]/10 border border-[#00D9A5]/20 mb-4">
                  <div className="flex items-start gap-2">
                    <FiInfo className="w-4 h-4 text-[#00D9A5] mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-white/70">
                      <p className="font-medium text-[#00D9A5] mb-1">{t('referral.referrerTip')}</p>
                      <p className="text-white/50">{t('referral.referrerTipDesc')}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4 mb-6">
                  <input
                    type="text"
                    value={referrerAddress}
                    onChange={(e) => setReferrerAddress(e.target.value)}
                    placeholder={t('referral.enterReferrerAddress')}
                    className="input-premium font-mono text-sm w-full overflow-hidden"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSetReferrer}
                    disabled={isSettingReferrer || !referrerAddress || !account}
                    className="w-full btn-premium disabled:opacity-50"
                  >
                    <span>{isSettingReferrer ? t('referral.settingReferrer') : t('referral.setReferrer')}</span>
                  </motion.button>
                </div>
              </>
            )}

            {/* Divider */}
            <div className="divider-glow my-6" />

            {/* Referral Rewards */}
            <h3 className="font-semibold mb-4 text-white/80 flex items-center gap-2">
              <FiGift className="text-[#00D9A5]" /> {t('referral.referralReward')}
            </h3>

            <div className="relative p-4 sm:p-6 rounded-2xl mb-4 overflow-hidden bg-gradient-to-br from-[#1A2332] to-[#111827] border border-white/5">
              <div className="absolute inset-0 bg-gradient-to-br from-[#00D9A5]/5 to-[#FFB800]/5" />
              <div className="relative text-center">
                <div className="text-white/50 text-sm mb-2">{t('referral.pendingReferralReward')}</div>
                <div className="text-3xl sm:text-4xl font-bold text-gradient-premium mb-1">
                  {formatNumber(userInfo?.referralRewards, 4)}
                </div>
                <div className="text-white/40">AGG</div>
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
                {isClaimingReferral ? t('referral.claiming') : t('referral.claimReferralReward')}
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
              {t('referral.teamReward')}
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
                        {t('referral.level')} {i + 1}
                      </span>
                      <span className={isAchieved ? 'text-[#00D9A5] font-medium' : 'text-white/50'}>
                        {isAchieved ? t('referral.achieved') : `${t('referral.need')} ${formatNumber(threshold)} LP`}
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
                      <span className="text-white/40">{t('referral.rewardRate')}</span>
                      <span className="text-[#FFB800] font-medium">{rate}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Team Rewards Claim */}
            <div className="relative p-4 sm:p-6 rounded-2xl mb-4 overflow-hidden bg-gradient-to-br from-[#1A2332] to-[#111827] border border-white/5">
              <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/5 to-[#FF8A00]/5" />
              <div className="relative text-center">
                <div className="text-white/50 text-sm mb-2">{t('referral.pendingTeamReward')}</div>
                <div className="text-3xl sm:text-4xl font-bold text-gradient-gold mb-1">
                  {formatNumber(userInfo?.teamRewards, 4)}
                </div>
                <div className="text-white/40">AGG</div>
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
                {isClaimingTeam ? t('referral.claiming') : t('referral.claimTeamReward')}
              </span>
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Multi-Level Team Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-premium p-4 sm:p-6"
      >
        {/* Header with Stats */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <FiUsers className="text-[#00D9A5]" />
            {t('referral.myTeam')}
            <span className="text-sm font-normal text-white/40 ml-2">
              {t('referral.total')} {teamStats.total} {t('referral.personTotal')}
            </span>
          </h2>
          <button
            onClick={handleRefreshTeam}
            disabled={loadingTeam}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors disabled:opacity-50"
          >
            <FiRefreshCw className={`w-4 h-4 ${loadingTeam ? 'animate-spin' : ''}`} />
            {t('referral.refresh')}
          </button>
        </div>

        {/* Level Tabs - 动态生成 */}
        <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveLevel('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all flex-shrink-0 ${
              activeLevel === 'all'
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-white/50 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            {t('referral.all')}
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              activeLevel === 'all' ? 'bg-[#00D9A5]/20 text-[#00D9A5]' : 'bg-white/10 text-white/50'
            }`}>
              {teamStats.total}
            </span>
          </button>
          {activeLevelsWithData.map(({ level, count }) => {
            const color = getLevelColor(level);
            return (
              <button
                key={level}
                onClick={() => setActiveLevel(String(level))}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all flex-shrink-0 ${
                  activeLevel === String(level)
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                {getLevelName(level)}
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeLevel === String(level) ? 'bg-[#00D9A5]/20 text-[#00D9A5]' : 'bg-white/10 text-white/50'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Level Stats Cards - 前5层分别显示，6-15层合并 */}
        <div className="flex gap-2 sm:gap-4 mb-6 overflow-x-auto pb-2">
          {teamLevels.slice(0, 5).map((levelMembers, index) => {
            const level = index + 1;
            const color = getLevelColor(level);
            return (
              <div
                key={level}
                className={`p-3 sm:p-4 rounded-xl min-w-[120px] flex-shrink-0 bg-gradient-to-br ${level <= 3 ? (
                  level === 1 ? 'from-[#00D9A5]/10 to-[#00D9A5]/5 border border-[#00D9A5]/20' :
                  level === 2 ? 'from-[#FFB800]/10 to-[#FFB800]/5 border border-[#FFB800]/20' :
                  'from-[#FF6B6B]/10 to-[#FF6B6B]/5 border border-[#FF6B6B]/20'
                ) : 'from-purple-500/10 to-purple-500/5 border border-purple-500/20'}`}
                style={color.custom ? {
                  background: `linear-gradient(135deg, ${color.custom.color1}15, ${color.custom.color1}08)`,
                  borderColor: `${color.custom.color1}30`,
                } : undefined}
              >
                <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                  <div
                    className={`w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-gradient-to-r ${color.gradient} flex items-center justify-center text-[#0B1120] text-xs font-bold`}
                    style={color.custom ? { background: `linear-gradient(90deg, ${color.custom.color1}, ${color.custom.color2})` } : undefined}
                  >
                    {level}
                  </div>
                  <span className="text-white/60 text-xs sm:text-sm whitespace-nowrap">
                    {getLevelName(level)}{language === 'zh' ? '会员' : ' Members'}
                  </span>
                </div>
                <div className={`text-xl sm:text-2xl font-bold ${color.text}`}
                  style={color.custom ? { color: color.custom.color1 } : undefined}
                >
                  {levelMembers.length}
                </div>
              </div>
            );
          })}
          {/* 6-15层合并卡片 */}
          {teamLevels.length > 5 && (() => {
            const deeperCount = teamLevels.slice(5).reduce((sum, l) => sum + l.length, 0);
            if (deeperCount === 0) return null;
            return (
              <div className="p-3 sm:p-4 rounded-xl min-w-[120px] flex-shrink-0 bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-500/20">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                  <div className="w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center text-[#0B1120] text-xs font-bold">
                    +
                  </div>
                  <span className="text-white/60 text-xs sm:text-sm whitespace-nowrap">{t('referral.deeperLevels')}</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-violet-400">{deeperCount}</div>
                <div className="text-xs text-white/40">{language === 'zh' ? `6-${teamLevels.length}代` : `L6-L${teamLevels.length}`}</div>
              </div>
            );
          })()}
        </div>

        {/* Loading State */}
        {loadingTeam ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-[#00D9A5]/30 border-t-[#00D9A5] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/50">{t('referral.loadingTeam')}</p>
            {loadingProgress > 0 && (
              <p className="text-white/30 text-sm mt-2">
                {language === 'zh' ? `已加载 ${loadingProgress} 层` : `Loaded ${loadingProgress} levels`}
              </p>
            )}
          </div>
        ) : teamStats.total === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <FiUsers className="w-10 h-10 text-white/20" />
            </div>
            <p className="text-white/50 mb-2">{t('referral.noTeamMembers')}</p>
            <p className="text-white/30 text-sm">{t('referral.shareYourLink')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Tree View - 全部层级 */}
            {activeLevel === 'all' && teamLevels.length > 0 && teamLevels[0].map((member) => (
              <TeamMemberRow
                key={member.address}
                member={member}
                level={1}
                maxExpandLevel={teamLevels.length}
              />
            ))}

            {/* Flat View - 特定层级 */}
            {activeLevel !== 'all' && (() => {
              const levelNum = parseInt(activeLevel);
              const levelIndex = levelNum - 1;
              if (levelIndex >= teamLevels.length) return null;
              return teamLevels[levelIndex].map((member) => (
                <FlatMemberRow key={member.address} member={member} level={levelNum} />
              ));
            })()}

            {/* Load More Button */}
            {activeLevel === 'all' && level1Page.hasMore && (
              <div className="mt-4 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingTeam}
                  className="px-6 py-2 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  {loadingTeam ? t('common.loading') : `${t('referral.loadMore')} (${teamStats.levels[0] || 0}/${level1Page.total})`}
                </button>
              </div>
            )}
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
            {t('referral.rewardRules')}
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
                  {t('referral.referralRewardTitle')}
                </h4>
                <div className="space-y-2">
                  {[
                    { level: t('lpMining.level1Referrer'), rate: '20%', total: t('referral.level1Rate') },
                    { level: t('lpMining.level2Referrer'), rate: '10%', total: t('referral.level2Rate') },
                    { level: t('lpMining.level3Referrer'), rate: '5%', total: t('referral.level3Rate') },
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
                  {t('referral.teamRewardTitle')}
                </h4>
                <div className="space-y-2 text-sm text-white/70">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-start gap-2">
                      <span className="text-[#FFB800] mt-0.5">1.</span>
                      <span>{t('referral.teamRule1')}</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-start gap-2">
                      <span className="text-[#FFB800] mt-0.5">2.</span>
                      <span>{t('referral.teamRule2')}</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-start gap-2">
                      <span className="text-[#FFB800] mt-0.5">3.</span>
                      <span>{t('referral.teamRule3')} <span className="text-[#FFB800] font-medium">2%</span> {t('referral.teamRule3b')}</span>
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
