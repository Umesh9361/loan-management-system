import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { AuthService, type LoginCredentials } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Building, User, Lock, HelpCircle, Eye, EyeOff } from "lucide-react";
import { useLocation } from "wouter";
import { ForgotPassword } from "@/components/forgot-password";

const loginSchema = z.object({
  tenantId: z.string().min(1, "कंपनी ओळखकर्ता आवश्यक आहे"),
  username: z.string().min(1, "वापरकर्ता नाव आवश्यक आहे"),
  password: z.string().min(1, "पासवर्ड आवश्यक आहे"),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      tenantId: "",
      username: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const credentials: LoginCredentials = {
        tenantId: data.tenantId,
        username: data.username,
        password: data.password,
      };
      
      const loginResult = await AuthService.login(credentials);
      
      // Longer delay to ensure session is properly saved across environments
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // CRITICAL: Prime auth cache with user data before navigation
      if (loginResult) {
        // Set the user data in cache immediately
        queryClient.setQueryData(["/api/auth/me"], loginResult);
        
        // Prefetch to ensure cache is warmed up
        await queryClient.prefetchQuery({
          queryKey: ["/api/auth/me"],
          staleTime: 5 * 60 * 1000, // Match useCurrentUser staleTime
        });
      }
      
      toast({
        title: "प्रवेश यशस्वी",
        description: "आपण यशस्वीपणे लॉगिन झाला आहात",
      });
      
      // Navigate to home page after successful login and cache setup
      navigate("/");
    } catch (error) {
      toast({
        title: "प्रवेश अयशस्वी",
        description: error instanceof Error ? error.message : "अज्ञात त्रुटी",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <ForgotPassword onBack={() => setShowForgotPassword(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-20 w-20 bg-primary rounded-full flex items-center justify-center mb-6">
            <Building className="text-white h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">कर्ज व्यवस्थापन प्रणाली</h1>
          <p className="text-gray-600">आपल्या खात्यात प्रवेश करा</p>
        </div>
        
        <Card>
          <CardContent className="p-8">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <Label htmlFor="tenantId" className="block text-sm font-medium text-gray-700 mb-2">
                  कंपनी ओळखकर्ता (Tenant ID)
                </Label>
                <div className="relative">
                  <Input
                    id="tenantId"
                    {...form.register("tenantId")}
                    className="font-inter pl-10"
                    placeholder=""
                  />
                  <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                </div>

                {form.formState.errors.tenantId && (
                  <p className="text-red-600 text-sm mt-1">{form.formState.errors.tenantId.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  वापरकर्ता नाव
                </Label>
                <div className="relative">
                  <Input
                    id="username"
                    {...form.register("username")}
                    className="pl-10"
                    placeholder=""
                  />
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                </div>
                {form.formState.errors.username && (
                  <p className="text-red-600 text-sm mt-1">{form.formState.errors.username.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  पासवर्ड
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...form.register("password")}
                    className="pl-10 pr-10"
                    placeholder=""
                  />
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 p-0 bg-transparent border-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="text-red-600 text-sm mt-1">{form.formState.errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rememberMe"
                    {...form.register("rememberMe")}
                  />
                  <Label htmlFor="rememberMe" className="text-sm text-gray-700">
                    मला आठवण ठेवा
                  </Label>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-primary hover:text-primary/80"
                >
                  पासवर्ड विसरलात?
                </button>
              </div>

              <div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "प्रवेश करत आहे..." : "प्रवेश करा"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
