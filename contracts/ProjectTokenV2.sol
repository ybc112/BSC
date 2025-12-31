// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ProjectTokenV2
 * @dev 带买卖滑点的项目代币
 *
 * 滑点机制：
 * - 买入：0% 滑点
 * - 卖出：2.8% 滑点（转入指定地址或销毁）
 */
contract ProjectTokenV2 is ERC20, Ownable {
    uint256 public constant TOTAL_SUPPLY = 100_000_000 * 1e18; // 1亿
    uint256 public constant FEE_BASE = 10000;

    // 滑点配置
    uint256 public buyFee = 0;       // 买入滑点：0%
    uint256 public sellFee = 280;    // 卖出滑点：2.8% = 280/10000

    // 滑点接收地址（可以是销毁地址或团队地址）
    address public feeReceiver;

    // DEX交易对地址（用于识别买卖）
    mapping(address => bool) public isPair;

    // 白名单（免滑点）
    mapping(address => bool) public isExcludedFromFee;

    // 事件
    event PairUpdated(address indexed pair, bool status);
    event FeeReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);
    event FeesUpdated(uint256 buyFee, uint256 sellFee);
    event ExcludedFromFee(address indexed account, bool status);
    event FeeCollected(address indexed from, address indexed to, uint256 amount, bool isSell);

    constructor(
        string memory name,
        string memory symbol,
        address _feeReceiver
    ) ERC20(name, symbol) Ownable(msg.sender) {
        require(_feeReceiver != address(0), "Invalid fee receiver");

        feeReceiver = _feeReceiver;

        // 合约部署者和滑点接收地址免滑点
        isExcludedFromFee[msg.sender] = true;
        isExcludedFromFee[_feeReceiver] = true;

        _mint(msg.sender, TOTAL_SUPPLY);
    }

    /**
     * @dev 重写transfer，加入滑点逻辑
     */
    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        address from = _msgSender();
        uint256 finalAmount = _handleFee(from, to, amount);
        _transfer(from, to, finalAmount);
        return true;
    }

    /**
     * @dev 重写transferFrom，加入滑点逻辑
     */
    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        address spender = _msgSender();

        // 先扣除授权额度（使用原始金额）
        _spendAllowance(from, spender, amount);

        // 处理滑点
        uint256 finalAmount = _handleFee(from, to, amount);

        // 执行转账（使用扣除滑点后的金额）
        _transfer(from, to, finalAmount);

        return true;
    }

    /**
     * @dev 处理滑点逻辑
     * @param from 发送方
     * @param to 接收方
     * @param amount 原始金额
     * @return 扣除滑点后的金额
     */
    function _handleFee(address from, address to, uint256 amount) internal returns (uint256) {
        // 白名单地址免滑点
        if (isExcludedFromFee[from] || isExcludedFromFee[to]) {
            return amount;
        }

        uint256 feeAmount = 0;
        bool isSell = false;

        // 判断是买入还是卖出
        if (isPair[from]) {
            // 从交易对转出 = 买入
            feeAmount = amount * buyFee / FEE_BASE;
        } else if (isPair[to]) {
            // 转入交易对 = 卖出
            feeAmount = amount * sellFee / FEE_BASE;
            isSell = true;
        }

        // 扣除滑点
        if (feeAmount > 0) {
            // 将滑点转给接收地址
            _transfer(from, feeReceiver, feeAmount);
            emit FeeCollected(from, to, feeAmount, isSell);
            return amount - feeAmount;
        }

        return amount;
    }

    // ============ 管理员功能 ============

    /**
     * @dev 设置DEX交易对地址
     * @param _pair 交易对地址
     * @param _status 是否为交易对
     */
    function setPair(address _pair, bool _status) external onlyOwner {
        require(_pair != address(0), "Invalid pair address");
        isPair[_pair] = _status;
        emit PairUpdated(_pair, _status);
    }

    /**
     * @dev 批量设置DEX交易对地址
     */
    function setPairsBatch(address[] calldata _pairs, bool _status) external onlyOwner {
        for (uint256 i = 0; i < _pairs.length; i++) {
            require(_pairs[i] != address(0), "Invalid pair address");
            isPair[_pairs[i]] = _status;
            emit PairUpdated(_pairs[i], _status);
        }
    }

    /**
     * @dev 设置滑点接收地址
     */
    function setFeeReceiver(address _feeReceiver) external onlyOwner {
        require(_feeReceiver != address(0), "Invalid fee receiver");
        address oldReceiver = feeReceiver;
        feeReceiver = _feeReceiver;

        // 移除旧接收地址的白名单（如果不是部署者）
        if (oldReceiver != owner()) {
            isExcludedFromFee[oldReceiver] = false;
            emit ExcludedFromFee(oldReceiver, false);
        }

        // 新接收地址自动免滑点
        isExcludedFromFee[_feeReceiver] = true;
        emit ExcludedFromFee(_feeReceiver, true);

        emit FeeReceiverUpdated(oldReceiver, _feeReceiver);
    }

    /**
     * @dev 设置买卖滑点
     * @param _buyFee 买入滑点（基数10000）
     * @param _sellFee 卖出滑点（基数10000）
     */
    function setFees(uint256 _buyFee, uint256 _sellFee) external onlyOwner {
        require(_buyFee <= 1000, "Buy fee too high");   // 最高10%
        require(_sellFee <= 1000, "Sell fee too high"); // 最高10%

        buyFee = _buyFee;
        sellFee = _sellFee;

        emit FeesUpdated(_buyFee, _sellFee);
    }

    /**
     * @dev 设置白名单（免滑点）
     */
    function setExcludedFromFee(address _account, bool _status) external onlyOwner {
        isExcludedFromFee[_account] = _status;
        emit ExcludedFromFee(_account, _status);
    }

    /**
     * @dev 批量设置白名单
     */
    function setExcludedFromFeeBatch(address[] calldata _accounts, bool _status) external onlyOwner {
        for (uint256 i = 0; i < _accounts.length; i++) {
            isExcludedFromFee[_accounts[i]] = _status;
            emit ExcludedFromFee(_accounts[i], _status);
        }
    }

    /**
     * @dev 销毁代币
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /**
     * @dev 从指定地址销毁代币（需要授权）
     */
    function burnFrom(address account, uint256 amount) external {
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
    }

    // ============ 查询函数 ============

    /**
     * @dev 获取滑点配置
     */
    function getFeeConfig() external view returns (
        uint256 _buyFee,
        uint256 _sellFee,
        address _feeReceiver
    ) {
        return (buyFee, sellFee, feeReceiver);
    }

    /**
     * @dev 计算实际到账金额（卖出时）
     */
    function calculateSellAmount(uint256 _amount) external view returns (
        uint256 feeAmount,
        uint256 receiveAmount
    ) {
        feeAmount = _amount * sellFee / FEE_BASE;
        receiveAmount = _amount - feeAmount;
    }

    /**
     * @dev 计算实际到账金额（买入时）
     */
    function calculateBuyAmount(uint256 _amount) external view returns (
        uint256 feeAmount,
        uint256 receiveAmount
    ) {
        feeAmount = _amount * buyFee / FEE_BASE;
        receiveAmount = _amount - feeAmount;
    }
}
