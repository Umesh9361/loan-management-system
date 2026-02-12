import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Trash2, Users, FileText, CreditCard, Briefcase, TrendingUp, Calendar, ArrowLeft, Key, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";

interface TenantStats {
  tenantId: string;
  userCount: number;
  activeUsers: number;
  loanCount: number;
  groupCount: number;
  borrowerCount: number;
  cashTransactionCount: number;
  lastActivity: string;
}

export default function SuperAdminTenants() {
  const { toast } = useToast();
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [resetPasswordTenant, setResetPasswordTenant] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { data: tenantStats, isLoading } = useQuery<TenantStats[]>({
    queryKey: ["/api/super-admin/tenant-stats"],
  });

  const deleteTenantMutation = useMutation({
    mutationFn: (tenantId: string) => apiRequest(`/api/super-admin/delete-tenant/${tenantId}`, "DELETE"),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenant-stats"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/users"], refetchType: 'all' });
      toast({
        title: "यशस्वी!",
        description: `टेनंट आणि त्याचा डेटा डिलीट झाला`,
      });
      setSelectedTenant(null);
    },
    onError: (error: any) => {
      toast({
        title: "त्रुटी!",
        description: error.message || "टेनंट डिलीट करताना त्रुटी झाली",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ tenantId, newPassword }: { tenantId: string; newPassword: string }) => 
      apiRequest(`/api/super-admin/reset-tenant-admin/${tenantId}`, "PATCH", { newPassword }),
    onSuccess: (data: any) => {
      toast({
        title: "यशस्वी!",
        description: `टेनंट ${data.tenantId || resetPasswordTenant} चा admin password reset झाला`,
      });
      setResetPasswordTenant(null);
      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
    },
    onError: (error: any) => {
      toast({
        title: "त्रुटी!",
        description: error.message || "Password reset करताना त्रुटी झाली",
        variant: "destructive",
      });
    },
  });

  const handleDeleteTenant = (tenantId: string) => {
    deleteTenantMutation.mutate(tenantId);
  };

  const handleResetPassword = () => {
    if (resetPasswordTenant && newPassword.trim()) {
      resetPasswordMutation.mutate({ 
        tenantId: resetPasswordTenant, 
        newPassword: newPassword.trim() 
      });
    }
  };

  const getTotalDataEntries = (stats: TenantStats) => {
    return stats.loanCount + stats.groupCount + stats.borrowerCount + stats.cashTransactionCount;
  };

  const isInactiveTenant = (stats: TenantStats) => {
    const totalEntries = getTotalDataEntries(stats);
    const lastActivity = new Date(stats.lastActivity);
    const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    
    return totalEntries === 0 || (totalEntries < 5 && daysSinceActivity > 30);
  };

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
                <div className="flex items-center gap-4 mb-2">
                  <Link href="/super-admin">
                    <Button variant="outline" size="sm">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      परत जा
                    </Button>
                  </Link>
                  <h1 className="text-3xl font-bold text-gray-900 font-noto">
                    टेनंट व्यवस्थापन
                  </h1>
                </div>
                <p className="text-gray-600">
                  निष्क्रिय टेनंट आणि त्यांचा डेटा व्यवस्थापित करा
                </p>
              </div>
            </div>

            {isLoading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">डेटा लोड करत आहे...</div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      टेनंट आकडेवारी आणि व्यवस्थापन
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>टेनंट आयडी</TableHead>
                            <TableHead className="text-center">वापरकर्ते</TableHead>
                            <TableHead className="text-center">कर्जे</TableHead>
                            <TableHead className="text-center">गट</TableHead>
                            <TableHead className="text-center">कर्जदार</TableHead>
                            <TableHead className="text-center">रोकड व्यवहार</TableHead>
                            <TableHead className="text-center">एकूण डेटा</TableHead>
                            <TableHead className="text-center">शेवटची क्रिया</TableHead>
                            <TableHead className="text-center">स्थिती</TableHead>
                            <TableHead className="text-center">कृती</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tenantStats?.map((stats) => {
                            const totalData = getTotalDataEntries(stats);
                            const isInactive = isInactiveTenant(stats);
                            const lastActivity = new Date(stats.lastActivity);
                            const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

                            return (
                              <TableRow key={stats.tenantId}>
                                <TableCell className="font-medium">{stats.tenantId}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="gap-1">
                                    <Users className="h-3 w-3" />
                                    {stats.activeUsers}/{stats.userCount}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="gap-1">
                                    <CreditCard className="h-3 w-3" />
                                    {stats.loanCount}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="gap-1">
                                    <Briefcase className="h-3 w-3" />
                                    {stats.groupCount}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="gap-1">
                                    <Users className="h-3 w-3" />
                                    {stats.borrowerCount}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="gap-1">
                                    <FileText className="h-3 w-3" />
                                    {stats.cashTransactionCount}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={totalData === 0 ? "destructive" : totalData < 10 ? "secondary" : "default"}>
                                    {totalData}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-xs text-muted-foreground">
                                      {lastActivity.toLocaleDateString('hi-IN')}
                                    </span>
                                    <Badge variant={daysSinceActivity > 30 ? "destructive" : daysSinceActivity > 7 ? "secondary" : "default"} className="text-xs">
                                      <Calendar className="h-3 w-3 mr-1" />
                                      {daysSinceActivity} दिवस
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={isInactive ? "destructive" : "default"}>
                                    {isInactive ? "निष्क्रिय" : "सक्रिय"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex gap-2 justify-center">
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setResetPasswordTenant(stats.tenantId)}
                                        >
                                          <Key className="h-4 w-4" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent aria-describedby="password-reset-description">
                                        <DialogHeader>
                                          <DialogTitle>Admin Password Reset</DialogTitle>
                                        </DialogHeader>
                                        <div id="password-reset-description" className="sr-only">
                                          Admin password reset form for tenant
                                        </div>
                                        <div className="space-y-4">
                                          <div>
                                            <Label htmlFor="tenant-id">टेनंट आयडी</Label>
                                            <Input
                                              id="tenant-id"
                                              value={stats.tenantId}
                                              disabled
                                              className="bg-gray-100"
                                            />
                                          </div>
                                          <div>
                                            <Label htmlFor="new-password">नवीन Password</Label>
                                            <div className="relative">
                                              <Input
                                                id="new-password"
                                                type={showPassword ? "text" : "password"}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="नवीन password प्रविष्ट करा"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                              >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                              </button>
                                            </div>
                                          </div>
                                          <div>
                                            <Label htmlFor="confirm-password">Confirm Password</Label>
                                            <div className="relative">
                                              <Input
                                                id="confirm-password"
                                                type={showConfirmPassword ? "text" : "password"}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="पुन्हा password प्रविष्ट करा"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                              >
                                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                              </button>
                                            </div>
                                            {confirmPassword && newPassword !== confirmPassword && (
                                              <p className="text-red-500 text-sm mt-1">Password जुळत नाही!</p>
                                            )}
                                          </div>
                                          <div className="flex gap-2 justify-end">
                                            <Button variant="outline" onClick={() => {
                                              setResetPasswordTenant(null);
                                              setNewPassword("");
                                              setConfirmPassword("");
                                              setShowPassword(false);
                                              setShowConfirmPassword(false);
                                            }}>
                                              रद्द करा
                                            </Button>
                                            <Button 
                                              onClick={handleResetPassword}
                                              disabled={!newPassword.trim() || newPassword !== confirmPassword || resetPasswordMutation.isPending}
                                            >
                                              Password Reset करा
                                            </Button>
                                          </div>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                    
                                    {isInactive && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => setSelectedTenant(stats.tenantId)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>टेनंट डिलीट करा</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              तुम्ही खात्री आहात की तुम्हाला टेनंट "{stats.tenantId}" आणि त्याचा सगळा डेटा कायमचा डिलीट करायचा आहे? हे कृती पूर्ववत करता येणार नाही.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>रद्द करा</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => handleDeleteTenant(stats.tenantId)}
                                              className="bg-red-600 hover:bg-red-700"
                                              disabled={deleteTenantMutation.isPending}
                                            >
                                              होय, डिलीट करा
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {tenantStats?.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        कोणतेही टेनंट सापडले नाहीत
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>निष्क्रिय टेनंट मापदंड</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      <p><strong>निष्क्रिय टेनंट म्हणजे:</strong></p>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        <li>कोणताही डेटा एन्ट्री नाही (कर्जे, गट, कर्जदार, रोकड व्यवहार)</li>
                        <li>किंवा कमी डेटा (5 पेक्षा कमी एन्ट्री) आणि 30 दिवसांपेक्षा जास्त काळ निष्क्रिय</li>
                      </ul>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <Badge variant="destructive">निष्क्रिय - डिलीट करता येईल</Badge>
                      <Badge variant="default">सक्रिय - संरक्षित</Badge>
                      <Badge variant="secondary">मध्यम क्रिया</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}