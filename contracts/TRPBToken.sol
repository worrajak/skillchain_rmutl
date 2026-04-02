// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TRPB Token (ใต้ร่มพระบารมี Coin)
 * @dev TRC-20 Token on TRON Network
 *
 * ใช้สำหรับ:
 * - จ่ายค่าจ้างงานผ่าน Escrow
 * - บริจาคกองทุน
 * - รางวัลนักศึกษา
 *
 * อัตรา: 1 TRPB = 1 THB (กำหนดโดยคณะทำงาน)
 */
contract TRPBToken {
    string public name = "TRPB Coin";
    string public symbol = "TRPB";
    uint8 public decimals = 6; // TRON standard
    uint256 public totalSupply;

    address public owner;
    address public feeCollector; // คณะทำงานใต้ร่มพระบารมี

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 value);
    event Burn(address indexed from, uint256 value);
    event FeeCollectorChanged(address indexed newCollector);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(uint256 _initialSupply, address _feeCollector) {
        owner = msg.sender;
        feeCollector = _feeCollector;
        totalSupply = _initialSupply * 10**decimals;
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        require(balanceOf[msg.sender] >= _value, "Insufficient balance");
        require(_to != address(0), "Invalid address");
        balanceOf[msg.sender] -= _value;
        balanceOf[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function approve(address _spender, uint256 _value) public returns (bool) {
        allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        require(balanceOf[_from] >= _value, "Insufficient balance");
        require(allowance[_from][msg.sender] >= _value, "Allowance exceeded");
        require(_to != address(0), "Invalid address");
        balanceOf[_from] -= _value;
        balanceOf[_to] += _value;
        allowance[_from][msg.sender] -= _value;
        emit Transfer(_from, _to, _value);
        return true;
    }

    /// @notice Mint เหรียญใหม่ (เฉพาะ owner)
    function mint(address _to, uint256 _value) public onlyOwner returns (bool) {
        totalSupply += _value;
        balanceOf[_to] += _value;
        emit Mint(_to, _value);
        emit Transfer(address(0), _to, _value);
        return true;
    }

    /// @notice Burn เหรียญ
    function burn(uint256 _value) public returns (bool) {
        require(balanceOf[msg.sender] >= _value, "Insufficient balance");
        balanceOf[msg.sender] -= _value;
        totalSupply -= _value;
        emit Burn(msg.sender, _value);
        emit Transfer(msg.sender, address(0), _value);
        return true;
    }

    /// @notice เปลี่ยน fee collector
    function setFeeCollector(address _newCollector) public onlyOwner {
        feeCollector = _newCollector;
        emit FeeCollectorChanged(_newCollector);
    }

    /// @notice Transfer ownership
    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        owner = _newOwner;
    }
}
