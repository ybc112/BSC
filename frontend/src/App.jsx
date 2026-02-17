import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUserPlus, FiX, FiCheck } from 'react-icons/fi';

import Header from './components/Header';
import HomePage from './components/HomePage';
import LPMiningPage from './components/LPMiningPage';
import TokenMiningPage from './components/TokenMiningPage';
import ReferralPage from './components/ReferralPage';
import AdminPage from './components/AdminPage';

import { useWallet } from './hooks/useWallet';
import { useContracts, useLPMining, useTokenMiningV2, useTokenMiningV3, useTokenBalance, useAllowance, useVault } from './hooks/useContracts';
import { CONTRACTS, formatAddress } from './utils/constants';
import { useLanguage } from './contexts/LanguageContext';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingReferrer, setPendingReferrer] = useState(null); // 待绑定的推荐人
  const [showReferrerModal, setShowReferrerModal] = useState(false); // 显示推荐人确认弹窗
  const [isBindingReferrer, setIsBindingReferrer] = useState(false); // 绑定中状态

  const { t } = useLanguage();

  const {
    account,
    provider,
    signer,
    isConnecting,
    isCorrectNetwork,
    connect,
    switchNetwork,
  } = useWallet();

  const contracts = useContracts(signer, provider);
  const lpMiningData = useLPMining(contracts.lpMining, account);
  const tokenMiningV2Data = useTokenMiningV2(contracts.tokenMiningV2, account);
  const tokenMiningV3Data = useTokenMiningV3(contracts.tokenMiningV3, account);
  // Vault 使用 USDT 合约
  const vaultData = useVault(contracts.vault, contracts.usdt, account);

  const { balance: lpBalance, refetch: refetchLpBalance } = useTokenBalance(contracts.lpToken, account);
  // TokenMiningV2 质押的是 ProjectTokenV2 代币，不是 rewardToken
  const { balance: tokenBalance, refetch: refetchTokenBalance } = useTokenBalance(contracts.projectTokenV2, account);

  const { allowance: lpAllowance, refetch: refetchLpAllowance } = useAllowance(
    contracts.lpToken,
    account,
    CONTRACTS.LP_MINING
  );
  // TokenMiningV2 需要授权 ProjectTokenV2 代币
  const { allowance: tokenAllowance, refetch: refetchTokenAllowance } = useAllowance(
    contracts.projectTokenV2,
    account,
    CONTRACTS.TOKEN_MINING_V2
  );
  // TokenMiningV3 也需要授权 ProjectTokenV2 代币
  const { allowance: tokenAllowanceV3, refetch: refetchTokenAllowanceV3 } = useAllowance(
    contracts.projectTokenV2,
    account,
    CONTRACTS.TOKEN_MINING_V3
  );

  // 检查是否是管理员
  useEffect(() => {
    const checkAdmin = async () => {
      console.log('[Admin Check] Starting...', { account });
      if (!account) {
        console.log('[Admin Check] No account, skipping');
        setIsAdmin(false);
        return;
      }
      // 只要有任意一个合约实例就进行检查
      const contractList = [contracts.lpMining, contracts.tokenMiningV2, contracts.projectTokenV2, contracts.tokenMiningV3];
      const hasContract = contractList.some(c => c);
      console.log('[Admin Check] Contracts available:', {
        lpMining: !!contracts.lpMining,
        tokenMiningV2: !!contracts.tokenMiningV2,
        projectTokenV2: !!contracts.projectTokenV2,
        tokenMiningV3: !!contracts.tokenMiningV3,
        hasAny: hasContract
      });
      if (!hasContract) {
        console.log('[Admin Check] No contracts available, skipping');
        setIsAdmin(false);
        return;
      }
      try {
        const owners = await Promise.all(
          contractList.map(c => c?.owner().catch((e) => {
            console.log('[Admin Check] owner() call failed:', e.message);
            return null;
          }) ?? Promise.resolve(null))
        );
        console.log('[Admin Check] Owners fetched:', owners);
        console.log('[Admin Check] Current account:', account);
        const isOwner = owners.some(
          owner => owner && owner.toLowerCase() === account.toLowerCase()
        );
        console.log('[Admin Check] Is owner?', isOwner);
        setIsAdmin(isOwner);
      } catch (err) {
        console.error('[Admin Check] Error:', err);
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [account, contracts.lpMining, contracts.tokenMiningV2, contracts.projectTokenV2, contracts.tokenMiningV3]);

  // 检查 URL 参数中的推荐人
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref && ethers.isAddress(ref)) {
      localStorage.setItem('referrer', ref);
      setPendingReferrer(ref);
    } else {
      // 检查 localStorage 中是否有之前保存的推荐人
      const savedRef = localStorage.getItem('referrer');
      if (savedRef && ethers.isAddress(savedRef)) {
        setPendingReferrer(savedRef);
      }
    }
  }, []);

  // 自动绑定推荐人 - 改为显示确认弹窗（同时检查LP Mining和Token Mining V3）
  useEffect(() => {
    const checkReferrer = async () => {
      if (!account || !pendingReferrer) return;
      // 至少需要一个合约可用
      if (!contracts?.lpMining && !contracts?.tokenMiningV3) return;

      try {
        // 检查推荐人是否有效（不是自己）
        if (pendingReferrer.toLowerCase() === account.toLowerCase()) {
          toast.error(t('toast.cannotReferSelf'));
          localStorage.removeItem('referrer');
          setPendingReferrer(null);
          return;
        }

        // 检查两个合约是否都已有推荐人
        let lpHasRef = true;
        let v3HasRef = true;

        if (contracts?.lpMining) {
          try {
            lpHasRef = await contracts.lpMining.hasReferrer(account);
          } catch { lpHasRef = true; }
        }
        if (contracts?.tokenMiningV3) {
          try {
            v3HasRef = await contracts.tokenMiningV3.hasReferrer(account);
          } catch { v3HasRef = true; }
        }

        if (lpHasRef && v3HasRef) {
          // 两个合约都已有推荐人，清除待绑定状态
          localStorage.removeItem('referrer');
          setPendingReferrer(null);
          return;
        }

        // 至少一个合约未绑定，显示确认弹窗
        setShowReferrerModal(true);
      } catch (err) {
        console.error('Check referrer error:', err);
      }
    };

    checkReferrer();
  }, [account, contracts?.lpMining, contracts?.tokenMiningV3, pendingReferrer]);

  // 确认绑定推荐人（同时绑定LP Mining和Token Mining V3）
  const handleConfirmBind = async () => {
    if (!pendingReferrer) return;
    if (!contracts?.lpMining && !contracts?.tokenMiningV3) return;

    setIsBindingReferrer(true);
    try {
      const bindPromises = [];

      // LP Mining 绑定
      if (contracts?.lpMining) {
        try {
          const hasRef = await contracts.lpMining.hasReferrer(account);
          if (!hasRef) {
            bindPromises.push(
              contracts.lpMining.setReferrer(pendingReferrer)
                .then(tx => tx.wait())
                .then(() => ({ contract: 'LP Mining', success: true }))
                .catch(err => ({ contract: 'LP Mining', success: false, error: err }))
            );
          }
        } catch {}
      }

      // Token Mining V3 绑定
      if (contracts?.tokenMiningV3) {
        try {
          const hasRef = await contracts.tokenMiningV3.hasReferrer(account);
          if (!hasRef) {
            bindPromises.push(
              contracts.tokenMiningV3.setReferrer(pendingReferrer)
                .then(tx => tx.wait())
                .then(() => ({ contract: 'Token Mining V3', success: true }))
                .catch(err => ({ contract: 'Token Mining V3', success: false, error: err }))
            );
          }
        } catch {}
      }

      if (bindPromises.length === 0) {
        toast.success(t('toast.bindSuccess'));
      } else {
        toast.loading(t('toast.bindingReferrer'), { id: 'bindRef' });
        const results = await Promise.allSettled(bindPromises);
        const resolvedResults = results.map(r => r.status === 'fulfilled' ? r.value : { success: false });
        const allSuccess = resolvedResults.every(r => r.success);
        const anySuccess = resolvedResults.some(r => r.success);

        if (allSuccess) {
          toast.success(t('toast.bindSuccess'), { id: 'bindRef' });
        } else if (anySuccess) {
          toast.success(t('toast.bindSuccess'), { id: 'bindRef' });
        } else {
          toast.error(t('toast.bindFailed'), { id: 'bindRef' });
        }
      }

      // 清除推荐人缓存
      localStorage.removeItem('referrer');
      setPendingReferrer(null);
      setShowReferrerModal(false);
      handleRefresh();
    } catch (err) {
      console.error('Bind referrer error:', err);
      toast.error(t('toast.bindFailed'), { id: 'bindRef' });
    } finally {
      setIsBindingReferrer(false);
    }
  };

  // 取消绑定
  const handleCancelBind = () => {
    localStorage.removeItem('referrer');
    setPendingReferrer(null);
    setShowReferrerModal(false);
  };

  // 刷新数据
  const handleRefresh = () => {
    lpMiningData.refetch();
    tokenMiningV2Data.refetch();
    tokenMiningV3Data.refetch();
    vaultData.refetch();
    refetchLpBalance();
    refetchTokenBalance();
    refetchLpAllowance();
    refetchTokenAllowance();
    refetchTokenAllowanceV3();
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'lp-mining':
        return (
          <LPMiningPage
            account={account}
            lpMiningData={lpMiningData}
            lpBalance={lpBalance}
            lpAllowance={lpAllowance}
            contracts={contracts}
            onRefresh={handleRefresh}
          />
        );
      case 'token-mining':
        return (
          <TokenMiningPage
            account={account}
            tokenMiningV2Data={tokenMiningV2Data}
            tokenMiningV3Data={tokenMiningV3Data}
            tokenBalance={tokenBalance}
            tokenAllowance={tokenAllowance}
            tokenAllowanceV3={tokenAllowanceV3}
            contracts={contracts}
            onRefresh={handleRefresh}
          />
        );
      case 'referral':
        return (
          <ReferralPage
            account={account}
            lpMiningData={lpMiningData}
            tokenMiningV3Data={tokenMiningV3Data}
            contracts={contracts}
            onRefresh={handleRefresh}
          />
        );
      case 'admin':
        return (
          <AdminPage
            account={account}
            contracts={contracts}
            lpMiningData={lpMiningData}
            tokenMiningV2Data={tokenMiningV2Data}
            tokenMiningV3Data={tokenMiningV3Data}
            onRefresh={handleRefresh}
          />
        );
      default:
        return (
          <HomePage
            onPageChange={setCurrentPage}
            lpMiningData={lpMiningData}
            tokenMiningV2Data={tokenMiningV2Data}
          />
        );
    }
  };

  return (
    <>
      {/* Animated Background */}
      <div className="animated-bg" />

      {/* Referrer Confirmation Modal */}
      <AnimatePresence>
        {showReferrerModal && pendingReferrer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && !isBindingReferrer && handleCancelBind()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1120]/95 p-4 sm:p-6 shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="w-12 sm:w-14 h-12 sm:h-14 rounded-2xl bg-gradient-to-br from-[#00D9A5] to-[#00B88A] flex items-center justify-center">
                  <FiUserPlus className="w-6 sm:w-7 h-6 sm:h-7 text-[#0B1120]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{t('app.bindReferrer')}</h3>
                  <p className="text-white/50 text-sm">{t('app.viaReferralLink')}</p>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-6">
                <div className="text-sm text-white/50 mb-2">{t('app.referrerAddress')}</div>
                <div className="font-mono text-white break-all">{pendingReferrer}</div>
                <div className="text-xs text-white/40 mt-2">
                  {formatAddress(pendingReferrer)}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#00D9A5]/10 border border-[#00D9A5]/20 mb-6">
                <p className="text-sm text-white/70">
                  {t('app.bindReferrerDesc')}
                  <span className="text-[#00D9A5] font-medium">{t('app.irreversible')}</span>{t('app.confirmCorrect')}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleCancelBind}
                  disabled={isBindingReferrer}
                  className="flex-1 py-3 rounded-xl bg-white/10 text-white/70 font-medium hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  {t('app.cancel')}
                </button>
                <button
                  onClick={handleConfirmBind}
                  disabled={isBindingReferrer}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#00D9A5] to-[#00B88A] text-[#0B1120] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isBindingReferrer ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#0B1120]/30 border-t-[#0B1120] rounded-full animate-spin" />
                      {t('app.binding')}
                    </>
                  ) : (
                    <>
                      <FiCheck className="w-4 h-4" />
                      {t('app.confirmBind')}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <Toaster
        position="top-center"
        containerStyle={{ top: 70 }}
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(26, 35, 50, 0.95)',
            color: '#F8FAFC',
            border: '1px solid rgba(0, 217, 165, 0.2)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            fontSize: '14px',
            maxWidth: '90vw',
            fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif',
          },
          success: {
            iconTheme: {
              primary: '#00D9A5',
              secondary: '#0B1120',
            },
          },
          error: {
            iconTheme: {
              primary: '#FF6B6B',
              secondary: '#0B1120',
            },
          },
        }}
      />

      {/* Header */}
      <Header
        account={account}
        isConnecting={isConnecting}
        isCorrectNetwork={isCorrectNetwork}
        onConnect={connect}
        onSwitchNetwork={switchNetwork}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        isAdmin={isAdmin}
      />

      {/* Main Content */}
      <main className="min-h-screen pt-20 md:pt-28 pb-8 md:pb-12 px-3 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {renderPage()}
        </div>
      </main>

      {/* Footer */}
      <footer className="glass border-t border-white/5 py-6 md:py-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00D9A5] to-[#00B88A] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 17L9 11L13 15L21 7" stroke="#0B1120" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M17 7H21V11" stroke="#0B1120" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-white/50 text-sm">&copy; 2025 YieldVault. {t('footer.builtOn')}</span>
            </div>
            <div className="flex items-center gap-6">
              <a
                href={`https://bscscan.com/address/${CONTRACTS.LP_MINING}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-[#00D9A5] text-sm transition-colors"
              >
                {t('footer.lpMiningContract')}
              </a>
              <a
                href={`https://bscscan.com/address/${CONTRACTS.TOKEN_MINING_V3}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-[#00D9A5] text-sm transition-colors"
              >
                {t('footer.tokenMiningContract')}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

export default App;
