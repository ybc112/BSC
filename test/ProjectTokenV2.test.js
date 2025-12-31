const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ProjectTokenV2", function () {
  let token;
  let owner;
  let feeReceiver;
  let user1;
  let user2;
  let pair;

  const TOTAL_SUPPLY = ethers.parseEther("100000000"); // 1亿
  const FEE_BASE = 10000n;

  beforeEach(async function () {
    [owner, feeReceiver, user1, user2, pair] = await ethers.getSigners();

    const ProjectTokenV2 = await ethers.getContractFactory("ProjectTokenV2");
    token = await ProjectTokenV2.deploy("Project Token V2", "PTKV2", feeReceiver.address);
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should have correct name and symbol", async function () {
      expect(await token.name()).to.equal("Project Token V2");
      expect(await token.symbol()).to.equal("PTKV2");
    });

    it("Should have correct total supply", async function () {
      expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
    });

    it("Should mint total supply to owner", async function () {
      expect(await token.balanceOf(owner.address)).to.equal(TOTAL_SUPPLY);
    });

    it("Should set fee receiver correctly", async function () {
      const feeConfig = await token.getFeeConfig();
      expect(feeConfig._feeReceiver).to.equal(feeReceiver.address);
    });

    it("Should set default fees correctly", async function () {
      expect(await token.buyFee()).to.equal(0);
      expect(await token.sellFee()).to.equal(280); // 2.8%
    });

    it("Should exclude owner and feeReceiver from fee", async function () {
      expect(await token.isExcludedFromFee(owner.address)).to.be.true;
      expect(await token.isExcludedFromFee(feeReceiver.address)).to.be.true;
    });

    it("Should revert with zero fee receiver", async function () {
      const ProjectTokenV2 = await ethers.getContractFactory("ProjectTokenV2");
      await expect(
        ProjectTokenV2.deploy("Token", "TKN", ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid fee receiver");
    });
  });

  describe("Transfer without slippage", function () {
    it("Should transfer full amount between regular users (no pair)", async function () {
      const amount = ethers.parseEther("1000");
      await token.transfer(user1.address, amount);

      // user1 to user2 (no pair involved)
      await token.connect(user1).transfer(user2.address, amount);
      expect(await token.balanceOf(user2.address)).to.equal(amount);
    });

    it("Should transfer without fee from excluded address", async function () {
      const amount = ethers.parseEther("1000");
      // owner is excluded
      await token.transfer(user1.address, amount);
      expect(await token.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should transfer without fee to excluded address", async function () {
      const amount = ethers.parseEther("1000");
      await token.transfer(user1.address, amount);

      // exclude user2
      await token.setExcludedFromFee(user2.address, true);

      // user1 to user2 (user2 excluded)
      await token.connect(user1).transfer(user2.address, amount);
      expect(await token.balanceOf(user2.address)).to.equal(amount);
    });
  });

  describe("Sell slippage", function () {
    beforeEach(async function () {
      // Set pair address
      await token.setPair(pair.address, true);

      // Transfer tokens to user1
      const amount = ethers.parseEther("10000");
      await token.transfer(user1.address, amount);
    });

    it("Should charge sell fee when transferring to pair", async function () {
      const amount = ethers.parseEther("1000");
      const expectedFee = (amount * 280n) / FEE_BASE; // 2.8%
      const expectedReceive = amount - expectedFee;

      const feeReceiverBalanceBefore = await token.balanceOf(feeReceiver.address);

      await token.connect(user1).transfer(pair.address, amount);

      expect(await token.balanceOf(pair.address)).to.equal(expectedReceive);
      expect(await token.balanceOf(feeReceiver.address)).to.equal(
        feeReceiverBalanceBefore + expectedFee
      );
    });

    it("Should emit FeeCollected event on sell", async function () {
      const amount = ethers.parseEther("1000");
      const expectedFee = (amount * 280n) / FEE_BASE;

      await expect(token.connect(user1).transfer(pair.address, amount))
        .to.emit(token, "FeeCollected")
        .withArgs(user1.address, pair.address, expectedFee, true);
    });

    it("Should calculate sell amount correctly", async function () {
      const amount = ethers.parseEther("1000");
      const [feeAmount, receiveAmount] = await token.calculateSellAmount(amount);

      expect(feeAmount).to.equal((amount * 280n) / FEE_BASE);
      expect(receiveAmount).to.equal(amount - feeAmount);
    });
  });

  describe("Buy slippage (0%)", function () {
    beforeEach(async function () {
      await token.setPair(pair.address, true);
      // Transfer tokens to pair (simulating liquidity)
      await token.transfer(pair.address, ethers.parseEther("100000"));
    });

    it("Should not charge fee when buying (transferring from pair)", async function () {
      const amount = ethers.parseEther("1000");

      // Simulate buy: pair transfers to user
      await token.connect(pair).transfer(user1.address, amount);

      expect(await token.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should calculate buy amount correctly (0 fee)", async function () {
      const amount = ethers.parseEther("1000");
      const [feeAmount, receiveAmount] = await token.calculateBuyAmount(amount);

      expect(feeAmount).to.equal(0);
      expect(receiveAmount).to.equal(amount);
    });
  });

  describe("TransferFrom with slippage", function () {
    beforeEach(async function () {
      await token.setPair(pair.address, true);
      await token.transfer(user1.address, ethers.parseEther("10000"));
    });

    it("Should charge sell fee on transferFrom to pair", async function () {
      const amount = ethers.parseEther("1000");
      const expectedFee = (amount * 280n) / FEE_BASE;
      const expectedReceive = amount - expectedFee;

      // User1 approves user2
      await token.connect(user1).approve(user2.address, amount);

      // User2 transfers from user1 to pair (sell)
      await token.connect(user2).transferFrom(user1.address, pair.address, amount);

      expect(await token.balanceOf(pair.address)).to.equal(expectedReceive);
    });

    it("Should deduct full amount from allowance", async function () {
      const amount = ethers.parseEther("1000");
      const approvedAmount = ethers.parseEther("2000");

      await token.connect(user1).approve(user2.address, approvedAmount);
      await token.connect(user2).transferFrom(user1.address, pair.address, amount);

      // Allowance should decrease by full amount, not receive amount
      expect(await token.allowance(user1.address, user2.address)).to.equal(
        approvedAmount - amount
      );
    });
  });

  describe("Admin Functions", function () {
    describe("setPair", function () {
      it("Should set pair address", async function () {
        await token.setPair(pair.address, true);
        expect(await token.isPair(pair.address)).to.be.true;
      });

      it("Should emit PairUpdated event", async function () {
        await expect(token.setPair(pair.address, true))
          .to.emit(token, "PairUpdated")
          .withArgs(pair.address, true);
      });

      it("Should revert with zero address", async function () {
        await expect(token.setPair(ethers.ZeroAddress, true)).to.be.revertedWith(
          "Invalid pair address"
        );
      });

      it("Should only allow owner", async function () {
        await expect(
          token.connect(user1).setPair(pair.address, true)
        ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
      });
    });

    describe("setPairsBatch", function () {
      it("Should set multiple pairs at once", async function () {
        await token.setPairsBatch([pair.address, user2.address], true);
        expect(await token.isPair(pair.address)).to.be.true;
        expect(await token.isPair(user2.address)).to.be.true;
      });
    });

    describe("setFees", function () {
      it("Should set new fees", async function () {
        await token.setFees(100, 500); // 1% buy, 5% sell
        expect(await token.buyFee()).to.equal(100);
        expect(await token.sellFee()).to.equal(500);
      });

      it("Should emit FeesUpdated event", async function () {
        await expect(token.setFees(100, 500))
          .to.emit(token, "FeesUpdated")
          .withArgs(100, 500);
      });

      it("Should revert if buy fee too high", async function () {
        await expect(token.setFees(1001, 500)).to.be.revertedWith("Buy fee too high");
      });

      it("Should revert if sell fee too high", async function () {
        await expect(token.setFees(100, 1001)).to.be.revertedWith("Sell fee too high");
      });
    });

    describe("setFeeReceiver", function () {
      it("Should set new fee receiver", async function () {
        await token.setFeeReceiver(user1.address);
        const feeConfig = await token.getFeeConfig();
        expect(feeConfig._feeReceiver).to.equal(user1.address);
      });

      it("Should auto-exclude new fee receiver from fee", async function () {
        await token.setFeeReceiver(user1.address);
        expect(await token.isExcludedFromFee(user1.address)).to.be.true;
      });

      it("Should emit FeeReceiverUpdated event", async function () {
        await expect(token.setFeeReceiver(user1.address))
          .to.emit(token, "FeeReceiverUpdated")
          .withArgs(feeReceiver.address, user1.address);
      });
    });

    describe("setExcludedFromFee", function () {
      it("Should add/remove address from whitelist", async function () {
        await token.setExcludedFromFee(user1.address, true);
        expect(await token.isExcludedFromFee(user1.address)).to.be.true;

        await token.setExcludedFromFee(user1.address, false);
        expect(await token.isExcludedFromFee(user1.address)).to.be.false;
      });

      it("Should emit ExcludedFromFee event", async function () {
        await expect(token.setExcludedFromFee(user1.address, true))
          .to.emit(token, "ExcludedFromFee")
          .withArgs(user1.address, true);
      });
    });

    describe("setExcludedFromFeeBatch", function () {
      it("Should set multiple addresses at once", async function () {
        await token.setExcludedFromFeeBatch([user1.address, user2.address], true);
        expect(await token.isExcludedFromFee(user1.address)).to.be.true;
        expect(await token.isExcludedFromFee(user2.address)).to.be.true;
      });
    });
  });

  describe("Burn Functions", function () {
    it("Should burn tokens", async function () {
      const burnAmount = ethers.parseEther("1000");
      await token.burn(burnAmount);

      expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY - burnAmount);
      expect(await token.balanceOf(owner.address)).to.equal(TOTAL_SUPPLY - burnAmount);
    });

    it("Should burnFrom with allowance", async function () {
      const burnAmount = ethers.parseEther("1000");
      await token.transfer(user1.address, burnAmount);

      await token.connect(user1).approve(owner.address, burnAmount);
      await token.burnFrom(user1.address, burnAmount);

      expect(await token.balanceOf(user1.address)).to.equal(0);
    });
  });

  describe("View Functions", function () {
    it("Should return correct fee config", async function () {
      const config = await token.getFeeConfig();
      expect(config._buyFee).to.equal(0);
      expect(config._sellFee).to.equal(280);
      expect(config._feeReceiver).to.equal(feeReceiver.address);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero amount transfer", async function () {
      await token.transfer(user1.address, 0);
      expect(await token.balanceOf(user1.address)).to.equal(0);
    });

    it("Should work with maximum fee (10%)", async function () {
      await token.setFees(1000, 1000); // 10% both
      await token.setPair(pair.address, true);
      await token.transfer(user1.address, ethers.parseEther("1000"));

      const amount = ethers.parseEther("100");
      await token.connect(user1).transfer(pair.address, amount);

      const expectedFee = (amount * 1000n) / FEE_BASE;
      expect(await token.balanceOf(pair.address)).to.equal(amount - expectedFee);
    });
  });
});
