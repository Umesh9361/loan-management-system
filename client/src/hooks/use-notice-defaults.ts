import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_NOTICE_MATTER,
  noticeMatterSchema,
  type NoticeMatter,
} from "@shared/notice-matter";

type NoticeDefaultsResponse = { matter: NoticeMatter; customized: boolean };

async function requestDefaults(
  method: "GET" | "PUT" | "DELETE",
  matter?: NoticeMatter,
): Promise<NoticeDefaultsResponse> {
  const response = await fetch("/api/notice-settings", {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(matter ? { body: JSON.stringify({ matter }) } : {}),
  });

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error("नोटीसचे मजकूर सेटिंग वाचता आले नाही.");
  }

  const payload = result as { message?: string; matter?: unknown; customized?: unknown };
  if (!response.ok) {
    throw new Error(payload.message || "नोटीसचे मजकूर सेटिंग उपलब्ध नाही.");
  }
  return {
    matter: noticeMatterSchema.parse(payload.matter),
    customized: payload.customized === true,
  };
}

export function useNoticeDefaults() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const client = useQueryClient();
  const tenantId = user?.tenantId;
  const key = ["/api/notice-settings", tenantId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => requestDefaults("GET"),
    enabled: !!tenantId,
    retry: false,
    staleTime: 0,
  });
  const [draft, setDraft] = useState<{
    tenantId?: string;
    changes: Partial<NoticeMatter>;
  }>({ changes: {} });
  const changes = draft.tenantId === tenantId ? draft.changes : {};
  const defaultMatter = query.data?.matter || DEFAULT_NOTICE_MATTER;
  const matter: NoticeMatter = { ...defaultMatter, ...changes };

  const mutation = useMutation({
    mutationFn: (action: { method: "PUT" | "DELETE"; matter?: NoticeMatter }) =>
      requestDefaults(action.method, action.matter),
    onSuccess: result => {
      client.setQueryData(key, result);
      setDraft({ tenantId, changes: {} });
      toast({
        title: "संस्थेचा नोटीस मजकूर अद्ययावत झाला",
        description: "बदल फक्त पुढील नोटीस नमुन्यांसाठी आहेत; कर्जदाराची माहिती जतन केलेली नाही.",
      });
    },
    onError: error =>
      toast({
        title: "नोटीसचा डिफॉल्ट बदलला नाही",
        description: error instanceof Error ? error.message : "कृपया पुन्हा प्रयत्न करा.",
        variant: "destructive",
      }),
  });

  return {
    matter,
    defaultMatter,
    ready: query.isSuccess,
    error: query.error,
    refetch: query.refetch,
    busy: mutation.isPending,
    canSaveDefault: user?.role === "admin" || user?.role === "super_admin",
    customized: query.data?.customized === true,
    onMatterChange: (field: keyof NoticeMatter, value: string) =>
      setDraft(previous => ({
        tenantId,
        changes: {
          ...(previous.tenantId === tenantId ? previous.changes : {}),
          [field]: value,
        },
      })),
    onUseSaved: () => {
      if (
        window.confirm(
          "तात्पुरते बदल बाजूला ठेवून संस्थेचा जतन केलेला मजकूर वापरायचा? कर्जदाराची माहिती बदलणार नाही.",
        )
      ) {
        setDraft({ tenantId, changes: {} });
      }
    },
    onUseOriginal: () => {
      if (
        window.confirm(
          "या नोटीससाठी मूळ नमुन्याचा मजकूर तात्पुरता वापरायचा? संस्थेचा जतन केलेला मजकूर बदलणार नाही.",
        )
      ) {
        setDraft({ tenantId, changes: { ...DEFAULT_NOTICE_MATTER } });
      }
    },
    onSaveDefault: () => {
      const parsed = noticeMatterSchema.safeParse(matter);
      if (!parsed.success) {
        toast({
          title: "नोटीसचा मजकूर तपासा",
          description: parsed.error.issues[0]?.message,
          variant: "destructive",
        });
        return;
      }
      if (
        window.confirm(
          "हा मजकूर संस्थेच्या सर्व वापरकर्त्यांसाठी पुढील नोटीसचा डिफॉल्ट करायचा? हा बदल फक्त पुढील नोटीस नमुन्यांवर लागू होईल; कर्जदाराची किंवा कर्जाची माहिती जतन होणार नाही.",
        )
      ) {
        mutation.mutate({ method: "PUT", matter: parsed.data });
      }
    },
    onResetDefault: () => {
      if (
        window.confirm(
          "संस्थेचा सध्याचा जतन केलेला मजकूर काढून संस्थेसाठी आणि पुढील नोटिसांसाठी मूळ नमुना ठेवायचा? आधी तयार झालेल्या नोटिसा बदलणार नाहीत.",
        )
      ) {
        mutation.mutate({ method: "DELETE" });
      }
    },
  };
}
