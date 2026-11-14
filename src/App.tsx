import React, { useState, useEffect } from 'react';
import { useWeb3 } from './hooks/useWeb3';
import { Header } from './components/Header';
import { RegisterSection } from './components/RegisterSection';
import { MatrixTreeVisualizer } from './components/MatrixTreeVisualizer';
import { DeployContractModal } from './components/DeployContractModal';
import { QuickContractSwitcherModal } from './components/QuickContractSwitcherModal';
import { AuthAndOnboardingGate } from './components/AuthAndOnboardingGate';
import { AdminControlCenter } from './components/AdminControlCenter';
import { CONTRACT_ADDRESS, USDT_ADDRESS, isAuthorizedAdminWallet } from './contracts/config';
import { X, LogIn } from 'lucide-react';
import { TransactionToast } from './components/TransactionToast';
import { calculateMainIdVaultPools } from './utils/vaultPools';
import { notifyMatrixNetworkError } from './hooks/useMatrixAutoReconnect';
import { peekPostTxViewTarget } from './utils/postTxNotice';

export default function App() {
  const [language, setLanguage] = useState<'th' | 'en'>('th');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('f27_theme_mode');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });
  const [isDeployModalOpen, setIsDeployModalOpen] = useState<boolean>(false);
  const [isContractSwitcherOpen, setIsContractSwitcherOpen] = useState<boolean>(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [selectedInspectRank, setSelectedInspectRank] = useState<number>(() => {
    const t = peekPostTxViewTarget();
    const r = Number(t?.selectedRank || 0);
    return r >= 1 && r <= 18 ? r : 1;
  });
  const [, setSelectedVaultBalance] = useState<string>('0.00 USDT');
  const [bypassGateToDashboard, setBypassGateToDashboard] = useState<boolean>(false);
  const [isAdminView, setIsAdminView] = useState<boolean>(false);

  useEffect(() => {
    const handleOpenSwitcher = () => setIsContractSwitcherOpen(true);
    window.addEventListener('matrix:open-contract-switcher', handleOpenSwitcher);
    return () => window.removeEventListener('matrix:open-contract-switcher', handleOpenSwitcher);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      window.localStorage.setItem('f27_theme_mode', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const {
    account,
    detectedBrowserWallet,
    chainId,
    isBscTestnet,
    isConnecting,
    usdtBalance,
    bnbBalance,
    allowance,
    profile,
    isLoadingProfile,
    contractAddress,
    usdtAddress,
    updateSmartContractAddress,
    resetSmartContractAddress,
    txState,
    connectWallet,
    loginWithCustomInput,
    loginWithDemoUnregisteredWallet,
    disconnectWallet,
    switchToBscTestnet,
    refreshUserData,
    checkSponsorNode,
    previewNextPlacement,
    inspectRankData,
    handleApproveUsdt,
    handleRegister,
    handleExecuteOffChainSimulationAndBatch,
    handleUpgradeRank,
    handleAdminUpgrade,
    clearTxState,
  } = useWeb3();

  // Check if connected wallet is an authorized Admin (Root ID #1 / Contract Owner / AllSell Admin)
  const isAdminUser = isAuthorizedAdminWallet(account, profile);

  // If user is not an Admin, never allow Admin view to remain open
  useEffect(() => {
    if (!isAdminUser && isAdminView) {
      setIsAdminView(false);
      if (typeof window !== 'undefined' && window.location.hash.toLowerCase() === '#admin') {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } else if (isAdminUser && typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      const q = new URLSearchParams(window.location.search).get('admin');
      if (hash === '#admin' || q === '1' || q === 'true') {
        setIsAdminView(true);
      }
    }
  }, [isAdminUser, isAdminView]);

  const toggleAdminView = () => {
    if (!isAdminUser) return;
    setIsAdminView((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        if (next) {
          window.history.replaceState(null, '', '#admin');
        } else if (window.location.hash.toLowerCase() === '#admin') {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
      return next;
    });
  };

  // Check if connected wallet is already registered on-chain
  const isWalletRegistered = Boolean(
    profile?.isRegistered ||
      (profile?.ownedAllIdsRank1 && profile.ownedAllIdsRank1.length > 0) ||
      (profile?.mainNodeIdRank1 && Number(profile.mainNodeIdRank1) > 0)
  );

  // Whenever account changes, reset bypass so unregistered wallets see the registration form
  useEffect(() => {
    setBypassGateToDashboard(false);
  }, [account]);

  useEffect(() => {
    if (Array.isArray(profile?.vaults) && profile.vaults.length > 0) {
      const targetVault = profile.vaults.find((v: any) => Number(v.rank) === selectedInspectRank);
      if (targetVault) {
        setSelectedVaultBalance(`${Number(targetVault.balance || 0).toFixed(2)} USDT`);
      }
    }
  }, [profile?.vaults, selectedInspectRank]);

  // Scoped Main ID Selection and Vault Pools calculations
  const [selectedMainId, setSelectedMainId] = useState<string>(() => {
    const t = peekPostTxViewTarget();
    if (t?.selectedMainId && Number(t.selectedMainId) > 0) {
      return String(t.selectedMainId);
    }
    return '1';
  });
  const prevAccountRef = React.useRef<string | null>(null);
  const prevHadOwnedIdsRef = React.useRef<boolean>(false);

  useEffect(() => {
    const accountChanged = prevAccountRef.current !== account;
    const ownedList = profile?.ownedMainIdsRank1 || [];
    const hasOwnedIds =
      ownedList.length > 0 ||
      Boolean(profile?.mainNodeIdRank1 && profile.mainNodeIdRank1 !== '0');
    const newlyRegisteredSameAccount = !prevHadOwnedIdsRef.current && hasOwnedIds;

    if (accountChanged) {
      prevAccountRef.current = account;
    }
    prevHadOwnedIdsRef.current = hasOwnedIds;

    if ((accountChanged || newlyRegisteredSameAccount) && profile) {
      const postTarget = peekPostTxViewTarget();
      if (
        postTarget?.selectedMainId &&
        ownedList.map(String).includes(String(postTarget.selectedMainId))
      ) {
        setSelectedMainId(String(postTarget.selectedMainId));
      } else if (ownedList.length > 0) {
        setSelectedMainId(String(ownedList[0]));
      } else if (profile.mainNodeIdRank1 && profile.mainNodeIdRank1 !== '0') {
        setSelectedMainId(String(profile.mainNodeIdRank1));
      }
    }
  }, [account, profile]);

  const [mainIdVaultsOnChain, setMainIdVaultsOnChain] = useState<Record<number, number>>({});
  const [selectedMainIdRankOnChain, setSelectedMainIdRankOnChain] = useState<number | null>(null);
  const [selectedMainIdExtraLeftBonus, setSelectedMainIdExtraLeftBonus] = useState<number>(0);

  useEffect(() => {
    const mId = Number(selectedMainId);
    if (!mId || mId <= 0) return;

    let isMounted = true;
    const fetchMainIdVaultsFromDB = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      try {
        // 1. Read directly from our backend Database API (/api/matrix/main-id/:mainId)
        const dbRes = await fetch(`/api/matrix/main-id/${mId}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          if (dbData?.success && dbData.vaultsByRank) {
            const resultMap: Record<number, number> = {};
            for (let r = 1; r <= 27; r++) {
              resultMap[r] = Number(dbData.vaultsByRank[r] ?? 0);
            }
            if (isMounted) {
              setMainIdVaultsOnChain((prev) => {
                const changed = Object.keys(resultMap).some(
                  (k) => prev[Number(k)] !== resultMap[Number(k)]
                );
                return changed || Object.keys(prev).length === 0 ? resultMap : prev;
              });
              const nextR = Number(dbData.currentRank || 1);
              setSelectedMainIdRankOnChain((prev) => (prev === nextR ? prev : nextR));
              const nextBonus = Number(dbData.extraLeftBonus ?? dbData.extraLeftVaultBonus ?? 0);
              setSelectedMainIdExtraLeftBonus((prev) => (prev === nextBonus ? prev : nextBonus));
            }
            return;
          }
        } else {
          notifyMatrixNetworkError(new Error(`HTTP ${dbRes.status}`), 'main-id-vault-refresh');
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        notifyMatrixNetworkError(err, 'main-id-vault-refresh');
        // Fallback to profile vaults gracefully if transient offline / network issue occurs
        if (err?.name !== 'AbortError' && isMounted) {
          if (Array.isArray(profile?.vaults) && profile.vaults.length > 0) {
            const fallbackMap: Record<number, number> = {};
            profile.vaults.forEach((v: any) => {
              fallbackMap[Number(v.rank)] = parseFloat(v.balance || '0');
            });
            setMainIdVaultsOnChain((prev) => Object.keys(prev).length === 0 ? fallbackMap : prev);
          }
        }
      }
    };

    fetchMainIdVaultsFromDB();
    const handleTreeRefresh = () => {
      fetchMainIdVaultsFromDB();
    };
    const handleReconnected = () => {
      fetchMainIdVaultsFromDB();
      refreshUserData();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('matrix:tree:refresh', handleTreeRefresh);
      window.addEventListener('matrix:network:reconnected', handleReconnected);
    }
    const interval = setInterval(fetchMainIdVaultsFromDB, 12000);
    return () => {
      isMounted = false;
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('matrix:tree:refresh', handleTreeRefresh);
        window.removeEventListener('matrix:network:reconnected', handleReconnected);
      }
    };
  }, [selectedMainId, contractAddress, account, profile?.mainNodeIdRank1, profile?.currentMaxRank, profile?.vaults, refreshUserData]);

  const vaultByRank = React.useMemo(() => {
    const map: Record<number, number> = {};
    const isPrimaryMain =
      !profile?.mainNodeIdRank1 || String(profile.mainNodeIdRank1) === String(selectedMainId);
    if (isPrimaryMain && Array.isArray(profile?.vaults)) {
      profile.vaults.forEach((v) => {
        map[v.rank] = parseFloat(v.balance || '0');
      });
    }
    // Override with reconciled per-Main-ID vaults (including 0 when deducted by rank upgrade)
    Object.entries(mainIdVaultsOnChain).forEach(([rStr, bal]) => {
      const r = Number(rStr);
      map[r] = bal;
    });
    return map;
  }, [profile?.vaults, profile?.mainNodeIdRank1, selectedMainId, mainIdVaultsOnChain]);

  React.useMemo(() => {
    const mIdNum = Number(selectedMainId) || 1;
    const isPrimaryMain =
      !profile?.mainNodeIdRank1 || String(profile.mainNodeIdRank1) === String(selectedMainId);
    const currentR = selectedMainIdRankOnChain ?? (isPrimaryMain ? (profile?.currentMaxRank || 1) : 1);
    return calculateMainIdVaultPools(mIdNum, currentR, vaultByRank, selectedMainIdExtraLeftBonus);
  }, [
    selectedMainId,
    selectedMainIdRankOnChain,
    selectedMainIdExtraLeftBonus,
    profile?.mainNodeIdRank1,
    profile?.currentMaxRank,
    vaultByRank,
  ]);

  const handleFullLogout = () => {
    setBypassGateToDashboard(false);
    setIsAdminView(false);
    disconnectWallet();
  };

  const contractSwitcherModal = (
    <QuickContractSwitcherModal
      isOpen={isContractSwitcherOpen}
      onClose={() => setIsContractSwitcherOpen(false)}
      language={language}
      contractAddress={contractAddress || CONTRACT_ADDRESS}
      usdtAddress={usdtAddress || USDT_ADDRESS}
      onUpdateContractAddress={updateSmartContractAddress}
      onResetContractAddress={resetSmartContractAddress}
      onOpenDeployModal={() => setIsDeployModalOpen(true)}
    />
  );

  // Show Login Gate when no wallet is connected, or Onboarding Registration Form when wallet is not registered
  // (unless user is an Admin or bypassed gate)
  if (!bypassGateToDashboard && !(isAdminUser && isAdminView)) {
    if (!account) {
      return (
        <>
          <AuthAndOnboardingGate
            mode="login"
            language={language}
            onToggleLanguage={() => setLanguage(language === 'th' ? 'en' : 'th')}
            theme={theme}
            onToggleTheme={toggleTheme}
            account={account}
            detectedBrowserWallet={detectedBrowserWallet}
            chainId={chainId}
            isBscTestnet={isBscTestnet}
            isConnecting={isConnecting}
            isLoadingProfile={isLoadingProfile}
            profile={profile}
            usdtBalance={usdtBalance}
            bnbBalance={bnbBalance}
            allowance={allowance}
            contractAddress={contractAddress || CONTRACT_ADDRESS}
            usdtAddress={usdtAddress || USDT_ADDRESS}
            txState={txState}
            onClearTxState={clearTxState}
            onConnectWallet={connectWallet}
            onLoginCustomInput={loginWithCustomInput}
            onLoginDemoUnregisteredWallet={loginWithDemoUnregisteredWallet}
            onDisconnect={handleFullLogout}
            onSwitchNetwork={switchToBscTestnet}
            onRefresh={refreshUserData}
            onEnterGuestDashboard={() => setBypassGateToDashboard(true)}
            onApproveUsdt={handleApproveUsdt}
            onRegister={handleRegister}
            onExecuteOffChainBatch={handleExecuteOffChainSimulationAndBatch}
            onCheckSponsor={checkSponsorNode}
            onPreviewPlacement={previewNextPlacement}
            onUpgradeToRank={handleUpgradeRank}
          />
          {contractSwitcherModal}
        </>
      );
    }

    if (isLoadingProfile && !profile) {
      return (
        <>
          <AuthAndOnboardingGate
            mode="Checking"
            language={language}
            onToggleLanguage={() => setLanguage(language === 'th' ? 'en' : 'th')}
            theme={theme}
            onToggleTheme={toggleTheme}
            account={account}
            detectedBrowserWallet={detectedBrowserWallet}
            chainId={chainId}
            isBscTestnet={isBscTestnet}
            isConnecting={isConnecting}
            isLoadingProfile={isLoadingProfile}
            profile={profile}
            usdtBalance={usdtBalance}
            bnbBalance={bnbBalance}
            allowance={allowance}
            contractAddress={contractAddress || CONTRACT_ADDRESS}
            usdtAddress={usdtAddress || USDT_ADDRESS}
            txState={txState}
            onClearTxState={clearTxState}
            onConnectWallet={connectWallet}
            onLoginCustomInput={loginWithCustomInput}
            onLoginDemoUnregisteredWallet={loginWithDemoUnregisteredWallet}
            onDisconnect={handleFullLogout}
            onSwitchNetwork={switchToBscTestnet}
            onRefresh={refreshUserData}
            onEnterGuestDashboard={() => setBypassGateToDashboard(true)}
            onApproveUsdt={handleApproveUsdt}
            onRegister={handleRegister}
            onExecuteOffChainBatch={handleExecuteOffChainSimulationAndBatch}
            onCheckSponsor={checkSponsorNode}
            onPreviewPlacement={previewNextPlacement}
            onUpgradeToRank={handleUpgradeRank}
          />
          {contractSwitcherModal}
        </>
      );
    }

    if (!isLoadingProfile && !isWalletRegistered && !isAdminUser) {
      return (
        <>
          <AuthAndOnboardingGate
            mode="register_onboarding"
            language={language}
            onToggleLanguage={() => setLanguage(language === 'th' ? 'en' : 'th')}
            theme={theme}
            onToggleTheme={toggleTheme}
            account={account}
            detectedBrowserWallet={detectedBrowserWallet}
            chainId={chainId}
            isBscTestnet={isBscTestnet}
            isConnecting={isConnecting}
            isLoadingProfile={isLoadingProfile}
            profile={profile}
            usdtBalance={usdtBalance}
            bnbBalance={bnbBalance}
            allowance={allowance}
            contractAddress={contractAddress || CONTRACT_ADDRESS}
            usdtAddress={usdtAddress || USDT_ADDRESS}
            txState={txState}
            onClearTxState={clearTxState}
            onConnectWallet={connectWallet}
            onLoginCustomInput={loginWithCustomInput}
            onLoginDemoUnregisteredWallet={loginWithDemoUnregisteredWallet}
            onDisconnect={handleFullLogout}
            onSwitchNetwork={switchToBscTestnet}
            onRefresh={refreshUserData}
            onEnterGuestDashboard={() => setBypassGateToDashboard(true)}
            onApproveUsdt={handleApproveUsdt}
            onRegister={handleRegister}
            onExecuteOffChainBatch={handleExecuteOffChainSimulationAndBatch}
            onCheckSponsor={checkSponsorNode}
            onPreviewPlacement={previewNextPlacement}
            onUpgradeToRank={handleUpgradeRank}
          />
          {contractSwitcherModal}
        </>
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 flex flex-col relative selection:bg-indigo-500/20 selection:text-indigo-900 dark:selection:bg-emerald-500/30 dark:selection:text-emerald-200 transition-colors duration-200">
      {/* Subtle Pastel Gradient on Hero Section Top Background (Light Mode) */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-gradient-to-b from-indigo-100/60 via-sky-50/40 to-transparent dark:from-indigo-950/20 dark:via-slate-950/10 dark:to-transparent z-0" />

      <Header
        account={account}
        chainId={chainId}
        isBscTestnet={isBscTestnet}
        isConnecting={isConnecting}
        onConnect={connectWallet}
        onDisconnect={handleFullLogout}
        onSwitchNetwork={switchToBscTestnet}
        onRefresh={refreshUserData}
        language={language}
        onToggleLanguage={() => setLanguage(language === 'th' ? 'en' : 'th')}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenDeployModal={() => setIsDeployModalOpen(true)}
        contractAddress={contractAddress}
        isAdminUser={isAdminUser}
        isAdminView={isAdminUser && isAdminView}
        onToggleAdminView={toggleAdminView}
      />

      {/* Quick Banner when browsing in Guest / Bypass mode */}
      {(!account || (!isWalletRegistered && !isAdminUser)) && !(isAdminUser && isAdminView) && (
        <div className="relative z-10 bg-[#EFF6FF] dark:bg-indigo-950/60 border-b border-blue-200/80 dark:border-indigo-500/30 px-3 sm:px-6 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[#1E40AF] dark:text-indigo-200 font-medium">
              {!account
                ? language === 'th'
                  ? 'โหมดดูข้อมูล (ยังไม่ได้เข้าสู่ระบบ)'
                  : 'Guest Preview Mode (Not logged in)'
                : language === 'th'
                ? 'กระเป๋านี้ยังไม่ได้ลงทะเบียนรหัสสมาชิก'
                : 'This wallet is not registered yet'}
            </span>
            <button
              onClick={() => setBypassGateToDashboard(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#2563EB] hover:bg-blue-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold shadow-xs transition cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>
                {!account
                  ? language === 'th'
                    ? 'กลับไปหน้าเข้าสู่ระบบ / สมัครสมาชิก'
                    : 'Back to Login / Register'
                  : language === 'th'
                  ? 'เปิดฟอร์มสมัครสมาชิก'
                  : 'Open Registration Form'}
              </span>
            </button>
          </div>
        </div>
      )}

      <main className="relative z-10 flex-1 w-full max-w-none mx-auto px-1 sm:px-2.5 py-1.5 sm:py-3 flex flex-col space-y-2.5">
        {/* Global Framer Motion Blockchain Transaction Toast Notification System */}
        <TransactionToast
          txState={txState}
          onClear={clearTxState}
          language={language}
        />

        {isAdminUser && isAdminView ? (
          <AdminControlCenter
            account={account}
            language={language}
            contractAddress={contractAddress || CONTRACT_ADDRESS}
            usdtAddress={usdtAddress || USDT_ADDRESS}
            isLoading={txState.isLoading}
            onAdminUpgrade={handleAdminUpgrade}
            onUpdateContractAddress={updateSmartContractAddress}
            onResetContractAddress={resetSmartContractAddress}
            onOpenDeployModal={() => setIsDeployModalOpen(true)}
            onRefreshOnChainData={refreshUserData}
            onInspectRank={inspectRankData}
            onClose={() => toggleAdminView()}
          />
        ) : (
          <>
            {/* Binary Matrix Tree Visualizer */}
            <MatrixTreeVisualizer
              language={language}
              theme={theme}
              userAddress={account}
              chainId={chainId}
              isBscTestnet={isBscTestnet}
              contractAddress={contractAddress}
              usdtBalance={usdtBalance}
              allowance={allowance}
              onConnectWallet={connectWallet}
              onSwitchNetwork={switchToBscTestnet}
              onApproveUsdt={handleApproveUsdt}
              onRegisterWithSponsor={handleRegister}
              onUpgradeToRank={handleUpgradeRank}
              onAdminUpgrade={isAdminUser ? handleAdminUpgrade : undefined}
              onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
              currentUserRank={profile?.currentMaxRank || 1}
              lastTxSuccess={txState.successMessage}
              refreshTrigger={txState.successMessage}
            />
          </>
        )}
      </main>

      {/* Registration Popup Modal opened from Dashboard Status Widget / Summary Pill */}
      {isRegisterModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm"
          onClick={() => setIsRegisterModalOpen(false)}
        >
          <div
            className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-indigo-500/40 shadow-[0_20px_50px_-10px_rgba(15,23,42,0.15)] dark:shadow-2xl p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border border-slate-200/80 dark:border-slate-700 transition cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X className="w-4 h-4" />
            </button>
            <RegisterSection
              account={account}
              isRegistered={profile?.isRegistered ?? false}
              mainNodeIdRank1={profile?.mainNodeIdRank1}
              usdtBalance={usdtBalance}
              allowance={allowance}
              onConnectWallet={connectWallet}
              onApproveUsdt={handleApproveUsdt}
              onRegister={handleRegister}
              onExecuteOffChainBatch={handleExecuteOffChainSimulationAndBatch}
              onCheckSponsor={checkSponsorNode}
              onPreviewPlacement={previewNextPlacement}
              isLoading={txState.isLoading}
              currentStep={txState.step}
              txError={txState.error}
              txSuccess={txState.successMessage}
              onRegisterSuccess={() => {
                setTimeout(() => {
                  setIsRegisterModalOpen(false);
                }, 1050);
              }}
              language={language}
            />
          </div>
        </div>
      )}

      <DeployContractModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        language={language}
        account={account}
        onUpdateContractAddress={updateSmartContractAddress}
      />

      {contractSwitcherModal}
    </div>
  );
}
