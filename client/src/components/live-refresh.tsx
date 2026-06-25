import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

const REFRESH_KEY = "F2";
const PULL_THRESHOLD = 70;
const MAX_PULL = 110;

async function refreshAllData() {
  await queryClient.invalidateQueries();
}

function isTypingTarget(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t || !t.tagName) return false;
  const tag = t.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    t.isContentEditable === true
  );
}

export function LiveRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const animatingRef = useRef(false);

  pullRef.current = pull;
  refreshingRef.current = refreshing;

  // Desktop: F2 keyboard shortcut for a live data refresh
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== REFRESH_KEY) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      if (refreshingRef.current) return;
      setRefreshing(true);
      toast({ title: "🔄 डेटा रिफ्रेश होत आहे..." });
      refreshAllData().finally(() => {
        setRefreshing(false);
        toast({ title: "✅ डेटा अपडेट झाला" });
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Mobile: pull-to-refresh gesture (swipe down at top of page)
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (window.scrollY > 0) {
        startYRef.current = null;
        return;
      }
      startYRef.current = e.touches[0].clientY;
      animatingRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || refreshingRef.current) return;
      if (window.scrollY > 0) {
        startYRef.current = null;
        setPull(0);
        return;
      }
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        setPull(0);
        return;
      }
      const dist = Math.min(MAX_PULL, delta * 0.5);
      setPull(dist);
    };

    const onTouchEnd = () => {
      if (startYRef.current === null) return;
      const shouldRefresh = pullRef.current >= PULL_THRESHOLD;
      startYRef.current = null;
      animatingRef.current = true;
      if (shouldRefresh && !refreshingRef.current) {
        setRefreshing(true);
        setPull(PULL_THRESHOLD);
        refreshAllData().finally(() => {
          setRefreshing(false);
          setPull(0);
        });
      } else {
        setPull(0);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  if (pull <= 0 && !refreshing) return null;

  const label = refreshing
    ? "रिफ्रेश होत आहे..."
    : pull >= PULL_THRESHOLD
      ? "सोडा आणि रिफ्रेश करा"
      : "खाली ओढा";

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex items-end justify-center pointer-events-none print:hidden"
      style={{
        height: refreshing ? PULL_THRESHOLD : pull,
        transition: animatingRef.current ? "height 200ms ease" : undefined,
      }}
    >
      <div className="mb-1.5 flex items-center gap-2 rounded-full bg-white/95 shadow-md border border-indigo-100 px-4 py-1.5 text-indigo-600 text-sm font-medium">
        <RotateCcw
          className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
        />
        <span>{label}</span>
      </div>
    </div>
  );
}
