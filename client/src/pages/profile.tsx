import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DataIsolationDemo } from "@/components/data-isolation-demo";
import { User, Shield, Key, Building } from "lucide-react";

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "सध्याचा पासवर्ड आवश्यक आहे"),
  newPassword: z.string().min(1, "नवा पासवर्ड आवश्यक आहे"),
  confirmPassword: z.string().min(1, "पासवर्ड पुष्टीकरण आवश्यक आहे")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "पासवर्ड जुळत नाहीत",
  path: ["confirmPassword"]
});

type PasswordChangeData = z.infer<typeof passwordChangeSchema>;

export default function Profile() {
  const { toast } = useToast();
  const { safeNavigate } = useSafeNavigation();
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const { user, isLoading } = useCurrentUser();

  // ACCESS CONTROL: Only admin and super admin users can access profile page
  if (!isLoading && user && user.role === 'user') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600 flex items-center justify-center gap-2">
              <Shield className="h-5 w-5" />
              प्रवेश नाकारण्यात आला
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              प्रोफाइल पेज केवळ प्रशासक आणि सुपर प्रशासकांसाठी उपलब्ध आहे.
            </p>
            <p className="text-sm text-gray-500">
              सामान्य वापरकर्ते या पेजमध्ये प्रवेश करू शकत नाहीत.
            </p>
            <Button 
              onClick={() => safeNavigate('/')} 
              className="w-full"
            >
              डॅशबोर्डवर परत जा
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: company } = useQuery({
    queryKey: ["/api/company"],
    enabled: !!user,
  });

  const passwordForm = useForm<PasswordChangeData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    },
  });

  const passwordChangeMutation = useMutation({
    mutationFn: (data: PasswordChangeData) => 
      apiRequest("/api/auth/change-password", "PATCH", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      }),
    onSuccess: () => {
      toast({
        title: "यशस्वी",
        description: "पासवर्ड यशस्वीरित्या बदलला गेला",
      });
      setIsChangingPassword(false);
      passwordForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "त्रुटी",
        description: error.message || "पासवर्ड बदलताना त्रुटी झाली",
        variant: "destructive",
      });
    },
  });

  const handlePasswordChange = (data: PasswordChangeData) => {
    passwordChangeMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">लोड हो रहा है...</p>
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
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 font-noto">
                माझे प्रोफाइल
              </h1>
              <p className="text-gray-600 mt-2">
                वैयक्तिक माहिती आणि खाते सेटिंग्ज
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* User Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center font-noto">
                    <User className="mr-2 h-5 w-5" />
                    वापरकर्ता माहिती
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">वापरकर्ता नाव</Label>
                    <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                      {user?.username}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-700">भूमिका</Label>
                    <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md flex items-center">
                      <Shield className="mr-2 h-4 w-4 text-blue-600" />
                      {user?.role === 'admin' ? 'प्रशासक' : 'क्लर्क'}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-700">टेनंट आयडी</Label>
                    <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                      {user?.tenantId}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-700">खाते स्थिती</Label>
                    <div className="mt-1 px-3 py-2 bg-green-50 border border-green-200 rounded-md text-green-800">
                      {(user as any)?.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                    </div>
                  </div>
                  
                  {(user as any)?.createdAt && (
                    <div>
                      <Label className="text-sm font-medium text-gray-700">सदस्यता दिनांक</Label>
                      <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                        {new Date((user as any).createdAt).toLocaleDateString('hi-IN')}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Company Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center font-noto">
                    <Building className="mr-2 h-5 w-5" />
                    कंपनी माहिती
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">कंपनी नाव</Label>
                    <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                      {(company as any)?.name || 'कंपनी नोंदणी करा'}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-700">परवाना क्रमांक</Label>
                    <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                      {(company as any)?.licenseNumber || 'N/A'}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-700">पत्ता</Label>
                    <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                      {(company as any)?.address || 'N/A'}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-700">संपर्क क्रमांक</Label>
                    <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                      {(company as any)?.contactNumber || 'N/A'}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-700">ईमेल</Label>
                    <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                      {(company as any)?.email || 'N/A'}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Password Change Section */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center font-noto">
                    <Key className="mr-2 h-5 w-5" />
                    पासवर्ड बदला
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {user?.role === 'super_admin' ? (
                    <div className="text-center py-8">
                      <Key className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4 font-noto">
                        सुपर अॅडमिन म्हणून आपण Tenant Management मध्ये आपला पासवर्ड बदलू शकता
                      </p>
                      <Button 
                        onClick={() => safeNavigate('/super-admin-tenant-management')}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Tenant Management वर जा
                      </Button>
                    </div>
                  ) : !isChangingPassword ? (
                    <div className="text-center py-8">
                      <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">सुरक्षिततेसाठी आपला पासवर्ड नियमितपणे बदला</p>
                      <Button 
                        onClick={() => setIsChangingPassword(true)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        पासवर्ड बदला
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4 max-w-md mx-auto">
                      <div>
                        <Label>सध्याचा पासवर्ड</Label>
                        <Input 
                          type="password" 
                          {...passwordForm.register("currentPassword")} 
                          placeholder="सध्याचा पासवर्ड टाका"
                        />
                        {passwordForm.formState.errors.currentPassword && (
                          <p className="text-red-500 text-sm mt-1">
                            {passwordForm.formState.errors.currentPassword.message}
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <Label>नवा पासवर्ड</Label>
                        <Input 
                          type="password" 
                          {...passwordForm.register("newPassword")} 
                          placeholder="नवा पासवर्ड टाका"
                        />
                        {passwordForm.formState.errors.newPassword && (
                          <p className="text-red-500 text-sm mt-1">
                            {passwordForm.formState.errors.newPassword.message}
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <Label>पासवर्ड पुष्टी करा</Label>
                        <Input 
                          type="password" 
                          {...passwordForm.register("confirmPassword")} 
                          placeholder="नवा पासवर्ड पुन्हा टाका"
                        />
                        {passwordForm.formState.errors.confirmPassword && (
                          <p className="text-red-500 text-sm mt-1">
                            {passwordForm.formState.errors.confirmPassword.message}
                          </p>
                        )}
                      </div>
                      
                      <Separator className="my-4" />
                      
                      <div className="flex justify-end space-x-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => {
                            setIsChangingPassword(false);
                            passwordForm.reset();
                          }}
                        >
                          रद्द करा
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={passwordChangeMutation.isPending}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {passwordChangeMutation.isPending ? "बदलत आहे..." : "पासवर्ड बदला"}
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Data Privacy Notice */}
            <DataIsolationDemo />
          </div>
        </main>
      </div>
    </div>
  );
}