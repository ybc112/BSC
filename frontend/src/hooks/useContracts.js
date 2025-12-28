import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACTS } from '../utils/constants';
import { LP_MINING_ABI, TOKEN_MINING_ABI, ERC20_ABI } from '../abi';

export function useContracts(signer, provider) {
  const [contracts, setContracts] = useState({
    lpMining: null,
    tokenMining: null,
    rewardToken: null,
    lpToken: null,
  });

  useEffect(() => {
    if (!provider) return;

    const signerOrProvider = signer || provider;

    const lpMining = new ethers.Contract(CONTRACTS.LP_MINING, LP_MINING_ABI, signerOrProvider);
    const tokenMining = new ethers.Contract(CONTRACTS.TOKEN_MINING, TOKEN_MINING_ABI, signerOrProvider);
    const rewardToken = new ethers.Contract(CONTRACTS.REWARD_TOKEN, ERC20_ABI, signerOrProvider);
    const lpToken = new ethers.Contract(CONTRACTS.LP_TOKEN, ERC20_ABI, signerOrProvider);

    setContracts({ lpMining, tokenMining, rewardToken, lpToken });
  }, [signer, provider]);

  return contracts;
}

export function useLPMining(contract, account) {
  const [data, setData] = useState({
    userInfo: null,
    miningStatus: null,
    pendingReward: '0',
    referrals: [],
    teamConfig: null,
    loading: true,
  });

  const fetchData = useCallback(async () => {
    if (!contract) return;

    try {
      const miningStatus = await contract.getMiningStatus();
      const teamConfig = await contract.getTeamLevelConfig();

      let userInfo = null;
      let pendingReward = '0';
      let referrals = [];

      if (account) {
        userInfo = await contract.getUserInfo(account);
        pendingReward = await contract.pendingReward(account);
        try {
          referrals = await contract.getReferrals(account);
        } catch {
          referrals = [];
        }
      }

      setData({
        userInfo: userInfo ? {
          stakedAmount: ethers.formatEther(userInfo.stakedAmount),
          pendingRewards: ethers.formatEther(userInfo.pendingRewards),
          referralRewards: ethers.formatEther(userInfo.referralRewards),
          teamRewards: ethers.formatEther(userInfo.teamRewards),
          totalClaimed: ethers.formatEther(userInfo.totalClaimed),
          referrer: userInfo.referrer,
          referralCount: Number(userInfo.referralCount),
          teamPerformance: ethers.formatEther(userInfo.teamPerformance),
          smallAreaPerformance: ethers.formatEther(userInfo.smallAreaPerformance),
          teamLevel: Number(userInfo.teamLevel),
        } : null,
        miningStatus: {
          totalStaked: ethers.formatEther(miningStatus._totalStaked),
          totalDistributed: ethers.formatEther(miningStatus._totalDistributed),
          rewardPerSecond: ethers.formatEther(miningStatus._rewardPerSecond),
          startTime: Number(miningStatus._startTime),
          endTime: Number(miningStatus._endTime),
          remainingRewards: ethers.formatEther(miningStatus._remainingRewards),
          miningEnded: miningStatus._miningEnded,
        },
        pendingReward: ethers.formatEther(pendingReward),
        referrals,
        teamConfig: {
          thresholds: teamConfig.thresholds.map(t => ethers.formatEther(t)),
          rates: teamConfig.rates.map(r => Number(r) / 100),
        },
        loading: false,
      });
    } catch (err) {
      console.error('Fetch LP Mining data error:', err);
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [contract, account]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // 每15秒刷新
    return () => clearInterval(interval);
  }, [fetchData]);

  return { ...data, refetch: fetchData };
}

export function useTokenMining(contract, account) {
  const [data, setData] = useState({
    userInfo: null,
    miningStatus: null,
    pendingReward: '0',
    apy: 0,
    loading: true,
  });

  const fetchData = useCallback(async () => {
    if (!contract) return;

    try {
      const miningStatus = await contract.getMiningStatus();
      const apy = await contract.getAPY();

      let userInfo = null;
      let pendingReward = '0';

      if (account) {
        userInfo = await contract.getUserInfo(account);
        pendingReward = await contract.pendingReward(account);
      }

      setData({
        userInfo: userInfo ? {
          stakedAmount: ethers.formatEther(userInfo.stakedAmount),
          pendingRewards: ethers.formatEther(userInfo.pendingRewards),
          totalClaimed: ethers.formatEther(userInfo.totalClaimed),
          dailyReward: ethers.formatEther(userInfo.dailyReward),
        } : null,
        miningStatus: {
          totalStaked: ethers.formatEther(miningStatus._totalStaked),
          totalDistributed: ethers.formatEther(miningStatus._totalDistributed),
          remainingRewards: ethers.formatEther(miningStatus._remainingRewards),
          miningEnded: miningStatus._miningEnded,
          startTime: Number(miningStatus._startTime),
        },
        pendingReward: ethers.formatEther(pendingReward),
        apy: Number(apy) / 100,
        loading: false,
      });
    } catch (err) {
      console.error('Fetch Token Mining data error:', err);
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [contract, account]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { ...data, refetch: fetchData };
}

export function useTokenBalance(tokenContract, account) {
  const [balance, setBalance] = useState('0');
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    if (!tokenContract || !account) {
      setBalance('0');
      setLoading(false);
      return;
    }

    try {
      const bal = await tokenContract.balanceOf(account);
      setBalance(ethers.formatEther(bal));
    } catch (err) {
      console.error('Fetch balance error:', err);
    } finally {
      setLoading(false);
    }
  }, [tokenContract, account]);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  return { balance, loading, refetch: fetchBalance };
}

export function useAllowance(tokenContract, owner, spender) {
  const [allowance, setAllowance] = useState('0');

  const fetchAllowance = useCallback(async () => {
    if (!tokenContract || !owner || !spender) return;

    try {
      const allow = await tokenContract.allowance(owner, spender);
      setAllowance(ethers.formatEther(allow));
    } catch (err) {
      console.error('Fetch allowance error:', err);
    }
  }, [tokenContract, owner, spender]);

  useEffect(() => {
    fetchAllowance();
  }, [fetchAllowance]);

  return { allowance, refetch: fetchAllowance };
}
