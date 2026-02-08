import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUserPlus, FiCheck } from 'react-icons/fi';

import Header from './components/Header';
import HomePage from './components/HomePage';
import ReferralPage from './components/ReferralPage';
import AdminPage from './components/AdminPage';

import { useWallet, useContracts, useVaultData } from './hooks/useContracts';
import { formatAddress } from './utils/constants';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';

function AppContent() {
  const { t } = useLanguage();
  const [currentPage, setCurrentPage] = useState('home');
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingReferrer, setPendingReferrer] = useState(null);
  const [showReferrerModal, setShowReferrerModal] = useState(false);
  const [isBindingReferrer, setIsBindingReferrer] = useState(false);

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
  const vaultData = useVaultData(contracts.vault, contracts.usdt, account);

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      if (!account || !contracts.vault) {
        setIsAdmin(false);
        return;
      }
      try {
        const owner = await contracts.vault.owner();
        const isOp = await contracts.vault.operators(account);
        setIsAdmin(owner.toLowerCase() === account.toLowerCase() || isOp);
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [account, contracts.vault]);

  // Check URL referrer parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref && ethers.isAddress(ref)) {
      localStorage.setItem('airdrop_referrer', ref);
      setPendingReferrer(ref);
    } else {
      const savedRef = localStorage.getItem('airdrop_referrer');
      if (savedRef && ethers.isAddress(savedRef)) {
        setPendingReferrer(savedRef);
      }
    }
  }, []);

  // Auto show referrer modal
  useEffect(() => {
    const checkReferrer = async () => {
      if (!account || !contracts.vault || !pendingReferrer) return;

      try {
        const hasRef = await contracts.vault.hasReferrer(account);
        if (hasRef) {
          localStorage.removeItem('airdrop_referrer');
          setPendingReferrer(null);
          return;
        }

        if (pendingReferrer.toLowerCase() === account.toLowerCase()) {
          toast.error(t('toast.cannotReferSelf'));
          localStorage.removeItem('airdrop_referrer');
          setPendingReferrer(null);
          return;
        }

        setShowReferrerModal(true);
      } catch (err) {
        console.error('Check referrer error:', err);
      }
    };

    checkReferrer();
  }, [account, contracts.vault, pendingReferrer, t]);

  // Confirm bind referrer
  const handleConfirmBind = async () => {
    if (!contracts.vault || !pendingReferrer) return;

    setIsBindingReferrer(true);
    try {
      const tx = await contracts.vault.setReferrer(pendingReferrer);
      toast.loading(t('toast.bindingReferrer'), { id: 'bindRef' });
      await tx.wait();
      toast.success(t('toast.referrerBound'), { id: 'bindRef' });

      localStorage.removeItem('airdrop_referrer');
      setPendingReferrer(null);
      setShowReferrerModal(false);
      vaultData.refetch();
    } catch (err) {
      console.error('Bind referrer error:', err);
      toast.error(t('toast.bindFailed'), { id: 'bindRef' });
    } finally {
      setIsBindingReferrer(false);
    }
  };

  // Cancel bind
  const handleCancelBind = () => {
    localStorage.removeItem('airdrop_referrer');
    setPendingReferrer(null);
    setShowReferrerModal(false);
  };

  // Refresh data
  const handleRefresh = () => {
    vaultData.refetch();
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'referral':
        return (
          <ReferralPage
            account={account}
            contracts={contracts}
            vaultData={vaultData}
            onRefresh={handleRefresh}
          />
        );
      case 'admin':
        return (
          <AdminPage
            account={account}
            contracts={contracts}
            onRefresh={handleRefresh}
          />
        );
      default:
        return (
          <HomePage
            account={account}
            contracts={contracts}
            vaultData={vaultData}
            onRefresh={handleRefresh}
          />
        );
    }
  };

  return (
    <>
      <div className="animated-bg" />

      {/* Referrer Modal */}
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
              className="relative w-full max-w-md glass-card"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-green-600 flex items-center justify-center">
                  <FiUserPlus className="w-7 h-7 text-dark" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{t('modal.bindReferrer')}</h3>
                  <p className="text-white/50 text-sm">{t('modal.viaLink')}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-6">
                <div className="text-sm text-white/50 mb-2">{t('modal.referrerAddress')}</div>
                <div className="font-mono text-white break-all text-sm">{pendingReferrer}</div>
                <div className="text-xs text-white/40 mt-2">{formatAddress(pendingReferrer)}</div>
              </div>

              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 mb-6">
                <p className="text-sm text-white/70">
                  {t('modal.confirmDesc')}<span className="text-primary font-medium">{t('modal.irreversible')}</span>{t('modal.confirmDesc2')}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancelBind}
                  disabled={isBindingReferrer}
                  className="flex-1 btn-secondary disabled:opacity-50"
                >
                  {t('modal.cancel')}
                </button>
                <button
                  onClick={handleConfirmBind}
                  disabled={isBindingReferrer}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {isBindingReferrer ? (
                    <>
                      <div className="w-4 h-4 border-2 border-dark/30 border-t-dark rounded-full animate-spin" />
                      {t('modal.binding')}
                    </>
                  ) : (
                    <>
                      <FiCheck className="w-4 h-4" />
                      {t('modal.confirm')}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(26, 35, 50, 0.95)',
            color: '#F8FAFC',
            border: '1px solid rgba(0, 217, 165, 0.2)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
          },
          success: { iconTheme: { primary: '#00D9A5', secondary: '#0B1120' } },
          error: { iconTheme: { primary: '#FF6B6B', secondary: '#0B1120' } },
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

      {/* Main */}
      <main className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {renderPage()}
        </div>
      </main>

      {/* Footer */}
      <footer className="glass border-t border-white/5 py-6">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-white/40 text-sm">
            &copy; 2025 Airdrop. {t('footer.builtOn')}
          </p>
        </div>
      </footer>
    </>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
