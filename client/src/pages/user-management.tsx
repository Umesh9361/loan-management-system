import { useState } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Key, UserCheck, UserX, Shield, Activity, Home, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";

const userSchema = z.object({
  username: z.string().min(1, "Username आवश्यक आहे"),
  password: z.string().min(6, "पासवर्ड किमान 6 अक्षरांचा असावा"),
  confirmPassword: z.string().min(1, "पासवर्ड पुष्टी आवश्यक आहे"),
  fullName: z.string().min(1, "Full name आवश्यक आहे"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  role: z.enum(["user", "admin"], { required_error: "Role is required" })
}).refine((data) => data.password === data.confirmPassword, {
  message: "पासवर्ड जुळत नाही",
  path: ["confirmPassword"],
});

const permissionsSchema = z.object({
  // === मुख्य सुविधा (Basic Features) - Always Available ===
  canViewDashboard: z.boolean().default(true),
  canAccessInterestCalculator: z.boolean().default(true),
  
  // === मुख्य नेव्हिगेशन मेनू (Main Navigation Menus) ===
  canAccessCompanyRegistration: z.boolean().default(false), // कंपनी नोंदणी
  canAccessGroupManagement: z.boolean().default(false), // ग्रुप व्यवस्थापन
  canAccessLoanRegistration: z.boolean().default(false), // कर्ज नोंदणी
  canAccessLoanClosure: z.boolean().default(false), // कर्ज बंद करा
  canAccessCashTransactions: z.boolean().default(false), // रोकड व्यवहार
  canAccessPartyManagement: z.boolean().default(false), // अकाउंट क्रिएशन
  canAccessMobileCashbook: z.boolean().default(false), // मोबाईल रोकड वही
  
  // === कर्जदार व्यवस्थापन (Borrower Management) ===
  canManageBorrowers: z.boolean().default(false),
  canDeleteBorrowers: z.boolean().default(false), // Dangerous permission
  
  // === अहवाल (Reports Access) ===
  canViewReceiptGenerator: z.boolean().default(false), // पावती जनरेशन
  canViewCashBookReport: z.boolean().default(false), // रोकड वही
  canViewCapitalReport: z.boolean().default(false), // भांडवल खाते
  canViewLedgerReport: z.boolean().default(false), // खाते वही
  canViewBorrowerListReport: z.boolean().default(false), // कर्जदार सूची
  canViewOverdueReport: z.boolean().default(false), // मुदत संपलेले अहवाल
  canViewLoadingReport: z.boolean().default(false), // लोडिंग रिपोर्ट
  canViewAccountSummaryReport: z.boolean().default(false), // खाते सारांश अहवाल
  canViewInformationRegister: z.boolean().default(false), // माहिती तक्ता
  canViewNoticeGenerator: z.boolean().default(false), // नोटीस जनरेटर
  canViewBalanceSheet: z.boolean().default(false), // ताळेबंद
  canViewProfitLoss: z.boolean().default(false), // नफा-तोटा पत्रक
});

type User = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: "user" | "admin";
  isActive: boolean;
  isTemporaryDisabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  loginCount: number;
  permissions: any;
  creator: { username: string; fullName: string | null };
};

type UserFormData = z.infer<typeof userSchema>;
type PermissionsData = z.infer<typeof permissionsSchema>;

function DataEntryModeToggle() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: company } = useQuery<any>({
    queryKey: ["/api/company"],
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
        <div className="flex-1">
          <h3 className="font-medium text-sm">डेटा एन्ट्री मोड</h3>
          <p className="text-xs text-muted-foreground mt-1">
            जुने ट्रांजेक्शन अपलोड करताना हा मोड चालू करा. चालू असताना जुन्या तारखेच्या चेतावणी बंद राहतील.
            <br />
            <span className="text-red-600 font-medium">⚠️ भविष्यातील (future) तारीख चेतावणी नेहमीच चालू राहतील.</span>
            <br />
            <span className="text-amber-600 font-medium">सर्व जुने ट्रांजेक्शन एन्ट्री झाल्यावर हा मोड बंद करा.</span>
          </p>
        </div>
        <Switch
          checked={company?.dataEntryMode || false}
          onCheckedChange={async (checked: boolean) => {
            try {
              await apiRequest("/api/company/data-entry-mode-toggle", "PUT", { enabled: checked });
              qc.invalidateQueries({ queryKey: ["/api/company"] });
              toast({
                title: checked ? "डेटा एन्ट्री मोड चालू" : "डेटा एन्ट्री मोड बंद",
                description: checked
                  ? "तारीख चेतावणी तात्पुरत्या बंद आहेत"
                  : "तारीख चेतावणी पुन्हा चालू झाल्या",
              });
            } catch (error) {
              toast({
                title: "त्रुटी",
                description: "सेटिंग बदलता आली नाही",
                variant: "destructive",
              });
            }
          }}
        />
      </div>
      <div className={`text-xs px-3 py-2 rounded ${company?.dataEntryMode ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
        स्थिती: {company?.dataEntryMode ? '🔶 डेटा एन्ट्री मोड चालू - तारीख चेतावणी बंद' : '✅ सामान्य मोड - तारीख चेतावणी चालू'}
      </div>
    </div>
  );
}

function InterestRateWarningToggle() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: company } = useQuery<any>({
    queryKey: ["/api/company"],
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
        <div className="flex-1">
          <h3 className="font-medium text-sm">व्याजदर वॉर्निंग (Interest Rate चेतावणी)</h3>
          <p className="text-xs text-muted-foreground mt-1">
            कर्ज नोंदणी करताना व्याजदर चुकीचा टाईप केल्यास चेतावणी दाखवते.
            <br />
            <span className="text-amber-600 font-medium">उदा: मासिक 175% → 1.75% सुचवणे, वार्षिक 1.80% → मासिक मध्ये बदला.</span>
          </p>
        </div>
        <Switch
          checked={company?.interestRateWarningEnabled !== false}
          onCheckedChange={async (checked: boolean) => {
            try {
              await apiRequest("/api/company/interest-rate-warning-toggle", "PUT", { enabled: checked });
              qc.invalidateQueries({ queryKey: ["/api/company"] });
              toast({
                title: checked ? "व्याजदर वॉर्निंग चालू" : "व्याजदर वॉर्निंग बंद",
                description: checked
                  ? "व्याजदर चुकीचा असल्यास चेतावणी दिसेल"
                  : "व्याजदर चेतावणी बंद केली",
              });
            } catch (error) {
              toast({
                title: "त्रुटी",
                description: "सेटिंग बदलता आली नाही",
                variant: "destructive",
              });
            }
          }}
        />
      </div>
      <div className={`text-xs px-3 py-2 rounded ${company?.interestRateWarningEnabled !== false ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
        स्थिती: {company?.interestRateWarningEnabled !== false ? '✅ व्याजदर वॉर्निंग चालू — चुकीचा दर टाईप केल्यास सुधारणा सुचवेल' : '🔶 व्याजदर वॉर्निंग बंद — कोणतीही व्याजदर चेतावणी नाही'}
      </div>
    </div>
  );
}

function LtvWarningToggle() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: company } = useQuery<any>({
    queryKey: ["/api/company"],
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
        <div className="flex-1">
          <h3 className="font-medium text-sm">लोडिंग वॉर्निंग (LTV चेतावणी)</h3>
          <p className="text-xs text-muted-foreground mt-1">
            कर्ज सेव्ह करताना रक्कम बाजार मूल्याच्या 80% पेक्षा जास्त असल्यास चेतावणी दाखवते.
            <br />
            <span className="text-amber-600 font-medium">बंद केल्यावर कोणतीही LTV चेतावणी दिसणार नाही.</span>
          </p>
        </div>
        <Switch
          checked={company?.ltvWarningEnabled !== false}
          onCheckedChange={async (checked: boolean) => {
            try {
              await apiRequest("/api/company/ltv-warning-toggle", "PUT", { enabled: checked });
              qc.invalidateQueries({ queryKey: ["/api/company"] });
              toast({
                title: checked ? "लोडिंग वॉर्निंग चालू" : "लोडिंग वॉर्निंग बंद",
                description: checked
                  ? "कर्ज सेव्ह करताना LTV चेतावणी दिसेल"
                  : "LTV चेतावणी बंद केली",
              });
            } catch (error) {
              toast({
                title: "त्रुटी",
                description: "सेटिंग बदलता आली नाही",
                variant: "destructive",
              });
            }
          }}
        />
      </div>
      <div className={`text-xs px-3 py-2 rounded ${company?.ltvWarningEnabled !== false ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
        स्थिती: {company?.ltvWarningEnabled !== false ? '✅ लोडिंग वॉर्निंग चालू — 80% पेक्षा जास्त रक्कमेवर चेतावणी' : '🔶 लोडिंग वॉर्निंग बंद — कोणतीही LTV चेतावणी नाही'}
      </div>
    </div>
  );
}

function AccountNumberSetting() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [startingNumber, setStartingNumber] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [preview, setPreview] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [changedCount, setChangedCount] = useState(0);
  const [excludedCount, setExcludedCount] = useState(0);

  const { data: groups = [] } = useQuery<any[]>({
    queryKey: ["/api/groups"],
  });

  const handlePreview = async () => {
    if (!selectedGroupId || !startingNumber) {
      toast({ title: "त्रुटी", description: "ग्रुप आणि सुरुवातीचा क्रमांक निवडा", variant: "destructive" });
      return;
    }
    setPreviewLoading(true);
    try {
      const body: any = { groupId: selectedGroupId, startingNumber };
      if (fromDate) body.fromDate = fromDate;
      const res = await apiRequest("/api/loans/auto-arrange/preview", "POST", body);
      const data = await res.json();
      setPreview(data.preview || []);
      setChangedCount(data.changedCount || 0);
      setExcludedCount(data.excludedCount || 0);
    } catch (error) {
      toast({ title: "त्रुटी", description: "Preview तयार करता आली नाही", variant: "destructive" });
    }
    setPreviewLoading(false);
  };

  const handleArrange = async () => {
    if (!selectedGroupId || !startingNumber) return;
    setArranging(true);
    try {
      const arrangeBody: any = { groupId: selectedGroupId, startingNumber };
      if (fromDate) arrangeBody.fromDate = fromDate;
      const res = await apiRequest("/api/loans/auto-arrange", "POST", arrangeBody);
      const data = await res.json();
      toast({
        title: "यशस्वी!",
        description: data.message || `${data.updatedCount} कर्जांचे खाते क्रमांक बदलले`,
      });
      qc.invalidateQueries({ queryKey: ["/api/loans"], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
      setShowDialog(false);
      setPreview([]);
      setSelectedGroupId("");
      setStartingNumber("");
      setFromDate("");
      setExcludedCount(0);
    } catch (error) {
      toast({ title: "त्रुटी", description: "खाते क्रमांक बदलताना त्रुटी आली", variant: "destructive" });
    }
    setArranging(false);
  };

  const [showInsertDialog, setShowInsertDialog] = useState(false);
  const [insertGroupId, setInsertGroupId] = useState("");
  const [insertLoanId, setInsertLoanId] = useState("");
  const [insertPosition, setInsertPosition] = useState("");
  const [insertPreview, setInsertPreview] = useState<any[]>([]);
  const [insertPreviewLoading, setInsertPreviewLoading] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [insertChangedCount, setInsertChangedCount] = useState(0);

  const { data: insertGroupLoans = [] } = useQuery<any[]>({
    queryKey: ["/api/loans", { groupId: insertGroupId }],
    queryFn: async () => {
      if (!insertGroupId) return [];
      const res = await apiRequest(`/api/loans?groupId=${insertGroupId}`, "GET");
      return res.json();
    },
    enabled: !!insertGroupId,
  });

  const handleInsertPreview = async () => {
    if (!insertGroupId || !insertLoanId || !insertPosition) {
      toast({ title: "त्रुटी", description: "ग्रुप, कर्ज आणि क्रमांक निवडा", variant: "destructive" });
      return;
    }
    setInsertPreviewLoading(true);
    try {
      const res = await apiRequest("/api/loans/insert-at-position/preview", "POST", {
        groupId: insertGroupId, loanId: insertLoanId, position: insertPosition
      });
      const data = await res.json();
      setInsertPreview(data.preview || []);
      setInsertChangedCount(data.changedCount || 0);
    } catch (error) {
      toast({ title: "त्रुटी", description: "Preview तयार करता आली नाही", variant: "destructive" });
    }
    setInsertPreviewLoading(false);
  };

  const handleInsertExecute = async () => {
    if (!insertGroupId || !insertLoanId || !insertPosition) return;
    setInserting(true);
    try {
      const res = await apiRequest("/api/loans/insert-at-position", "POST", {
        groupId: insertGroupId, loanId: insertLoanId, position: insertPosition
      });
      const data = await res.json();
      toast({
        title: "यशस्वी!",
        description: data.message || `${data.updatedCount} कर्जांचे खाते क्रमांक बदलले`,
      });
      qc.invalidateQueries({ queryKey: ["/api/loans"], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
      setShowInsertDialog(false);
      setInsertPreview([]);
      setInsertGroupId("");
      setInsertLoanId("");
      setInsertPosition("");
    } catch (error) {
      toast({ title: "त्रुटी", description: "खाते क्रमांक बदलताना त्रुटी आली", variant: "destructive" });
    }
    setInserting(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
        <div className="flex-1">
          <h3 className="font-medium text-sm">🔢 खाते नंबर सेटिंग</h3>
          <p className="text-xs text-muted-foreground mt-1">
            ग्रुपमधील सर्व कर्जांचे खाते क्रमांक तारखेनुसार ऑटो अरेंज करा.
            <br />
            <span className="text-indigo-600 font-medium">नंबर टाका → तारखेनुसार sort → sequential क्रमांक automatic!</span>
          </p>
        </div>
        <Button
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={() => setShowDialog(true)}
        >
          ऑटो अरेंज करा
        </Button>
      </div>

      <div className="flex items-center justify-between p-4 rounded-lg border border-green-200 bg-green-50">
        <div className="flex-1">
          <h3 className="font-medium text-sm">🔀 ठिकाणी Insert करा</h3>
          <p className="text-xs text-muted-foreground mt-1">
            एका कर्जाला specific खाते क्रमांक द्या, बाकीचे automatic पुढे shift होतील.
            <br />
            <span className="text-green-600 font-medium">कर्ज निवडा → क्रमांक द्या → बाकीचे automatic shift!</span>
          </p>
        </div>
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => setShowInsertDialog(true)}
        >
          Insert करा
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) { setPreview([]); setSelectedGroupId(""); setStartingNumber(""); setFromDate(""); setExcludedCount(0); } }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">🔢 खाते क्रमांक ऑटो अरेंज</DialogTitle>
            <DialogDescription>
              ग्रुप निवडा, सुरुवातीचा क्रमांक टाका, preview बघा, आणि confirm करा.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">ग्रुप निवडा *</label>
                <Select value={selectedGroupId} onValueChange={(v) => { setSelectedGroupId(v); setPreview([]); }}>
                  <SelectTrigger><SelectValue placeholder="ग्रुप निवडा" /></SelectTrigger>
                  <SelectContent>
                    {groups.map((g: any) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">सुरुवातीचा क्रमांक *</label>
                <Input
                  type="number"
                  min="1"
                  placeholder="उदा. 1, 34, 100"
                  value={startingNumber}
                  onChange={(e) => { setStartingNumber(e.target.value); setPreview([]); }}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">या तारखेपासून <span className="text-muted-foreground font-normal">(ऐच्छिक)</span></label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPreview([]); }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                रिकामी ठेवल्यास सगळे कर्ज अरेंज होतील. तारीख दिल्यास फक्त त्या तारखेपासून पुढचे कर्ज अरेंज होतील.
              </p>
            </div>

            <Button
              onClick={handlePreview}
              disabled={!selectedGroupId || !startingNumber || previewLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              {previewLoading ? "Preview तयार होत आहे..." : "📋 Preview बघा"}
            </Button>

            {preview.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm flex-wrap gap-1">
                  <span className="font-medium">एकूण कर्ज: {preview.length}</span>
                  <div className="flex gap-2">
                    {excludedCount > 0 && (
                      <span className="text-gray-500 font-medium">वगळलेले: {excludedCount}</span>
                    )}
                    <span className={changedCount > 0 ? "text-orange-600 font-medium" : "text-green-600 font-medium"}>
                      {changedCount > 0 ? `${changedCount} बदल होतील` : "कोणताही बदल नाही"}
                    </span>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden max-h-[40vh] overflow-y-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left">जुना क्र.</th>
                        <th className="px-2 py-2 text-center">→</th>
                        <th className="px-2 py-2 text-left">नवीन क्र.</th>
                        <th className="px-2 py-2 text-left">कर्जदार</th>
                        <th className="px-2 py-2 text-left">तारीख</th>
                        <th className="px-2 py-2 text-right">रक्कम</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((item: any, idx: number) => (
                        <tr key={idx} className={item.excluded ? "bg-gray-100 text-gray-400" : item.changed ? "bg-amber-50 font-medium" : ""}>
                          <td className="px-2 py-1.5">{item.oldNumber}</td>
                          <td className="px-2 py-1.5 text-center">{item.excluded ? "—" : item.changed ? "→" : "="}</td>
                          <td className={`px-2 py-1.5 ${item.excluded ? "text-gray-400" : item.changed ? "text-indigo-700 font-bold" : ""}`}>
                            {item.excluded ? item.oldNumber : item.newNumber}
                          </td>
                          <td className="px-2 py-1.5 truncate max-w-[120px]">{item.borrowerName}</td>
                          <td className="px-2 py-1.5">{item.loanDate ? item.loanDate.split('-').reverse().join('/') : ''}</td>
                          <td className="px-2 py-1.5 text-right">₹{Number(item.principalAmount || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {changedCount > 0 && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setShowDialog(false); setPreview([]); }}
                    >
                      रद्द करा
                    </Button>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={handleArrange}
                      disabled={arranging}
                    >
                      {arranging ? "बदलत आहे..." : `✅ ${changedCount} बदल जतन करा`}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showInsertDialog} onOpenChange={(open) => { setShowInsertDialog(open); if (!open) { setInsertPreview([]); setInsertGroupId(""); setInsertLoanId(""); setInsertPosition(""); } }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">🔀 ठिकाणी Insert करा</DialogTitle>
            <DialogDescription>
              कर्ज निवडा, क्रमांक द्या — बाकीचे कर्ज automatic पुढे shift होतील.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">ग्रुप निवडा *</label>
              <Select value={insertGroupId} onValueChange={(v) => { setInsertGroupId(v); setInsertLoanId(""); setInsertPreview([]); }}>
                <SelectTrigger><SelectValue placeholder="ग्रुप निवडा" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {insertGroupId && (
              <div>
                <label className="text-sm font-medium mb-1 block">कर्ज निवडा *</label>
                <Select value={insertLoanId} onValueChange={(v) => { setInsertLoanId(v); setInsertPreview([]); }}>
                  <SelectTrigger><SelectValue placeholder="कर्ज निवडा" /></SelectTrigger>
                  <SelectContent>
                    {(insertGroupLoans as any[])
                      .sort((a: any, b: any) => {
                        const numA = parseInt(a.accountNumber) || 99999;
                        const numB = parseInt(b.accountNumber) || 99999;
                        return numA - numB;
                      })
                      .map((l: any) => (
                        <SelectItem key={l.id} value={l.id}>
                          क्र. {l.accountNumber} - {l.borrowerName} ({l.loanDate ? l.loanDate.split('-').reverse().join('/') : ''})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {insertLoanId && (
              <div>
                <label className="text-sm font-medium mb-1 block">या क्रमांकावर ठेवा *</label>
                <Input
                  type="number"
                  min="1"
                  placeholder="उदा. 35"
                  value={insertPosition}
                  onChange={(e) => { setInsertPosition(e.target.value); setInsertPreview([]); }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  या क्रमांकावर निवडलेलं कर्ज ठेवलं जाईल. बाकीचे कर्ज (या क्रमांकापासून पुढचे) +1 ने shift होतील.
                </p>
              </div>
            )}

            <Button
              onClick={handleInsertPreview}
              disabled={!insertGroupId || !insertLoanId || !insertPosition || insertPreviewLoading}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {insertPreviewLoading ? "Preview तयार होत आहे..." : "📋 Preview बघा"}
            </Button>

            {insertPreview.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm flex-wrap gap-1">
                  <span className="font-medium">एकूण कर्ज: {insertPreview.length}</span>
                  <span className={insertChangedCount > 0 ? "text-orange-600 font-medium" : "text-green-600 font-medium"}>
                    {insertChangedCount > 0 ? `${insertChangedCount} बदल होतील` : "कोणताही बदल नाही"}
                  </span>
                </div>

                <div className="border rounded-lg overflow-hidden max-h-[40vh] overflow-y-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left">जुना क्र.</th>
                        <th className="px-2 py-2 text-center">→</th>
                        <th className="px-2 py-2 text-left">नवीन क्र.</th>
                        <th className="px-2 py-2 text-left">कर्जदार</th>
                        <th className="px-2 py-2 text-left">तारीख</th>
                        <th className="px-2 py-2 text-right">रक्कम</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insertPreview.map((item: any, idx: number) => (
                        <tr key={idx} className={
                          item.type === 'insert' ? "bg-green-50 font-medium" :
                          item.type === 'shift' ? "bg-amber-50 font-medium" : ""
                        }>
                          <td className="px-2 py-1.5">{item.oldNumber}</td>
                          <td className="px-2 py-1.5 text-center">
                            {item.type === 'insert' ? "⬅" : item.changed ? "→" : "="}
                          </td>
                          <td className={`px-2 py-1.5 ${
                            item.type === 'insert' ? "text-green-700 font-bold" :
                            item.type === 'shift' ? "text-orange-700 font-bold" : ""
                          }`}>
                            {item.newNumber}
                          </td>
                          <td className="px-2 py-1.5 truncate max-w-[120px]">{item.borrowerName}</td>
                          <td className="px-2 py-1.5">{item.loanDate ? item.loanDate.split('-').reverse().join('/') : ''}</td>
                          <td className="px-2 py-1.5 text-right">₹{Number(item.principalAmount || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="text-xs space-y-1 p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 bg-green-100 border border-green-300 rounded"></span>
                    <span>Insert होणारं कर्ज (निवडलेलं)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 bg-amber-100 border border-amber-300 rounded"></span>
                    <span>Shift होणारे कर्ज (+1)</span>
                  </div>
                </div>

                {insertChangedCount > 0 && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setShowInsertDialog(false); setInsertPreview([]); }}
                    >
                      रद्द करा
                    </Button>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={handleInsertExecute}
                      disabled={inserting}
                    >
                      {inserting ? "बदलत आहे..." : `✅ ${insertChangedCount} बदल जतन करा`}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function UserManagement() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { safeNavigate } = useSafeNavigation();

  // Fetch current user info using useCurrentUser hook
  const { user: currentUser, isLoading: userLoading, isError: userError } = useCurrentUser();

  // Handle loading state (same as App.tsx)
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">लोड हो रहा है...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated (same as App.tsx)
  if (userError || !currentUser) {
    safeNavigate('/login');
    return null;
  }

  // SIMPLIFIED ACCESS CONTROL - Only allow admin and super_admin (same pattern as App.tsx)
  if (currentUser.role !== 'admin' && currentUser.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">अधिकार नाही</h2>
            <p className="text-red-700 text-sm mb-4">
              User Management पेज केवळ Admin आणि Super Admin users साठी उपलब्ध आहे।
            </p>
            <Button 
              onClick={() => safeNavigate('/')}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              मुख्य पटलावर जा
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // ACCESS GRANTED - Log for debugging
  console.log('✅ User Management ACCESS GRANTED:', { 
    userRole: currentUser.role, 
    tenantId: currentUser.tenantId, 
    accessType: currentUser.role === 'super_admin' ? 'Super Admin' : 'Normal Admin' 
  });

  // Optimized user fetching with super admin priority and no refresh issues
  const { data: users = [], isLoading, error: usersError, refetch } = useQuery<User[]>({
    queryKey: ["/api/user-management/users"],
    staleTime: currentUser.role === 'super_admin' ? 10 * 1000 : 60 * 1000, // Super admin gets fresher data (10s vs 60s)
    gcTime: 5 * 60 * 1000, // 5 minutes cache retention
    refetchOnWindowFocus: false, // Prevent excessive refetches
    retry: (failureCount, error) => {
      // For super admin, retry more aggressively
      if (currentUser.role === 'super_admin') {
        return failureCount < 3;
      }
      return failureCount < 1;
    },
    queryFn: async () => {
      console.log('🔄 User Management: Fetching users for', { userRole: currentUser.role, tenantId: currentUser.tenantId, timestamp: new Date().toISOString() });
      const response = await fetch("/api/user-management/users", {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Users fetch failed:', response.status, errorText);
        throw new Error(`Failed to fetch users: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Users fetched successfully:', data.length, 'users');
      return data;
    }
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: { userData: UserFormData; permissions: PermissionsData }) => {
      await apiRequest("/api/user-management/users", "POST", data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/user-management/users"], refetchType: 'all' });
      setShowCreateDialog(false);
      toast({ title: "Success", description: "User created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create user",
        variant: "destructive" 
      });
    }
  });

  // Update permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: Partial<PermissionsData> }) => {
      await apiRequest(`/api/user-management/users/${userId}/permissions`, "PUT", permissions);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/user-management/users"], refetchType: 'all' });
      setShowPermissionsDialog(false);
      toast({ title: "Success", description: "Permissions updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update permissions",
        variant: "destructive" 
      });
    }
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive, isTemporaryDisabled }: { 
      userId: string; 
      isActive: boolean; 
      isTemporaryDisabled: boolean 
    }) => {
      await apiRequest(`/api/user-management/users/${userId}/status`, "PUT", { isActive, isTemporaryDisabled });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/user-management/users"], refetchType: 'all' });
      toast({ title: "Success", description: "User status updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update status",
        variant: "destructive" 
      });
    }
  });

  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      await apiRequest(`/api/user-management/users/${userId}/password`, "PUT", { newPassword });
    },
    onSuccess: () => {
      setShowPasswordDialog(false);
      toast({ title: "Success", description: "Password updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update password",
        variant: "destructive" 
      });
    }
  });



  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest(`/api/user-management/users/${userId}`, "DELETE");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/user-management/users"], refetchType: 'all' });
      toast({ title: "Success", description: "User deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete user",
        variant: "destructive" 
      });
    }
  });

  // Fetch user activity
  const { data: userActivity = [] } = useQuery<any[]>({
    queryKey: ["/api/user-management/users", selectedUser?.id, "activity"],
    enabled: !!selectedUser && showActivityDialog,
    staleTime: 0
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading users...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-white">
      <MobileNav />
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>
        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
      <div className="p-3 sm:p-6 md:p-8 md:max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">User Management</h1>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground">Manage users, permissions, and access control</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/">
            <Button variant="outline" size="sm">
              <Home className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Home</span>
            </Button>
          </Link>
          
          {/* Force Refresh Button - Permanent Solution for Super Admin */}
          <Button 
            onClick={async () => {
              console.log('🔄 Force refresh initiated by super admin...');
              toast({ title: "Refreshing...", description: "Fetching latest data" });
              
              try {
                // Clear cached data and refetch
                await queryClient.invalidateQueries({ queryKey: ["/api/user-management/users"] });
                await refetch();
                
                toast({ 
                  title: "Success", 
                  description: "Data refreshed successfully",
                  variant: "default"
                });
              } catch (error) {
                console.error('Force refresh failed:', error);
                toast({ 
                  title: "Refresh Failed", 
                  description: "Please try again or reload page",
                  variant: "destructive"
                });
              }
            }}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            {isLoading ? "🔄" : "🔄"} Force Refresh
          </Button>
          


          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-4xl h-[85vh] sm:h-[90vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Create a new user account with custom permissions for your organization.
                </DialogDescription>
              </DialogHeader>
              <CreateUserForm 
                onSubmit={(data) => createUserMutation.mutate(data)}
                isLoading={createUserMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id} className="p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {user.fullName?.charAt(0) || user.username.charAt(0)}
                  </span>
                </div>
                
                <div>
                  <h3 className="font-semibold">{user.fullName}</h3>
                  <p className="text-sm text-muted-foreground">@{user.username}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                  {user.role}
                </Badge>
                
                <Badge variant={user.isActive ? 'default' : 'destructive'}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </Badge>
                
                {user.isTemporaryDisabled && (
                  <Badge variant="outline">Temporarily Disabled</Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedUser(user);
                    setShowPermissionsDialog(true);
                  }}
                  className="text-xs sm:text-sm"
                >
                  <Shield className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">Permissions</span>
                  <span className="sm:hidden">Perms</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedUser(user);
                    setShowPasswordDialog(true);
                  }}
                  className="text-xs sm:text-sm"
                >
                  <Key className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">Password</span>
                  <span className="sm:hidden">Pass</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedUser(user);
                    setShowActivityDialog(true);
                  }}
                  className="text-xs sm:text-sm"
                >
                  <Activity className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">Activity</span>
                  <span className="sm:hidden">Act</span>
                </Button>

                <Button
                  variant={user.isActive ? "outline" : "default"}
                  size="sm"
                  onClick={() => updateStatusMutation.mutate({
                    userId: user.id,
                    isActive: !user.isActive,
                    isTemporaryDisabled: user.isTemporaryDisabled
                  })}
                  className="text-xs sm:text-sm"
                >
                  {user.isActive ? (
                    <>
                      <UserX className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      <span className="hidden sm:inline">Deactivate</span>
                      <span className="sm:hidden">Deact</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      <span className="hidden sm:inline">Activate</span>
                      <span className="sm:hidden">Act</span>
                    </>
                  )}
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete ${user.fullName}?`)) {
                      deleteUserMutation.mutate(user.id);
                    }
                  }}
                  className="text-xs sm:text-sm"
                >
                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">Delete</span>
                  <span className="sm:hidden">Del</span>
                </Button>
              </div>
            </div>

            {user.permissions && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium mb-2">Key Permissions:</h4>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(user.permissions)
                    .filter(([key, value]) => value === true && !['id', 'userId', 'tenantId', 'createdAt', 'updatedAt'].includes(key))
                    .slice(0, 6)
                    .map(([key]) => (
                      <Badge key={key} variant="outline" className="text-xs">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </Badge>
                    ))
                  }
                  {Object.entries(user.permissions).filter(([key, value]) => value === true && !['id', 'userId', 'tenantId', 'createdAt', 'updatedAt'].includes(key)).length > 6 && (
                    <Badge variant="outline" className="text-xs">
                      +{Object.entries(user.permissions).filter(([key, value]) => value === true && !['id', 'userId', 'tenantId', 'createdAt', 'updatedAt'].includes(key)).length - 6} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card className="border border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">⚙️ सिस्टम सेटिंग्स</CardTitle>
        </CardHeader>
        <CardContent>
          <DataEntryModeToggle />
          <div className="mt-4">
            <LtvWarningToggle />
          </div>
          <div className="mt-4">
            <InterestRateWarningToggle />
          </div>
          <div className="mt-4">
            <AccountNumberSetting />
          </div>
        </CardContent>
      </Card>

      {/* Permissions Dialog */}
      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent className="w-[95vw] max-w-4xl h-[85vh] sm:h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              Manage Permissions - {selectedUser?.fullName}
            </DialogTitle>
            <DialogDescription>
              Configure user permissions to control access to different features and reports.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <PermissionsForm
              user={selectedUser}
              onSubmit={(permissions) => updatePermissionsMutation.mutate({
                userId: selectedUser.id,
                permissions
              })}
              isLoading={updatePermissionsMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="w-[95vw] max-w-md mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              Update Password - {selectedUser?.fullName}
            </DialogTitle>
            <DialogDescription>
              Set a new password for this user account.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <PasswordForm
              onSubmit={(newPassword) => updatePasswordMutation.mutate({
                userId: selectedUser.id,
                newPassword
              })}
              isLoading={updatePasswordMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Activity Dialog */}
      <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
        <DialogContent className="w-[95vw] max-w-2xl h-[80vh] overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              User Activity - {selectedUser?.fullName}
            </DialogTitle>
            <DialogDescription>
              View login history and activity logs for this user account.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[50vh] sm:h-[400px]">
            {userActivity.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No activity logs found
              </p>
            ) : (
              <div className="space-y-2">
                {userActivity.map((activity: any, index: number) => (
                  <div key={index} className="p-3 border rounded">
                    <p className="font-medium">{activity.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>


    </div>
        </main>
      </div>
    </div>
  );
}

// Create User Form Component
function CreateUserForm({ 
  onSubmit, 
  isLoading 
}: { 
  onSubmit: (data: { userData: UserFormData; permissions: PermissionsData }) => void;
  isLoading: boolean;
}) {
  const userForm = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: "user",
      password: "",
      confirmPassword: "",
    }
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Watch role changes to update permission defaults
  const selectedRole = userForm.watch("role");

  const permissionsForm = useForm<PermissionsData>({
    resolver: zodResolver(permissionsSchema),
    defaultValues: {
      canViewDashboard: true,
      canAccessInterestCalculator: true,
      canAccessCompanyRegistration: false,
      canAccessGroupManagement: false,
      canAccessLoanRegistration: false,
      canAccessLoanClosure: false,

      canManageBorrowers: false,
      canDeleteBorrowers: false,
      canAccessCashTransactions: false,
      canAccessPartyManagement: false,
      canAccessMobileCashbook: false,
      canViewReceiptGenerator: false,
      canViewCashBookReport: false,
      canViewCapitalReport: false,
      canViewLedgerReport: false,
      canViewBorrowerListReport: false,
      canViewOverdueReport: false,
      canViewAccountSummaryReport: false,
      canViewInformationRegister: false,
      canViewNoticeGenerator: false,
      canViewBalanceSheet: false,
      canViewProfitLoss: false,
    }
  });

  const handleSubmit = async () => {
    const userValid = await userForm.trigger();
    if (!userValid) {
      return;
    }
    const { confirmPassword: _, ...userData } = userForm.getValues();
    const permissions = permissionsForm.getValues();
    onSubmit({ userData: userData as UserFormData, permissions });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basic" className="text-xs sm:text-sm">Basic Info</TabsTrigger>
          <TabsTrigger value="permissions" className="text-xs sm:text-sm">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Form {...userForm}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={userForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={userForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>पासवर्ड</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} placeholder="पासवर्ड टाका" {...field} className="pr-10" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={userForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>पासवर्ड पुष्टी करा</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showConfirmPassword ? "text" : "password"} placeholder="पासवर्ड पुन्हा टाका" {...field} className="pr-10" />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={userForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={userForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (ऐच्छिक)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter email (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={userForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Form>
        </TabsContent>

        <TabsContent value="permissions">
          <Form {...permissionsForm}>
            <div className="space-y-4">
              {/* Duplicate Master Switch removed - PermissionsList component below already provides this functionality */}
              
              <PermissionsList form={permissionsForm} userRole={selectedRole} />
            </div>
          </Form>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button 
          onClick={handleSubmit} 
          disabled={isLoading}
          className="min-w-[120px] w-full sm:w-auto"
        >
          {isLoading ? "Creating..." : "Create User"}
        </Button>
      </div>
    </div>
  );
}

// Permissions Form Component
function PermissionsForm({ 
  user, 
  onSubmit, 
  isLoading 
}: { 
  user: User;
  onSubmit: (permissions: Partial<PermissionsData>) => void;
  isLoading: boolean;
}) {
  const schemaDefaults: PermissionsData = {
    canViewDashboard: true,
    canAccessInterestCalculator: true,
    canAccessCompanyRegistration: false,
    canAccessGroupManagement: false,
    canAccessLoanRegistration: false,
    canAccessLoanClosure: false,
    canAccessCashTransactions: false,
    canAccessPartyManagement: false,
    canAccessMobileCashbook: false,
    canManageBorrowers: false,
    canDeleteBorrowers: false,
    canViewReceiptGenerator: false,
    canViewCashBookReport: false,
    canViewCapitalReport: false,
    canViewLedgerReport: false,
    canViewBorrowerListReport: false,
    canViewOverdueReport: false,
    canViewAccountSummaryReport: false,
    canViewInformationRegister: false,
    canViewNoticeGenerator: false,
    canViewBalanceSheet: false,
    canViewProfitLoss: false,
  };
  const form = useForm<PermissionsData>({
    resolver: zodResolver(permissionsSchema),
    defaultValues: { ...schemaDefaults, ...(user.permissions || {}) }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => onSubmit({ ...data, canViewDashboard: true, canAccessInterestCalculator: true }))} className="space-y-6" autoComplete="off">
        <PermissionsList form={form} userRole={user.role} />
        
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button type="submit" disabled={isLoading} className="min-w-[120px] w-full sm:w-auto">
            {isLoading ? "Updating..." : "Update Permissions"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Password Form Component
function PasswordForm({ 
  onSubmit, 
  isLoading 
}: { 
  onSubmit: (password: string) => void;
  isLoading: boolean;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("पासवर्ड किमान 6 अक्षरांचा असावा");
      return;
    }
    if (password !== confirmPassword) {
      setError("पासवर्ड जुळत नाही");
      return;
    }
    onSubmit(password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      <div>
        <label className="text-sm font-medium">नवीन पासवर्ड</label>
        <div className="relative mt-1">
          <Input
            type={showPwd ? "text" : "password"}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="नवीन पासवर्ड टाका"
            minLength={6}
            required
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPwd(!showPwd)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            tabIndex={-1}
          >
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">पासवर्ड पुष्टी करा</label>
        <div className="relative mt-1">
          <Input
            type={showConfirmPwd ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
            placeholder="पासवर्ड पुन्हा टाका"
            minLength={6}
            required
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPwd(!showConfirmPwd)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            tabIndex={-1}
          >
            {showConfirmPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 font-medium">{error}</p>
      )}

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="submit" disabled={isLoading} className="min-w-[120px] w-full sm:w-auto">
          {isLoading ? "अपडेट करत आहे..." : "पासवर्ड अपडेट करा"}
        </Button>
      </div>
    </form>
  );
}

// Permissions List Component - Hierarchical Role-Based (August 2025)
function PermissionsList({ form, userRole = "user" }: { form: any; userRole?: string }) {
  
  const permissionCategories = {
    "मूलभूत सुविधा (Basic Features - Required)": [
      { key: "canViewDashboard", label: "डॅशबोर्ड पहा", required: true },
      { key: "canAccessInterestCalculator", label: "व्याज कॅल्क्युलेटर", required: true },
    ],
    "फॉर्म आणि डेटा एंट्री (Forms & Data Entry)": [
      { key: "canAccessCompanyRegistration", label: "कंपनी नोंदणी फॉर्म" },
      { key: "canAccessGroupManagement", label: "गट व्यवस्थापन" },
    ],
    "कर्ज व्यवस्थापन (Loan Management)": [
      { key: "canAccessLoanRegistration", label: "कर्ज नोंदणी फॉर्म" },
      { key: "canAccessLoanClosure", label: "कर्ज बंद करा" },
    ],
    "कर्जदार व्यवस्थापन (Borrower Management)": [
      { key: "canManageBorrowers", label: "कर्जदार पहा/तयार/एडिट करा" },
      { key: "canDeleteBorrowers", label: "⚠️ कर्जदार डिलीट करा (धोकादायक)", dangerous: true },
    ],
    "रोकड व्यवहार (Cash Transactions)": [
      { key: "canAccessCashTransactions", label: "रोकड व्यवहार व्यवस्थापन" },
      { key: "canAccessPartyManagement", label: "पार्टी/अकाउंट व्यवस्थापन" },
      { key: "canAccessMobileCashbook", label: "मोबाईल कॅशबुक" },
    ],
    "अहवाल (Individual Reports)": [
      { key: "canViewReceiptGenerator", label: "पावती तयार करा" },
      { key: "canViewNoticeGenerator", label: "नोटीस तयार करा" },
      { key: "canViewCashBookReport", label: "रोकड वही अहवाल" },
      { key: "canViewCapitalReport", label: "भांडवल अहवाल" },
      { key: "canViewLedgerReport", label: "खाते वही अहवाल" },
      { key: "canViewBorrowerListReport", label: "कर्जदार यादी अहवाल" },
      { key: "canViewOverdueReport", label: "थकबाकी अहवाल" },
      { key: "canViewLoadingReport", label: "लोडिंग रिपोर्ट (LTV)" },
      { key: "canViewAccountSummaryReport", label: "खाते सारांश अहवाल" },
      { key: "canViewInformationRegister", label: "माहिती तक्ता अहवाल" },
      { key: "canViewBalanceSheet", label: "ताळेबंद (Balance Sheet)" },
      { key: "canViewProfitLoss", label: "नफा-तोटा पत्रक (P&L)" },
    ]
  };

  // Filter categories based on user role being created
  const filteredCategories = Object.entries(permissionCategories).filter(([category, permissions]) => {
    // For User role - exclude admin and super admin sections
    if (userRole === "user") {
      return !category.includes("Admin Only") && !category.includes("Super Admin Only");
    }
    // For Admin role - exclude super admin only sections
    if (userRole === "admin") {
      return !category.includes("Super Admin Only");
    }
    // For Super Admin - show all
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg">
        <h4 className="font-semibold text-indigo-800 mb-2">भूमिका आधारित परमिशन (Role-Based Permissions)</h4>
        <div className="text-sm text-indigo-700">
          <p><strong>User:</strong> फक्त forms आणि reports - कोणते admin panels नाहीत</p>
          <p><strong>Admin:</strong> User permissions + management functions</p>
          <p><strong>Super Admin:</strong> सर्व permissions including super admin panel</p>
        </div>
      </div>
      
      {/* Master Toggle Switch */}
      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-md font-semibold text-green-800">Master Permission Switch</h4>
            <p className="text-sm text-green-600">एकाच क्लिकमध्ये सगळी मुख्य permissions चालू करा (Reports आणि Delete वगळून)</p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                form.setValue("canViewDashboard", true);
                form.setValue("canAccessInterestCalculator", true);
                form.setValue("canAccessCompanyRegistration", true);
                form.setValue("canAccessGroupManagement", true);
                form.setValue("canAccessLoanRegistration", true);
                form.setValue("canAccessLoanClosure", true);
                form.setValue("canManageBorrowers", true);
                form.setValue("canAccessCashTransactions", true);
                form.setValue("canAccessPartyManagement", true);
                form.setValue("canAccessMobileCashbook", true);
              }}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              🚀 सर्व मुख्य चालू
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                form.setValue("canViewDashboard", true);
                form.setValue("canAccessInterestCalculator", true);
                form.setValue("canAccessCompanyRegistration", false);
                form.setValue("canAccessGroupManagement", false);
                form.setValue("canAccessLoanRegistration", false);
                form.setValue("canAccessLoanClosure", false);
                form.setValue("canManageBorrowers", false);
                form.setValue("canDeleteBorrowers", false);
                form.setValue("canAccessCashTransactions", false);
                form.setValue("canAccessPartyManagement", false);
                form.setValue("canAccessMobileCashbook", false);
                form.setValue("canViewReceiptGenerator", false);
                form.setValue("canViewNoticeGenerator", false);
                form.setValue("canViewCashBookReport", false);
                form.setValue("canViewCapitalReport", false);
                form.setValue("canViewLedgerReport", false);
                form.setValue("canViewBorrowerListReport", false);
                form.setValue("canViewOverdueReport", false);
                form.setValue("canViewLoadingReport", false);
                form.setValue("canViewAccountSummaryReport", false);
                form.setValue("canViewInformationRegister", false);
                form.setValue("canViewBalanceSheet", false);
                form.setValue("canViewProfitLoss", false);
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              🔒 सगळं बंद करा
            </Button>
          </div>
        </div>
        <div className="mt-2 text-xs text-green-600">
          <strong>चालू होणारे:</strong> कंपनी नोंदणी, गट व्यवस्थापन, कर्ज नोंदणी/बंद, कर्जदार व्यवस्थापन, रोकड व्यवहार, पार्टी व्यवस्थापन, मोबाईल कॅशबुक<br/>
          <strong>Manual राहणारे:</strong> सर्व Reports permissions, Delete permissions (security साठी)
        </div>
      </div>
      
      {/* Permission Presets */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h4 className="text-md font-semibold text-blue-800 mb-2">Quick Presets - तयार सेटिंग्ज</h4>
        <p className="text-sm text-blue-600 mb-3">एका क्लिकमध्ये योग्य permissions सेट करा</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              form.setValue("canViewDashboard", true);
              form.setValue("canAccessInterestCalculator", true);
              form.setValue("canAccessCompanyRegistration", true);
              form.setValue("canAccessGroupManagement", true);
              form.setValue("canAccessLoanRegistration", true);
              form.setValue("canAccessLoanClosure", true);
              form.setValue("canManageBorrowers", true);
              form.setValue("canAccessCashTransactions", true);
              form.setValue("canAccessPartyManagement", true);
              form.setValue("canAccessMobileCashbook", true);
              form.setValue("canViewReceiptGenerator", true);
              form.setValue("canViewNoticeGenerator", true);
              form.setValue("canViewCashBookReport", true);
              form.setValue("canViewCapitalReport", true);
              form.setValue("canViewLedgerReport", true);
              form.setValue("canViewBorrowerListReport", true);
              form.setValue("canViewOverdueReport", true);
              form.setValue("canViewLoadingReport", true);
              form.setValue("canViewAccountSummaryReport", true);
              form.setValue("canViewInformationRegister", true);
              form.setValue("canViewBalanceSheet", true);
              form.setValue("canViewProfitLoss", true);
              form.setValue("canDeleteBorrowers", false);
            }}
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            ⭐ सर्व चालू (Delete वगळून)
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              form.setValue("canViewDashboard", true);
              form.setValue("canAccessInterestCalculator", true);
              form.setValue("canAccessCompanyRegistration", false);
              form.setValue("canAccessGroupManagement", false);
              form.setValue("canAccessLoanRegistration", false);
              form.setValue("canAccessLoanClosure", false);
              form.setValue("canManageBorrowers", false);
              form.setValue("canDeleteBorrowers", false);
              form.setValue("canAccessCashTransactions", false);
              form.setValue("canAccessPartyManagement", false);
              form.setValue("canAccessMobileCashbook", false);
              form.setValue("canViewReceiptGenerator", true);
              form.setValue("canViewNoticeGenerator", true);
              form.setValue("canViewCashBookReport", true);
              form.setValue("canViewCapitalReport", true);
              form.setValue("canViewLedgerReport", true);
              form.setValue("canViewBorrowerListReport", true);
              form.setValue("canViewOverdueReport", true);
              form.setValue("canViewLoadingReport", true);
              form.setValue("canViewAccountSummaryReport", true);
              form.setValue("canViewInformationRegister", true);
              form.setValue("canViewBalanceSheet", true);
              form.setValue("canViewProfitLoss", true);
            }}
            className="bg-cyan-600 text-white hover:bg-cyan-700"
          >
            👁️ फक्त पहा (View Only)
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              form.setValue("canViewDashboard", true);
              form.setValue("canAccessInterestCalculator", true);
              form.setValue("canAccessCompanyRegistration", true);
              form.setValue("canAccessGroupManagement", true);
              form.setValue("canAccessLoanRegistration", true);
              form.setValue("canAccessLoanClosure", true);
              form.setValue("canManageBorrowers", true);
              form.setValue("canDeleteBorrowers", false);
              form.setValue("canAccessCashTransactions", true);
              form.setValue("canAccessPartyManagement", true);
              form.setValue("canAccessMobileCashbook", true);
              form.setValue("canViewReceiptGenerator", false);
              form.setValue("canViewNoticeGenerator", false);
              form.setValue("canViewCashBookReport", false);
              form.setValue("canViewCapitalReport", false);
              form.setValue("canViewLedgerReport", false);
              form.setValue("canViewBorrowerListReport", false);
              form.setValue("canViewOverdueReport", false);
              form.setValue("canViewLoadingReport", false);
              form.setValue("canViewAccountSummaryReport", false);
              form.setValue("canViewInformationRegister", false);
              form.setValue("canViewBalanceSheet", false);
              form.setValue("canViewProfitLoss", false);
            }}
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            ✏️ डेटा एंट्री (Reports वगळून)
          </Button>
        </div>
        <div className="mt-2 text-xs text-blue-600">
          <strong>सर्व चालू:</strong> सगळं चालू (Delete वगळून) | <strong>फक्त पहा:</strong> Dashboard + सर्व Reports | <strong>डेटा एंट्री:</strong> Forms + Loan + Cash (Reports वगळून)
        </div>
      </div>
      
      {filteredCategories.map(([category, permissions]) => (
        <div key={category}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-indigo-600">{category}</h3>
            {category.includes("अहवाल") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  form.setValue("canViewReceiptGenerator", true);
                  form.setValue("canViewNoticeGenerator", true);
                  form.setValue("canViewCashBookReport", true);
                  form.setValue("canViewCapitalReport", true);
                  form.setValue("canViewLedgerReport", true);
                  form.setValue("canViewBorrowerListReport", true);
                  form.setValue("canViewOverdueReport", true);
                  form.setValue("canViewLoadingReport", true);
                  form.setValue("canViewAccountSummaryReport", true);
                  form.setValue("canViewInformationRegister", true);
                  form.setValue("canViewBalanceSheet", true);
                  form.setValue("canViewProfitLoss", true);
                }}
                className="bg-purple-600 text-white hover:bg-purple-700 text-xs"
              >
                📊 सर्व अहवाल चालू करा
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 bg-gray-50 p-4 rounded-lg">
            {permissions.map((permission) => {
              const { key, label } = permission;
              const required = (permission as any).required || false;
              const adminOnly = (permission as any).adminOnly || false;
              const superAdminOnly = (permission as any).superAdminOnly || false;
              
              return (
              <FormField
                key={key}
                control={form.control}
                name={key}
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-x-3 bg-white p-3 rounded border">
                    <div className="flex-1">
                      <FormLabel className="text-sm font-medium cursor-pointer">
                        {label}
                        {required && <span className="text-red-500 ml-1">*</span>}
                      </FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={required ? true : field.value}
                        onCheckedChange={field.onChange}
                        disabled={required || (adminOnly && userRole === "user") || (superAdminOnly && userRole !== "super_admin")}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            );
            })}
          </div>
        </div>
      ))}
      
      <div className="bg-indigo-50 p-4 rounded-lg">
        <p className="text-sm text-indigo-700">
          <strong>लक्ष ठेवा:</strong> लाल तार्‍यांका (*) असलेली permissions सर्व users साठी आवश्यक आहेत.
          Dashboard आणि Interest Calculator सर्वांना उपलब्ध असतील.
        </p>
      </div>
    </div>
  );
}