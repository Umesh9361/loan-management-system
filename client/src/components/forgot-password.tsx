import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Building, User, ArrowLeft, Send } from "lucide-react";

const forgotPasswordSchema = z.object({
  tenantId: z.string().min(1, "कंपनी ओळखकर्ता आवश्यक आहे"),
  username: z.string().min(1, "वापरकर्ता नाव आवश्यक आहे"),
});

type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordProps {
  onBack: () => void;
}

export function ForgotPassword({ onBack }: ForgotPasswordProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      tenantId: "",
      username: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordData) => {
    setIsLoading(true);
    try {
      await apiRequest("/api/admin/request-password-reset", "POST", data);
      
      toast({
        title: "Request Sent Successfully",
        description: "Your password reset request has been sent to Super Admin. You will receive a new password soon.",
      });
      
      setIsSubmitted(true);
    } catch (error) {
      toast({
        title: "Request Failed",
        description: error instanceof Error ? error.message : "Failed to send password reset request",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-center text-green-700">
            ✓ Request Sent Successfully
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            Your password reset request has been sent to Super Admin.
          </p>
          <p className="text-sm text-gray-500">
            Please contact your Super Admin or wait for password reset approval.
          </p>
          <Button onClick={onBack} variant="outline" className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">
          <Send className="mx-auto h-8 w-8 text-primary mb-2" />
          Forgot Password
        </CardTitle>
        <p className="text-center text-sm text-gray-600">
          Send password reset request to Super Admin
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
          <div>
            <Label htmlFor="tenantId">Company ID / Tenant ID</Label>
            <div className="relative">
              <Input
                id="tenantId"
                {...form.register("tenantId")}
                className="pl-10"
                placeholder="Enter your company ID"
              />
              <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            </div>
            {form.formState.errors.tenantId && (
              <p className="text-red-600 text-sm mt-1">
                {form.formState.errors.tenantId.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="username">Admin Username</Label>
            <div className="relative">
              <Input
                id="username"
                {...form.register("username")}
                className="pl-10"
                placeholder="Enter admin username"
              />
              <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            </div>
            {form.formState.errors.username && (
              <p className="text-red-600 text-sm mt-1">
                {form.formState.errors.username.message}
              </p>
            )}
          </div>

          <div className="space-y-2 pt-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Sending Request..." : "Send Reset Request"}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              className="w-full" 
              onClick={onBack}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Button>
          </div>
        </form>

        <div className="mt-6 p-3 bg-indigo-50 rounded-lg">
          <p className="text-xs text-indigo-600">
            <strong>Note:</strong> Only tenant admins can request password resets. 
            Regular users should contact their admin for password changes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}