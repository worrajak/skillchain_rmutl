// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITRC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title JobEscrow — ระบบ Escrow สำหรับ SkillChain
 * @dev ผู้จ้างฝากเงิน → งานเสร็จ → แบ่งจ่ายตาม % อัตโนมัติ
 *
 * โครงสร้าง Fee (งาน PAID):
 *   - นักศึกษา: 85%
 *   - กองทุนกลาง: 5%
 *   - Mentor: 5% (ถ้ามี)
 *   - คณะทำงาน: 5%
 */
contract JobEscrow {
    ITRC20 public trpbToken;
    address public owner;
    address public fundWallet;      // กองทุนกลาง
    address public staffWallet;     // คณะทำงานใต้ร่มฯ

    // Fee basis points (1 bp = 0.01%)
    uint256 public studentFeeBps = 8500;  // 85%
    uint256 public fundFeeBps = 500;      // 5%
    uint256 public mentorFeeBps = 500;    // 5%
    uint256 public staffFeeBps = 500;     // 5%

    struct Escrow {
        bytes32 jobId;
        address employer;
        address student;
        address mentor;       // address(0) ถ้าไม่มี
        uint256 amount;
        bool released;
        bool refunded;
    }

    mapping(bytes32 => Escrow) public escrows;

    event EscrowCreated(bytes32 indexed jobId, address employer, uint256 amount);
    event EscrowReleased(bytes32 indexed jobId, address student, uint256 studentAmount, uint256 fundAmount, uint256 mentorAmount, uint256 staffAmount);
    event EscrowRefunded(bytes32 indexed jobId, address employer, uint256 amount);
    event FeesUpdated(uint256 student, uint256 fund, uint256 mentor, uint256 staff);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _token, address _fundWallet, address _staffWallet) {
        trpbToken = ITRC20(_token);
        owner = msg.sender;
        fundWallet = _fundWallet;
        staffWallet = _staffWallet;
    }

    /// @notice ผู้จ้างฝากเงินเข้า escrow
    function createEscrow(
        bytes32 _jobId,
        address _student,
        address _mentor,
        uint256 _amount
    ) external {
        require(escrows[_jobId].amount == 0, "Escrow exists");
        require(_amount > 0, "Amount must be > 0");

        // โอน TRPB จากผู้จ้างเข้า contract
        require(trpbToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        escrows[_jobId] = Escrow({
            jobId: _jobId,
            employer: msg.sender,
            student: _student,
            mentor: _mentor,
            amount: _amount,
            released: false,
            refunded: false
        });

        emit EscrowCreated(_jobId, msg.sender, _amount);
    }

    /// @notice ปล่อยเงินเมื่องานเสร็จ (เฉพาะ owner/staff)
    function release(bytes32 _jobId) external onlyOwner {
        Escrow storage e = escrows[_jobId];
        require(e.amount > 0, "No escrow");
        require(!e.released && !e.refunded, "Already processed");

        uint256 total = e.amount;
        uint256 toStudent;
        uint256 toFund;
        uint256 toMentor;
        uint256 toStaff;

        if (e.mentor != address(0)) {
            toStudent = (total * studentFeeBps) / 10000;
            toFund = (total * fundFeeBps) / 10000;
            toMentor = (total * mentorFeeBps) / 10000;
            toStaff = total - toStudent - toFund - toMentor;
        } else {
            // ไม่มี Mentor → ส่วนของ mentor กลับเข้า student
            toStudent = (total * (studentFeeBps + mentorFeeBps)) / 10000;
            toFund = (total * fundFeeBps) / 10000;
            toMentor = 0;
            toStaff = total - toStudent - toFund;
        }

        e.released = true;

        trpbToken.transfer(e.student, toStudent);
        trpbToken.transfer(fundWallet, toFund);
        if (toMentor > 0) trpbToken.transfer(e.mentor, toMentor);
        trpbToken.transfer(staffWallet, toStaff);

        emit EscrowReleased(_jobId, e.student, toStudent, toFund, toMentor, toStaff);
    }

    /// @notice คืนเงินผู้จ้าง (กรณี dispute/ยกเลิก)
    function refund(bytes32 _jobId) external onlyOwner {
        Escrow storage e = escrows[_jobId];
        require(e.amount > 0, "No escrow");
        require(!e.released && !e.refunded, "Already processed");

        e.refunded = true;
        trpbToken.transfer(e.employer, e.amount);

        emit EscrowRefunded(_jobId, e.employer, e.amount);
    }

    /// @notice ปรับ % fee (เฉพาะ owner)
    function updateFees(uint256 _student, uint256 _fund, uint256 _mentor, uint256 _staff) external onlyOwner {
        require(_student + _fund + _mentor + _staff == 10000, "Must total 100%");
        studentFeeBps = _student;
        fundFeeBps = _fund;
        mentorFeeBps = _mentor;
        staffFeeBps = _staff;
        emit FeesUpdated(_student, _fund, _mentor, _staff);
    }

    /// @notice ดูยอด escrow
    function getEscrow(bytes32 _jobId) external view returns (Escrow memory) {
        return escrows[_jobId];
    }

    function setFundWallet(address _w) external onlyOwner { fundWallet = _w; }
    function setStaffWallet(address _w) external onlyOwner { staffWallet = _w; }
    function transferOwnership(address _new) external onlyOwner { owner = _new; }
}
