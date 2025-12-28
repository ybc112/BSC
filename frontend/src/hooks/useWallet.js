import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CURRENT_NETWORK } from '../utils/constants';

export function useWallet() {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const isCorrectNetwork = chainId === parseInt(CURRENT_NETWORK.chainId, 16);

  // 检查钱包是否已连接
  const checkConnection = useCallback(async () => {
    if (typeof window.ethereum === 'undefined') return;

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const network = await provider.getNetwork();

        setAccount(accounts[0]);
        setChainId(Number(network.chainId));
        setProvider(provider);
        setSigner(signer);
      }
    } catch (err) {
      console.error('Check connection error:', err);
    }
  }, []);

  // 连接钱包
  const connect = useCallback(async () => {
    if (typeof window.ethereum === 'undefined') {
      setError('请安装 MetaMask 钱包');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();

      setAccount(accounts[0]);
      setChainId(Number(network.chainId));
      setProvider(provider);
      setSigner(signer);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    setAccount(null);
    setChainId(null);
    setProvider(null);
    setSigner(null);
  }, []);

  // 切换网络
  const switchNetwork = useCallback(async () => {
    if (typeof window.ethereum === 'undefined') return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CURRENT_NETWORK.chainId }],
      });
    } catch (switchError) {
      // 如果网络不存在，添加网络
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [CURRENT_NETWORK],
          });
        } catch (addError) {
          setError('添加网络失败');
        }
      } else {
        setError('切换网络失败');
      }
    }
  }, []);

  // 监听账户和网络变化
  useEffect(() => {
    if (typeof window.ethereum === 'undefined') return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setAccount(accounts[0]);
      }
    };

    const handleChainChanged = (chainId) => {
      setChainId(parseInt(chainId, 16));
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    checkConnection();

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [checkConnection, disconnect]);

  return {
    account,
    chainId,
    provider,
    signer,
    isConnecting,
    isConnected: !!account,
    isCorrectNetwork,
    error,
    connect,
    disconnect,
    switchNetwork,
  };
}
