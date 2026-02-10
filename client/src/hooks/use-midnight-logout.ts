import { useEffect, useRef } from "react";
import { AuthService } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";

export function useMidnightLogout(isLoggedIn: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loginDateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      return;
    }

    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    loginDateRef.current = nowIST.toISOString().split('T')[0];

    function getMillisUntilMidnightIST(): number {
      const now = new Date();
      const nowInIST = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
      const tomorrowIST = new Date(nowInIST);
      tomorrowIST.setUTCHours(0, 0, 0, 0);
      tomorrowIST.setUTCDate(tomorrowIST.getUTCDate() + 1);
      const midnightISTinUTC = new Date(tomorrowIST.getTime() - 5.5 * 60 * 60 * 1000);
      return midnightISTinUTC.getTime() - now.getTime();
    }

    async function performLogout() {
      try {
        await AuthService.logout();
      } catch (e) {
        console.error("Midnight logout error:", e);
      }
      queryClient.clear();
      window.location.href = "/";
    }

    function checkDateChange() {
      const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      const todayIST = now.toISOString().split('T')[0];
      if (loginDateRef.current && loginDateRef.current < todayIST) {
        performLogout();
      }
    }

    const msUntilMidnight = getMillisUntilMidnightIST();
    timerRef.current = setTimeout(() => {
      performLogout();
    }, msUntilMidnight);

    checkIntervalRef.current = setInterval(checkDateChange, 60000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [isLoggedIn]);
}
