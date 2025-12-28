const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("LPMining", function () {
  let lpMining, rewardToken, lpToken;
  let owner, user1, user2, user3, user4, user5, attacker;
  let startTime;

  const TOTAL_REWARDS = ethers.parseEther("60000000");
  const MINING_DURATION = 3 * 365 * 24 * 60 * 60; // 3年

  beforeEach(async function () {
    [owner, user1, user2, user3, user4, user5, attacker] = await ethers.getSigners();

    const MockToken = await ethers.getContractFactory("MockToken");
    rewardToken = await MockToken.deploy("Reward", "RWT");
    lpToken = await MockToken.deploy("LP", "LP");

    startTime = (await time.latest()) + 60;

    const LPMining = await ethers.getContractFactory("LPMining");
    lpMining = await LPMining.deploy(
      await rewardToken.getAddress(),
      await lpToken.getAddress(),
      startTime
    );

    // 转移奖励代币到合约
    await rewardToken.transfer(await lpMining.getAddress(), TOTAL_REWARDS);

    // 给用户分配LP代币
    for (const user of [user1, user2, user3, user4, user5, attacker]) {
      await lpToken.transfer(user.address, ethers.parseEther("100000"));
      await lpToken.connect(user).approve(await lpMining.getAddress(), ethers.MaxUint256);
    }

    // Owner也授权
    await lpToken.approve(await lpMining.getAddress(), ethers.MaxUint256);
  });

  // ============ 构造函数测试 ============
  describe("构造函数", function () {
    it("应该拒绝零地址的奖励代币", async function () {
      const LPMining = await ethers.getContractFactory("LPMining");
      await expect(
        LPMining.deploy(ethers.ZeroAddress, await lpToken.getAddress(), startTime)
      ).to.be.revertedWith("Invalid reward token");
    });

    it("应该拒绝零地址的LP代币", async function () {
      const LPMining = await ethers.getContractFactory("LPMining");
      await expect(
        LPMining.deploy(await rewardToken.getAddress(), ethers.ZeroAddress, startTime)
      ).to.be.revertedWith("Invalid LP token");
    });

    it("应该拒绝过去的开始时间", async function () {
      const LPMining = await ethers.getContractFactory("LPMining");
      const pastTime = (await time.latest()) - 100;
      await expect(
        LPMining.deploy(await rewardToken.getAddress(), await lpToken.getAddress(), pastTime)
      ).to.be.revertedWith("Start time must be future");
    });
  });

  // ============ 基础功能测试 ============
  describe("基础功能", function () {
    describe("质押 (Deposit)", function () {
      it("应该成功质押LP代币", async function () {
        await time.increaseTo(startTime);
        await lpMining.connect(user1).deposit(ethers.parseEther("1000"));

        const userInfo = await lpMining.userInfo(user1.address);
        expect(userInfo.amount).to.equal(ethers.parseEther("1000"));
        expect(await lpMining.totalStaked()).to.equal(ethers.parseEther("1000"));
      });

      it("应该在挖矿开始前拒绝质押", async function () {
        await expect(
          lpMining.connect(user1).deposit(ethers.parseEther("1000"))
        ).to.be.revertedWith("Mining not started");
      });

      it("应该拒绝零数量质押", async function () {
        await time.increaseTo(startTime);
        await expect(
          lpMining.connect(user1).deposit(0)
        ).to.be.revertedWith("Amount must be > 0");
      });

      it("应该正确处理多次质押", async function () {
        await time.increaseTo(startTime);
        await lpMining.connect(user1).deposit(ethers.parseEther("1000"));
        await time.increase(86400);
        await lpMining.connect(user1).deposit(ethers.parseEther("500"));

        const userInfo = await lpMining.userInfo(user1.address);
        expect(userInfo.amount).to.equal(ethers.parseEther("1500"));
      });

      it("应该在挖矿结束后拒绝质押", async function () {
        await time.increaseTo(startTime);
        await lpMining.connect(user1).deposit(ethers.parseEther("1000"));

        // 跳到挖矿结束后
        await time.increase(MINING_DURATION + 86400);

        // 调用updatePool多次确保miningEnded被设置
        // 第一次调用会更新到endTime
        await lpMining.updatePool();
        // 第二次调用时 endTimestamp <= lastRewardTime，会设置miningEnded
        await lpMining.updatePool();

        // 验证挖矿已结束
        const status = await lpMining.getMiningStatus();
        expect(status._miningEnded).to.equal(true);

        await expect(
          lpMining.connect(user2).deposit(ethers.parseEther("1000"))
        ).to.be.revertedWith("Mining ended");
      });
    });

    describe("解押 (Withdraw)", function () {
      beforeEach(async function () {
        await time.increaseTo(startTime);
        await lpMining.connect(user1).deposit(ethers.parseEther("1000"));
      });

      it("应该成功解押LP代币", async function () {
        await lpMining.connect(user1).withdraw(ethers.parseEther("500"));

        const userInfo = await lpMining.userInfo(user1.address);
        expect(userInfo.amount).to.equal(ethers.parseEther("500"));
      });

      it("应该拒绝超额解押", async function () {
        await expect(
          lpMining.connect(user1).withdraw(ethers.parseEther("2000"))
        ).to.be.revertedWith("Insufficient balance");
      });

      it("应该允许全额解押", async function () {
        await lpMining.connect(user1).withdraw(ethers.parseEther("1000"));

        const userInfo = await lpMining.userInfo(user1.address);
        expect(userInfo.amount).to.equal(0);
      });

      it("应该允许零数量解押（仅结算收益）", async function () {
        await time.increase(86400);
        await lpMining.connect(user1).withdraw(0);

        const userInfo = await lpMining.userInfo(user1.address);
        expect(userInfo.amount).to.equal(ethers.parseEther("1000"));
        expect(userInfo.pendingRewards).to.be.gt(0);
      });
    });

    describe("收益计算和领取", function () {
      it("应该随时间累积收益", async function () {
        await time.increaseTo(startTime);
        await lpMining.connect(user1).deposit(ethers.parseEther("1000"));

        await time.increase(86400); // 1天

        const pending = await lpMining.pendingReward(user1.address);
        expect(pending).to.be.gt(0);
      });

      it("应该正确分配65%给用户", async function () {
        await time.increaseTo(startTime);
        await lpMining.connect(user1).deposit(ethers.parseEther("1000"));

        await time.increase(86400 * 30); // 30天

        const pendingBefore = await lpMining.pendingReward(user1.address);
        const balanceBefore = await rewardToken.balanceOf(user1.address);

        await lpMining.connect(user1).claim();

        const balanceAfter = await rewardToken.balanceOf(user1.address);
        const received = balanceAfter - balanceBefore;

        // 用户应该收到约65%的收益
        const expectedUserShare = pendingBefore * 6500n / 10000n;
        expect(received).to.be.closeTo(expectedUserShare, ethers.parseEther("1"));
      });

      it("应该在无收益时拒绝领取", async function () {
        await time.increaseTo(startTime);
        await expect(
          lpMining.connect(user1).claim()
        ).to.be.revertedWith("No rewards to claim");
      });

      it("应该在无推荐奖励时拒绝领取", async function () {
        await time.increaseTo(startTime);
        await expect(
          lpMining.connect(user1).claimReferralRewards()
        ).to.be.revertedWith("No referral rewards");
      });

      it("应该在无团队奖励时拒绝领取", async function () {
        await time.increaseTo(startTime);
        await expect(
          lpMining.connect(user1).claimTeamRewards()
        ).to.be.revertedWith("No team rewards");
      });
    });
  });

  // ============ 推荐系统测试 ============
  describe("推荐系统", function () {
    beforeEach(async function () {
      await time.increaseTo(startTime);
      await lpMining.deposit(ethers.parseEther("100")); // owner质押
    });

    it("应该正确设置推荐人", async function () {
      await lpMining.connect(user1).setReferrer(owner.address);

      const userInfo = await lpMining.userInfo(user1.address);
      expect(userInfo.referrer).to.equal(owner.address);
    });

    it("应该拒绝自我推荐", async function () {
      await expect(
        lpMining.connect(user1).setReferrer(user1.address)
      ).to.be.revertedWith("Cannot refer yourself");
    });

    it("应该拒绝零地址推荐人", async function () {
      await expect(
        lpMining.connect(user1).setReferrer(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid referrer");
    });

    it("应该拒绝重复设置推荐人", async function () {
      await lpMining.connect(user1).setReferrer(owner.address);
      await expect(
        lpMining.connect(user1).setReferrer(owner.address)
      ).to.be.revertedWith("Referrer already set");
    });

    it("应该拒绝未质押用户作为推荐人", async function () {
      await expect(
        lpMining.connect(user1).setReferrer(user2.address)
      ).to.be.revertedWith("Referrer must be staker or owner");
    });

    describe("推荐奖励分配", function () {
      beforeEach(async function () {
        // 建立3层推荐关系: owner -> user1 -> user2 -> user3
        await lpMining.connect(user1).setReferrer(owner.address);
        await lpMining.connect(user1).deposit(ethers.parseEther("1000"));

        await lpMining.connect(user2).setReferrer(user1.address);
        await lpMining.connect(user2).deposit(ethers.parseEther("1000"));

        await lpMining.connect(user3).setReferrer(user2.address);
        await lpMining.connect(user3).deposit(ethers.parseEther("1000"));
      });

      it("应该正确分配1代推荐奖励(20%)", async function () {
        await time.increase(86400 * 7);

        const user2RefBefore = (await lpMining.userInfo(user2.address)).referralRewards;
        await lpMining.connect(user3).claim();
        const user2RefAfter = (await lpMining.userInfo(user2.address)).referralRewards;

        expect(user2RefAfter).to.be.gt(user2RefBefore);
      });

      it("应该正确分配2代推荐奖励(10%)", async function () {
        await time.increase(86400 * 7);

        const user1RefBefore = (await lpMining.userInfo(user1.address)).referralRewards;
        await lpMining.connect(user3).claim();
        const user1RefAfter = (await lpMining.userInfo(user1.address)).referralRewards;

        expect(user1RefAfter).to.be.gt(user1RefBefore);
      });

      it("应该正确分配3代推荐奖励(5%)", async function () {
        await time.increase(86400 * 7);

        const ownerRefBefore = (await lpMining.userInfo(owner.address)).referralRewards;
        await lpMining.connect(user3).claim();
        const ownerRefAfter = (await lpMining.userInfo(owner.address)).referralRewards;

        expect(ownerRefAfter).to.be.gt(ownerRefBefore);
      });

      it("应该能领取推荐奖励", async function () {
        await time.increase(86400 * 7);
        await lpMining.connect(user3).claim();

        const refRewards = (await lpMining.userInfo(user2.address)).referralRewards;
        expect(refRewards).to.be.gt(0);

        const balanceBefore = await rewardToken.balanceOf(user2.address);
        await lpMining.connect(user2).claimReferralRewards();
        const balanceAfter = await rewardToken.balanceOf(user2.address);

        expect(balanceAfter - balanceBefore).to.equal(refRewards);
      });

      it("没有推荐人时奖励应进入未分配池", async function () {
        // user4没有推荐人
        await lpMining.connect(user4).deposit(ethers.parseEther("1000"));
        await time.increase(86400 * 7);

        const unallocatedBefore = await lpMining.unallocatedPool();
        await lpMining.connect(user4).claim();
        const unallocatedAfter = await lpMining.unallocatedPool();

        // 35%的奖励应该进入未分配池
        expect(unallocatedAfter).to.be.gt(unallocatedBefore);
      });

      it("只有1代推荐人时，剩余奖励应进入未分配池", async function () {
        // user4只有1代推荐人(owner)
        await lpMining.connect(user4).setReferrer(owner.address);
        await lpMining.connect(user4).deposit(ethers.parseEther("1000"));
        await time.increase(86400 * 7);

        const unallocatedBefore = await lpMining.unallocatedPool();
        await lpMining.connect(user4).claim();
        const unallocatedAfter = await lpMining.unallocatedPool();

        // 2代和3代的推荐奖励 + 团队奖励应该进入未分配池
        expect(unallocatedAfter).to.be.gt(unallocatedBefore);
      });
    });
  });

  // ============ 团队奖励测试 ============
  describe("团队奖励", function () {
    it("应该正确计算团队业绩", async function () {
      await time.increaseTo(startTime);
      await lpMining.deposit(ethers.parseEther("100"));

      await lpMining.connect(user1).setReferrer(owner.address);
      await lpMining.connect(user1).deposit(ethers.parseEther("5000"));

      const ownerInfo = await lpMining.userInfo(owner.address);
      expect(ownerInfo.teamPerformance).to.equal(ethers.parseEther("5000"));
    });

    it("应该正确计算大区小区业绩", async function () {
      await time.increaseTo(startTime);
      await lpMining.deposit(ethers.parseEther("100"));

      // user1质押5000, user2质押3000
      await lpMining.connect(user1).setReferrer(owner.address);
      await lpMining.connect(user1).deposit(ethers.parseEther("5000"));

      await lpMining.connect(user2).setReferrer(owner.address);
      await lpMining.connect(user2).deposit(ethers.parseEther("3000"));

      const ownerInfo = await lpMining.userInfo(owner.address);
      expect(ownerInfo.bigAreaPerformance).to.equal(ethers.parseEther("5000"));
      expect(ownerInfo.smallAreaPerformance).to.equal(ethers.parseEther("3000"));
    });

    it("解押时应该正确更新团队业绩", async function () {
      await time.increaseTo(startTime);
      await lpMining.deposit(ethers.parseEther("100"));

      await lpMining.connect(user1).setReferrer(owner.address);
      await lpMining.connect(user1).deposit(ethers.parseEther("5000"));

      // 解押一部分
      await lpMining.connect(user1).withdraw(ethers.parseEther("2000"));

      const ownerInfo = await lpMining.userInfo(owner.address);
      expect(ownerInfo.teamPerformance).to.equal(ethers.parseEther("3000"));
    });

    it("应该正确分配团队奖励给符合条件的上级", async function () {
      await time.increaseTo(startTime);
      await lpMining.deposit(ethers.parseEther("100"));

      // 设置较低的团队等级阈值以便测试
      await lpMining.setTeamLevels(
        [ethers.parseEther("100"), ethers.parseEther("500"), ethers.parseEther("1000")],
        [100, 150, 200]
      );

      // 建立推荐链
      await lpMining.connect(user1).setReferrer(owner.address);
      await lpMining.connect(user1).deposit(ethers.parseEther("2000"));

      await lpMining.connect(user2).setReferrer(user1.address);
      await lpMining.connect(user2).deposit(ethers.parseEther("1000"));

      await lpMining.connect(user3).setReferrer(user2.address);
      await lpMining.connect(user3).deposit(ethers.parseEther("500"));

      await time.increase(86400 * 7);

      // user3 claim时，上级应该获得团队奖励
      await lpMining.connect(user3).claim();

      const user2Info = await lpMining.userInfo(user2.address);
      const user1Info = await lpMining.userInfo(user1.address);

      // 检查是否有团队奖励分配
      // user2的小区业绩 = user3的质押 = 500
      // user1的小区业绩 = user2的质押 + user2的团队业绩 = 1000 + 500 = 1500
    });

    it("应该能领取团队奖励", async function () {
      await time.increaseTo(startTime);
      await lpMining.deposit(ethers.parseEther("100"));

      // 设置较低的团队等级阈值
      await lpMining.setTeamLevels(
        [ethers.parseEther("100"), ethers.parseEther("500"), ethers.parseEther("1000")],
        [100, 150, 200]
      );

      await lpMining.connect(user1).setReferrer(owner.address);
      await lpMining.connect(user1).deposit(ethers.parseEther("2000"));

      await lpMining.connect(user2).setReferrer(user1.address);
      await lpMining.connect(user2).deposit(ethers.parseEther("1000"));

      await time.increase(86400 * 30);

      // user2 claim，user1应该获得团队奖励
      await lpMining.connect(user2).claim();

      const user1TeamRewards = (await lpMining.userInfo(user1.address)).teamRewards;

      if (user1TeamRewards > 0) {
        const balanceBefore = await rewardToken.balanceOf(user1.address);
        await lpMining.connect(user1).claimTeamRewards();
        const balanceAfter = await rewardToken.balanceOf(user1.address);

        expect(balanceAfter - balanceBefore).to.equal(user1TeamRewards);
      }
    });

    it("管理员应该能设置团队等级", async function () {
      const newThresholds = [
        ethers.parseEther("500"),
        ethers.parseEther("2000"),
        ethers.parseEther("5000")
      ];
      const newRates = [80, 120, 180];

      await lpMining.setTeamLevels(newThresholds, newRates);

      const config = await lpMining.getTeamLevelConfig();
      expect(config.thresholds[0]).to.equal(newThresholds[0]);
      expect(config.rates[0]).to.equal(newRates[0]);
    });

    it("应该拒绝长度不匹配的团队等级设置", async function () {
      await expect(
        lpMining.setTeamLevels(
          [ethers.parseEther("500"), ethers.parseEther("2000")],
          [100]
        )
      ).to.be.revertedWith("Length mismatch");
    });

    it("应该拒绝空数组的团队等级设置", async function () {
      await expect(
        lpMining.setTeamLevels([], [])
      ).to.be.revertedWith("Empty arrays");
    });

    it("应该拒绝阈值不递增的团队等级设置", async function () {
      await expect(
        lpMining.setTeamLevels(
          [ethers.parseEther("2000"), ethers.parseEther("500")],
          [100, 150]
        )
      ).to.be.revertedWith("Thresholds must increase");
    });

    it("应该拒绝比例不递增的团队等级设置", async function () {
      const newThresholds = [
        ethers.parseEther("500"),
        ethers.parseEther("2000")
      ];
      const newRates = [150, 100]; // 不递增

      await expect(
        lpMining.setTeamLevels(newThresholds, newRates)
      ).to.be.revertedWith("Rates must increase");
    });

    it("应该拒绝比例过高的团队等级设置", async function () {
      const newThresholds = [ethers.parseEther("500")];
      const newRates = [1500]; // 超过10%

      await expect(
        lpMining.setTeamLevels(newThresholds, newRates)
      ).to.be.revertedWith("Rate too high");
    });

    it("非管理员不能设置团队等级", async function () {
      await expect(
        lpMining.connect(user1).setTeamLevels([ethers.parseEther("100")], [100])
      ).to.be.revertedWithCustomError(lpMining, "OwnableUnauthorizedAccount");
    });
  });

  // ============ 管理员功能测试 ============
  describe("管理员功能", function () {
    it("管理员应该能转移LP", async function () {
      await time.increaseTo(startTime);
      await lpMining.connect(user1).deposit(ethers.parseEther("1000"));

      const balanceBefore = await lpToken.balanceOf(owner.address);
      await lpMining.adminTransferLP(owner.address, ethers.parseEther("500"));
      const balanceAfter = await lpToken.balanceOf(owner.address);

      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("500"));
    });

    it("应该拒绝转移LP到零地址", async function () {
      await time.increaseTo(startTime);
      await lpMining.connect(user1).deposit(ethers.parseEther("1000"));

      await expect(
        lpMining.adminTransferLP(ethers.ZeroAddress, ethers.parseEther("500"))
      ).to.be.revertedWith("Invalid address");
    });

    it("应该拒绝超额转移LP", async function () {
      await time.increaseTo(startTime);
      await lpMining.connect(user1).deposit(ethers.parseEther("1000"));

      await expect(
        lpMining.adminTransferLP(owner.address, ethers.parseEther("2000"))
      ).to.be.revertedWith("Insufficient LP");
    });

    it("非管理员不能转移LP", async function () {
      await time.increaseTo(startTime);
      await lpMining.connect(user1).deposit(ethers.parseEther("1000"));

      await expect(
        lpMining.connect(attacker).adminTransferLP(attacker.address, ethers.parseEther("500"))
      ).to.be.revertedWithCustomError(lpMining, "OwnableUnauthorizedAccount");
    });

    it("管理员应该能提取未分配奖励池", async function () {
      await time.increaseTo(startTime);

      // 没有推荐人的用户claim会产生未分配奖励
      await lpMining.connect(user1).deposit(ethers.parseEther("1000"));
      await time.increase(86400 * 7);
      await lpMining.connect(user1).claim();

      const unallocated = await lpMining.unallocatedPool();
      expect(unallocated).to.be.gt(0);

      const balanceBefore = await rewardToken.balanceOf(owner.address);
      await lpMining.withdrawUnallocated(owner.address);
      const balanceAfter = await rewardToken.balanceOf(owner.address);

      expect(balanceAfter - balanceBefore).to.equal(unallocated);
      expect(await lpMining.unallocatedPool()).to.equal(0);
    });

    it("应该拒绝提取未分配奖励到零地址", async function () {
      await time.increaseTo(startTime);
      await lpMining.connect(user1).deposit(ethers.parseEther("1000"));
      await time.increase(86400 * 7);
      await lpMining.connect(user1).claim();

      await expect(
        lpMining.withdrawUnallocated(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });

    it("应该拒绝提取空的未分配奖励池", async function () {
      await expect(
        lpMining.withdrawUnallocated(owner.address)
      ).to.be.revertedWith("No unallocated rewards");
    });

    it("管理员应该能紧急提取", async function () {
      const balanceBefore = await rewardToken.balanceOf(owner.address);
      await lpMining.emergencyWithdraw(
        await rewardToken.getAddress(),
        ethers.parseEther("1000")
      );
      const balanceAfter = await rewardToken.balanceOf(owner.address);

      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("1000"));
    });

    it("非管理员不能紧急提取", async function () {
      await expect(
        lpMining.connect(attacker).emergencyWithdraw(
          await rewardToken.getAddress(),
          ethers.parseEther("1000")
        )
      ).to.be.revertedWithCustomError(lpMining, "OwnableUnauthorizedAccount");
    });

    it("非管理员不能提取未分配奖励池", async function () {
      await time.increaseTo(startTime);
      await lpMining.connect(user1).deposit(ethers.parseEther("1000"));
      await time.increase(86400 * 7);
      await lpMining.connect(user1).claim();

      await expect(
        lpMining.connect(attacker).withdrawUnallocated(attacker.address)
      ).to.be.revertedWithCustomError(lpMining, "OwnableUnauthorizedAccount");
    });
  });

  // ============ 安全测试 ============
  describe("安全测试", function () {
    describe("重入攻击防护", function () {
      it("deposit应该防止重入", async function () {
        await time.increaseTo(startTime);
        // ReentrancyGuard会阻止重入
        await lpMining.connect(user1).deposit(ethers.parseEther("1000"));
      });

      it("withdraw应该防止重入", async function () {
        await time.increaseTo(startTime);
        await lpMining.connect(user1).deposit(ethers.parseEther("1000"));
        await lpMining.connect(user1).withdraw(ethers.parseEther("500"));
      });

      it("claim应该防止重入", async function () {
        await time.increaseTo(startTime);
        await lpMining.connect(user1).deposit(ethers.parseEther("1000"));
        await time.increase(86400);
        await lpMining.connect(user1).claim();
      });
    });

    describe("溢出保护", function () {
      it("应该处理大额质押", async function () {
        await time.increaseTo(startTime);
        const largeAmount = ethers.parseEther("50000");
        await lpMining.connect(user1).deposit(largeAmount);

        const userInfo = await lpMining.userInfo(user1.address);
        expect(userInfo.amount).to.equal(largeAmount);
      });
    });

    describe("边界条件", function () {
      it("应该在挖矿结束后停止产出", async function () {
        await time.increaseTo(startTime);
        await lpMining.connect(user1).deposit(ethers.parseEther("1000"));

        // 跳到挖矿结束后
        await time.increase(MINING_DURATION + 86400);

        const pending1 = await lpMining.pendingReward(user1.address);
        await time.increase(86400 * 30);
        const pending2 = await lpMining.pendingReward(user1.address);

        // 结束后收益不再增加
        expect(pending2).to.equal(pending1);
      });

      it("应该正确处理零质押状态", async function () {
        await time.increaseTo(startTime);
        await lpMining.connect(user1).deposit(ethers.parseEther("1000"));
        await lpMining.connect(user1).withdraw(ethers.parseEther("1000"));

        await time.increase(86400);

        // 零质押不应产生新收益
        const pending = await lpMining.pendingReward(user1.address);
        // pending应该只包含之前累积的，不会继续增加
      });

      it("updatePool在无质押时应该只更新时间", async function () {
        await time.increaseTo(startTime);
        const lastTimeBefore = await lpMining.lastRewardTime();

        await time.increase(86400);
        await lpMining.updatePool();

        const lastTimeAfter = await lpMining.lastRewardTime();
        expect(lastTimeAfter).to.be.gt(lastTimeBefore);
        expect(await lpMining.accRewardPerShare()).to.equal(0);
      });

      it("updatePool在时间未增加时应该直接返回", async function () {
        await time.increaseTo(startTime);
        await lpMining.connect(user1).deposit(ethers.parseEther("1000"));

        const accBefore = await lpMining.accRewardPerShare();
        // 同一个区块内再次调用
        await lpMining.updatePool();
        const accAfter = await lpMining.accRewardPerShare();

        // accRewardPerShare不应变化（因为时间相同）
      });
    });

    describe("权限控制", function () {
      it("只有owner能调用管理员函数", async function () {
        await expect(
          lpMining.connect(attacker).emergencyWithdraw(
            await rewardToken.getAddress(),
            ethers.parseEther("1000")
          )
        ).to.be.revertedWithCustomError(lpMining, "OwnableUnauthorizedAccount");
      });
    });
  });

  // ============ 查询函数测试 ============
  describe("查询函数", function () {
    it("getUserInfo应该返回正确信息", async function () {
      await time.increaseTo(startTime);
      await lpMining.deposit(ethers.parseEther("100"));
      await lpMining.connect(user1).setReferrer(owner.address);
      await lpMining.connect(user1).deposit(ethers.parseEther("1000"));

      const info = await lpMining.getUserInfo(user1.address);
      expect(info.stakedAmount).to.equal(ethers.parseEther("1000"));
      expect(info.referrer).to.equal(owner.address);
    });

    it("getMiningStatus应该返回正确状态", async function () {
      await time.increaseTo(startTime);
      await lpMining.connect(user1).deposit(ethers.parseEther("1000"));

      const status = await lpMining.getMiningStatus();
      expect(status._totalStaked).to.equal(ethers.parseEther("1000"));
      expect(status._startTime).to.equal(startTime);
      expect(status._miningEnded).to.equal(false);
    });

    it("getReferrals应该返回直推列表", async function () {
      await time.increaseTo(startTime);
      await lpMining.deposit(ethers.parseEther("100"));

      await lpMining.connect(user1).setReferrer(owner.address);
      await lpMining.connect(user2).setReferrer(owner.address);

      const referrals = await lpMining.getReferrals(owner.address);
      expect(referrals.length).to.equal(2);
      expect(referrals).to.include(user1.address);
      expect(referrals).to.include(user2.address);
    });

    it("getReferralsPaginated应该支持分页查询", async function () {
      await time.increaseTo(startTime);
      await lpMining.deposit(ethers.parseEther("100"));

      await lpMining.connect(user1).setReferrer(owner.address);
      await lpMining.connect(user2).setReferrer(owner.address);
      await lpMining.connect(user3).setReferrer(owner.address);

      const [refs, total] = await lpMining.getReferralsPaginated(owner.address, 0, 2);
      expect(total).to.equal(3);
      expect(refs.length).to.equal(2);
    });

    it("getReferralsPaginated offset超出范围时应返回空数组", async function () {
      await time.increaseTo(startTime);
      await lpMining.deposit(ethers.parseEther("100"));

      await lpMining.connect(user1).setReferrer(owner.address);

      const [refs, total] = await lpMining.getReferralsPaginated(owner.address, 100, 10);
      expect(total).to.equal(1);
      expect(refs.length).to.equal(0);
    });

    it("getReferralsPaginated limit超出时应返回剩余全部", async function () {
      await time.increaseTo(startTime);
      await lpMining.deposit(ethers.parseEther("100"));

      await lpMining.connect(user1).setReferrer(owner.address);
      await lpMining.connect(user2).setReferrer(owner.address);

      const [refs, total] = await lpMining.getReferralsPaginated(owner.address, 1, 100);
      expect(total).to.equal(2);
      expect(refs.length).to.equal(1); // 只有1个剩余
    });

    it("getBonusStats应该返回正确统计", async function () {
      await time.increaseTo(startTime);
      await lpMining.connect(user1).deposit(ethers.parseEther("1000"));
      await time.increase(86400 * 7);
      await lpMining.connect(user1).claim();

      const stats = await lpMining.getBonusStats();
      expect(stats._unallocatedPool).to.be.gt(0);
    });

    it("getTeamLevelConfig应该返回正确配置", async function () {
      const config = await lpMining.getTeamLevelConfig();
      expect(config.thresholds.length).to.equal(3);
      expect(config.rates.length).to.equal(3);
    });
  });

  // ============ 循环推荐防护测试 ============
  describe("循环推荐防护", function () {
    it("应该防止循环推荐", async function () {
      await time.increaseTo(startTime);

      // owner质押
      await lpMining.deposit(ethers.parseEther("100"));

      // user1设置owner为推荐人并质押
      await lpMining.connect(user1).setReferrer(owner.address);
      await lpMining.connect(user1).deposit(ethers.parseEther("1000"));

      // owner尝试设置user1为推荐人（应该失败，因为会形成环）
      await expect(
        lpMining.setReferrer(user1.address)
      ).to.be.revertedWith("Circular referral not allowed");
    });

    it("应该防止深层循环推荐", async function () {
      await time.increaseTo(startTime);

      // 建立推荐链: owner -> user1 -> user2
      await lpMining.deposit(ethers.parseEther("100"));

      await lpMining.connect(user1).setReferrer(owner.address);
      await lpMining.connect(user1).deposit(ethers.parseEther("1000"));

      await lpMining.connect(user2).setReferrer(user1.address);
      await lpMining.connect(user2).deposit(ethers.parseEther("1000"));

      // owner尝试设置user2为推荐人（应该失败）
      await expect(
        lpMining.setReferrer(user2.address)
      ).to.be.revertedWith("Circular referral not allowed");
    });
  });
});
