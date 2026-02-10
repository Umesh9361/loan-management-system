import { useState } from "react";
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
import { Plus, Edit, Trash2, Key, UserCheck, UserX, Shield, Activity, Home } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";

const userSchema = z.object({
  username: z.string().min(1, "Username आवश्यक आहे"),
  password: z.string().min(1, "Password आवश्यक आहे"),
  fullName: z.string().min(1, "Full name आवश्यक आहे"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  role: z.enum(["user", "admin"], { required_error: "Role is required" })
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
  canViewAccountSummaryReport: z.boolean().default(false), // खाते सारांश अहवाल
  canViewOtherReports: z.boolean().default(false) // इतर अहवाल
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
              className="bg-blue-600 hover:bg-blue-700"
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
          'Cache-Control': 'no-cache', // Force fresh data
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-management/users"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-management/users"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-management/users"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-management/users"] });
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
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">User Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage users, permissions, and access control</p>
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
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
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
          <Card key={user.id} className="p-4">
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
      role: "user"
    }
  });

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
      canViewOtherReports: false
    }
  });

  const handleSubmit = async () => {
    const userValid = await userForm.trigger();
    if (!userValid) {
      return;
    }
    const userData = userForm.getValues();
    const permissions = permissionsForm.getValues();
    onSubmit({ userData, permissions });
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter password" {...field} />
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
    canViewOtherReports: false,
  };
  const form = useForm<PermissionsData>({
    resolver: zodResolver(permissionsSchema),
    defaultValues: { ...schemaDefaults, ...(user.permissions || {}) }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => onSubmit({ ...data, canViewDashboard: true, canAccessInterestCalculator: true }))} className="space-y-6">
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }
    onSubmit(password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">New Password</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter new password"
          minLength={6}
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium">Confirm Password</label>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          minLength={6}
          required
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="submit" disabled={isLoading} className="min-w-[120px] w-full sm:w-auto">
          {isLoading ? "Updating..." : "Update Password"}
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
      { key: "canViewCashBookReport", label: "रोकड वही अहवाल" },
      { key: "canViewCapitalReport", label: "भांडवल अहवाल" },
      { key: "canViewLedgerReport", label: "खाते वही अहवाल" },
      { key: "canViewBorrowerListReport", label: "कर्जदार यादी अहवाल" },
      { key: "canViewOverdueReport", label: "थकबाकी अहवाल" },
      { key: "canViewAccountSummaryReport", label: "खाते सारांश अहवाल" },
      { key: "canViewOtherReports", label: "इतर अहवाल" },
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
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-2">भूमिका आधारित परमिशन (Role-Based Permissions)</h4>
        <div className="text-sm text-blue-700">
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
            🚀 Enable All Main Features
          </Button>
        </div>
        <div className="mt-2 text-xs text-green-600">
          <strong>चालू होणारे:</strong> Company Registration, Group Management, Loan Registration/Closure, Borrower Management, Cash Transactions, Party Management, Mobile Cashbook<br/>
          <strong>Manual राहणारे:</strong> सर्व Reports permissions, Delete permissions (security साठी)
        </div>
      </div>
      
      {filteredCategories.map(([category, permissions]) => (
        <div key={category}>
          <h3 className="text-lg font-semibold mb-3 text-blue-600">{category}</h3>
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
      
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-blue-700">
          <strong>लक्ष ठेवा:</strong> लाल तार्‍यांका (*) असलेली permissions सर्व users साठी आवश्यक आहेत.
          Dashboard आणि Interest Calculator सर्वांना उपलब्ध असतील.
        </p>
      </div>
    </div>
  );
}