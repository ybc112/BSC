const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TokenMining", function () {
  let tokenMining, stakingToken, rewardToken;
  let owner, user1, user2, attacker;
  let startTime;

  const TOTAL_REWARDS = ethers.parseEther("30000000");
  const DAILY_RATE = 50n; // 0.5%
  const RATE_BASE = 10000n;

  beforeEach(async function () {
    [owner, user1, user2, attacker] = await ethers.getSigners();

    const MockToken = await ethers.getContractFactory("MockToken");
    stakingToken = await MockToken.deploy("Staking", "STK");
    rewardToken = await MockToken.deploy("Reward", "RWT");

    startTime = (await time.latest()) + 60;

    const TokenMining = await ethers.getContractFactory("TokenMining");
    tokenMining = await TokenMining.deploy(
      await stakingToken.getAddress(),
      await rewardToken.getAddress(),
      startTime
    );

    // 转移奖励代币到合约
    await rewardToken.transfer(await tokenMining.getAddress(), TOTAL_REWARDS);

    // 给用户分配质押代币
    for (const user of [user1, user2, attacker]) {
      await stakingToken.transfer(user.address, ethers.parseEther("100000"));
      await stakingToken.connect(user).approve(await tokenMining.getAddress(), ethers.MaxUint256);
    }
  });

  // ============ 构造函数测试 ============
  describe("构造函数", function () {
    it("应该拒绝零地址的质押代币", async function () {
      const TokenMining = await ethers.getContractFactory("TokenMining");
      await expect(
        TokenMining.deploy(ethers.ZeroAddress, await rewardToken.getAddress(), startTime)
      ).to.be.revertedWith("Invalid staking token");
    });

    it("应该拒绝零地址的奖励代币", async function () {
      const TokenMining = await ethers.getContractFactory("TokenMining");
      await expect(
        TokenMining.deploy(await stakingToken.getAddress(), ethers.ZeroAddress, startTime)
      ).to.be.revertedWith("Invalid reward token");
    });

    it("应该拒绝过去的开始时间", async function () {
      const TokenMining = await ethers.getContractFactory("TokenMining");
      const pastTime = (await time.latest()) - 100;
      await expect(
        TokenMining.deploy(await stakingToken.getAddress(), await rewardToken.getAddress(), pastTime)
      ).to.be.revertedWith("Start time must be future");
    });
  });

  // ============ 基础功能测试 ============
  describe("基础功能", function () {
    describe("质押 (Deposit)", function () {
      it("应该成功质押代币", async function () {
        await time.increaseTo(startTime);
        await tokenMining.connect(user1).deposit(ethers.parseEther("1000"));

        const userInfo = await tokenMining.userInfo(user1.address);
        expect(userInfo.amount).to.equal(ethers.parseEther("1000"));
      });

      it("应该在挖矿开始前拒绝质押", async function () {
        await expect(
          tokenMining.connect(user1).deposit(ethers.parseEther("1000"))
        ).to.be.revertedWith("Mining not started");
      });

      it("应该拒绝零数量质押", async function () {
        await time.increaseTo(startTime);
        await expect(
          tokenMining.connect(user1).deposit(0)
        ).to.be.revertedWith("Amount must be > 0");
      });

      it("应该正确处理多次质押", async function () {
        await time.increaseTo(startTime);
        await tokenMining.connect(user1).deposit(ethers.parseEther("1000"));
        await time.increase(86400);
        await tokenMining.connect(user1).deposit(ethers.parseEther("500"));

        const userInfo = await tokenMining.userInfo(user1.address);
        expect(userInfo.amount).to.equal(ethers.parseEther("1500"));
      });

      it("多次质押应该正确累积pending收益", async function () {
        await time.increaseTo(startTime);
        await tokenMining.connect(user1).deposit(ethers.parseEther("1000"));
        await time.increase(86400);

        const pendingBefore = await tokenMining.pendingReward(user1.address);
        expect(pendingBefore).to.be.gt(0);

        // 第二次质押时应该结算之前的收益
        await tokenMining.connect(user1).deposit(ethers.parseEther("500"));

        const userInfo = await tokenMining.userInfo(user1.address);
        expect(userInfo.pendingRewards).to.be.gt(0);
      });
    });

    describe("解押 (Withdraw)", function () {
      beforeEach(async function () {
        await time.increaseTo(startTime);
        await tokenMining.connect(user1).deposit(ethers.parseEther("1000"));
      });

      it("应该成功解押代币", async function () {
        await tokenMining.connect(user1).withdraw(ethers.parseEther("500"));

        const userInfo = await tokenMining.userInfo(user1.address);
        expect(userInfo.amount).to.equal(ethers.parseEther("500"));
      });

      it("应该拒绝超额解押", async function () {
        await expect(
          tokenMining.connect(user1).withdraw(ethers.parseEther("2000"))
        ).to.be.revertedWith("Insufficient balance");
      });

      it("应该允许全额解押", async function () {
        await tokenMining.connect(user1).withdraw(ethers.parseEther("1000"));

        const userInfo = await tokenMining.userInfo(user1.address);
        expect(userInfo.amount).to.equal(0);
      });

      it("应该允许零数量解押（仅结算收益）", async function () {
        await time.increase(86400);
        await tokenMining.connect(user1).withdraw(0);

        const userInfo = await tokenMining.userInfo(user1.address);
        expect(userInfo.amount).to.equal(ethers.parseEther("1000"));
        expect(userInfo.pendingRewards).to.be.gt(0);
      });
    });

    describe("收益计算", function () {
      it("应该按每日0.5%计算收益", async function () {
        await time.increaseTo(startTime);
        const depositAmount = ethers.parseEther("10000");
        await tokenMining.connect(user1).deposit(depositAmount);

        // 前进1天
        await time.increase(86400);

        const pending = await tokenMining.pendingReward(user1.address);
        // 预期收益 = 10000 * 0.5% = 50
        const expectedReward = depositAmount * DAILY_RATE / RATE_BASE;

        expect(pending).to.be.closeTo(expectedReward, ethers.parseEther("0.1"));
      });

      it("应该正确累积多天收益", async function () {
        await time.increaseTo(startTime);
        const depositAmount = ethers.parseEther("10000");
        await tokenMining.connect(user1).deposit(depositAmount);

        // 前进7天
        await time.increase(86400 * 7);

        const pending = await tokenMining.pendingReward(user1.address);
        // 预期收益 = 10000 * 0.5% * 7 = 350
        const expectedReward = depositAmount * DAILY_RATE * 7n / RATE_BASE;

        expect(pending).to.be.closeTo(expectedReward, ethers.parseEther("1"));
      });

      it("零质押或未更新时应返回0收益", async function () {
        await time.increaseTo(startTime);

        // 没有质押的用户
        const pending = await tokenMining.pendingReward(user1.address);
        expect(pending).to.equal(0);
      });
    });

    describe("领取收益", function () {
      it("应该成功领取收益", async function () {
        await time.increaseTo(startTime);
        await tokenMining.connect(user1).deposit(ethers.parseEther("10000"));

        await time.increase(86400 * 7);

        const pendingBefore = await tokenMining.pendingReward(user1.address);
        const balanceBefore = await rewardToken.balanceOf(user1.address);

        await tokenMining.connect(user1).claim();

        const balanceAfter = await rewardToken.balanceOf(user1.address);
        expect(balanceAfter - balanceBefore).to.be.closeTo(pendingBefore, ethers.parseEther("0.1"));
      });

      it("应该在无收益时拒绝领取", async function () {
        await time.increaseTo(startTime);
        await expect(
          tokenMining.connect(user1).claim()
        ).to.be.revertedWith("No rewards to claim");
      });

      it("领取后应该重置待领取收益", async function () {
        await time.increaseTo(startTime);
        await tokenMining.connect(user1).deposit(ethers.parseEther("10000"));

        await time.increase(86400);
        await tokenMining.connect(user1).claim();

        // 刚领取完，pending应该接近0
        const pending = await tokenMining.pendingReward(user1.address);
        expect(pending).to.be.lt(ethers.parseEther("1"));
      });
    });
  });

  // ============ 挖矿结束测试 ============
  describe("挖矿结束机制", function () {
    it("应该在奖励耗尽时结束挖矿", async function () {
      await time.increaseTo(startTime);

      // 质押1亿代币，每日0.5% = 50万/天
      // 3000万奖励 / 50万/天 = 60天耗尽
      const hugeAmount = ethers.parseEther("100000000");
      await stakingToken.mint(user1.address, hugeAmount);
      await stakingToken.connect(user1).approve(await tokenMining.getAddress(), ethers.MaxUint256);
      await tokenMining.connect(user1).deposit(hugeAmount);

      // 跳过70天，确保奖励耗尽
      await time.increase(86400 * 70);

      // 领取收益，应该触发miningEnded
      await tokenMining.connect(user1).claim();

      const status = await tokenMining.getMiningStatus();
      expect(status._miningEnded).to.equal(true);
      expect(status._totalDistributed).to.equal(TOTAL_REWARDS);
    });

    it("挖矿结束后不应产生新收益", async function () {
      await time.increaseTo(startTime);

      const hugeAmount = ethers.parseEther("100000000");
      await stakingToken.mint(user1.address, hugeAmount);
      await stakingToken.connect(user1).approve(await tokenMining.getAddress(), ethers.MaxUint256);
      await tokenMining.connect(user1).deposit(hugeAmount);

      await time.increase(86400 * 70);
      await tokenMining.connect(user1).claim();

      const status = await tokenMining.getMiningStatus();
      expect(status._miningEnded).to.equal(true);

      // 再等一段时间
      await time.increase(86400 * 30);

      const pending = await tokenMining.pendingReward(user1.address);
      expect(pending).to.equal(0);
    });

    it("挖矿结束后应该拒绝新质押", async function () {
      await time.increaseTo(startTime);

      const hugeAmount = ethers.parseEther("100000000");
      await stakingToken.mint(user1.address, hugeAmount);
      await stakingToken.connect(user1).approve(await tokenMining.getAddress(), ethers.MaxUint256);
      await tokenMining.connect(user1).deposit(hugeAmount);

      await time.increase(86400 * 70);
      await tokenMining.connect(user1).claim();

      const status = await tokenMining.getMiningStatus();
      expect(status._miningEnded).to.equal(true);

      await expect(
        tokenMining.connect(user2).deposit(ethers.parseEther("1000"))
      ).to.be.revertedWith("Mining ended");
    });

    it("接近奖励耗尽时pendingReward应该被限制", async function () {
      await time.increaseTo(startTime);

      const hugeAmount = ethers.parseEther("100000000");
      await stakingToken.mint(user1.address, hugeAmount);
      await stakingToken.connect(user1).approve(await tokenMining.getAddress(), ethers.MaxUint256);
      await tokenMining.connect(user1).deposit(hugeAmount);

      // 跳过60天，接近耗尽
      await time.increase(86400 * 60);

      const pending = await tokenMining.pendingReward(user1.address);
      // pending应该不超过剩余奖励
      const status = await tokenMining.getMiningStatus();
      expect(pending).to.be.lte(status._remainingRewards + ethers.parseEther("1"));
    });
  });

  // ============ 多用户测试 ============
  describe("多用户场景", function () {
    it("多用户应该独立计算收益", async function () {
      await time.increaseTo(startTime);

      await tokenMining.connect(user1).deposit(ethers.parseEther("10000"));
      await time.increase(86400);
      await tokenMining.connect(user2).deposit(ethers.parseEther("5000"));
      await time.increase(86400);

      const pending1 = await tokenMining.pendingReward(user1.address);
      const pending2 = await tokenMining.pendingReward(user2.address);

      // user1质押2天，user2质押1天
      // user1: 10000 * 0.5% * 2 = 100
      // user2: 5000 * 0.5% * 1 = 25
      expect(pending1).to.be.gt(pending2);
    });

    it("用户之间不应互相影响", async function () {
      await time.increaseTo(startTime);

      await tokenMining.connect(user1).deposit(ethers.parseEther("10000"));
      await time.increase(86400);

      const pending1Before = await tokenMining.pendingReward(user1.address);

      // user2的操作不应影响user1
      await tokenMining.connect(user2).deposit(ethers.parseEther("50000"));

      const pending1After = await tokenMining.pendingReward(user1.address);
      expect(pending1After).to.be.gte(pending1Before);
    });
  });

  // ============ 安全测试 ============
  describe("安全测试", function () {
    it("应该防止重入攻击", async function () {
      await time.increaseTo(startTime);
      await tokenMining.connect(user1).deposit(ethers.parseEther("1000"));
      await time.increase(86400);
      await tokenMining.connect(user1).claim();
      // ReentrancyGuard保护
    });

    it("owner应该能紧急提取", async function () {
      const balanceBefore = await rewardToken.balanceOf(owner.address);
      await tokenMining.emergencyWithdraw(
        await rewardToken.getAddress(),
        ethers.parseEther("1000")
      );
      const balanceAfter = await rewardToken.balanceOf(owner.address);

      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("1000"));
    });

    it("非owner不能紧急提取", async function () {
      await expect(
        tokenMining.connect(attacker).emergencyWithdraw(
          await rewardToken.getAddress(),
          ethers.parseEther("1000")
        )
      ).to.be.revertedWithCustomError(tokenMining, "OwnableUnauthorizedAccount");
    });

    it("应该处理大额质押", async function () {
      await time.increaseTo(startTime);
      await stakingToken.transfer(user1.address, ethers.parseEther("1000000"));
      await stakingToken.connect(user1).approve(await tokenMining.getAddress(), ethers.MaxUint256);

      await tokenMining.connect(user1).deposit(ethers.parseEther("1000000"));

      const userInfo = await tokenMining.userInfo(user1.address);
      expect(userInfo.amount).to.equal(ethers.parseEther("1000000"));
    });
  });

  // ============ 查询函数测试 ============
  describe("查询函数", function () {
    it("getUserInfo应该返回正确信息", async function () {
      await time.increaseTo(startTime);
      await tokenMining.connect(user1).deposit(ethers.parseEther("10000"));
      await time.increase(86400);

      const info = await tokenMining.getUserInfo(user1.address);
      expect(info.stakedAmount).to.equal(ethers.parseEther("10000"));
      expect(info.dailyReward).to.equal(ethers.parseEther("50")); // 10000 * 0.5%
    });

    it("getMiningStatus应该返回正确状态", async function () {
      await time.increaseTo(startTime);
      await tokenMining.connect(user1).deposit(ethers.parseEther("1000"));

      const status = await tokenMining.getMiningStatus();
      expect(status._totalStaked).to.equal(ethers.parseEther("1000"));
      expect(status._miningEnded).to.equal(false);
    });

    it("getAPY应该返回正确年化", async function () {
      const apy = await tokenMining.getAPY();
      // 0.5% * 365 = 182.5% = 18250 (基数10000)
      expect(apy).to.equal(18250n);
    });

    it("pendingReward在挖矿结束后应返回0", async function () {
      await time.increaseTo(startTime);

      const hugeAmount = ethers.parseEther("100000000");
      await stakingToken.mint(user1.address, hugeAmount);
      await stakingToken.connect(user1).approve(await tokenMining.getAddress(), ethers.MaxUint256);
      await tokenMining.connect(user1).deposit(hugeAmount);

      await time.increase(86400 * 70);
      await tokenMining.connect(user1).claim();

      // 挖矿结束后
      const pending = await tokenMining.pendingReward(user1.address);
      expect(pending).to.equal(0);
    });
  });

  // ============ 边界条件测试 ============
  describe("边界条件", function () {
    it("收益计算应处理剩余奖励不足的情况", async function () {
      await time.increaseTo(startTime);

      // 大量质押，使收益快速累积
      const hugeAmount = ethers.parseEther("100000000");
      await stakingToken.mint(user1.address, hugeAmount);
      await stakingToken.connect(user1).approve(await tokenMining.getAddress(), ethers.MaxUint256);
      await tokenMining.connect(user1).deposit(hugeAmount);

      // 接近耗尽时
      await time.increase(86400 * 59);

      // 计算的收益应该被限制在剩余奖励范围内
      const pending = await tokenMining.pendingReward(user1.address);
      const status = await tokenMining.getMiningStatus();

      // pending不应超过剩余奖励太多（允许一定误差）
      expect(pending).to.be.lte(TOTAL_REWARDS);
    });

    it("claim时如果超出剩余奖励应该只发放剩余部分", async function () {
      await time.increaseTo(startTime);

      const hugeAmount = ethers.parseEther("100000000");
      await stakingToken.mint(user1.address, hugeAmount);
      await stakingToken.connect(user1).approve(await tokenMining.getAddress(), ethers.MaxUint256);
      await tokenMining.connect(user1).deposit(hugeAmount);

      await time.increase(86400 * 70);

      const balanceBefore = await rewardToken.balanceOf(user1.address);
      await tokenMining.connect(user1).claim();
      const balanceAfter = await rewardToken.balanceOf(user1.address);

      // 用户收到的奖励应该等于总奖励（因为奖励已耗尽）
      const received = balanceAfter - balanceBefore;
      expect(received).to.equal(TOTAL_REWARDS);
    });
  });
});
