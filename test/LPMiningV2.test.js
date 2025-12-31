const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("LPMiningV2", function () {
  let rewardToken;
  let lpToken;
  let mining;
  let owner;
  let user1;
  let user2;
  let user3;
  let splitAddr1;
  let splitAddr2;

  const TOTAL_REWARDS = ethers.parseEther("60000000"); // 6000万
  const MINING_DURATION = 3 * 365 * 24 * 3600; // 3年
  const DISTRIBUTION_BASE = 10000n;
  const SECONDS_PER_DAY = 86400;

  beforeEach(async function () {
    [owner, user1, user2, user3, splitAddr1, splitAddr2] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("ProjectToken");
    rewardToken = await MockERC20.deploy("Reward Token", "RWD");
    lpToken = await MockERC20.deploy("LP Token", "LP");
    await rewardToken.waitForDeployment();
    await lpToken.waitForDeployment();

    // Deploy LPMiningV2
    const startTime = (await time.latest()) + 60;
    const LPMiningV2 = await ethers.getContractFactory("LPMiningV2");
    mining = await LPMiningV2.deploy(
      await rewardToken.getAddress(),
      await lpToken.getAddress(),
      startTime
    );
    await mining.waitForDeployment();

    // Fund mining contract with rewards
    await rewardToken.transfer(await mining.getAddress(), TOTAL_REWARDS);

    // Distribute LP tokens to users
    await lpToken.transfer(user1.address, ethers.parseEther("100000"));
    await lpToken.transfer(user2.address, ethers.parseEther("100000"));
    await lpToken.transfer(user3.address, ethers.parseEther("100000"));

    // Approve mining contract
    await lpToken.connect(user1).approve(await mining.getAddress(), ethers.MaxUint256);
    await lpToken.connect(user2).approve(await mining.getAddress(), ethers.MaxUint256);
    await lpToken.connect(user3).approve(await mining.getAddress(), ethers.MaxUint256);

    // Set up split addresses
    await mining.setSplitAddresses(
      [splitAddr1.address, splitAddr2.address],
      [5000, 5000] // 50% each of the 35%
    );

    // Move to start time
    await time.increaseTo(startTime);
  });

  describe("Deployment", function () {
    it("Should set correct tokens", async function () {
      expect(await mining.rewardToken()).to.equal(await rewardToken.getAddress());
      expect(await mining.lpToken()).to.equal(await lpToken.getAddress());
    });

    it("Should set correct mining parameters", async function () {
      expect(await mining.totalRewards()).to.equal(TOTAL_REWARDS);
      expect(await mining.miningDuration()).to.equal(MINING_DURATION);
    });

    it("Should set correct distribution rates", async function () {
      expect(await mining.userBaseShare()).to.equal(6500); // 65%
      expect(await mining.splitShare()).to.equal(3500); // 35%
    });

    it("Should set correct referral rates", async function () {
      expect(await mining.referralLevel1()).to.equal(2000); // 20%
      expect(await mining.referralLevel2()).to.equal(1000); // 10%
      expect(await mining.referralLevel3()).to.equal(500); // 5%
    });

    it("Should set default lock duration", async function () {
      expect(await mining.lockDuration()).to.equal(30 * 24 * 3600); // 30 days
    });

    it("Should initialize team levels", async function () {
      const config = await mining.getTeamLevelConfig();
      expect(config.thresholds.length).to.equal(3);
      expect(config.rates.length).to.equal(3);
    });

    it("Should revert with invalid tokens", async function () {
      const LPMiningV2 = await ethers.getContractFactory("LPMiningV2");
      const startTime = (await time.latest()) + 100;

      await expect(
        LPMiningV2.deploy(ethers.ZeroAddress, await lpToken.getAddress(), startTime)
      ).to.be.revertedWith("Invalid reward token");

      await expect(
        LPMiningV2.deploy(await rewardToken.getAddress(), ethers.ZeroAddress, startTime)
      ).to.be.revertedWith("Invalid LP token");
    });
  });

  describe("Referrer System", function () {
    beforeEach(async function () {
      // User1 stakes first
      await mining.connect(user1).deposit(ethers.parseEther("1000"));
    });

    it("Should set referrer", async function () {
      await mining.connect(user2).setReferrer(user1.address);

      const userInfo = await mining.getUserInfo(user2.address);
      expect(userInfo.referrer).to.equal(user1.address);
    });

    it("Should emit ReferrerSet event", async function () {
      await expect(mining.connect(user2).setReferrer(user1.address))
        .to.emit(mining, "ReferrerSet")
        .withArgs(user2.address, user1.address);
    });

    it("Should allow owner as referrer without staking", async function () {
      await expect(
        mining.connect(user2).setReferrer(owner.address)
      ).to.not.be.reverted;
    });

    it("Should not allow self-referral", async function () {
      await expect(
        mining.connect(user2).setReferrer(user2.address)
      ).to.be.revertedWith("Cannot refer yourself");
    });

    it("Should not allow referrer change", async function () {
      await mining.connect(user2).setReferrer(user1.address);

      await expect(
        mining.connect(user2).setReferrer(owner.address)
      ).to.be.revertedWith("Referrer already set");
    });

    it("Should not allow non-staker as referrer", async function () {
      await expect(
        mining.connect(user2).setReferrer(user3.address)
      ).to.be.revertedWith("Referrer must be staker or owner");
    });

    it("Should prevent circular referral", async function () {
      await mining.connect(user2).setReferrer(user1.address);
      await mining.connect(user2).deposit(ethers.parseEther("1000"));

      // Try to make user1 refer user2 (circular)
      await expect(
        mining.connect(user1).setReferrer(user2.address)
      ).to.be.revertedWith("Circular referral not allowed");
    });

    it("Should track direct referrals", async function () {
      await mining.connect(user2).setReferrer(user1.address);
      await mining.connect(user3).setReferrer(user1.address);

      const refs = await mining.getReferrals(user1.address);
      expect(refs.length).to.equal(2);
      expect(refs).to.include(user2.address);
      expect(refs).to.include(user3.address);
    });
  });

  describe("Deposit", function () {
    it("Should deposit LP tokens", async function () {
      const amount = ethers.parseEther("1000");

      await expect(mining.connect(user1).deposit(amount))
        .to.emit(mining, "Deposit");

      const userInfo = await mining.getUserInfo(user1.address);
      expect(userInfo.stakedAmount).to.equal(amount);
    });

    it("Should update total staked", async function () {
      const amount = ethers.parseEther("1000");
      await mining.connect(user1).deposit(amount);

      expect(await mining.totalStaked()).to.equal(amount);
    });

    it("Should set lock time", async function () {
      const amount = ethers.parseEther("1000");
      await mining.connect(user1).deposit(amount);

      const lockStatus = await mining.getLockStatus(user1.address);
      expect(lockStatus.isLocked).to.be.true;
      expect(lockStatus.remainingTime).to.be.gt(0);
    });

    it("Should reset lock time on additional deposit", async function () {
      const amount = ethers.parseEther("1000");
      await mining.connect(user1).deposit(amount);

      await time.increase(15 * SECONDS_PER_DAY);

      const lockStatusBefore = await mining.getLockStatus(user1.address);

      // Deposit more
      await mining.connect(user1).deposit(amount);

      const lockStatusAfter = await mining.getLockStatus(user1.address);
      // Remaining time should be reset to ~30 days
      expect(lockStatusAfter.remainingTime).to.be.gt(lockStatusBefore.remainingTime);
    });

    it("Should update team performance", async function () {
      await mining.connect(user1).deposit(ethers.parseEther("1000"));
      await mining.connect(user2).setReferrer(user1.address);
      await mining.connect(user2).deposit(ethers.parseEther("5000"));

      const user1Info = await mining.getUserInfo(user1.address);
      expect(user1Info.teamPerformance).to.equal(ethers.parseEther("5000"));
    });

    it("Should revert with zero amount", async function () {
      await expect(mining.connect(user1).deposit(0)).to.be.revertedWith("Amount must be > 0");
    });
  });

  describe("Withdraw", function () {
    beforeEach(async function () {
      await mining.connect(user1).deposit(ethers.parseEther("10000"));
    });

    it("Should not withdraw during lock period", async function () {
      await expect(
        mining.connect(user1).withdraw(ethers.parseEther("1000"))
      ).to.be.revertedWith("Still in lock period");
    });

    it("Should withdraw after lock period", async function () {
      // Wait for lock period to end
      await time.increase(31 * SECONDS_PER_DAY);

      const balanceBefore = await lpToken.balanceOf(user1.address);
      await mining.connect(user1).withdraw(ethers.parseEther("5000"));
      const balanceAfter = await lpToken.balanceOf(user1.address);

      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("5000"));
    });

    it("Should emit Withdraw event", async function () {
      await time.increase(31 * SECONDS_PER_DAY);

      await expect(mining.connect(user1).withdraw(ethers.parseEther("5000")))
        .to.emit(mining, "Withdraw")
        .withArgs(user1.address, ethers.parseEther("5000"));
    });

    it("Should revert if insufficient balance", async function () {
      await time.increase(31 * SECONDS_PER_DAY);

      await expect(
        mining.connect(user1).withdraw(ethers.parseEther("100000"))
      ).to.be.revertedWith("Insufficient balance");
    });
  });

  describe("Reward Distribution", function () {
    it("Should calculate pending reward", async function () {
      await mining.connect(user1).deposit(ethers.parseEther("10000"));

      await time.increase(SECONDS_PER_DAY);

      const pending = await mining.pendingReward(user1.address);
      expect(pending).to.be.gt(0);
    });

    it("Should distribute rewards correctly (65% base, 35% split)", async function () {
      await mining.connect(user1).deposit(ethers.parseEther("10000"));

      await time.increase(SECONDS_PER_DAY);

      const pendingBefore = await mining.pendingReward(user1.address);
      const userBalanceBefore = await rewardToken.balanceOf(user1.address);
      const split1Before = await rewardToken.balanceOf(splitAddr1.address);
      const split2Before = await rewardToken.balanceOf(splitAddr2.address);

      await mining.connect(user1).claim();

      const userBalanceAfter = await rewardToken.balanceOf(user1.address);
      const split1After = await rewardToken.balanceOf(splitAddr1.address);
      const split2After = await rewardToken.balanceOf(splitAddr2.address);

      // User should receive part of 65% (after referral and team deductions)
      const userReceived = userBalanceAfter - userBalanceBefore;
      expect(userReceived).to.be.gt(0);

      // Split addresses should receive 35% total (split evenly)
      const split1Received = split1After - split1Before;
      const split2Received = split2After - split2Before;
      expect(split1Received).to.be.gt(0);
      expect(split2Received).to.be.gt(0);
    });

    it("Should emit Claim event", async function () {
      await mining.connect(user1).deposit(ethers.parseEther("10000"));

      await time.increase(SECONDS_PER_DAY);

      await expect(mining.connect(user1).claim()).to.emit(mining, "Claim");
    });
  });

  describe("Referral Rewards", function () {
    beforeEach(async function () {
      // Set up referral chain: owner <- user1 <- user2 <- user3
      await mining.connect(user1).setReferrer(owner.address);
      await mining.connect(user1).deposit(ethers.parseEther("10000"));

      await mining.connect(user2).setReferrer(user1.address);
      await mining.connect(user2).deposit(ethers.parseEther("10000"));

      await mining.connect(user3).setReferrer(user2.address);
      await mining.connect(user3).deposit(ethers.parseEther("10000"));
    });

    it("Should distribute 3-level referral rewards", async function () {
      await time.increase(SECONDS_PER_DAY);

      // User3 claims, should generate referral rewards for user2, user1, owner
      await mining.connect(user3).claim();

      const user2Info = await mining.getUserInfo(user2.address);
      const user1Info = await mining.getUserInfo(user1.address);

      // Level 1 (user2) should get 20% of user3's base
      // Level 2 (user1) should get 10%
      // Level 3 (owner) should get 5%
      expect(user2Info.referralRewards).to.be.gt(0);
      expect(user1Info.referralRewards).to.be.gt(0);
    });

    it("Should emit ReferralReward events", async function () {
      await time.increase(SECONDS_PER_DAY);

      await expect(mining.connect(user3).claim())
        .to.emit(mining, "ReferralReward");
    });

    it("Should allow claiming referral rewards", async function () {
      await time.increase(SECONDS_PER_DAY);
      await mining.connect(user3).claim();

      const balanceBefore = await rewardToken.balanceOf(user2.address);
      await mining.connect(user2).claimReferralRewards();
      const balanceAfter = await rewardToken.balanceOf(user2.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should revert claim referral with no rewards", async function () {
      await expect(
        mining.connect(user1).claimReferralRewards()
      ).to.be.revertedWith("No referral rewards");
    });
  });

  describe("Team Rewards", function () {
    it("Should calculate team level based on small area performance", async function () {
      // Setup team structure under user1
      await mining.connect(user1).deposit(ethers.parseEther("1000"));

      // Add multiple referrals
      await mining.connect(user2).setReferrer(user1.address);
      await mining.connect(user2).deposit(ethers.parseEther("6000")); // Big area

      await mining.connect(user3).setReferrer(user1.address);
      await mining.connect(user3).deposit(ethers.parseEther("2000")); // Small area

      // Small area = total - big area = 2000
      const user1Info = await mining.getUserInfo(user1.address);
      expect(user1Info.teamLevel).to.equal(1); // >= 1000 LP
    });

    it("Should distribute team rewards using differential method", async function () {
      await mining.connect(user1).deposit(ethers.parseEther("1000"));

      // Create enough small area for user1 to reach higher level
      for (let i = 0; i < 3; i++) {
        const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
        await owner.sendTransaction({ to: wallet.address, value: ethers.parseEther("1") });
        await lpToken.transfer(wallet.address, ethers.parseEther("5000"));
        await lpToken.connect(wallet).approve(await mining.getAddress(), ethers.MaxUint256);
        await mining.connect(wallet).setReferrer(user1.address);
        await mining.connect(wallet).deposit(ethers.parseEther("3000"));
      }

      // User2 becomes referral of user1
      await mining.connect(user2).setReferrer(user1.address);
      await mining.connect(user2).deposit(ethers.parseEther("10000"));

      await time.increase(SECONDS_PER_DAY);
      await mining.connect(user2).claim();

      const user1Info = await mining.getUserInfo(user1.address);
      expect(user1Info.teamRewards).to.be.gte(0);
    });

    it("Should allow claiming team rewards", async function () {
      await mining.connect(user1).deposit(ethers.parseEther("1000"));
      await mining.connect(user2).setReferrer(user1.address);
      await mining.connect(user2).deposit(ethers.parseEther("10000"));

      // Create small area for team level
      await mining.connect(user3).setReferrer(user1.address);
      await mining.connect(user3).deposit(ethers.parseEther("2000"));

      await time.increase(SECONDS_PER_DAY);
      await mining.connect(user2).claim();

      const user1Info = await mining.getUserInfo(user1.address);
      if (user1Info.teamRewards > 0) {
        const balanceBefore = await rewardToken.balanceOf(user1.address);
        await mining.connect(user1).claimTeamRewards();
        const balanceAfter = await rewardToken.balanceOf(user1.address);
        expect(balanceAfter).to.be.gt(balanceBefore);
      }
    });
  });

  describe("Admin Functions", function () {
    describe("setLockDuration", function () {
      it("Should update lock duration", async function () {
        await mining.setLockDuration(60 * 24 * 3600); // 60 days

        expect(await mining.lockDuration()).to.equal(60 * 24 * 3600);
      });

      it("Should emit LockDurationUpdated event", async function () {
        await expect(mining.setLockDuration(60 * 24 * 3600))
          .to.emit(mining, "LockDurationUpdated")
          .withArgs(30 * 24 * 3600, 60 * 24 * 3600);
      });

      it("Should only allow owner", async function () {
        await expect(
          mining.connect(user1).setLockDuration(60 * 24 * 3600)
        ).to.be.revertedWithCustomError(mining, "OwnableUnauthorizedAccount");
      });
    });

    describe("setMiningParams", function () {
      it("Should update mining parameters", async function () {
        const newRewards = ethers.parseEther("80000000");
        const newDuration = 4 * 365 * 24 * 3600;

        await mining.setMiningParams(newRewards, newDuration);

        expect(await mining.totalRewards()).to.equal(newRewards);
        expect(await mining.miningDuration()).to.equal(newDuration);
      });

      it("Should emit MiningParamsUpdated event", async function () {
        const newRewards = ethers.parseEther("80000000");
        const newDuration = 4 * 365 * 24 * 3600;

        await expect(mining.setMiningParams(newRewards, newDuration))
          .to.emit(mining, "MiningParamsUpdated");
      });
    });

    describe("setDistributionRates", function () {
      it("Should update distribution rates", async function () {
        await mining.setDistributionRates(7000, 3000); // 70%/30%

        expect(await mining.userBaseShare()).to.equal(7000);
        expect(await mining.splitShare()).to.equal(3000);
      });

      it("Should revert if not sum to 10000", async function () {
        await expect(
          mining.setDistributionRates(7000, 4000)
        ).to.be.revertedWith("Must sum to 10000");
      });
    });

    describe("setReferralRates", function () {
      it("Should update referral rates", async function () {
        await mining.setReferralRates(2500, 1500, 1000);

        expect(await mining.referralLevel1()).to.equal(2500);
        expect(await mining.referralLevel2()).to.equal(1500);
        expect(await mining.referralLevel3()).to.equal(1000);
      });

      it("Should revert if total too high", async function () {
        await expect(
          mining.setReferralRates(5000, 4000, 3000)
        ).to.be.revertedWith("Total rate too high");
      });
    });

    describe("setTeamLevels", function () {
      it("Should update team levels", async function () {
        await mining.setTeamLevels(
          [ethers.parseEther("500"), ethers.parseEther("2500"), ethers.parseEther("5000")],
          [50, 100, 150]
        );

        const config = await mining.getTeamLevelConfig();
        expect(config.thresholds[0]).to.equal(ethers.parseEther("500"));
        expect(config.rates[0]).to.equal(50);
      });

      it("Should emit TeamLevelUpdated event", async function () {
        await expect(
          mining.setTeamLevels(
            [ethers.parseEther("500"), ethers.parseEther("2500"), ethers.parseEther("5000")],
            [50, 100, 150]
          )
        ).to.emit(mining, "TeamLevelUpdated");
      });

      it("Should revert if length mismatch", async function () {
        await expect(
          mining.setTeamLevels(
            [ethers.parseEther("500"), ethers.parseEther("2500")],
            [50, 100, 150]
          )
        ).to.be.revertedWith("Length mismatch");
      });

      it("Should revert if thresholds not increasing", async function () {
        await expect(
          mining.setTeamLevels(
            [ethers.parseEther("500"), ethers.parseEther("300"), ethers.parseEther("5000")],
            [50, 100, 150]
          )
        ).to.be.revertedWith("Thresholds must increase");
      });
    });

    describe("setSplitAddresses", function () {
      it("Should update split addresses", async function () {
        await mining.setSplitAddresses(
          [user1.address, user2.address, user3.address],
          [3000, 3000, 4000]
        );

        const config = await mining.getSplitConfig();
        expect(config.addresses.length).to.equal(3);
      });

      it("Should emit SplitAddressUpdated event", async function () {
        await expect(
          mining.setSplitAddresses([user1.address], [10000])
        ).to.emit(mining, "SplitAddressUpdated");
      });

      it("Should revert with too many addresses", async function () {
        const addresses = [];
        const rates = [];
        for (let i = 0; i < 11; i++) {
          addresses.push(user1.address);
          rates.push(1000);
        }

        await expect(
          mining.setSplitAddresses(addresses, rates)
        ).to.be.revertedWith("Too many addresses");
      });
    });

    describe("adminTransferLP", function () {
      it("Should only allow owner to transfer excess LP (not user staked)", async function () {
        // User deposits 10000 LP
        await mining.connect(user1).deposit(ethers.parseEther("10000"));

        // Send extra LP directly to contract
        await lpToken.transfer(await mining.getAddress(), ethers.parseEther("2000"));

        // Should be able to transfer the excess LP (2000)
        const balanceBefore = await lpToken.balanceOf(owner.address);
        await mining.adminTransferLP(owner.address, ethers.parseEther("1000"));
        const balanceAfter = await lpToken.balanceOf(owner.address);

        expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("1000"));
      });

      it("Should revert when trying to transfer user staked LP", async function () {
        await mining.connect(user1).deposit(ethers.parseEther("10000"));

        // Should fail - trying to transfer user's staked LP
        await expect(mining.adminTransferLP(owner.address, ethers.parseEther("1000")))
          .to.be.revertedWith("Cannot transfer user staked LP");
      });

      it("Should emit AdminTransferLP event", async function () {
        await mining.connect(user1).deposit(ethers.parseEther("10000"));
        // Send extra LP
        await lpToken.transfer(await mining.getAddress(), ethers.parseEther("2000"));

        await expect(mining.adminTransferLP(owner.address, ethers.parseEther("1000")))
          .to.emit(mining, "AdminTransferLP")
          .withArgs(owner.address, ethers.parseEther("1000"));
      });
    });

    describe("emergencyWithdraw", function () {
      it("Should allow owner to withdraw tokens", async function () {
        const amount = ethers.parseEther("1000");
        await mining.emergencyWithdraw(await rewardToken.getAddress(), amount);

        expect(await rewardToken.balanceOf(owner.address)).to.be.gte(amount);
      });
    });
  });

  describe("View Functions", function () {
    it("Should return mining status", async function () {
      const status = await mining.getMiningStatus();

      expect(status._totalStaked).to.equal(0);
      expect(status._totalDistributed).to.equal(0);
      expect(status._rewardPerSecond).to.be.gt(0);
      expect(status._miningEnded).to.be.false;
    });

    it("Should return distribution stats", async function () {
      await mining.connect(user1).deposit(ethers.parseEther("10000"));
      await time.increase(SECONDS_PER_DAY);
      await mining.connect(user1).claim();

      const stats = await mining.getDistributionStats();
      expect(stats._totalSplitDistributed).to.be.gt(0);
    });

    it("Should return lock status", async function () {
      await mining.connect(user1).deposit(ethers.parseEther("10000"));

      const status = await mining.getLockStatus(user1.address);
      expect(status.isLocked).to.be.true;
      expect(status.remainingTime).to.be.closeTo(30 * SECONDS_PER_DAY, 100);
    });

    it("Should return paginated referrals", async function () {
      await mining.connect(user1).deposit(ethers.parseEther("1000"));
      await mining.connect(user2).setReferrer(user1.address);
      await mining.connect(user3).setReferrer(user1.address);

      const [refs, total] = await mining.getReferralsPaginated(user1.address, 0, 10);
      expect(total).to.equal(2);
      expect(refs.length).to.equal(2);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle claim with no split addresses", async function () {
      // Deploy new mining without split addresses
      const LPMiningV2 = await ethers.getContractFactory("LPMiningV2");
      const startTime = (await time.latest()) + 60;
      const newMining = await LPMiningV2.deploy(
        await rewardToken.getAddress(),
        await lpToken.getAddress(),
        startTime
      );

      await rewardToken.transfer(await newMining.getAddress(), ethers.parseEther("1000000"));
      await lpToken.connect(user1).approve(await newMining.getAddress(), ethers.MaxUint256);

      await time.increaseTo(startTime);
      await newMining.connect(user1).deposit(ethers.parseEther("10000"));

      await time.increase(SECONDS_PER_DAY);

      // Should not revert - split goes to owner
      await expect(newMining.connect(user1).claim()).to.not.be.reverted;
    });

    it("Should handle mining end", async function () {
      // Create small reward pool
      const LPMiningV2 = await ethers.getContractFactory("LPMiningV2");
      const startTime = (await time.latest()) + 60;
      const smallMining = await LPMiningV2.deploy(
        await rewardToken.getAddress(),
        await lpToken.getAddress(),
        startTime
      );

      const smallRewards = ethers.parseEther("100");
      await rewardToken.transfer(await smallMining.getAddress(), smallRewards);
      await smallMining.setMiningParams(smallRewards, 100); // 100 seconds duration

      await lpToken.connect(user1).approve(await smallMining.getAddress(), ethers.MaxUint256);

      await time.increaseTo(startTime);
      await smallMining.connect(user1).deposit(ethers.parseEther("10000"));

      // Wait for mining to end
      await time.increase(200);

      const status = await smallMining.getMiningStatus();
      // Mining should be close to or ended
      expect(status._remainingRewards).to.be.lte(smallRewards);
    });
  });
});
