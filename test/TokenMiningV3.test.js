const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TokenMiningV3", function () {
  let stakingToken;
  let rewardToken;
  let mining;
  let owner;
  let user1;
  let user2;
  let user3;
  let user4;
  let user5;

  const TOTAL_REWARDS = ethers.parseEther("30000000"); // 3000万
  const RATE_BASE = 10000n;
  const SECONDS_PER_DAY = 86400n;

  const LockTier = {
    FLEXIBLE: 0,
    THREE_MONTHS: 1,
    SIX_MONTHS: 2,
    TWELVE_MONTHS: 3,
  };

  beforeEach(async function () {
    [owner, user1, user2, user3, user4, user5] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("ProjectToken");
    stakingToken = await MockERC20.deploy("Staking Token", "STK");
    rewardToken = await MockERC20.deploy("Reward Token", "RWD");
    await stakingToken.waitForDeployment();
    await rewardToken.waitForDeployment();

    const startTime = (await time.latest()) + 60;
    const TokenMiningV3 = await ethers.getContractFactory("TokenMiningV3");
    mining = await TokenMiningV3.deploy(
      await stakingToken.getAddress(),
      await rewardToken.getAddress(),
      startTime
    );
    await mining.waitForDeployment();

    // Fund mining contract with rewards
    await rewardToken.transfer(await mining.getAddress(), TOTAL_REWARDS);

    // Distribute staking tokens to users
    const users = [user1, user2, user3, user4, user5];
    for (const user of users) {
      await stakingToken.transfer(user.address, ethers.parseEther("100000"));
      await stakingToken.connect(user).approve(await mining.getAddress(), ethers.MaxUint256);
    }

    // Move to start time
    await time.increaseTo(startTime);
  });

  // ============ 基础功能（与V2一致）============

  describe("Deployment", function () {
    it("Should set correct staking and reward tokens", async function () {
      expect(await mining.stakingToken()).to.equal(await stakingToken.getAddress());
      expect(await mining.rewardToken()).to.equal(await rewardToken.getAddress());
    });

    it("Should set correct total rewards", async function () {
      expect(await mining.totalRewards()).to.equal(TOTAL_REWARDS);
    });

    it("Should initialize tier configs correctly", async function () {
      const flexible = await mining.getTierConfig(LockTier.FLEXIBLE);
      expect(flexible.duration).to.equal(0);
      expect(flexible.dailyRate).to.equal(40);

      const threeMonths = await mining.getTierConfig(LockTier.THREE_MONTHS);
      expect(threeMonths.duration).to.equal(90 * 24 * 3600);
      expect(threeMonths.dailyRate).to.equal(60);
    });

    it("Should have no referral rates by default", async function () {
      const rates = await mining.getReferralRates();
      expect(rates.length).to.equal(0);
      expect(await mining.getReferralLevels()).to.equal(0);
    });
  });

  describe("Deposit & Withdraw (same as V2)", function () {
    it("Should deposit with FLEXIBLE tier", async function () {
      const amount = ethers.parseEther("1000");
      await expect(mining.connect(user1).deposit(amount, LockTier.FLEXIBLE))
        .to.emit(mining, "Deposit");

      const info = await mining.getUserInfo(user1.address);
      expect(info._totalStaked).to.equal(amount);
    });

    it("Should withdraw from FLEXIBLE tier immediately", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);
      await time.increase(SECONDS_PER_DAY);

      const before = await stakingToken.balanceOf(user1.address);
      await mining.connect(user1).withdraw(0);
      const after = await stakingToken.balanceOf(user1.address);
      expect(after - before).to.equal(amount);
    });

    it("Should not withdraw from locked tier before unlock", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.THREE_MONTHS);
      await expect(mining.connect(user1).withdraw(0)).to.be.revertedWith("Still in lock period");
    });

    it("Should calculate correct rewards for FLEXIBLE tier (0.4%/day)", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);
      await time.increase(SECONDS_PER_DAY);

      const pending = await mining.pendingReward(user1.address, 0);
      const expectedReward = (amount * 40n) / RATE_BASE;
      expect(pending).to.be.closeTo(expectedReward, ethers.parseEther("0.1"));
    });
  });

  // ============ 推荐系统 ============

  describe("Referral System - setReferrer", function () {
    it("Should set referrer successfully", async function () {
      await expect(mining.connect(user2).setReferrer(user1.address))
        .to.emit(mining, "ReferrerSet")
        .withArgs(user2.address, user1.address);

      const info = await mining.getUserInfo(user2.address);
      expect(info._referrer).to.equal(user1.address);
    });

    it("Should not allow setting referrer twice", async function () {
      await mining.connect(user2).setReferrer(user1.address);
      await expect(
        mining.connect(user2).setReferrer(user3.address)
      ).to.be.revertedWith("Referrer already set");
    });

    it("Should not allow self-referral", async function () {
      await expect(
        mining.connect(user1).setReferrer(user1.address)
      ).to.be.revertedWith("Cannot refer yourself");
    });

    it("Should not allow zero address as referrer", async function () {
      await expect(
        mining.connect(user1).setReferrer(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid referrer");
    });

    it("Should prevent circular referral", async function () {
      await mining.connect(user2).setReferrer(user1.address);
      await expect(
        mining.connect(user1).setReferrer(user2.address)
      ).to.be.revertedWith("Circular referral not allowed");
    });

    it("Should track direct referrals count", async function () {
      await mining.connect(user2).setReferrer(user1.address);
      await mining.connect(user3).setReferrer(user1.address);

      const info = await mining.getUserInfo(user1.address);
      expect(info._directReferrals).to.equal(2);
    });

    it("Should return referral list", async function () {
      await mining.connect(user2).setReferrer(user1.address);
      await mining.connect(user3).setReferrer(user1.address);

      const refs = await mining.getReferrals(user1.address);
      expect(refs.length).to.equal(2);
      expect(refs[0]).to.equal(user2.address);
      expect(refs[1]).to.equal(user3.address);
    });

    it("Should not require referrer to be staked", async function () {
      // user1 has not staked, but can still be a referrer
      await expect(
        mining.connect(user2).setReferrer(user1.address)
      ).to.not.be.reverted;
    });
  });

  describe("Referral Rates Configuration", function () {
    it("Should set referral rates (3 levels)", async function () {
      await mining.setReferralRates([1000, 800, 500]); // 10%, 8%, 5%
      const rates = await mining.getReferralRates();
      expect(rates.length).to.equal(3);
      expect(rates[0]).to.equal(1000);
      expect(rates[1]).to.equal(800);
      expect(rates[2]).to.equal(500);
    });

    it("Should set referral rates (20 levels)", async function () {
      const rates = Array(20).fill(100); // 20代每代1%
      await mining.setReferralRates(rates);
      expect(await mining.getReferralLevels()).to.equal(20);
    });

    it("Should reject more than 20 levels", async function () {
      const rates = Array(21).fill(100);
      await expect(
        mining.setReferralRates(rates)
      ).to.be.revertedWith("Too many levels");
    });

    it("Should reject total rate exceeding 100%", async function () {
      await expect(
        mining.setReferralRates([4000, 4000, 3000]) // 40% + 40% + 30% = 110%
      ).to.be.revertedWith("Total rate exceeds 100%");
    });

    it("Should reject single rate exceeding 50%", async function () {
      await expect(
        mining.setReferralRates([5001]) // 50.01%
      ).to.be.revertedWith("Single rate too high");
    });

    it("Should allow clearing referral rates", async function () {
      await mining.setReferralRates([1000, 800, 500]);
      await mining.setReferralRates([]);
      expect(await mining.getReferralLevels()).to.equal(0);
    });

    it("Should only allow owner to set rates", async function () {
      await expect(
        mining.connect(user1).setReferralRates([1000])
      ).to.be.revertedWithCustomError(mining, "OwnableUnauthorizedAccount");
    });

    it("Should emit ReferralRatesUpdated event", async function () {
      await expect(mining.setReferralRates([1000, 800]))
        .to.emit(mining, "ReferralRatesUpdated");
    });
  });

  describe("Referral Rewards Distribution", function () {
    beforeEach(async function () {
      // Setup: 3-level referral: 10%, 8%, 5%
      await mining.setReferralRates([1000, 800, 500]);

      // Referral chain: user1 <- user2 <- user3 <- user4
      await mining.connect(user2).setReferrer(user1.address);
      await mining.connect(user3).setReferrer(user2.address);
      await mining.connect(user4).setReferrer(user3.address);
    });

    it("Should distribute 1-level referral reward on claim", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user2).deposit(amount, LockTier.FLEXIBLE);
      await time.increase(SECONDS_PER_DAY);

      // user2 claims, user1 should get 10% referral reward
      await mining.connect(user2).claim(0);

      const info = await mining.getUserInfo(user1.address);
      const expectedUserReward = (amount * 40n) / RATE_BASE; // ~40 tokens
      const expectedReferral = (expectedUserReward * 1000n) / RATE_BASE; // 10% = ~4 tokens

      expect(info._referralRewards).to.be.closeTo(expectedReferral, ethers.parseEther("0.01"));
    });

    it("Should distribute multi-level referral rewards on claim", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user4).deposit(amount, LockTier.FLEXIBLE);
      await time.increase(SECONDS_PER_DAY);

      // user4 claims -> user3 gets 10%, user2 gets 8%, user1 gets 5%
      await mining.connect(user4).claim(0);

      const userReward = (amount * 40n) / RATE_BASE; // ~40 tokens

      const info3 = await mining.getUserInfo(user3.address);
      const info2 = await mining.getUserInfo(user2.address);
      const info1 = await mining.getUserInfo(user1.address);

      expect(info3._referralRewards).to.be.closeTo(
        (userReward * 1000n) / RATE_BASE, ethers.parseEther("0.01")
      ); // 10%
      expect(info2._referralRewards).to.be.closeTo(
        (userReward * 800n) / RATE_BASE, ethers.parseEther("0.01")
      ); // 8%
      expect(info1._referralRewards).to.be.closeTo(
        (userReward * 500n) / RATE_BASE, ethers.parseEther("0.01")
      ); // 5%
    });

    it("Should emit ReferralReward events", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user2).deposit(amount, LockTier.FLEXIBLE);
      await time.increase(SECONDS_PER_DAY);

      await expect(mining.connect(user2).claim(0))
        .to.emit(mining, "ReferralReward");
    });

    it("Should distribute referral rewards on withdraw too", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user2).deposit(amount, LockTier.FLEXIBLE);
      await time.increase(SECONDS_PER_DAY);

      await mining.connect(user2).withdraw(0);

      const info = await mining.getUserInfo(user1.address);
      expect(info._referralRewards).to.be.gt(0);
    });

    it("Should distribute referral rewards on claimAll", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user2).deposit(amount, LockTier.FLEXIBLE);
      await mining.connect(user2).deposit(amount, LockTier.THREE_MONTHS);
      await time.increase(SECONDS_PER_DAY);

      await mining.connect(user2).claimAll();

      const info = await mining.getUserInfo(user1.address);
      expect(info._referralRewards).to.be.gt(0);
    });

    it("Should not distribute referral rewards when no referrer", async function () {
      // user1 has no referrer
      const amount = ethers.parseEther("10000");
      await mining.connect(user1).deposit(amount, LockTier.FLEXIBLE);
      await time.increase(SECONDS_PER_DAY);

      const beforeDistributed = await mining.totalReferralDistributed();
      await mining.connect(user1).claim(0);
      const afterDistributed = await mining.totalReferralDistributed();

      expect(afterDistributed).to.equal(beforeDistributed);
    });

    it("Should not distribute referral rewards when rates are empty", async function () {
      await mining.setReferralRates([]); // Clear rates

      const amount = ethers.parseEther("10000");
      await mining.connect(user2).deposit(amount, LockTier.FLEXIBLE);
      await time.increase(SECONDS_PER_DAY);

      await mining.connect(user2).claim(0);

      const info = await mining.getUserInfo(user1.address);
      expect(info._referralRewards).to.equal(0);
    });

    it("Should stop referral distribution at chain end", async function () {
      // user2 -> user1 (only 1 level of referrer for user2)
      // But we have 3 levels of rates configured
      // Only user1 should get level 1 reward, levels 2&3 skipped
      const amount = ethers.parseEther("10000");
      await mining.connect(user2).deposit(amount, LockTier.FLEXIBLE);
      await time.increase(SECONDS_PER_DAY);

      await mining.connect(user2).claim(0);

      // user1 gets reward (level 1), no one at level 2 or 3
      const info1 = await mining.getUserInfo(user1.address);
      expect(info1._referralRewards).to.be.gt(0);
    });

    it("Referral rewards should come from the 30M pool (totalDistributed increases)", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user2).deposit(amount, LockTier.FLEXIBLE);
      await time.increase(SECONDS_PER_DAY);

      const beforeDistributed = await mining.totalDistributed();
      await mining.connect(user2).claim(0);
      const afterDistributed = await mining.totalDistributed();

      // totalDistributed should include both user reward + referral rewards
      const userReward = (amount * 40n) / RATE_BASE;
      const referralReward = (userReward * 1000n) / RATE_BASE; // 10% for level 1

      // afterDistributed should be roughly userReward + referralReward
      expect(afterDistributed - beforeDistributed).to.be.closeTo(
        userReward + referralReward,
        ethers.parseEther("0.1")
      );
    });
  });

  describe("Claim Referral Rewards", function () {
    beforeEach(async function () {
      await mining.setReferralRates([1000]); // 1 level: 10%
      await mining.connect(user2).setReferrer(user1.address);
    });

    it("Should claim referral rewards successfully", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user2).deposit(amount, LockTier.FLEXIBLE);
      await time.increase(SECONDS_PER_DAY);
      await mining.connect(user2).claim(0);

      // user1 claims referral rewards
      const before = await rewardToken.balanceOf(user1.address);
      await mining.connect(user1).claimReferralRewards();
      const after = await rewardToken.balanceOf(user1.address);

      expect(after - before).to.be.gt(0);

      // referralRewards should be 0 after claim
      const info = await mining.getUserInfo(user1.address);
      expect(info._referralRewards).to.equal(0);
    });

    it("Should track totalReferralClaimed", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user2).deposit(amount, LockTier.FLEXIBLE);
      await time.increase(SECONDS_PER_DAY);
      await mining.connect(user2).claim(0);

      await mining.connect(user1).claimReferralRewards();

      const info = await mining.getUserInfo(user1.address);
      expect(info._totalReferralClaimed).to.be.gt(0);
    });

    it("Should revert if no referral rewards", async function () {
      await expect(
        mining.connect(user1).claimReferralRewards()
      ).to.be.revertedWith("No referral rewards");
    });

    it("Should emit ClaimReferralRewards event", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user2).deposit(amount, LockTier.FLEXIBLE);
      await time.increase(SECONDS_PER_DAY);
      await mining.connect(user2).claim(0);

      await expect(mining.connect(user1).claimReferralRewards())
        .to.emit(mining, "ClaimReferralRewards");
    });

    it("Should accumulate referral rewards from multiple claims", async function () {
      const amount = ethers.parseEther("10000");
      await mining.connect(user2).deposit(amount, LockTier.FLEXIBLE);

      // Day 1
      await time.increase(SECONDS_PER_DAY);
      await mining.connect(user2).claim(0);

      const info1 = await mining.getUserInfo(user1.address);
      const firstReward = info1._referralRewards;

      // Day 2
      await time.increase(SECONDS_PER_DAY);
      await mining.connect(user2).claim(0);

      const info2 = await mining.getUserInfo(user1.address);
      expect(info2._referralRewards).to.be.closeTo(firstReward * 2n, ethers.parseEther("0.1"));
    });
  });

  describe("Mining Pool Shared by Mining + Referral", function () {
    it("Should end mining when pool exhausted (including referral rewards)", async function () {
      // Create small reward pool
      const TokenMiningV3 = await ethers.getContractFactory("TokenMiningV3");
      const startTime2 = (await time.latest()) + 60;
      const smallMining = await TokenMiningV3.deploy(
        await stakingToken.getAddress(),
        await rewardToken.getAddress(),
        startTime2
      );

      const smallRewards = ethers.parseEther("100");
      await rewardToken.transfer(await smallMining.getAddress(), smallRewards);
      await smallMining.setTotalRewards(smallRewards);

      // Set high referral rate
      await smallMining.setReferralRates([2000]); // 20%

      await stakingToken.connect(user1).approve(await smallMining.getAddress(), ethers.MaxUint256);
      await stakingToken.connect(user2).approve(await smallMining.getAddress(), ethers.MaxUint256);

      await time.increaseTo(startTime2);

      // Setup referral
      await smallMining.connect(user2).setReferrer(user1.address);

      // Stake large amount
      await smallMining.connect(user2).deposit(ethers.parseEther("100000"), LockTier.TWELVE_MONTHS);

      // Wait long time
      await time.increase(365 * Number(SECONDS_PER_DAY));

      // Total distributed should not exceed pool
      const status = await smallMining.getMiningStatus();
      expect(status._totalDistributed).to.be.lte(smallRewards);
    });
  });

  describe("View Functions", function () {
    it("Should return mining status with referral stats", async function () {
      await mining.setReferralRates([1000]);
      await mining.connect(user2).setReferrer(user1.address);

      const amount = ethers.parseEther("10000");
      await mining.connect(user2).deposit(amount, LockTier.FLEXIBLE);
      await time.increase(SECONDS_PER_DAY);
      await mining.connect(user2).claim(0);

      const status = await mining.getMiningStatus();
      expect(status._totalReferralDistributed).to.be.gt(0);
    });

    it("Should return user info with referral data", async function () {
      await mining.connect(user2).setReferrer(user1.address);
      await mining.connect(user3).setReferrer(user1.address);

      const info = await mining.getUserInfo(user1.address);
      expect(info._directReferrals).to.equal(2);
      expect(info._referrer).to.equal(ethers.ZeroAddress);
    });

    it("Should return referrals paginated", async function () {
      await mining.connect(user2).setReferrer(user1.address);
      await mining.connect(user3).setReferrer(user1.address);
      await mining.connect(user4).setReferrer(user1.address);

      const [result, total] = await mining.getReferralsPaginated(user1.address, 0, 2);
      expect(total).to.equal(3);
      expect(result.length).to.equal(2);

      const [result2, total2] = await mining.getReferralsPaginated(user1.address, 2, 2);
      expect(total2).to.equal(3);
      expect(result2.length).to.equal(1);
    });
  });

  describe("Admin Functions", function () {
    it("Should set tier config", async function () {
      await mining.setTierConfig(LockTier.FLEXIBLE, 0, 50);
      const config = await mining.getTierConfig(LockTier.FLEXIBLE);
      expect(config.dailyRate).to.equal(50);
    });

    it("Should set total rewards", async function () {
      const newTotal = ethers.parseEther("50000000");
      await mining.setTotalRewards(newTotal);
      expect(await mining.totalRewards()).to.equal(newTotal);
    });

    it("Should emergency withdraw", async function () {
      const amount = ethers.parseEther("1000");
      await mining.emergencyWithdraw(await rewardToken.getAddress(), amount);
      expect(await rewardToken.balanceOf(owner.address)).to.be.gte(amount);
    });
  });
});
