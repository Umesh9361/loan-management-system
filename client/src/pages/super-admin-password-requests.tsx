import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Clock, CheckCircle, XCircle, Search, ArrowLeft, Eye, UserCheck } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

interface PasswordRequest {
  id: string;
  tenantId: string;
  username: string;
  userRole: string;
  reason: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  companyName?: string;
}

interface UserDetail {
  id: string;
  username: string;
  role: string;
  tenantId: string;
  lastLoginAt: string | null;
  isActive: boolean;
  companyName: string;
}

export function SuperAdminPasswordRequests() {
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Get all users for password reset management
  const { data: allUsers = [], isLoading: isUsersLoading } = useQuery<UserDetail[]>({
    queryKey: ["/api/super-admin/all-users"],
  });

  // Reset Password Mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const response = await fetch(`/api/super-admin/reset-password/${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPassword }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reset password");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/all-users"] });
      setSelectedUser(null);
      setNewPassword("");
      toast({
        title: "पासवर्ड रीसेट केले",
        description: "यूजरचा पासवर्ड यशस्वीपणे अपडेट केला आहे",
      });
    },
    onError: (error: any) => {
      toast({
        title: "त्रुटी",
        description: error.message || "पासवर्ड रीसेट करण्यात अपयश",
        variant: "destructive",
      });
    },
  });

  const handleResetPassword = () => {
    if (!selectedUser || !newPassword) return;
    resetPasswordMutation.mutate({ userId: selectedUser.id, newPassword });
  };

  // Filter users based on search
  const filteredUsers = allUsers.filter((user) =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.tenantId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.companyName && user.companyName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Get inactive users (no login for 7+ days)
  const inactiveUsers = filteredUsers.filter((user) => {
    if (!user.lastLoginAt) return true;
    const daysSinceLogin = Math.floor((Date.now() - new Date(user.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceLogin >= 7;
  });

  if (isUsersLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">लोड करत आहे...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link href="/super-admin" className="text-blue-600 hover:text-blue-700">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-noto">
                पासवर्ड रीसेट व्यवस्थापन
              </h1>
              <p className="text-gray-600 mt-2">
                सर्व टेनंट्स च्या यूजर्सचे पासवर्ड रीसेट करा
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <Search className="h-5 w-5 text-gray-400" />
              <Input
                placeholder="यूजर नाव, टेनंट ID किंवा कंपनी नाव शोधा..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">एकूण यूजर्स</p>
                  <p className="text-2xl font-bold text-gray-900">{allUsers.length}</p>
                </div>
                <UserCheck className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">निष्क्रिय यूजर्स</p>
                  <p className="text-2xl font-bold text-orange-600">{inactiveUsers.length}</p>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">सक्रिय यूजर्स</p>
                  <p className="text-2xl font-bold text-green-600">{allUsers.length - inactiveUsers.length}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <KeyRound className="mr-2 h-5 w-5" />
              यूजर लिस्ट - पासवर्ड रीसेट
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>यूजर नाव</TableHead>
                  <TableHead>टेनंट</TableHead>
                  <TableHead>कंपनी</TableHead>
                  <TableHead>भूमिका</TableHead>
                  <TableHead>शेवटचे लॉगिन</TableHead>
                  <TableHead>स्थिती</TableHead>
                  <TableHead>क्रिया</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const daysSinceLogin = user.lastLoginAt 
                    ? Math.floor((Date.now() - new Date(user.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24))
                    : 999;
                  
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.tenantId}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {user.companyName || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role === 'admin' ? 'ऍडमिन' : user.role === 'super_admin' ? 'सुपर ऍडमिन' : 'यूजर'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.lastLoginAt ? (
                          <div>
                            <p className="text-sm">{format(new Date(user.lastLoginAt), 'dd/MM/yyyy')}</p>
                            <p className="text-xs text-gray-500">{daysSinceLogin} दिवस आधी</p>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-orange-600">
                            कधीही नाही
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {daysSinceLogin >= 7 ? (
                          <Badge variant="destructive">निष्क्रिय</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">सक्रिय</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedUser(user)}
                            >
                              <KeyRound className="h-4 w-4 mr-1" />
                              रीसेट
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="font-noto">पासवर्ड रीसेट करा</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <Alert>
                                <Eye className="h-4 w-4" />
                                <AlertDescription>
                                  <strong>{user.username}</strong> ({user.tenantId}) साठी नवा पासवर्ड सेट करा
                                </AlertDescription>
                              </Alert>
                              
                              <div>
                                <Label htmlFor="newPassword">नवा पासवर्ड</Label>
                                <Input
                                  id="newPassword"
                                  type="password"
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                  placeholder="किमान 6 अक्षरांचा पासवर्ड"
                                />
                              </div>
                              
                              <div className="flex space-x-3">
                                <Button
                                  onClick={handleResetPassword}
                                  disabled={!newPassword || newPassword.length < 6 || resetPasswordMutation.isPending}
                                  className="flex-1"
                                >
                                  {resetPasswordMutation.isPending ? "रीसेट करत आहे..." : "पासवर्ड रीसेट करा"}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedUser(null);
                                    setNewPassword("");
                                  }}
                                >
                                  रद्द करा
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {filteredUsers.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">कोणतेही यूजर्स सापडले नाहीत</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}