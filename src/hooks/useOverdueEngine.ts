import { useEffect, useState, useCallback } from 'react';
import { useOrg } from '../context/OrgContext';
import { useAuth } from '../context/AuthContext';
import { runOverdueDetectionEngine } from '../services/notificationService';

export function useOverdueEngine() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<Date | null>(null);
  const [lastScanResult, setLastScanResult] = useState<{
    scannedCount: number;
    newlyFlaggedOverdueCount: number;
  } | null>(null);

  const runScan = useCallback(async () => {
    if (!currentOrg?.id || !user) return;
    setScanning(true);
    try {
      const result = await runOverdueDetectionEngine(currentOrg.id);
      setLastScanned(new Date());
      setLastScanResult(result);
    } catch (err) {
      console.warn('Overdue background scan notice:', err);
    } finally {
      setScanning(false);
    }
  }, [currentOrg?.id, user]);

  useEffect(() => {
    if (!currentOrg?.id || !user) return;

    // Run initial scan on load
    runScan();

    // Schedule background scan every 5 minutes (300,000 ms)
    const interval = setInterval(() => {
      runScan();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [currentOrg?.id, user, runScan]);

  return {
    scanning,
    lastScanned,
    lastScanResult,
    triggerOverdueScan: runScan,
  };
}
