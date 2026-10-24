import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_PLEDGE_MATTER, pledgeMatterSchema, type PledgeFormMatter } from "@shared/pledge-form-editor";

type Defaults = { matter: PledgeFormMatter; customized: boolean };
async function requestDefaults(method: "GET" | "PUT" | "DELETE", matter?: PledgeFormMatter): Promise<Defaults> {
  const response = await fetch("/api/pledge-form-settings", {
    method, credentials: "include", headers: { "Content-Type": "application/json" },
    ...(matter ? { body: JSON.stringify({ matter }) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "फॉर्म सेटिंग उपलब्ध नाही.");
  return { matter: pledgeMatterSchema.parse(result.matter), customized: result.customized === true };
}
export function usePledgeFormDefaults() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const client = useQueryClient();
  const tenantId = user?.tenantId;
  const key = ["/api/pledge-form-settings", tenantId];
  const query = useQuery({ queryKey: key, queryFn: () => requestDefaults("GET"), enabled: !!tenantId, retry: false, staleTime: 0 });
  const [draft, setDraft] = useState<{ tenantId?: string; changes: Partial<PledgeFormMatter> }>({ changes: {} });
  const changes = draft.tenantId === tenantId ? draft.changes : {};
  const defaultMatter = query.data?.matter || DEFAULT_PLEDGE_MATTER;
  const matter = { ...defaultMatter, ...changes };
  const mutation = useMutation({
    mutationFn: (action: { method: "PUT" | "DELETE"; matter?: PledgeFormMatter }) => requestDefaults(action.method, action.matter),
    onSuccess: result => {
      client.setQueryData(key, result);
      setDraft({ tenantId, changes: {} });
      toast({ title: "संस्थेचा डिफॉल्ट मजकूर अद्ययावत झाला", description: "ग्राहकाची माहिती जतन केलेली नाही." });
    },
    onError: error => toast({ title: "डिफॉल्ट बदलला नाही", description: error.message, variant: "destructive" }),
  });
  return {
    matter, defaultMatter, ready: query.isSuccess, error: query.error, refetch: query.refetch,
    busy: mutation.isPending, canSaveDefault: user?.role === "admin" || user?.role === "super_admin",
    onMatterChange: (field: keyof PledgeFormMatter, value: string) => setDraft(previous => ({
      tenantId, changes: { ...(previous.tenantId === tenantId ? previous.changes : {}), [field]: value },
    })),
    onUseSaved: () => {
      if (window.confirm("तात्पुरते मजकूर बदल बाजूला ठेवून संस्थेचा जतन केलेला मजकूर वापरायचा? भरलेले तपशील कायम राहतील.")) setDraft({ tenantId, changes: {} });
    },
    onUseOriginal: () => {
      if (window.confirm("या प्रिंटसाठी मूळ नमुन्याचा मजकूर आणायचा? संस्थेचा जतन केलेला डिफॉल्ट बदलणार नाही.")) setDraft({ tenantId, changes: { ...DEFAULT_PLEDGE_MATTER } });
    },
    onSaveDefault: () => {
      const parsed = pledgeMatterSchema.safeParse(matter);
      if (!parsed.success) { toast({ title: "मजकूर तपासा", description: parsed.error.issues[0]?.message, variant: "destructive" }); return; }
      if (window.confirm("हा मजकूर संस्थेच्या सर्व वापरकर्त्यांसाठी पुढील फॉर्मचा डिफॉल्ट करायचा? फक्त मजकूर जतन होईल; ग्राहकाचे नाव, रक्कम व भरलेले तपशील नाहीत.")) mutation.mutate({ method: "PUT", matter: parsed.data });
    },
    onResetDefault: () => {
      if (window.confirm("संस्थेचा जतन केलेला कस्टम मजकूर काढून सर्वांसाठी मूळ नमुना डिफॉल्ट करायचा?")) mutation.mutate({ method: "DELETE" });
    },
  };
}
