import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  X,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  RotateCcw,
  Terminal,
  ClipboardPaste,
  History,
  Trash2,
  ChevronDown,
  ChevronUp,
  Rocket,
} from 'lucide-react';
import {
  DEFAULT_CONTRACT_ADDRESS,
  DEFAULT_USDT_ADDRESS,
  BSC_TESTNET_RPC,
  BSC_TESTNET_CHAIN_ID,
  MATRIX_ABI,
} from '../contracts/config';

type Language = 'th' | 'en';

interface SavedContractItem {
  address: string;
  usdtAddress?: string;
  label: string;
  savedAt: string;
}

const HISTORY_STORAGE_KEY = 'F27_SAVED_CONTRACTS_HISTORY';

interface QuickContractSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  contractAddress: string;
  usdtAddress: string;
  onUpdateContractAddress: (newContract: string, newUsdt?: string) => Promise<boolean>;
  onResetContractAddress: () => Promise<boolean>;
  onOpenDeployModal?: () => void;
}

export const QuickContractSwitcherModal: React.FC<QuickContractSwitcherModalProps> = ({
  isOpen,
  onClose,
  language,
  contractAddress,
  usdtAddress,
  onUpdateContractAddress,
  onResetContractAddress,
  onOpenDeployModal,
}) => {
  const [inputContract, setInputContract] = useState('');
  const [inputLabel, setInputLabel] = useState('');
  const [inputUsdt, setInputUsdt] = useState(usdtAddress || DEFAULT_USDT_ADDRESS);
  const [showAdvancedUsdt, setShowAdvancedUsdt] = useState(false);
  const [showCliGuide, setShowCliGuide] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [copiedCurrent, setCopiedCurrent] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Live On-Chain Verification state for target/active contract
  const [verifyingAddr, setVerifyingAddr] = useState(false);
  const [chainCheck, setChainCheck] = useState<{
    checkedAddress: string;
    hasBytecode: boolean;
    rank1TotalNodes: number | null;
    rootOwner: string | null;
    error?: string;
  } | null>(null);

  const [savedContracts, setSavedContracts] = useState<SavedContractItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [
      {
        address: DEFAULT_CONTRACT_ADDRESS,
        usdtAddress: DEFAULT_USDT_ADDRESS,
        label: 'สัญญาหลักค่าเริ่มต้น (Default Contract)',
        savedAt: new Date().toISOString(),
      },
    ];
  });

  const saveHistoryToStorage = useCallback((list: SavedContractItem[]) => {
    setSavedContracts(list);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list.slice(0, 12)));
      } catch {
        // ignore
      }
    }
  }, []);

  const addAddressToHistory = useCallback(
    (addr: string, usdt?: string, customLabel?: string) => {
      const cleanAddr = addr.trim();
      if (!ethers.isAddress(cleanAddr)) return;
      const existingIdx = savedContracts.findIndex(
        (item) => item.address.toLowerCase() === cleanAddr.toLowerCase()
      );
      const labelToUse =
        customLabel?.trim() ||
        (existingIdx >= 0 ? savedContracts[existingIdx].label : '') ||
        (cleanAddr.toLowerCase() === DEFAULT_CONTRACT_ADDRESS.toLowerCase()
          ? 'สัญญาหลักค่าเริ่มต้น (Default)'
          : `สัญญาที่บันทึก (${cleanAddr.slice(0, 6)}...${cleanAddr.slice(-4)})`);

      const newItem: SavedContractItem = {
        address: cleanAddr,
        usdtAddress: usdt || usdtAddress || DEFAULT_USDT_ADDRESS,
        label: labelToUse,
        savedAt: new Date().toISOString(),
      };

      const filtered = savedContracts.filter(
        (item) => item.address.toLowerCase() !== cleanAddr.toLowerCase()
      );
      saveHistoryToStorage([newItem, ...filtered]);
    },
    [savedContracts, saveHistoryToStorage, usdtAddress]
  );

  // Verify contract on BSC Testnet
  const verifyContractOnChain = useCallback(async (targetAddr: string) => {
    const clean = targetAddr.trim();
    if (!ethers.isAddress(clean)) {
      setChainCheck(null);
      return;
    }
    setVerifyingAddr(true);
    try {
      const provider = new ethers.JsonRpcProvider(
        BSC_TESTNET_RPC,
        { chainId: BSC_TESTNET_CHAIN_ID, name: 'bnbt' },
        { staticNetwork: true }
      );
      const code = await provider.getCode(clean);
      const hasBytecode = Boolean(code && code !== '0x' && code !== '0x0');
      if (!hasBytecode) {
        setChainCheck({
          checkedAddress: clean,
          hasBytecode: false,
          rank1TotalNodes: null,
          rootOwner: null,
          error: 'ไม่พบ Smart Contract Bytecode ที่ Address นี้บนเครือข่าย BSC Testnet (Chain 97)',
        });
        setVerifyingAddr(false);
        return;
      }

      const contract = new ethers.Contract(clean, MATRIX_ABI, provider);
      const [totalNodesRaw, rootNodeInfo] = await Promise.all([
        contract.getRankTotalNodes(1).catch(() => null),
        contract.getNodeInfo(1, 1).catch(() => null),
      ]);

      const rank1TotalNodes = totalNodesRaw !== null ? Number(totalNodesRaw) : null;
      const rootOwner =
        rootNodeInfo && rootNodeInfo.owner && rootNodeInfo.owner !== ethers.ZeroAddress
          ? String(rootNodeInfo.owner)
          : null;

      setChainCheck({
        checkedAddress: clean,
        hasBytecode: true,
        rank1TotalNodes,
        rootOwner,
      });
    } catch (err: any) {
      setChainCheck({
        checkedAddress: clean,
        hasBytecode: false,
        rank1TotalNodes: null,
        rootOwner: null,
        error: err?.message || 'ไม่สามารถเชื่อมต่อ RPC เพื่อตรวจสอบสัญญาได้',
      });
    } finally {
      setVerifyingAddr(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      setInputUsdt(usdtAddress || DEFAULT_USDT_ADDRESS);
      const targetToVerify =
        inputContract.trim() && ethers.isAddress(inputContract.trim())
          ? inputContract.trim()
          : contractAddress || DEFAULT_CONTRACT_ADDRESS;
      verifyContractOnChain(targetToVerify);
    }
  }, [isOpen, contractAddress, usdtAddress, inputContract, verifyContractOnChain]);

  if (!isOpen) return null;

  const trimmedInput = inputContract.trim();
  const isInputValidAddress = ethers.isAddress(trimmedInput);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const match = text.match(/0x[a-fA-F0-9]{40}/);
        const extracted = match ? match[0] : text.trim();
        setInputContract(extracted);
        setFeedback(null);
      }
    } catch {
      setFeedback({
        type: 'error',
        message:
          language === 'th'
            ? 'กรุณากด Ctrl+V หรือแตะค้างเพื่อวางที่อยู่สัญญาในช่องกรอก'
            : 'Please press Ctrl+V to paste the contract address',
      });
    }
  };

  const handleSaveNewContract = async (overrideAddr?: string, overrideUsdt?: string, overrideLabel?: string) => {
    const targetContract = (overrideAddr ?? trimmedInput).trim();
    const targetUsdt = (overrideUsdt ?? inputUsdt).trim() || DEFAULT_USDT_ADDRESS;

    if (!ethers.isAddress(targetContract)) {
      setFeedback({
        type: 'error',
        message:
          language === 'th'
            ? '❌ รูปแบบที่อยู่ Smart Contract ไม่ถูกต้อง (ต้องขึ้นต้นด้วย 0x และยาว 42 ตัวอักษร)'
            : '❌ Invalid Smart Contract address format (must be 0x... 42 chars)',
      });
      return;
    }

    if (!ethers.isAddress(targetUsdt)) {
      setFeedback({
        type: 'error',
        message:
          language === 'th'
            ? '❌ รูปแบบที่อยู่ USDT Token Address ไม่ถูกต้อง'
            : '❌ Invalid USDT Token address format',
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const ok = await onUpdateContractAddress(targetContract, targetUsdt);
      if (ok) {
        addAddressToHistory(targetContract, targetUsdt, overrideLabel ?? inputLabel);
        setInputContract('');
        setInputLabel('');
        setFeedback({
          type: 'success',
          message:
            language === 'th'
              ? `✅ เปลี่ยนสัญญาเป็น ${targetContract.slice(0, 8)}...${targetContract.slice(-4)} สำเร็จ! ระบบบันทึกลงฐานข้อมูลและซิงก์ผังสายงานใหม่เรียบร้อยแล้ว`
              : `✅ Switched contract to ${targetContract.slice(0, 8)}...${targetContract.slice(-4)} and synced database!`,
        });
        await verifyContractOnChain(targetContract);
      } else {
        setFeedback({
          type: 'error',
          message:
            language === 'th'
              ? '❌ ไม่สามารถบันทึกที่อยู่สัญญาได้ กรุณาตรวจสอบการเชื่อมต่อ'
              : '❌ Failed to save contract address',
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const ok = await onResetContractAddress();
      if (ok) {
        setInputContract('');
        setFeedback({
          type: 'success',
          message:
            language === 'th'
              ? `🔄 คืนค่ากลับเป็นสัญญาหลักเริ่มต้น (${DEFAULT_CONTRACT_ADDRESS.slice(0, 8)}...${DEFAULT_CONTRACT_ADDRESS.slice(-4)}) เรียบร้อยแล้ว!`
              : '🔄 Reset to default contract address successfully!',
        });
        await verifyContractOnChain(DEFAULT_CONTRACT_ADDRESS);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHistoryItem = (addr: string) => {
    const next = savedContracts.filter((item) => item.address.toLowerCase() !== addr.toLowerCase());
    saveHistoryToStorage(next);
  };

  const cliCommand = `npm run set-contract -- ${trimmedInput && isInputValidAddress ? trimmedInput : '<0xNewContractAddress>'}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-indigo-500/40 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.18)] dark:shadow-2xl p-4 sm:p-6 text-[#0F172A] dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] dark:bg-indigo-500/20 border border-blue-200/80 dark:border-indigo-500/40 flex items-center justify-center text-[#2563EB] dark:text-indigo-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-white tracking-tight">
                {language === 'th'
                  ? 'ตั้งค่า / เปลี่ยน Smart Contract Address ด่วน'
                  : 'Quick Smart Contract Switcher'}
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                {language === 'th'
                  ? 'เปลี่ยนที่อยู่สัญญาใน 1 คลิก — อัปเดตทั้งหน้าเว็บ ฐานข้อมูลเซิร์ฟเวอร์ และบอทดึงผังอัตโนมัติทันที'
                  : 'Switch contract in 1 click — updates Frontend, Backend DB, and Live WS Bot immediately'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700 transition cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* 1. Active Contract Status Card */}
          <div className="rounded-xl bg-[#F8FAFC] dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#15803D] dark:bg-emerald-400 animate-ping" />
                {language === 'th' ? 'สัญญาที่ใช้งานอยู่ปัจจุบัน (Active Contract)' : 'Active Contract Address'}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-500/30">
                BNB Smart Chain Testnet (97)
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 rounded-xl px-3 py-2.5">
              <span className="font-mono text-xs sm:text-sm font-bold text-[#0F172A] dark:text-emerald-300 break-all">
                {contractAddress}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(contractAddress);
                    setCopiedCurrent(true);
                    setTimeout(() => setCopiedCurrent(false), 1800);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#334155] dark:text-slate-200 transition cursor-pointer"
                >
                  {copiedCurrent ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#15803D] dark:text-emerald-400" />
                      <span className="text-[#15803D] dark:text-emerald-400">คัดลอกแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>คัดลอก</span>
                    </>
                  )}
                </button>
                <a
                  href={`https://testnet.bscscan.com/address/${contractAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#EFF6FF] hover:bg-blue-100/80 dark:bg-indigo-500/20 dark:hover:bg-indigo-500/30 text-[#2563EB] dark:text-indigo-300 border border-blue-200/80 dark:border-indigo-500/30 transition"
                >
                  <span>BSCScan</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Live On-Chain Verification Badge */}
            <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap text-xs">
              {verifyingAddr ? (
                <span className="inline-flex items-center gap-1.5 text-[#64748B] dark:text-slate-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
                  <span>กำลังตรวจสอบสถานะสัญญาบน Blockchain...</span>
                </span>
              ) : chainCheck ? (
                chainCheck.hasBytecode ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold border border-emerald-200/80 dark:border-emerald-500/30">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>
                        ตรวจสอบสัญญา ({chainCheck.checkedAddress.slice(0, 6)}...{chainCheck.checkedAddress.slice(-4)}): พบ Smart Contract บนเชน
                      </span>
                    </span>
                    {chainCheck.rank1TotalNodes !== null && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold border border-blue-200/80 dark:border-indigo-500/30">
                        จำนวน ID ใน Rank 1: {chainCheck.rank1TotalNodes} รหัส
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold border border-rose-200 dark:border-rose-500/30">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{chainCheck.error || 'ไม่พบ Bytecode บน BSC Testnet'}</span>
                  </span>
                )
              ) : null}
            </div>
          </div>

          {/* 2. Quick Paste & Update Form */}
          <div className="rounded-xl bg-white dark:bg-slate-900/60 border-2 border-indigo-500/20 dark:border-indigo-500/30 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                <span>✏️ วางที่อยู่ Smart Contract Address ใหม่ (0x...)</span>
              </label>
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#EFF6FF] hover:bg-blue-100/80 dark:bg-indigo-500/20 dark:hover:bg-indigo-500/30 text-[#2563EB] dark:text-indigo-300 border border-blue-200/80 dark:border-indigo-500/30 transition cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>{language === 'th' ? 'วางจากคลิปบอร์ด (Paste)' : 'Paste Address'}</span>
              </button>
            </div>

            <div className="space-y-2.5">
              <input
                type="text"
                value={inputContract}
                onChange={(e) => {
                  setInputContract(e.target.value);
                  setFeedback(null);
                }}
                placeholder="0x..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-[#2563EB] dark:focus:border-indigo-400 focus:outline-none font-mono text-xs sm:text-sm text-[#0F172A] dark:text-white placeholder:text-slate-400"
              />

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={inputLabel}
                  onChange={(e) => setInputLabel(e.target.value)}
                  placeholder={
                    language === 'th'
                      ? 'ตั้งชื่อช่วยจำ (ไม่บังคับ เช่น สัญญาชุดทดสอบใหม่ V2)'
                      : 'Optional label (e.g. New Testnet Contract V2)'
                  }
                  className="flex-1 px-3 py-2 rounded-xl bg-[#F8FAFC] dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 focus:border-[#2563EB] focus:outline-none text-xs text-[#334155] dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => setShowAdvancedUsdt(!showAdvancedUsdt)}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#475569] dark:text-slate-300 transition cursor-pointer shrink-0"
                >
                  <span>USDT Address</span>
                  {showAdvancedUsdt ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showAdvancedUsdt && (
                <div className="pt-1">
                  <label className="block text-[11px] font-semibold text-[#64748B] dark:text-slate-400 mb-1">
                    USDT Token Address (ค่าเริ่มต้น: {DEFAULT_USDT_ADDRESS})
                  </label>
                  <input
                    type="text"
                    value={inputUsdt}
                    onChange={(e) => setInputUsdt(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 font-mono text-xs text-[#0F172A] dark:text-slate-200"
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isSaving || !isInputValidAddress}
                onClick={() => handleSaveNewContract()}
                className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm transition cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึกและซิงก์สัญญาใหม่...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      {language === 'th'
                        ? 'บันทึก & เปลี่ยนสัญญาทั้งระบบทันที'
                        : 'Save & Switch Contract Now'}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={handleResetToDefault}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#334155] dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition cursor-pointer"
                title={`คืนค่ากลับเป็น ${DEFAULT_CONTRACT_ADDRESS}`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{language === 'th' ? 'คืนค่าสัญญาเริ่มต้น' : 'Reset Default'}</span>
              </button>

              {onOpenDeployModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenDeployModal();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-[#DCFCE7] hover:bg-emerald-200/80 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-[#15803D] dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-500/30 transition cursor-pointer"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  <span>{language === 'th' ? 'Deploy สัญญาใหม่' : 'Deploy New'}</span>
                </button>
              )}
            </div>

            {/* Feedback Banner */}
            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold border ${
                  feedback.type === 'success'
                    ? 'bg-[#DCFCE7] text-[#15803D] border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-500/40'
                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-500/40'
                }`}
              >
                {feedback.message}
              </div>
            )}
          </div>

          {/* 3. Saved / Recent Contracts History for 1-Click Switching */}
          {savedContracts.length > 0 && (
            <div className="rounded-xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#334155] dark:text-slate-300 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[#2563EB] dark:text-indigo-400" />
                  <span>
                    {language === 'th'
                      ? 'สลับสัญญาที่เคยบันทึกไว้ (คลิกเดียวสลับทันที)'
                      : 'Saved Contracts (1-Click Switch)'}
                  </span>
                </span>
              </div>

              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {savedContracts.map((item) => {
                  const isCurrent = item.address.toLowerCase() === contractAddress.toLowerCase();
                  return (
                    <div
                      key={item.address}
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition ${
                        isCurrent
                          ? 'bg-[#EFF6FF] dark:bg-indigo-950/40 border-blue-300 dark:border-indigo-500/50'
                          : 'bg-white dark:bg-slate-950 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                            {item.label}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-500/20 dark:text-emerald-300">
                              กำลังใช้งาน
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-[#64748B] dark:text-slate-400 truncate">
                          {item.address}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isCurrent && (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleSaveNewContract(item.address, item.usdtAddress, item.label)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#2563EB] hover:bg-blue-700 text-white transition cursor-pointer"
                          >
                            {language === 'th' ? 'ใช้สัญญานี้' : 'Use'}
                          </button>
                        )}
                        {item.address.toLowerCase() !== DEFAULT_CONTRACT_ADDRESS.toLowerCase() && (
                          <button
                            type="button"
                            onClick={() => handleDeleteHistoryItem(item.address)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="ลบออกจากประวัติ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Ubuntu VPS / Terminal Command Helper */}
          <div className="rounded-xl bg-[#F8FAFC] dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 p-3">
            <button
              type="button"
              onClick={() => setShowCliGuide(!showCliGuide)}
              className="w-full flex items-center justify-between text-xs font-bold text-[#475569] dark:text-slate-300 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#2563EB] dark:text-indigo-400" />
                <span>
                  {language === 'th'
                    ? 'คำสั่งเปลี่ยน Contract Address ผ่าน Terminal (สำหรับ VPS Ubuntu)'
                    : 'CLI Command for Ubuntu VPS Terminal'}
                </span>
              </span>
              {showCliGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showCliGuide && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
                <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                  {language === 'th'
                    ? 'นอกจากกดเปลี่ยนผ่านหน้าเว็บนี้แล้ว หากอยู่บนเซิร์ฟเวอร์ Ubuntu VPS สามารถรันคำสั่งเดียวเพื่ออัปเดตทั้งฐานข้อมูลและ .env ได้ทันที:'
                    : 'Run this single command on your Ubuntu VPS to update database config and .env immediately:'}
                </p>
                <div className="flex items-center justify-between gap-2 bg-slate-900 text-emerald-300 font-mono text-xs px-3 py-2 rounded-xl">
                  <code className="break-all">{cliCommand}</code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(cliCommand);
                      setCopiedCli(true);
                      setTimeout(() => setCopiedCli(false), 1800);
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-sans font-semibold shrink-0 cursor-pointer"
                  >
                    {copiedCli ? 'คัดลอกแล้ว' : 'คัดลอก'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
