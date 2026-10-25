import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPledgePhotoCatalog, loadPledgeCollateralPhotos, pledgePhotoImageUrl, selectPledgeCollateralPhotos, pledgeCollateralPhotoLabels } from "@/lib/pledge-loan-photos";
import { Button } from "@/components/ui/button";

type Props = {
  loanId: string;
  onChange: (photos: string[], loanId: string, labels: string[]) => void;
  onBusyChange: (busy: boolean) => void;
};

export function PledgePhotoSelection({ loanId, onChange, onBusyChange }: Props) {
  const catalog = useQuery({
    queryKey: ["/api/loans", loanId, "photos", "print-selection"],
    queryFn: () => fetchPledgePhotoCatalog(loanId), retry: false,
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const initialised = useRef(false);
  const request = useRef(0);
  const busyCallback = useRef(onBusyChange);
  busyCallback.current = onBusyChange;
  useEffect(() => {
    if (catalog.data && !initialised.current) {
      setSelected(selectPledgeCollateralPhotos(catalog.data).map(photo => photo.id));
      initialised.current = true;
    }
  }, [catalog.data]);
  useEffect(() => () => { request.current++; busyCallback.current(false); }, []);

  const toggle = async (id: string) => {
    if (busy || !catalog.data) return;
    const next = selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];
    if (next.length > 2) { setError("आधी निवडलेला एखादा फोटो काढा. A4 मांडणीसाठी कमाल 2 वस्तूंचे फोटो निवडता येतात."); return; }
    const token = ++request.current;
    setBusy(true); busyCallback.current(true); setError("");
    try {
      const photos = await loadPledgeCollateralPhotos(loanId, next, catalog.data);
      if (token !== request.current) return;
      onChange(photos, loanId, pledgeCollateralPhotoLabels(catalog.data, next));
      setSelected(next);
    } catch (error) {
      if (token === request.current) setError(error instanceof Error ? error.message : "फोटो बदलता आले नाहीत.");
    } finally {
      if (token === request.current) { setBusy(false); busyCallback.current(false); }
    }
  };
  const items = (catalog.data || []).filter(photo => !photo.photoType || photo.photoType === "collateral");
  const borrower = catalog.data?.filter(photo => photo.photoType === "borrower").at(-1);
  return <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3" aria-label="प्रिंटसाठी फोटो निवड">
    <div>
      <h4 className="text-sm font-semibold text-slate-900">प्रिंटसाठी वस्तूंचे फोटो निवडा</h4>
      <p className="mt-1 text-xs leading-5 text-slate-600">सुरुवातीला पहिले 2 फोटो निवडलेले असतात. इतर फोटो निवडा किंवा फोटो नको असल्यास निवड काढा. मूळ सेव्ह केलेले फोटो बदलत नाहीत.</p>
    </div>
    {catalog.isLoading && <p role="status" className="text-xs text-slate-600">उपलब्ध फोटो तपासत आहोत…</p>}
    {catalog.isError && <div role="alert" className="space-y-2 text-xs text-red-700">
      <p>फोटोंची यादी मिळाली नाही. आधी भरलेले फोटो बदललेले नाहीत.</p>
      <Button type="button" size="sm" variant="outline" onClick={() => catalog.refetch()}>पुन्हा प्रयत्न करा</Button>
    </div>}
    {catalog.data && <>
      <p className="text-xs font-medium text-indigo-800">{selected.length}/2 वस्तूंचे फोटो प्रिंटसाठी निवडले</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((photo, index) => <label key={photo.id} className={`min-w-0 cursor-pointer rounded-md border p-2 ${selected.includes(photo.id) ? "border-indigo-500 bg-indigo-50" : "border-slate-200"}`}>
          <img loading="lazy" src={pledgePhotoImageUrl(loanId, photo.id)} alt={`वस्तूचा फोटो ${index + 1}`} className="mb-2 h-24 w-full bg-white object-contain" />
          <span className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={selected.includes(photo.id)} disabled={busy} onChange={() => void toggle(photo.id)} className="h-4 w-4 accent-indigo-600" />वस्तूचा फोटो {index + 1}</span>
        </label>)}
      </div>
      {!items.length && <p className="text-xs text-slate-500">या खात्यात वस्तूचे फोटो सेव्ह केलेले नाहीत.</p>}
      {borrower ? <div className="flex items-center gap-3 rounded-md bg-slate-50 p-2">
        <img src={pledgePhotoImageUrl(loanId, borrower.id)} alt="कर्जदाराचा फोटो" className="h-16 w-12 bg-white object-contain" />
        <p className="text-xs text-slate-700">कर्जदाराचा स्वतंत्र फोटो फॉर्ममध्ये आपोआप घेतला आहे.</p>
      </div> : <p className="text-xs text-slate-500">कर्जदाराचा स्वतंत्र फोटो सेव्ह केलेला नाही.</p>}
    </>}
    {busy && <p role="status" className="text-xs text-indigo-700">निवडलेले फोटो फॉर्ममध्ये भरत आहोत…</p>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </section>;
}
