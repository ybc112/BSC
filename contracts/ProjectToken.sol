// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ProjectToken
 * @dev 项目正式代币，总量1亿
 */
contract ProjectToken is ERC20, Ownable {
    uint256 public constant TOTAL_SUPPLY = 100_000_000 * 1e18; // 1亿

    constructor(string memory name, string memory symbol) 
        ERC20(name, symbol) 
        Ownable(msg.sender) 
    {
        _mint(msg.sender, TOTAL_SUPPLY);
    }

    // 如果需要销毁功能
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
