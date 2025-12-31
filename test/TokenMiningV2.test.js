const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TokenMiningV2", function () {
  let stakingToken;
  let rewardToken;
  let mining;
  let owner;
  let user1;
  let user2;

  const TOTAL_REWARDS = ethers.parseEther("30000000"); // 3000万
  const RATE_BASE = 10000n;
  const SECONDS_PER_DAY = 86400n;

  // 锁仓档位枚举
  const LockTier = {
    FLEXIBLE: 0,
    THREE_MONTHS: 1,
    SIX_MONTHS: 2,
    TWELVE_MONTHS: 3,
  };

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("ProjectToken");
    stakingToken = await MockERC20.deploy("Staking Token", "STK");
    rewardToken = await MockERC20.deploy("Reward Token", "RWD");
    await stakingToken.waitForDeployment();
    await rewardToken.waitForDeployment();

    // Deploy TokenMiningV2
    const startTime = (await time.latest()) + 60;
    const TokenMiningV2 = await ethers.getContractFactory("TokenMiningV2");
    mining = await TokenMiningV2.deploy(
      await stakingToken.getAddress(),
      await rewardToken.getAddress(),
      startTime
    );
    await mining.waitForDeployment();

    // Fund mining contract with rewards
    await rewardToken.transfer(await mining.getAddress(), TOTAL_REWARDS);

    // Distribute staking tokens to users
    await stakingToken.transfer(user1.address, ethers.parseEther("100000"));
    await stakingToken.transfer(user2.address, ethers.parseEther("100000"));

    // Approve mining contract
    await stakingToken.connect(user1).approve(await mining.getAddress(), ethers.MaxUint256);
    await stakingToken.connect(user2).approve(await mining.getAddress(), ethers.MaxUint256);

    // Move to start time
    await time.increaseTo(startTime);
  });

  describe("Deployment", function () {
    it("Should set correct staking and reward tokens", async function () {
      expect(await mining.stakingToken()).to.equal(await stakingToken.getAddress());
      expect(await mining.rewardToken()).to.equal(await rewardToken.getAddress());
    });

    it("Should set correct total rewards", async function () {
      expect(await mining.totalRewards()).to.equal(TOTAL_REWARDS);
    });

    it("Should initialize tier configs correctly", async function () {
      // FLEXIBLE: 0 days, 0.4%
      const flexible = await mining.getTierConfig(LockTier.FLEXIBLE);
      expect(flexible.duration).to.equal(0);
      expect(flexible.dailyRate).to.equal(40);

      // THREE_MONTHS: 90 days, 0.6%
      const threeMonths = await mining.getTierConfig(LockTier.THREE_MONTHS);
      expect(threeMonths.duration).to.equal(90 * 24 * 3600);
      expect(threeMonths.dailyRate).to.equal(60);

      // SIX_MONTHS: 180 days, 0.8%
      const sixMonths = await mining.getTierConfig(LockTier.SIX_MONTHS);
      expect(sixMonths.duration).to.equal(180 * 24 * 3600);
      expect(sixMonths.dailyRate).to.equal(80);

      // TWELVE_MONTHS: 365 days, 1.0%
      const twelveMonths = await mining.getTierConfig(LockTier.TWELVE_MONTHS);
      expect(twelveMonths.duration).to.equal(365 * 24 * 3600);
      expect(twelveMonths.dailyRate).to.equal(100);
    });

    it("Should return all tier configs", async function () {
      const configs = await mining.getAllTierConfigs();
      expect(configs.dailyRates[0]).to.equal(40);
      expect(configs.dailyRates[1]).to.equal(60);
      expect(configs.dailyRates[2]).to.equal(80);
      expect(configs.dailyRates[3]).to.equal(100);
    });

    it("Should revert deployment with invalid tokens", async function () {
      const TokenMiningV2 = await ethers.getContractFactory("TokenMiningV2");
      const startTime = (await time.latest()) + 100;

      await expect(
        TokenMiningV2.deploy(ethers.ZeroAddress, await rewardToken.getAddress(), startTime)
      ).to.be.revertedWith("Invalid staking token");

      await expect(
        TokenMiningV2.deploy(await stakingToken.getAddress(), ethers.ZeroAddress, startTime)
      ).to.be.revertedWith("Invalid reward token");
    });

    it("Should revert with past start time", async function () {
      const TokenMiningV2 = await ethers.getContractFactory("TokenMiningV2");
      const pastTime = (await time.latest()) - 100;

      await expect(
        TokenMiningV2.deploy(await stakingToken.getAddress(), await rewardToken.getAddress(), pastTime)
      ).to.be.revertedWith("Start time must be future");
    });
  });

  describe("Deposit", function () {
    it("Should deposit with FLEXIBLE tier (no lock)", async function () {
      const amount = ethers.parseEther("1000");

      await expect(mining.connect(user1).deposit(amount, LockTier.FLEXIBLE))
        .to.emit(mining, "Deposit");

      const userInfo = await mining.getUserInfo(user1.address);
      expect(userInfo._totalStaked).to.equal(amount);
    });

    it("Should deposit with THREE_MONTHS tier", async function () {
      const amount = ethers.parseEther("1000");

      await mining.connect(user1).deposit(amount, LockTier.THREE_MONTHS);

      const record = await mining.getStakeRecord(user1.address, 0);
      expect(record.amount).to.equal(amount);
      expect(record.tier).to.equal(LockTier.THREE_MONTHS);
    });

    it("Should set correct unlock time for locked tier", async function () {
      const amount = ethers.parseEther("1000");

      await mining.connect(user1).deposit(amount, LockTier.SIX_MONTHS);

      const record = await mining.getStakeRecord(user1.address, 0);
      const currentTime = await time.latest();

      // 180 days lock
      expect(record.unlockTime).to.be.closeTo(currentTime + 180 * 24 * 3600, 10);
    });

    it("Should allow multiple deposits creating separate records", async function () {
      const amount1 = ethers.parseEther("1000");
      const amount2 = ethers.parseEther("2000");

      await mining.connect(user1).deposit(amount1, LockTier.FLEXIBLE);
      await mining.connect(user1).deposit(amount2, LockTier.THREE_MONTHS);

      const userInfo = await mining.getUserInfo(user1.address);
      expect(userInfo._totalStaked).to.equal(amount1 + amount2);
      expect(userInfo._stakeCount).to.equal(2);

      const record0 = await mining.getStakeRecord(user1.address, 0);
      const record1 = await mining.getStakeRecord(user1.address, 1);

      expect(record0.amount).to.equal(amount1);
      expect(record0.tier).to.equal(LockTier.FLEXIBLE);
      expect(record1.amount).to.equal(amount2);
      expect(record1.tier).to.equal(LockTier.THREE_MONTHS);
    });

    it("Should revert deposit of zero amount", async function () {
      await expect(
        mining.connect(user1).deposit(0, LockTier.FLEXIBLE)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("Should update total staked", async function () {
      const amount = ethers.parseEther("5000");
      await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);

      expect(await mining.totalStaked()).to.equal(amount);
    });
  });

  describe("Reward Calculation", function () {
    it("Should calculate correct rewards for FLEXIBLE tier (0.4%/day)", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);

      // Wait 1 day
      await time.increase(SECONDS_PER_DAY);

      const pending = await mining.pendingReward(user1.address, 0);
      // Expected: 10000 * 0.4% = 40 tokens per day
      const expectedReward = (amount * 40n) / RATE_BASE;

      expect(pending).to.be.closeTo(expectedReward, ethers.parseEther("0.1"));
    });

    it("Should calculate correct rewards for THREE_MONTHS tier (0.6%/day)", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.THREE_MONTHS);

      await time.increase(SECONDS_PER_DAY);

      const pending = await mining.pendingReward(user1.address, 0);
      // Expected: 10000 * 0.6% = 60 tokens per day
      const expectedReward = (amount * 60n) / RATE_BASE;

      expect(pending).to.be.closeTo(expectedReward, ethers.parseEther("0.1"));
    });

    it("Should calculate correct rewards for SIX_MONTHS tier (0.8%/day)", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.SIX_MONTHS);

      await time.increase(SECONDS_PER_DAY);

      const pending = await mining.pendingReward(user1.address, 0);
      // Expected: 10000 * 0.8% = 80 tokens per day
      const expectedReward = (amount * 80n) / RATE_BASE;

      expect(pending).to.be.closeTo(expectedReward, ethers.parseEther("0.1"));
    });

    it("Should calculate correct rewards for TWELVE_MONTHS tier (1.0%/day)", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.TWELVE_MONTHS);

      await time.increase(SECONDS_PER_DAY);

      const pending = await mining.pendingReward(user1.address, 0);
      // Expected: 10000 * 1.0% = 100 tokens per day
      const expectedReward = (amount * 100n) / RATE_BASE;

      expect(pending).to.be.closeTo(expectedReward, ethers.parseEther("0.1"));
    });

    it("Should calculate pendingRewardAll for multiple stakes", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);
      await mining.connect(user1).deposit(amount, LockTier.THREE_MONTHS);

      await time.increase(SECONDS_PER_DAY);

      const totalPending = await mining.pendingRewardAll(user1.address);
      // Expected: 10000 * 0.4% + 10000 * 0.6% = 40 + 60 = 100 tokens
      const expectedReward = (amount * 40n + amount * 60n) / RATE_BASE;

      expect(totalPending).to.be.closeTo(expectedReward, ethers.parseEther("0.2"));
    });
  });

  describe("Claim", function () {
    it("Should claim single stake rewards", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);

      await time.increase(SECONDS_PER_DAY);

      const balanceBefore = await rewardToken.balanceOf(user1.address);
      await mining.connect(user1).claim(0);
      const balanceAfter = await rewardToken.balanceOf(user1.address);

      const expectedReward = (amount * 40n) / RATE_BASE;
      expect(balanceAfter - balanceBefore).to.be.closeTo(expectedReward, ethers.parseEther("0.1"));
    });

    it("Should emit Claim event", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);

      await time.increase(SECONDS_PER_DAY);

      await expect(mining.connect(user1).claim(0)).to.emit(mining, "Claim");
    });

    it("Should claimAll rewards from multiple stakes", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);
      await mining.connect(user1).deposit(amount, LockTier.THREE_MONTHS);

      await time.increase(SECONDS_PER_DAY);

      const balanceBefore = await rewardToken.balanceOf(user1.address);
      await mining.connect(user1).claimAll();
      const balanceAfter = await rewardToken.balanceOf(user1.address);

      const expectedReward = (amount * 40n + amount * 60n) / RATE_BASE;
      expect(balanceAfter - balanceBefore).to.be.closeTo(expectedReward, ethers.parseEther("0.2"));
    });

    it("Should emit ClaimAll event", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);

      await time.increase(SECONDS_PER_DAY);

      await expect(mining.connect(user1).claimAll()).to.emit(mining, "ClaimAll");
    });

    it("Should revert claim on inactive stake", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);

      await time.increase(SECONDS_PER_DAY);
      await mining.connect(user1).withdraw(0);

      // Try to claim on inactive stake
      await expect(mining.connect(user1).claim(0)).to.be.revertedWith("Stake not active");
    });

    it("Should update totalClaimed after claim", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);

      await time.increase(SECONDS_PER_DAY);
      await mining.connect(user1).claim(0);

      const userInfo = await mining.getUserInfo(user1.address);
      expect(userInfo._totalClaimed).to.be.gt(0);
    });
  });

  describe("Withdraw", function () {
    it("Should withdraw from FLEXIBLE tier immediately", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);

      await time.increase(SECONDS_PER_DAY);

      const stakingBalanceBefore = await stakingToken.balanceOf(user1.address);
      await mining.connect(user1).withdraw(0);
      const stakingBalanceAfter = await stakingToken.balanceOf(user1.address);

      // Should get principal back
      expect(stakingBalanceAfter - stakingBalanceBefore).to.equal(amount);
    });

    it("Should not withdraw from locked tier before unlock time", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.THREE_MONTHS);

      // Try to withdraw immediately (within lock period)
      await expect(mining.connect(user1).withdraw(0)).to.be.revertedWith("Still in lock period");
    });

    it("Should withdraw after lock period ends", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.THREE_MONTHS);

      // Wait 90+ days
      await time.increase(91 * Number(SECONDS_PER_DAY));

      await expect(mining.connect(user1).withdraw(0)).to.not.be.reverted;
    });

    it("Should withdraw principal and rewards together", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);

      await time.increase(SECONDS_PER_DAY);

      const stakingBalanceBefore = await stakingToken.balanceOf(user1.address);
      const rewardBalanceBefore = await rewardToken.balanceOf(user1.address);

      await mining.connect(user1).withdraw(0);

      const stakingBalanceAfter = await stakingToken.balanceOf(user1.address);
      const rewardBalanceAfter = await rewardToken.balanceOf(user1.address);

      expect(stakingBalanceAfter - stakingBalanceBefore).to.equal(amount);
      expect(rewardBalanceAfter - rewardBalanceBefore).to.be.gt(0);
    });

    it("Should mark stake as inactive after withdraw", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);

      await time.increase(SECONDS_PER_DAY);
      await mining.connect(user1).withdraw(0);

      const record = await mining.getStakeRecord(user1.address, 0);
      expect(record.active).to.be.false;
      expect(record.amount).to.equal(0);
    });

    it("Should emit Withdraw event", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);

      await time.increase(SECONDS_PER_DAY);

      await expect(mining.connect(user1).withdraw(0))
        .to.emit(mining, "Withdraw")
        .withArgs(user1.address, 0, amount);
    });

    it("Should update total staked after withdraw", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);

      expect(await mining.totalStaked()).to.equal(amount);

      await time.increase(SECONDS_PER_DAY);
      await mining.connect(user1).withdraw(0);

      expect(await mining.totalStaked()).to.equal(0);
    });
  });

  describe("Mining End", function () {
    it("Should cap rewards to remaining balance", async function () {
      // Create a small reward pool for testing
      const TokenMiningV2 = await ethers.getContractFactory("TokenMiningV2");
      const startTime = (await time.latest()) + 60;
      const smallMining = await TokenMiningV2.deploy(
        await stakingToken.getAddress(),
        await rewardToken.getAddress(),
        startTime
      );

      // Fund with small amount
      const smallRewards = ethers.parseEther("100");
      await rewardToken.transfer(await smallMining.getAddress(), smallRewards);
      await smallMining.setTotalRewards(smallRewards);

      await stakingToken.connect(user1).approve(await smallMining.getAddress(), ethers.MaxUint256);

      await time.increaseTo(startTime);

      // Stake large amount
      await smallMining.connect(user1).deposit(ethers.parseEther("100000"), LockTier.TWELVE_MONTHS);

      // Wait long time
      await time.increase(365 * Number(SECONDS_PER_DAY));

      // Mining should end
      const pending = await smallMining.pendingRewardAll(user1.address);
      expect(pending).to.be.lte(smallRewards);
    });
  });

  describe("Admin Functions", function () {
    describe("setTierConfig", function () {
      it("Should update tier config", async function () {
        await mining.setTierConfig(LockTier.FLEXIBLE, 0, 50); // 0.5%

        const config = await mining.getTierConfig(LockTier.FLEXIBLE);
        expect(config.dailyRate).to.equal(50);
      });

      it("Should emit TierConfigUpdated event", async function () {
        await expect(mining.setTierConfig(LockTier.FLEXIBLE, 0, 50))
          .to.emit(mining, "TierConfigUpdated")
          .withArgs(LockTier.FLEXIBLE, 0, 50);
      });

      it("Should revert if rate too high", async function () {
        await expect(
          mining.setTierConfig(LockTier.FLEXIBLE, 0, 1001)
        ).to.be.revertedWith("Rate too high");
      });

      it("Should only allow owner", async function () {
        await expect(
          mining.connect(user1).setTierConfig(LockTier.FLEXIBLE, 0, 50)
        ).to.be.revertedWithCustomError(mining, "OwnableUnauthorizedAccount");
      });
    });

    describe("setTotalRewards", function () {
      it("Should update total rewards", async function () {
        const newTotal = ethers.parseEther("50000000");
        await mining.setTotalRewards(newTotal);
        expect(await mining.totalRewards()).to.equal(newTotal);
      });

      it("Should revert if less than distributed", async function () {
        const amount = ethers.parseEther("10000");
        await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);

        await time.increase(SECONDS_PER_DAY);
        await mining.connect(user1).claim(0);

        // Try to set total rewards less than distributed
        const distributed = await mining.totalDistributed();
        await expect(
          mining.setTotalRewards(distributed - 1n)
        ).to.be.revertedWith("Must be greater than distributed");
      });
    });

    describe("emergencyWithdraw", function () {
      it("Should allow owner to withdraw tokens", async function () {
        const withdrawAmount = ethers.parseEther("1000");

        await mining.emergencyWithdraw(await rewardToken.getAddress(), withdrawAmount);

        expect(await rewardToken.balanceOf(owner.address)).to.be.gte(withdrawAmount);
      });
    });
  });

  describe("View Functions", function () {
    it("Should return user stakes correctly", async function () {
      const amount1 = ethers.parseEther("1000");
      const amount2 = ethers.parseEther("2000");

      await mining.connect(user1).deposit(amount1, LockTier.FLEXIBLE);
      await mining.connect(user1).deposit(amount2, LockTier.SIX_MONTHS);

      const stakes = await mining.getUserStakes(user1.address);

      expect(stakes.amounts[0]).to.equal(amount1);
      expect(stakes.amounts[1]).to.equal(amount2);
      expect(stakes.tiers[0]).to.equal(LockTier.FLEXIBLE);
      expect(stakes.tiers[1]).to.equal(LockTier.SIX_MONTHS);
    });

    it("Should return active stake count", async function () {
      await mining.connect(user1).deposit(ethers.parseEther("1000"), LockTier.FLEXIBLE);
      await mining.connect(user1).deposit(ethers.parseEther("2000"), LockTier.FLEXIBLE);

      expect(await mining.getUserActiveStakeCount(user1.address)).to.equal(2);

      // Withdraw one
      await time.increase(SECONDS_PER_DAY);
      await mining.connect(user1).withdraw(0);

      expect(await mining.getUserActiveStakeCount(user1.address)).to.equal(1);
    });

    it("Should return mining status", async function () {
      const status = await mining.getMiningStatus();

      expect(status._totalStaked).to.equal(0);
      expect(status._miningEnded).to.be.false;
    });
  });
});
