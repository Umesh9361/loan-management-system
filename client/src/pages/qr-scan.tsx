import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";

export default function QrScan() {
  const params = useParams<{ loanId: string }>();
  const loanId = params.loanId;
  const { user, authReady } = useCurrentUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authReady) return;
    if (user && loanId) {
      setLocation(`/closure?loanId=${loanId}`);
    }
  }, [authReady, user, loanId, setLocation]);

  return (
    <div style={{ background: "white", width: "100vw", height: "100vh" }} />
  );
}
