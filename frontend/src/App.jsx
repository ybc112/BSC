import { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ethers } from 'ethers';

import Header from './components/Header';
import HomePage from './components/HomePage';
import LPMiningPage from './components/LPMiningPage';
import TokenMiningPage from './components/TokenMiningPage';
import ReferralPage from './components/ReferralPage';

import { useWallet } from './hooks/useWallet';
import { useContracts, useLPMining, useTokenMining, useTokenBalance, useAllowance } from './hooks/useContracts';
import { CONTRACTS } from './utils/constants';

function App() {
  const [currentPage, setCurrentPage] = useState('home');

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
  const tokenMiningData = useTokenMining(contracts.tokenMining, account);

  const { balance: lpBalance, refetch: refetchLpBalance } = useTokenBalance(contracts.lpToken, account);
  const { balance: tokenBalance, refetch: refetchTokenBalance } = useTokenBalance(contracts.rewardToken, account);

  const { allowance: lpAllowance, refetch: refetchLpAllowance } = useAllowance(
    contracts.lpToken,
    account,
    CONTRACTS.LP_MINING
  );
  const { allowance: tokenAllowance, refetch: refetchTokenAllowance } = useAllowance(
    contracts.rewardToken,
    account,
    CONTRACTS.TOKEN_MINING
  );

  // 检查 URL 参数中的推荐人
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref && ethers.isAddress(ref)) {
      localStorage.setItem('referrer', ref);
    }
  }, []);

  // 刷新数据
  const handleRefresh = () => {
    lpMiningData.refetch();
    tokenMiningData.refetch();
    refetchLpBalance();
    refetchTokenBalance();
    refetchLpAllowance();
    refetchTokenAllowance();
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
            tokenMiningData={tokenMiningData}
            tokenBalance={tokenBalance}
            tokenAllowance={tokenAllowance}
            contracts={contracts}
            onRefresh={handleRefresh}
          />
        );
      case 'referral':
        return (
          <ReferralPage
            account={account}
            lpMiningData={lpMiningData}
            contracts={contracts}
            onRefresh={handleRefresh}
          />
        );
      default:
        return (
          <HomePage
            onPageChange={setCurrentPage}
            lpMiningData={lpMiningData}
            tokenMiningData={tokenMiningData}
          />
        );
    }
  };

  return (
    <>
      {/* Animated Background */}
      <div className="animated-bg" />

      {/* Toast Notifications */}
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
            fontFamily: 'Space Grotesk, sans-serif',
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
      />

      {/* Main Content */}
      <main className="min-h-screen pt-24 md:pt-28 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {renderPage()}
        </div>
      </main>

      {/* Footer */}
      <footer className="glass border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00D9A5] to-[#00B88A] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 17L9 11L13 15L21 7" stroke="#0B1120" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M17 7H21V11" stroke="#0B1120" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-white/50 text-sm">&copy; 2025 YieldVault. Built on BSC.</span>
            </div>
            <div className="flex items-center gap-6">
              <a
                href="https://testnet.bscscan.com/address/0x2c556Fc2Baf45a9c57228119241d92871348676D"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-[#00D9A5] text-sm transition-colors"
              >
                LP Mining Contract
              </a>
              <a
                href="https://testnet.bscscan.com/address/0xD986ad28BE396ECC5CA882416AAF84F216ae08dc"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-[#00D9A5] text-sm transition-colors"
              >
                Token Mining Contract
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

export default App;
