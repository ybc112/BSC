import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACTS, NETWORK } from '../utils/constants';
import { ERC20_ABI, AIRDROP_VAULT_ABI } from '../abi';

// Wallet connection hook
export function useWallet() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);

  const checkNetwork = useCallback(async () => {
    if (!window.ethereum) return false;
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const correct = chainId === NETWORK.chainId;
      setIsCorrectNetwork(correct);
      return correct;
    } catch {
      return false;
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: NETWORK.chainId }],
      });
    } catch (error) {
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [NETWORK],
        });
      }
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        setAccount(accounts[0]);
        setProvider(provider);
        setSigner(signer);
        await checkNetwork();
      }
    } catch (error) {
      console.error('Connect error:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [checkNetwork]);

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          setAccount(null);
          setSigner(null);
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });

      // Auto connect if previously connected
      window.ethereum.request({ method: 'eth_accounts' }).then((accounts) => {
        if (accounts.length > 0) {
          connect();
        }
      });
    }
  }, [connect]);

  return {
    account,
    provider,
    signer,
    isConnecting,
    isCorrectNetwork,
    connect,
    switchNetwork,
  };
}

// Contracts hook
export function useContracts(signer, provider) {
  const [contracts, setContracts] = useState({
    vault: null,
    usdt: null,
  });

  useEffect(() => {
    const signerOrProvider = signer || provider;
    if (!signerOrProvider) return;

    const newContracts = {};

    if (CONTRACTS.AIRDROP_VAULT) {
      newContracts.vault = new ethers.Contract(
        CONTRACTS.AIRDROP_VAULT,
        AIRDROP_VAULT_ABI,
        signerOrProvider
      );
    }

    if (CONTRACTS.USDT) {
      newContracts.usdt = new ethers.Contract(
        CONTRACTS.USDT,
        ERC20_ABI,
        signerOrProvider
      );
    }

    setContracts(newContracts);
  }, [signer, provider]);

  return contracts;
}

// Vault data hook
export function useVaultData(vault, usdt, account) {
  const [data, setData] = useState({
    userInfo: null,
    referralRates: null,
    config: null,
    usdtBalance: '0',
    usdtAllowance: '0',
    isLoading: true,
  });

  const refetch = useCallback(async () => {
    if (!vault) {
      setData(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      // Get config
      const [threshold, receiver, enabled] = await vault.getAutoTransferConfig();
      const [level1, level2, level3] = await vault.getReferralRates();

      const config = {
        threshold: ethers.formatEther(threshold),
        receiver,
        enabled,
      };

      const referralRates = {
        level1: Number(level1) / 100,
        level2: Number(level2) / 100,
        level3: Number(level3) / 100,
      };

      let userInfo = null;
      let usdtBalance = '0';
      let usdtAllowance = '0';

      if (account) {
        const info = await vault.getUserInfo(account);
        userInfo = {
          enabled: info.enabled,
          referrer: info.referrer,
          totalTransferred: ethers.formatEther(info.totalTransferred),
          referralRewards: ethers.formatEther(info.referralRewards),
          totalReferralEarned: ethers.formatEther(info.totalReferralEarned),
          directReferrals: Number(info.directReferrals),
          tokenBalance: ethers.formatEther(info.tokenBalance),
          allowance: ethers.formatEther(info.allowance),
        };

        if (usdt) {
          const balance = await usdt.balanceOf(account);
          const allowance = await usdt.allowance(account, await vault.getAddress());
          usdtBalance = ethers.formatEther(balance);
          usdtAllowance = ethers.formatEther(allowance);
        }
      }

      setData({
        userInfo,
        referralRates,
        config,
        usdtBalance,
        usdtAllowance,
        isLoading: false,
      });
    } catch (error) {
      console.error('Fetch vault data error:', error);
      setData(prev => ({ ...prev, isLoading: false }));
    }
  }, [vault, usdt, account]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...data, refetch };
}
