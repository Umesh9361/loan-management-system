import { useEffect, useRef, useCallback } from "react";
import { AuthService } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";

export function useMidnightLogout(isLoggedIn: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loginDateRef = useRef<string | null>(null);
  const isLoggingOutRef = useRef(false);

  const performLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (checkIntervalRef.current) { clearInterval(checkIntervalRef.current); checkIntervalRef.current = null; }

    try {
      sessionStorage.removeItem('closure_summary_entries');
      sessionStorage.removeItem('closure_summary_counter');
      await AuthService.logout();
    } catch (e) {
      console.error("Midnight logout error:", e);
    }
    queryClient.clear();
    window.location.href = "/";
  }, []);

  const checkDateChange = useCallback(() => {
    if (isLoggingOutRef.current) return;
    const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const todayIST = now.toISOString().split('T')[0];
    if (loginDateRef.current && loginDateRef.current < todayIST) {
      performLogout();
    }
  }, [performLogout]);

  useEffect(() => {
    if (!isLoggedIn) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      if (checkIntervalRef.current) { clearInterval(checkIntervalRef.current); checkIntervalRef.current = null; }
      isLoggingOutRef.current = false;
      return;
    }

    isLoggingOutRef.current = false;
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    loginDateRef.current = nowIST.toISOString().split('T')[0];

    function getMillisUntilMidnightIST(): number {
      const now = new Date();
      const nowInIST = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
      const tomorrowIST = new Date(nowInIST);
      tomorrowIST.setUTCHours(0, 0, 0, 0);
      tomorrowIST.setUTCDate(tomorrowIST.getUTCDate() + 1);
      const midnightISTinUTC = new Date(tomorrowIST.getTime() - 5.5 * 60 * 60 * 1000);
      const ms = midnightISTinUTC.getTime() - now.getTime();
      return Math.max(ms, 1000);
    }

    const msUntilMidnight = getMillisUntilMidnightIST();
    timerRef.current = setTimeout(() => {
      performLogout();
    }, msUntilMidnight);

    checkIntervalRef.current = setInterval(checkDateChange, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkDateChange();
      }
    };

    const handleFocus = () => {
      checkDateChange();
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        checkDateChange();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      if (checkIntervalRef.current) { clearInterval(checkIntervalRef.current); checkIntervalRef.current = null; }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [isLoggedIn, performLogout, checkDateChange]);
}
