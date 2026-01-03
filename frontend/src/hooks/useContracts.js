import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACTS } from '../utils/constants';
import { LP_MINING_ABI, TOKEN_MINING_ABI, ERC20_ABI, TOKEN_MINING_V2_ABI, PROJECT_TOKEN_V2_ABI } from '../abi';

// 带重试的异步调用函数
const retryCall = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`RPC call failed, retrying (${i + 1}/${retries})...`);
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
};

export function useContracts(signer, provider) {
  const [contracts, setContracts] = useState({
    lpMining: null,
    tokenMining: null,
    rewardToken: null,
    lpToken: null,
    // V2 合约
    tokenMiningV2: null,
    projectTokenV2: null,
  });

  useEffect(() => {
    if (!provider) return;

    const signerOrProvider = signer || provider;

    const lpMining = new ethers.Contract(CONTRACTS.LP_MINING, LP_MINING_ABI, signerOrProvider);
    const tokenMining = new ethers.Contract(CONTRACTS.TOKEN_MINING, TOKEN_MINING_ABI, signerOrProvider);
    const rewardToken = new ethers.Contract(CONTRACTS.REWARD_TOKEN, ERC20_ABI, signerOrProvider);
    const lpToken = new ethers.Contract(CONTRACTS.LP_TOKEN, ERC20_ABI, signerOrProvider);

    // V2 合约
    let tokenMiningV2 = null;
    let projectTokenV2 = null;

    if (CONTRACTS.TOKEN_MINING_V2) {
      tokenMiningV2 = new ethers.Contract(CONTRACTS.TOKEN_MINING_V2, TOKEN_MINING_V2_ABI, signerOrProvider);
    }
    if (CONTRACTS.PROJECT_TOKEN_V2) {
      projectTokenV2 = new ethers.Contract(CONTRACTS.PROJECT_TOKEN_V2, PROJECT_TOKEN_V2_ABI, signerOrProvider);
    }

    setContracts({ lpMining, tokenMining, rewardToken, lpToken, tokenMiningV2, projectTokenV2 });
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
    contractConfig: null,
    splitConfig: { addresses: [], rates: [] },
    lockStatus: null,
    isOwner: false,
    loading: true,
  });

  const fetchData = useCallback(async () => {
    if (!contract) return;

    try {
      const miningStatus = await retryCall(() => contract.getMiningStatus());
      const teamConfig = await retryCall(() => contract.getTeamLevelConfig());

      // 获取合约配置参数
      const [
        lockDuration,
        totalRewards,
        miningDuration,
        userBaseShare,
        splitShare,
        referralLevel1,
        referralLevel2,
        referralLevel3,
        owner
      ] = await retryCall(() => Promise.all([
        contract.lockDuration(),
        contract.totalRewards(),
        contract.miningDuration(),
        contract.userBaseShare(),
        contract.splitShare(),
        contract.referralLevel1(),
        contract.referralLevel2(),
        contract.referralLevel3(),
        contract.owner()
      ]));

      // 获取分流配置
      let splitConfig = { addresses: [], rates: [] };
      try {
        const splitData = await retryCall(() => contract.getSplitConfig());
        splitConfig = {
          addresses: splitData.addresses,
          rates: splitData.rates.map(r => Number(r) / 100), // 转为百分比
        };
      } catch (err) {
        console.error('Fetch split config error:', err);
      }

      let userInfo = null;
      let pendingReward = '0';
      let referrals = [];
      let lockStatus = null;
      let isOwner = false;

      if (account) {
        userInfo = await retryCall(() => contract.getUserInfo(account));
        pendingReward = await retryCall(() => contract.pendingReward(account));
        lockStatus = await retryCall(() => contract.getLockStatus(account));
        isOwner = owner.toLowerCase() === account.toLowerCase();
        try {
          referrals = await retryCall(() => contract.getReferrals(account));
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
          unlockTime: Number(userInfo.unlockTime),
          isLocked: userInfo.isLocked,
        } : null,
        lockStatus: lockStatus ? {
          unlockTime: Number(lockStatus.unlockTime),
          remainingTime: Number(lockStatus.remainingTime),
          isLocked: lockStatus.isLocked,
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
        contractConfig: {
          lockDuration: Number(lockDuration),
          lockDurationDays: Number(lockDuration) / 86400,
          totalRewards: ethers.formatEther(totalRewards),
          miningDuration: Number(miningDuration),
          miningDurationDays: Number(miningDuration) / 86400,
          userBaseShare: Number(userBaseShare) / 100,
          splitShare: Number(splitShare) / 100,
          referralLevel1: Number(referralLevel1) / 100,
          referralLevel2: Number(referralLevel2) / 100,
          referralLevel3: Number(referralLevel3) / 100,
        },
        splitConfig,
        isOwner,
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

// TokenMiningV2 Hook - 多档锁仓挖矿
export function useTokenMiningV2(contract, account) {
  const [data, setData] = useState({
    userInfo: null,
    stakes: [],
    miningStatus: null,
    tierConfigs: null,
    pendingRewardAll: '0',
    loading: true,
  });

  const fetchData = useCallback(async () => {
    if (!contract) return;

    try {
      const miningStatus = await retryCall(() => contract.getMiningStatus());
      const tierConfigs = await retryCall(() => contract.getAllTierConfigs());

      let userInfo = null;
      let stakes = [];
      let pendingRewardAll = '0';

      if (account) {
        userInfo = await retryCall(() => contract.getUserInfo(account));
        pendingRewardAll = await retryCall(() => contract.pendingRewardAll(account));

        // 获取用户所有质押记录
        try {
          const userStakes = await retryCall(() => contract.getUserStakes(account));
          stakes = userStakes.stakeIds.map((id, index) => ({
            stakeId: Number(id),
            amount: ethers.formatEther(userStakes.amounts[index]),
            unlockTime: Number(userStakes.unlockTimes[index]),
            tier: Number(userStakes.tiers[index]),
            pendingReward: ethers.formatEther(userStakes.pendingRewards[index]),
            active: userStakes.actives[index],
          })).filter(s => s.active);
        } catch (err) {
          console.error('Fetch stakes error:', err);
          stakes = [];
        }
      }

      setData({
        userInfo: userInfo ? {
          totalStaked: ethers.formatEther(userInfo._totalStaked),
          totalClaimed: ethers.formatEther(userInfo._totalClaimed),
          stakeCount: Number(userInfo._stakeCount),
          pendingRewards: ethers.formatEther(userInfo._pendingRewards),
          activeStakeCount: Number(userInfo._activeStakeCount || 0),
        } : null,
        stakes,
        miningStatus: {
          totalStaked: ethers.formatEther(miningStatus._totalStaked),
          totalDistributed: ethers.formatEther(miningStatus._totalDistributed),
          remainingRewards: ethers.formatEther(miningStatus._remainingRewards),
          miningEnded: miningStatus._miningEnded,
          startTime: Number(miningStatus._startTime),
        },
        tierConfigs: {
          durations: tierConfigs.durations.map(d => Number(d) / 86400), // 秒转天
          dailyRates: tierConfigs.dailyRates.map(r => Number(r) / 100), // 转为百分比
          annualAPYs: tierConfigs.annualAPYs.map(a => Number(a) / 100),
        },
        pendingRewardAll: ethers.formatEther(pendingRewardAll),
        loading: false,
      });
    } catch (err) {
      console.error('Fetch TokenMiningV2 data error:', err);
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

// ProjectTokenV2 Hook - 带滑点代币
export function useProjectTokenV2(contract, account) {
  const [data, setData] = useState({
    balance: '0',
    feeConfig: null,
    isExcluded: false,
    loading: true,
  });

  const fetchData = useCallback(async () => {
    if (!contract) return;

    try {
      const feeConfig = await contract.getFeeConfig();

      let balance = '0';
      let isExcluded = false;

      if (account) {
        balance = await contract.balanceOf(account);
        isExcluded = await contract.isExcludedFromFee(account);
      }

      setData({
        balance: ethers.formatEther(balance),
        feeConfig: {
          buyFee: Number(feeConfig._buyFee) / 100, // 转为百分比
          sellFee: Number(feeConfig._sellFee) / 100,
          feeReceiver: feeConfig._feeReceiver,
        },
        isExcluded,
        loading: false,
      });
    } catch (err) {
      console.error('Fetch ProjectTokenV2 data error:', err);
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [contract, account]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
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
      const bal = await retryCall(() => tokenContract.balanceOf(account));
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
      const allow = await retryCall(() => tokenContract.allowance(owner, spender));
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
