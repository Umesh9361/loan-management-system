import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Users,
  Building,
  Plus,
  Activity,
  Calendar,
  Shield,
  AlertTriangle,
  TrendingUp,
  Clock,
  Eye,
  EyeOff,
} from "lucide-react";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";

// Schema for new tenant creation
const createTenantSchema = z.object({
  tenantId: z.string().min(1, "Tenant ID आवश्यक आहे").max(20, "Tenant ID जास्तीत जास्त 20 अक्षरांची असावी"),
  adminUsername: z.string().min(1, "Admin username आवश्यक आहे"),
  adminPassword: z.string().min(6, "Password कमीत कमी 6 अक्षरांचा असावा"),
  confirmPassword: z.string().min(1, "Confirm Password आवश्यक आहे"),
  companyName: z.string().min(1, "Company name आवश्यक आहे"),
  companyAddress: z.string().optional(),
  subscriptionType: z.enum(["lifetime", "time_limited"]).default("lifetime"),
  subscriptionMonths: z.number().min(1).optional(),
}).refine((data) => data.adminPassword === data.confirmPassword, {
  message: "दोन्ही passwords सारखे असावेत",
  path: ["confirmPassword"],
}).refine((data) => {
  if (data.subscriptionType === "time_limited" && (!data.subscriptionMonths || data.subscriptionMonths < 1)) {
    return false;
  }
  return true;
}, {
  message: "कालमर्यादित सदस्यत्वासाठी महिने आवश्यक आहेत",
  path: ["subscriptionMonths"],
});

type CreateTenantFormData = z.infer<typeof createTenantSchema>;

interface TenantStats {
  tenantId: string;
  userCount: string;
  activeUsers: string;
  loanCount: string;
  groupCount: string;
  borrowerCount: string;
  cashTransactionCount: string;
  lastActivity: string;
}

interface TenantActivity {
  tenantId: string;
  lastLoginAt: string;
  daysSinceLastActivity: number;
  isInactive: boolean;
}

export default function SuperAdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateTenantDialogOpen, setIsCreateTenantDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form for creating new tenant
  const createTenantForm = useForm<CreateTenantFormData>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      tenantId: "",
      adminUsername: "admin",
      adminPassword: "",
      confirmPassword: "",
      companyName: "",
      companyAddress: "",
      subscriptionType: "lifetime",
      subscriptionMonths: undefined,
    },
  });

  // Fetch tenant statistics
  const { data: tenantStats = [], isLoading: isStatsLoading } = useQuery<TenantStats[]>({
    queryKey: ["/api/super-admin/tenant-stats"],
  });

  // Get storage analytics
  const { data: storageAnalytics = [], isLoading: isStorageLoading } = useQuery<any[]>({
    queryKey: ["/api/super-admin/storage-analytics"],
  });

  const filteredTenantStats = tenantStats.filter(s => s.tenantId !== 'SUPER_ADMIN');
  const filteredStorageAnalytics = storageAnalytics.filter((s: any) => s.tenantId !== 'SUPER_ADMIN');

  // Calculate tenant activity metrics
  const tenantActivity: TenantActivity[] = filteredTenantStats.map(stat => {
    const lastActivity = new Date(stat.lastActivity);
    const now = new Date();
    const daysSinceLastActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      tenantId: stat.tenantId,
      lastLoginAt: stat.lastActivity,
      daysSinceLastActivity,
      isInactive: daysSinceLastActivity > 7 // Mark as inactive if no activity for 7+ days
    };
  });

  // Create new tenant mutation
  const createTenantMutation = useMutation({
    mutationFn: async (data: CreateTenantFormData) => {
      const response = await fetch("/api/super-admin/create-tenant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create tenant");
      }
      
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenant-stats"], refetchType: 'all' });
      setIsCreateTenantDialogOpen(false);
      createTenantForm.reset();
      toast({
        title: "नवीन टेनंट तयार केले",
        description: "नवीन टेनंट आणि admin user यशस्वीपणे तयार केले आहे",
      });
    },
    onError: (error: any) => {
      toast({
        title: "त्रुटी",
        description: error.message || "टेनंट तयार करण्यात अपयश",
        variant: "destructive",
      });
    },
  });

  const handleCreateTenant = (data: CreateTenantFormData) => {
    const { confirmPassword, ...submitData } = data;
    submitData.tenantId = submitData.tenantId.toUpperCase();
    createTenantMutation.mutate(submitData as any);
  };

  if (isStatsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">लोड हो रहा है...</p>
        </div>
      </div>
    );
  }

  // Calculate summary metrics
  const totalTenants = filteredTenantStats.length;
  const totalUsers = filteredTenantStats.reduce((sum, stat) => sum + parseInt(stat.userCount), 0);
  const activeUsers = filteredTenantStats.reduce((sum, stat) => sum + parseInt(stat.activeUsers), 0);
  const inactiveTenants = tenantActivity.filter(t => t.isInactive).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileNav />
      
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 font-noto">
                  सुपर एडमिन डॅशबोर्ड
                </h1>
                <p className="text-gray-600 mt-2">
                  संपूर्ण सिस्टम व्यवस्थापन आणि टेनंट निगरानी
                </p>
              </div>

              <Dialog open={isCreateTenantDialogOpen} onOpenChange={setIsCreateTenantDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="mr-2 h-4 w-4" />
                    नवीन टेनंट तयार करा
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-noto">नवीन टेनंट तयार करा</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={createTenantForm.handleSubmit(handleCreateTenant)} className="space-y-4" autoComplete="off">
                    <div>
                      <Label>टेनंट आयडी</Label>
                      <Input 
                        {...createTenantForm.register("tenantId")} 
                        placeholder="उदा: COMPANY_ABC"
                        className="uppercase"
                      />
                      {createTenantForm.formState.errors.tenantId && (
                        <p className="text-red-500 text-sm mt-1">
                          {createTenantForm.formState.errors.tenantId.message}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label>कंपनी नाव</Label>
                      <Input {...createTenantForm.register("companyName")} />
                      {createTenantForm.formState.errors.companyName && (
                        <p className="text-red-500 text-sm mt-1">
                          {createTenantForm.formState.errors.companyName.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label>कंपनी पत्ता (वैकल्पिक)</Label>
                      <Input {...createTenantForm.register("companyAddress")} />
                    </div>

                    <div>
                      <Label>सदस्यत्व प्रकार</Label>
                      <select
                        {...createTenantForm.register("subscriptionType")}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="lifetime">कायमस्वरूपी (Lifetime)</option>
                        <option value="time_limited">कालमर्यादित (Time Limited)</option>
                      </select>
                    </div>

                    {createTenantForm.watch("subscriptionType") === "time_limited" && (
                      <div>
                        <Label>सदस्यत्व कालावधी (महिने)</Label>
                        <Input
                          type="number"
                          min={1}
                          placeholder="उदा: 12, 24, 36"
                          {...createTenantForm.register("subscriptionMonths", { valueAsNumber: true })}
                        />
                        {createTenantForm.formState.errors.subscriptionMonths && (
                          <p className="text-red-500 text-sm mt-1">
                            {createTenantForm.formState.errors.subscriptionMonths.message}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div>
                      <Label>Admin Username</Label>
                      <Input {...createTenantForm.register("adminUsername")} />
                      {createTenantForm.formState.errors.adminUsername && (
                        <p className="text-red-500 text-sm mt-1">
                          {createTenantForm.formState.errors.adminUsername.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label>Admin Password</Label>
                      <div className="relative">
                        <Input 
                          type={showPassword ? "text" : "password"} 
                          {...createTenantForm.register("adminPassword")} 
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {createTenantForm.formState.errors.adminPassword && (
                        <p className="text-red-500 text-sm mt-1">
                          {createTenantForm.formState.errors.adminPassword.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label>Confirm Password</Label>
                      <div className="relative">
                        <Input 
                          type={showConfirmPassword ? "text" : "password"} 
                          {...createTenantForm.register("confirmPassword")} 
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {createTenantForm.formState.errors.confirmPassword && (
                        <p className="text-red-500 text-sm mt-1">
                          {createTenantForm.formState.errors.confirmPassword.message}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsCreateTenantDialogOpen(false)}
                      >
                        रद्द करा
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createTenantMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {createTenantMutation.isPending ? "तयार करत आहे..." : "तयार करा"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm md:text-base font-medium">एकूण टेनंट</CardTitle>
                  <Building className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="md:p-6">
                  <div className="text-2xl md:text-3xl font-bold">{totalTenants}</div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    सक्रिय कंपन्या
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm md:text-base font-medium">एकूण वापरकर्ते</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="md:p-6">
                  <div className="text-2xl md:text-3xl font-bold">{totalUsers}</div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    सर्व टेनंट मधील
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm md:text-base font-medium">सक्रिय वापरकर्ते</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="md:p-6">
                  <div className="text-2xl md:text-3xl font-bold">{activeUsers}</div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    चालू असलेले
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm md:text-base font-medium">निष्क्रिय टेनंट</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="md:p-6">
                  <div className="text-2xl md:text-3xl font-bold text-red-600">{inactiveTenants}</div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    7+ दिवस निष्क्रिय
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Storage Analytics */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-noto">
                  <TrendingUp className="h-5 w-5" />
                  डेटा स्टोरेज विश्लेषण - प्रत्येक टेनंट चा स्टोरेज वापर
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isStorageLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-gray-600">स्टोरेज डेटा लोड करत आहे...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredStorageAnalytics.length > 0 ? (
                      filteredStorageAnalytics.map((tenant: any) => (
                        <div key={tenant.tenantId} className="border rounded-lg p-4 md:p-6 bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h3 className="font-semibold text-lg">{tenant.companyName}</h3>
                              <p className="text-sm text-gray-600">टेनंट ID: {tenant.tenantId}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-indigo-600">{tenant.storage.formattedSize}</p>
                              <p className="text-sm text-gray-600">एकूण स्टोरेज</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                            <div className="text-center p-2 md:p-3 bg-white rounded">
                              <p className="font-medium text-gray-700 md:text-base">{tenant.recordCounts.users}</p>
                              <p className="text-gray-500 md:text-sm">वापरकर्ते</p>
                            </div>
                            <div className="text-center p-2 md:p-3 bg-white rounded">
                              <p className="font-medium text-gray-700 md:text-base">{tenant.recordCounts.borrowers}</p>
                              <p className="text-gray-500 md:text-sm">कर्जदार</p>
                            </div>
                            <div className="text-center p-2 md:p-3 bg-white rounded">
                              <p className="font-medium text-gray-700 md:text-base">{tenant.recordCounts.loans}</p>
                              <p className="text-gray-500 md:text-sm">कर्जे</p>
                            </div>
                            <div className="text-center p-2 md:p-3 bg-white rounded">
                              <p className="font-medium text-gray-700 md:text-base">{tenant.recordCounts.transactions}</p>
                              <p className="text-gray-500 md:text-sm">व्यवहार</p>
                            </div>
                            <div className="text-center p-2 md:p-3 bg-white rounded">
                              <p className="font-medium text-gray-700 md:text-base">{tenant.recordCounts.cashTransactions}</p>
                              <p className="text-gray-500 md:text-sm">रोकड व्यवहार</p>
                            </div>
                          </div>
                          
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-gray-600">
                              डेटा वितरण: कर्जे ({tenant.storage.breakdown.loans} MB), व्यवहार ({tenant.storage.breakdown.transactions} MB), 
                              रोकड ({tenant.storage.breakdown.cashTransactions} MB), कर्जदार ({tenant.storage.breakdown.borrowers} MB)
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>अद्याप कोणताही स्टोरेज डेटा उपलब्ध नाही</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    User Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    सर्व टेनंट मधील वापरकर्ते व्यवस्थापित करा
                  </p>
                  <Link href="/super-admin">
                    <Button variant="outline" className="w-full">
                      <Users className="h-4 w-4 mr-2" />
                      वापरकर्ता व्यवस्थापन
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Tenant Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    टेनंट डेटा आणि statistics व्यवस्थापित करा
                  </p>
                  <Link href="/super-admin-tenant-management">
                    <Button variant="outline" className="w-full">
                      <Building className="h-4 w-4 mr-2" />
                      टेनंट व्यवस्थापन
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    System Monitoring
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    सिस्टम performance आणि activity monitor करा
                  </p>
                  <Button variant="outline" className="w-full" disabled>
                    <Activity className="h-4 w-4 mr-2" />
                    लवकरच उपलब्ध
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Tenant Activity Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center font-noto">
                  <Clock className="mr-2 h-5 w-5" />
                  टेनंट गतिविधी निगरानी
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>टेनंट आयडी</TableHead>
                        <TableHead>वापरकर्ते</TableHead>
                        <TableHead>कर्ज</TableHead>
                        <TableHead>गट</TableHead>
                        <TableHead>शेवटची गतिविधी</TableHead>
                        <TableHead>स्थिती</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTenantStats.map((stat) => {
                        const activity = tenantActivity.find(a => a.tenantId === stat.tenantId);
                        const isInactive = activity?.isInactive || false;
                        
                        return (
                          <TableRow key={stat.tenantId}>
                            <TableCell className="font-medium">
                              <Badge variant="outline">{stat.tenantId}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {stat.activeUsers}/{stat.userCount} सक्रिय
                              </span>
                            </TableCell>
                            <TableCell>{stat.loanCount}</TableCell>
                            <TableCell>{stat.groupCount}</TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {new Date(stat.lastActivity).toLocaleDateString('hi-IN')}
                              </span>
                              <br />
                              <span className="text-xs text-gray-500">
                                {activity?.daysSinceLastActivity || 0} दिवस आधी
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={isInactive ? "destructive" : "default"}
                                className={isInactive ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}
                              >
                                {isInactive ? "निष्क्रिय" : "सक्रिय"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredTenantStats.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">कोणतेही टेनंट आढळले नाहीत</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}