import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import {
  FiUsers,
  FiCopy,
  FiDollarSign,
  FiGift,
  FiUserPlus,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
} from 'react-icons/fi';
import { formatNumber, formatAddress, parseContractError } from '../utils/constants';
import { useLanguage } from '../contexts/LanguageContext';

export default function ReferralPage({ account, contracts, vaultData, onRefresh }) {
  const { t } = useLanguage();
  const [isClaiming, setIsClaiming] = useState(false);
  const [referrals, setReferrals] = useState([]);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [showReferrals, setShowReferrals] = useState(true);
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(false);

  // Load referrals
  const loadReferrals = useCallback(async () => {
    if (!contracts.vault || !account) return;

    setIsLoadingReferrals(true);
    try {
      const result = await contracts.vault.getReferrals(account, 0, 50);
      setReferrals(result.list || []);
      setTotalReferrals(Number(result.total));
    } catch (err) {
      console.error('Load referrals error:', err);
    } finally {
      setIsLoadingReferrals(false);
    }
  }, [contracts.vault, account]);

  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

  const handleClaimRewards = async () => {
    if (!contracts.vault) return;

    setIsClaiming(true);
    try {
      const tx = await contracts.vault.claimReferralRewards();
      toast.loading(t('toast.claimingRewards'), { id: 'claim' });
      await tx.wait();
      toast.success(t('toast.rewardsClaimed'), { id: 'claim' });
      onRefresh?.();
    } catch (err) {
      console.error('Claim error:', err);
      toast.error(parseContractError(err), { id: 'claim' });
    } finally {
      setIsClaiming(false);
    }
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}?ref=${account}`;
    navigator.clipboard.writeText(link);
    toast.success(t('toast.linkCopied'));
  };

  const copyAddress = (address) => {
    navigator.clipboard.writeText(address);
    toast.success(t('toast.addressCopied'));
  };

  if (!account) {
    return (
      <div className="glass-card text-center py-12">
        <FiUsers className="w-16 h-16 text-primary mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-semibold text-white mb-2">{t('ref.connectWallet')}</h3>
        <p className="text-white/50">{t('ref.connectDesc')}</p>
      </div>
    );
  }

  const pendingRewards = parseFloat(vaultData.userInfo?.referralRewards || '0');
  const totalEarned = parseFloat(vaultData.userInfo?.totalReferralEarned || '0');
  const directReferrals = vaultData.userInfo?.directReferrals || 0;
  const referrer = vaultData.userInfo?.referrer;
  const hasReferrer = referrer && referrer !== ethers.ZeroAddress;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary to-orange-600 flex items-center justify-center shadow-lg">
            <FiUsers className="w-7 h-7 text-dark" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{t('ref.title')}</h1>
            <p className="text-white/50">{t('ref.subtitle')}</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { loadReferrals(); onRefresh?.(); }}
          className="p-3 rounded-xl bg-white/10 text-white/70 hover:bg-white/20"
        >
          <FiRefreshCw className={`w-5 h-5 ${isLoadingReferrals ? 'animate-spin' : ''}`} />
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <FiUserPlus className="w-5 h-5" />
            <span className="text-white/40 text-sm">{t('ref.directReferrals')}</span>
          </div>
          <div className="text-2xl font-bold text-white">{directReferrals}</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2 text-secondary">
            <FiGift className="w-5 h-5" />
            <span className="text-white/40 text-sm">{t('ref.pendingRewards')}</span>
          </div>
          <div className="text-2xl font-bold text-secondary">
            {formatNumber(pendingRewards)} <span className="text-white/40 text-sm">USDT</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <FiDollarSign className="w-5 h-5" />
            <span className="text-white/40 text-sm">{t('ref.totalEarned')}</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatNumber(totalEarned)} <span className="text-white/40 text-sm">USDT</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2 text-white/50">
            <FiUsers className="w-5 h-5" />
            <span className="text-white/40 text-sm">{t('ref.myReferrer')}</span>
          </div>
          <div className="text-lg font-bold text-white truncate">
            {hasReferrer ? formatAddress(referrer) : t('ref.none')}
          </div>
        </div>
      </div>

      {/* Claim Card */}
      {pendingRewards > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card border-secondary/30"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">{t('ref.pendingRewards')}</h3>
              <p className="text-3xl font-bold text-secondary">
                {formatNumber(pendingRewards)} <span className="text-lg text-white/50">USDT</span>
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleClaimRewards}
              disabled={isClaiming}
              className="btn-primary"
            >
              {isClaiming ? t('ref.claiming') : t('ref.claimRewards')}
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Referral Link */}
      <div className="glass-card">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FiCopy className="w-5 h-5 text-primary" />
          {t('ref.yourLink')}
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            readOnly
            value={`${window.location.origin}?ref=${account}`}
            className="input-field flex-1 text-sm"
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={copyReferralLink}
            className="btn-primary"
          >
            <FiCopy className="w-4 h-4" />
            {t('ref.copy')}
          </motion.button>
        </div>
        <p className="mt-3 text-sm text-white/50">
          {t('ref.shareDesc')}
        </p>
      </div>

      {/* Reward Rates */}
      <div className="glass-card">
        <h3 className="text-lg font-semibold text-white mb-4">{t('ref.rewardRates')}</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { level: 1, rate: vaultData.referralRates?.level1 || 20, color: 'primary' },
            { level: 2, rate: vaultData.referralRates?.level2 || 10, color: 'secondary' },
            { level: 3, rate: vaultData.referralRates?.level3 || 5, color: 'white/50' },
          ].map((item) => (
            <div key={item.level} className="text-center p-4 rounded-xl bg-white/5">
              <div className={`text-2xl font-bold ${item.color === 'primary' ? 'text-primary' : item.color === 'secondary' ? 'text-secondary' : 'text-white/50'}`}>
                {item.rate}%
              </div>
              <div className="text-sm text-white/50 mt-1">{t('ref.level')} {item.level}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Referrals List */}
      <div className="glass-card">
        <button
          onClick={() => setShowReferrals(!showReferrals)}
          className="w-full flex items-center justify-between"
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <FiUsers className="w-5 h-5 text-primary" />
            {t('ref.myReferrals')} ({totalReferrals})
          </h3>
          {showReferrals ? <FiChevronUp /> : <FiChevronDown />}
        </button>

        {showReferrals && (
          <div className="mt-4">
            {referrals.length === 0 ? (
              <div className="text-center py-8 text-white/40">
                {t('ref.noReferrals')}
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {referrals.map((addr, idx) => (
                  <div
                    key={addr}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-medium">
                        {idx + 1}
                      </div>
                      <span className="font-mono text-white text-sm">{formatAddress(addr)}</span>
                    </div>
                    <button
                      onClick={() => copyAddress(addr)}
                      className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10"
                    >
                      <FiCopy className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
