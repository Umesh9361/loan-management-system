import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  Trash2,
  Building,
  Users,
  Activity,
  Calendar,
  AlertTriangle,
  ArrowLeft,
  Database,
  UserX,
  UserCheck,
  Clock,
  Lock,
  Power,
  Eye,
  EyeOff,
} from "lucide-react";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface TenantInfo {
  tenantId: string;
  companyName: string;
  address?: string;
  createdAt: string;
  userCount: number;
  activeUserCount: number;
  loanCount: number;
  lastActivity: string;
  daysSinceLastActivity: number;
  isInactive: boolean;
  isActive: boolean;
}

export default function SuperAdminTenantManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingTenant, setDeletingTenant] = useState<string | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
  const [disableHours, setDisableHours] = useState<string>("24");
  const [resetPasswordAdmin, setResetPasswordAdmin] = useState<any>(null);
  const [newPassword, setNewPassword] = useState<string>("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [deletingAdmin, setDeletingAdmin] = useState<string | null>(null);
  const [approveRequestAdmin, setApproveRequestAdmin] = useState<any>(null);
  const [requestPassword, setRequestPassword] = useState<string>("");
  const [confirmRequestPassword, setConfirmRequestPassword] = useState("");
  const [showRequestPassword, setShowRequestPassword] = useState(false);
  const [showConfirmRequestPassword, setShowConfirmRequestPassword] = useState(false);
  const [changingOwnPassword, setChangingOwnPassword] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newOwnPassword, setNewOwnPassword] = useState<string>("");
  const [confirmOwnPassword, setConfirmOwnPassword] = useState<string>("");
  const [showOwnCurrentPassword, setShowOwnCurrentPassword] = useState(false);
  const [showOwnNewPassword, setShowOwnNewPassword] = useState(false);
  const [showOwnConfirmPassword, setShowOwnConfirmPassword] = useState(false);
  const [togglingTenant, setTogglingTenant] = useState<string | null>(null);

  // Fetch all tenants
  const { data: tenants = [], isLoading, refetch } = useQuery<TenantInfo[]>({
    queryKey: ["/api/super-admin/tenants"],
  });

  // Fetch ONLY normal tenant admin users for enable/disable functionality - NO super admin users or regular users
  const { data: adminUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/super-admin/admin-users"],
    staleTime: 30000
  });

  // Query for password reset requests
  const { data: passwordResetRequests = [], isLoading: requestsLoading } = useQuery<any[]>({
    queryKey: ["/api/super-admin/password-reset-requests"],
  });

  // Simple disable admin mutation
  const temporaryDisableAdminMutation = useMutation({
    mutationFn: async ({ adminId }: { adminId: string; hours?: number }) => {
      await apiRequest(`/api/super-admin/admin/${adminId}/temporary-disable`, "POST");
    },
    onSuccess: () => {
      toast({
        title: "Admin Disabled",
        description: "Admin access has been disabled.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/admin-users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disable admin",
        variant: "destructive",
      });
    },
  });

  // Temporary enable admin mutation
  const temporaryEnableAdminMutation = useMutation({
    mutationFn: async (adminId: string) => {
      await apiRequest(`/api/super-admin/admin/${adminId}/temporary-enable`, "POST");
    },
    onSuccess: () => {
      toast({
        title: "Admin Enabled",
        description: "Admin access has been restored.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/admin-users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to enable admin",
        variant: "destructive",
      });
    },
  });

  // Toggle tenant mutation
  const toggleTenantMutation = useMutation({
    mutationFn: async ({ tenantId, isActive }: { tenantId: string; isActive: boolean }) => {
      await apiRequest(`/api/super-admin/tenants/${tenantId}/toggle`, "PATCH", { isActive });
    },
    onSuccess: () => {
      toast({
        title: "टेनंट स्थिती बदली",
        description: "टेनंट स्थिती यशस्वीरित्या अपडेट झाली.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      setTogglingTenant(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to toggle tenant status",
        variant: "destructive",
      });
      setTogglingTenant(null);
    },
  });

  // Delete tenant mutation
  const deleteTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const response = await apiRequest(`/api/super-admin/delete-tenant/${tenantId}`, "DELETE");
      return response;
    },
    onSuccess: (data, tenantId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenant-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/storage-analytics"] });
      setDeletingTenant(null);
      
      toast({
        title: "टेनंट डिलीट झाले",
        description: `${tenantId} आणि त्याचा सर्व डेटा पूर्णपणे डिलीट झाला आहे. एकूण ${(data as any)?.deletedRecords?.totalDeleted || 0} records डिलीट केले.`,
      });
    },
    onError: (error: any) => {
      setDeletingTenant(null);
      toast({
        title: "त्रुटी",
        description: error.message || "टेनंट डिलीट करण्यात अपयश",
        variant: "destructive",
      });
    },
  });

  // Reset admin password mutation
  const resetAdminPasswordMutation = useMutation({
    mutationFn: async ({ adminId, newPassword }: { adminId: string; newPassword: string }) => {
      await apiRequest(`/api/super-admin/reset-admin-password/${adminId}`, "POST", { newPassword });
    },
    onSuccess: () => {
      toast({
        title: "Password Reset Successfully",
        description: "Admin password has been reset successfully.",
      });
      setResetPasswordAdmin(null);
      setNewPassword("");
      setResetConfirmPassword("");
      setShowResetPassword(false);
      setShowResetConfirmPassword(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset admin password",
        variant: "destructive",
      });
    },
  });

  // Delete admin user mutation
  const deleteAdminMutation = useMutation({
    mutationFn: async (adminId: string) => {
      await apiRequest(`/api/super-admin/delete-admin/${adminId}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Admin Deleted Successfully", 
        description: "Admin user has been permanently deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/admin-users"] });
      setDeletingAdmin(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete admin user",
        variant: "destructive",
      });
      setDeletingAdmin(null);
    },
  });

  // Change own password mutation for Super Admin
  const changeOwnPasswordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      await apiRequest("/api/super-admin/change-own-password", "POST", { currentPassword, newPassword });
    },
    onSuccess: () => {
      toast({
        title: "Password Changed Successfully",
        description: "Your Super Admin password has been updated successfully.",
      });
      setChangingOwnPassword(false);
      setCurrentPassword("");
      setNewOwnPassword("");
      setConfirmOwnPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password. Please check your current password.",
        variant: "destructive",
      });
    },
  });

  const handleChangeOwnPassword = () => {
    if (newOwnPassword !== confirmOwnPassword) {
      toast({
        title: "Error",
        description: "New password and confirm password do not match.",
        variant: "destructive",
      });
      return;
    }

    if (newOwnPassword.length < 6) {
      toast({
        title: "Error", 
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    changeOwnPasswordMutation.mutate({
      currentPassword,
      newPassword: newOwnPassword
    });
  };

  const handleResetPassword = (admin: any) => {
    setResetPasswordAdmin(admin);
  };

  const handleDeleteAdmin = (adminId: string) => {
    setDeletingAdmin(adminId);
    deleteAdminMutation.mutate(adminId);
  };

  const handleDeleteTenant = (tenantId: string) => {
    setDeletingTenant(tenantId);
    deleteTenantMutation.mutate(tenantId);
  };

  const handleToggleTenant = (tenantId: string, currentActiveStatus: boolean) => {
    setTogglingTenant(tenantId);
    toggleTenantMutation.mutate({ 
      tenantId, 
      isActive: !currentActiveStatus 
    });
  };

  // Approve password reset request mutation
  const approvePasswordResetMutation = useMutation({
    mutationFn: async ({ requestId, newPassword }: { requestId: string; newPassword: string }) => {
      await apiRequest(`/api/super-admin/approve-password-reset/${requestId}`, "POST", { newPassword });
    },
    onSuccess: () => {
      toast({
        title: "Password Reset Approved",
        description: "Admin password has been reset successfully.",
      });
      setApproveRequestAdmin(null);
      setRequestPassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/password-reset-requests"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve password reset",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileNav />
        <div className="lg:flex">
          <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
            <Sidebar />
          </aside>
          <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
            <div className="px-4 sm:px-6 lg:px-8 py-6">
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-gray-600">टेनंट डेटा लोड करत आहे...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

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
              <div className="flex items-center gap-4">
                <Link href="/super-admin-dashboard">
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    मागे जा
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 font-noto">
                    टेनंट व्यवस्थापन
                  </h1>
                  <p className="text-gray-600 mt-2">
                    सर्व टेनंट व्यवस्थापित करा आणि निष्क्रिय टेनंट डिलीट करा
                  </p>
                </div>
              </div>
              
              {/* Super Admin Own Password Change Button */}
              <Button 
                variant="outline" 
                onClick={() => setChangingOwnPassword(true)}
                className="flex items-center gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                <Lock className="h-4 w-4" />
                स्वतःचा पासवर्ड बदला
              </Button>
            </div>

            {/* Password Reset Requests Section */}
            {passwordResetRequests.length > 0 && (
              <Card className="mb-6 border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="flex items-center font-noto text-orange-700">
                    <Clock className="mr-2 h-5 w-5" />
                    Password Reset Requests ({passwordResetRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {passwordResetRequests.map((request: any) => (
                      <div key={request.id} className="bg-white p-4 rounded-lg border border-orange-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {request.adminUsername} ({request.tenantId})
                            </h4>
                            <p className="text-sm text-gray-600">
                              Company: {request.companyName}
                            </p>
                            <p className="text-sm text-gray-500">
                              Requested: {new Date(request.requestedAt).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => setApproveRequestAdmin(request)}
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            Approve & Set Password
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Admin Users Management Section */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center font-noto">
                  <UserX className="mr-2 h-5 w-5" />
                  एडमिन अ‍ॅक्सेस व्यवस्थापन
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {adminUsers.map((admin) => (
                    <Card key={admin.id} className={`border ${admin.isTemporaryDisabled ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div>
                            <p className="font-medium">{admin.fullName || admin.username}</p>
                            <p className="text-sm text-gray-600">{admin.companyName}</p>
                            <Badge variant="outline" className="text-xs mt-1">
                              {admin.tenantId}
                            </Badge>
                          </div>
                          
                          {/* Horizontal Button Layout */}
                          <div className="flex gap-2 flex-wrap">
                            {admin.isTemporaryDisabled ? (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => temporaryEnableAdminMutation.mutate(admin.id)}
                                disabled={temporaryEnableAdminMutation.isPending}
                                className="flex-1 min-w-[80px] text-xs"
                              >
                                <UserCheck className="h-3 w-3 mr-1" />
                                Enable
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => temporaryDisableAdminMutation.mutate({ adminId: admin.id, hours: 0 })}
                                disabled={temporaryDisableAdminMutation.isPending}
                                className="flex-1 min-w-[80px] text-xs"
                              >
                                <UserX className="h-3 w-3 mr-1" />
                                Disable
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResetPassword(admin)}
                              className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 flex-1 min-w-[80px] text-xs"
                            >
                              Reset
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={deletingAdmin === admin.id}
                                  className="bg-red-600 hover:bg-red-700 flex-1 min-w-[80px] text-xs"
                                >
                                  {deletingAdmin === admin.id ? "..." : "Delete"}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="font-noto">
                                    Admin डिलीट करायचा आहे?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    <strong>{admin.fullName || admin.username}</strong> ({admin.companyName}) हा admin कायमचा डिलीट होईल. ही क्रिया रद्द करता येणार नाही!
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>रद्द करा</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteAdmin(admin.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    होय, डिलीट करा
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        {admin.isTemporaryDisabled && (
                          <div className="text-xs text-red-600 mt-2 flex items-center">
                            <UserX className="h-3 w-3 mr-1" />
                            Admin access disabled
                          </div>
                        )}
                        {admin.temporaryDisabledBy && (
                          <div className="text-xs text-gray-500 mt-1">
                            Disabled by: {admin.temporaryDisabledBy}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Password Reset Dialog */}
            {resetPasswordAdmin && (
              <Dialog open={!!resetPasswordAdmin} onOpenChange={() => setResetPasswordAdmin(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reset Admin Password</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">
                        Reset password for: <strong>{resetPasswordAdmin.fullName || resetPasswordAdmin.username}</strong>
                      </p>
                      <p className="text-sm text-gray-600 mb-4">
                        Company: <strong>{resetPasswordAdmin.companyName}</strong>
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="new-password">नवीन Password</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showResetPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="किमान 6 अक्षरांचा password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowResetPassword(!showResetPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          type={showResetConfirmPassword ? "text" : "password"}
                          value={resetConfirmPassword}
                          onChange={(e) => setResetConfirmPassword(e.target.value)}
                          placeholder="पुन्हा password प्रविष्ट करा"
                        />
                        <button
                          type="button"
                          onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showResetConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {resetConfirmPassword && newPassword !== resetConfirmPassword && (
                        <p className="text-red-500 text-sm mt-1">Password जुळत नाही!</p>
                      )}
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => {
                        setResetPasswordAdmin(null);
                        setNewPassword("");
                        setResetConfirmPassword("");
                        setShowResetPassword(false);
                        setShowResetConfirmPassword(false);
                      }}>
                        रद्द करा
                      </Button>
                      <Button
                        onClick={() => {
                          if (newPassword.length >= 6 && newPassword === resetConfirmPassword) {
                            resetAdminPasswordMutation.mutate({ 
                              adminId: resetPasswordAdmin.id, 
                              newPassword 
                            });
                          }
                        }}
                        disabled={resetAdminPasswordMutation.isPending || newPassword.length < 6 || newPassword !== resetConfirmPassword}
                      >
                        {resetAdminPasswordMutation.isPending ? "रीसेट करत आहे..." : "Password Reset करा"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">एकूण टेनंट</CardTitle>
                  <Building className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{tenants.length}</div>
                  <p className="text-xs text-muted-foreground">सक्रिय कंपन्या</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">सक्रिय टेनंट</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {tenants.filter(t => !t.isInactive).length}
                  </div>
                  <p className="text-xs text-muted-foreground">चालू असलेले</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">निष्क्रिय टेनंट</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {tenants.filter(t => t.isInactive).length}
                  </div>
                  <p className="text-xs text-muted-foreground">30+ दिवस निष्क्रिय</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">एकूण वापरकर्ते</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {tenants.reduce((sum, t) => sum + t.userCount, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">सर्व टेनंट मधील</p>
                </CardContent>
              </Card>
            </div>

            {/* Tenants Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center font-noto">
                  <Database className="mr-2 h-5 w-5" />
                  टेनंट यादी आणि डिलीट व्यवस्थापन
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>टेनंट माहिती</TableHead>
                        <TableHead>वापरकर्ते</TableHead>
                        <TableHead>कर्जे</TableHead>
                        <TableHead>शेवटची गतिविधी</TableHead>
                        <TableHead>स्थिती</TableHead>
                        <TableHead className="text-center">सक्रिय/निष्क्रिय</TableHead>
                        <TableHead className="text-center">क्रिया</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenants.filter(t => t.tenantId !== 'SUPER_ADMIN').map((tenant) => (
                        <TableRow key={tenant.tenantId}>
                          <TableCell>
                            <div>
                              <div className="font-semibold">{tenant.companyName}</div>
                              <div className="text-sm text-gray-500">
                                ID: <Badge variant="outline">{tenant.tenantId}</Badge>
                              </div>
                              {tenant.address && (
                                <div className="text-xs text-gray-400 mt-1">
                                  {tenant.address}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">
                                {tenant.activeUserCount}/{tenant.userCount}
                              </div>
                              <div className="text-gray-500">सक्रिय/एकूण</div>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <div className="font-medium">{tenant.loanCount}</div>
                            <div className="text-xs text-gray-500">कर्जे</div>
                          </TableCell>
                          
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">
                                {new Date(tenant.lastActivity).toLocaleDateString('hi-IN')}
                              </div>
                              <div className="text-gray-500">
                                {tenant.daysSinceLastActivity} दिवस आधी
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <Badge 
                              variant={tenant.isInactive ? "destructive" : "default"}
                              className={tenant.isInactive ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}
                            >
                              {tenant.isInactive ? "निष्क्रिय" : "सक्रिय"}
                            </Badge>
                            {tenant.daysSinceLastActivity > 60 && (
                              <div className="text-xs text-red-500 mt-1">
                                डिलीट करण्यासाठी योग्य
                              </div>
                            )}
                          </TableCell>

                          {/* Toggle Switch Column */}
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <Switch
                                checked={tenant.isActive ?? !tenant.isInactive}
                                onCheckedChange={() => handleToggleTenant(tenant.tenantId, tenant.isActive ?? !tenant.isInactive)}
                                disabled={togglingTenant === tenant.tenantId}
                                className="data-[state=checked]:bg-green-600"
                              />
                              {togglingTenant === tenant.tenantId && (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {tenant.isActive ?? !tenant.isInactive ? "सक्रिय" : "निष्क्रिय"}
                            </div>
                          </TableCell>
                          
                          <TableCell className="text-center">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  disabled={deletingTenant === tenant.tenantId}
                                >
                                  {deletingTenant === tenant.tenantId ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="font-noto">
                                    टेनंट पूर्णपणे डिलीट करा?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    <div className="space-y-3">
                                      <p>
                                        <strong>{tenant.companyName}</strong> ({tenant.tenantId}) 
                                        आणि त्याचा संपूर्ण डेटा कायमचा डिलीट होईल.
                                      </p>
                                      
                                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                        <h4 className="font-semibold text-red-800 mb-2">
                                          डिलीट होणाऱ्या डेटाची माहिती:
                                        </h4>
                                        <ul className="text-sm text-red-700 space-y-1">
                                          <li>• {tenant.userCount} वापरकर्ते</li>
                                          <li>• {tenant.loanCount} कर्जे</li>
                                          <li>• सर्व व्यवहार आणि रोकड नोंदी</li>
                                          <li>• कर्जदार आणि गट माहिती</li>
                                          <li>• कंपनी माहिती</li>
                                        </ul>
                                      </div>
                                      
                                      <p className="text-red-600 font-medium">
                                        ⚠️ ही क्रिया रद्द करता येणार नाही!
                                      </p>
                                    </div>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>रद्द करा</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteTenant(tenant.tenantId)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    होय, पूर्णपणे डिलीट करा
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {tenants.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <div className="text-gray-500">
                              <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <p>कोणतेही टेनंट उपलब्ध नाहीत</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Approve Password Reset Request Dialog */}
            {approveRequestAdmin && (
              <Dialog open={!!approveRequestAdmin} onOpenChange={() => setApproveRequestAdmin(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Approve Password Reset Request</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">
                        Admin: <strong>{approveRequestAdmin.adminUsername}</strong>
                      </p>
                      <p className="text-sm text-gray-600 mb-2">
                        Company: <strong>{approveRequestAdmin.companyName}</strong>
                      </p>
                      <p className="text-sm text-gray-600 mb-4">
                        Requested: <strong>{new Date(approveRequestAdmin.requestedAt).toLocaleString()}</strong>
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="request-password">नवीन Password</Label>
                      <div className="relative">
                        <Input
                          id="request-password"
                          type={showRequestPassword ? "text" : "password"}
                          value={requestPassword}
                          onChange={(e) => setRequestPassword(e.target.value)}
                          placeholder="किमान 6 अक्षरांचा password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRequestPassword(!showRequestPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showRequestPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="confirm-request-password">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          id="confirm-request-password"
                          type={showConfirmRequestPassword ? "text" : "password"}
                          value={confirmRequestPassword}
                          onChange={(e) => setConfirmRequestPassword(e.target.value)}
                          placeholder="पुन्हा password प्रविष्ट करा"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmRequestPassword(!showConfirmRequestPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showConfirmRequestPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {confirmRequestPassword && requestPassword !== confirmRequestPassword && (
                        <p className="text-red-500 text-sm mt-1">Password जुळत नाही!</p>
                      )}
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => {
                        setApproveRequestAdmin(null);
                        setRequestPassword("");
                        setConfirmRequestPassword("");
                        setShowRequestPassword(false);
                        setShowConfirmRequestPassword(false);
                      }}>
                        रद्द करा
                      </Button>
                      <Button
                        onClick={() => {
                          if (requestPassword.length >= 6 && requestPassword === confirmRequestPassword) {
                            approvePasswordResetMutation.mutate({ 
                              requestId: approveRequestAdmin.id, 
                              newPassword: requestPassword 
                            });
                          }
                        }}
                        disabled={approvePasswordResetMutation.isPending || requestPassword.length < 6 || requestPassword !== confirmRequestPassword}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        {approvePasswordResetMutation.isPending ? "मंजूर करत आहे..." : "मंजूर करा आणि Password सेट करा"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Super Admin Own Password Change Dialog */}
            {changingOwnPassword && (
              <Dialog open={changingOwnPassword} onOpenChange={setChangingOwnPassword}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-noto">सुपर अॅडमिन पासवर्ड बदला</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="currentPassword" className="font-noto">
                        सध्याचा पासवर्ड
                      </Label>
                      <div className="relative">
                        <Input
                          id="currentPassword"
                          type={showOwnCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="सध्याचा पासवर्ड टाका"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOwnCurrentPassword(!showOwnCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showOwnCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="newOwnPassword" className="font-noto">
                        नवीन पासवर्ड
                      </Label>
                      <div className="relative">
                        <Input
                          id="newOwnPassword"
                          type={showOwnNewPassword ? "text" : "password"}
                          value={newOwnPassword}
                          onChange={(e) => setNewOwnPassword(e.target.value)}
                          placeholder="नवीन पासवर्ड टाका (कमीत कमी 6 अक्षर)"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOwnNewPassword(!showOwnNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showOwnNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="confirmPassword" className="font-noto">
                        पासवर्ड पुष्टी करा
                      </Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showOwnConfirmPassword ? "text" : "password"}
                          value={confirmOwnPassword}
                          onChange={(e) => setConfirmOwnPassword(e.target.value)}
                          placeholder="नवीन पासवर्ड पुन्हा टाका"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOwnConfirmPassword(!showOwnConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showOwnConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button
                        onClick={() => setChangingOwnPassword(false)}
                        variant="outline"
                        className="flex-1"
                      >
                        रद्द करा
                      </Button>
                      <Button
                        onClick={handleChangeOwnPassword}
                        disabled={changeOwnPasswordMutation.isPending || !currentPassword || !newOwnPassword || !confirmOwnPassword}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        {changeOwnPasswordMutation.isPending ? "बदलत आहे..." : "पासवर्ड बदला"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}