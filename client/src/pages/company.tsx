import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const companySchema = z.object({
  name: z.string().min(1, "कंपनीचे नाव आवश्यक आहे"),
  licenseNumber: z.string().optional(),
  address: z.string().optional(),
  contactNumber: z.string().optional(),
  email: z.string().email("वैध ईमेल पत्ता टाका").optional().or(z.literal("")),
});

type CompanyFormData = z.infer<typeof companySchema>;

export default function Company() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const { data: company, isLoading, error } = useQuery<any>({
    queryKey: ["/api/company"],
  });

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      licenseNumber: "",
      address: "",
      contactNumber: "",
      email: "",
    },
  });

  // Update form when company data loads - Use useEffect to prevent infinite re-render
  React.useEffect(() => {
    if (company && !isEditing) {
      form.reset({
        name: company.name || "",
        licenseNumber: company.licenseNumber || "",
        address: company.address || "",
        contactNumber: company.contactNumber || "",
        email: company.email || "",
      });
    }
  }, [company, isEditing, form]);

  const createMutation = useMutation({
    mutationFn: (data: CompanyFormData) => apiRequest("/api/company", "POST", data),
    onSuccess: (newCompany) => {
      queryClient.setQueryData(["/api/company"], newCompany);
      toast({
        title: "यशस्वी",
        description: "कंपनी माहिती यशस्वीपणे जतन केली",
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "त्रुटी",
        description: "कंपनी माहिती जतन करताना त्रुटी झाली",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CompanyFormData) => apiRequest("/api/company", "PUT", data),
    onSuccess: (updatedCompany) => {
      queryClient.setQueryData(["/api/company"], updatedCompany);
      toast({
        title: "यशस्वी",
        description: "कंपनी माहिती यशस्वीपणे अपडेट केली",
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "त्रुटी",
        description: "कंपनी माहिती अपडेट करताना त्रुटी झाली",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CompanyFormData) => {
    if (company) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    if (company && company.name) {
      form.reset({
        name: company.name || "",
        licenseNumber: company.licenseNumber || "",
        address: company.address || "",
        contactNumber: company.contactNumber || "",
        email: company.email || "",
      });
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    form.reset();
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <p className="text-red-600 mb-4">कंपनी माहिती लोड करताना त्रुटी झाली</p>
          <Button onClick={() => window.location.reload()}>पुन्हा प्रयत्न करा</Button>
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
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">कंपनी नोंदणी</h1>
              <p className="text-gray-600">आपल्या कंपनीची माहिती व्यवस्थापित करा</p>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>कंपनी तपशील</CardTitle>
                {company && !isEditing && (
                  <Button onClick={handleEdit}>संपादन करा</Button>
                )}
              </CardHeader>
              <CardContent>
                {!company && !isEditing ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">कंपनी माहिती अद्याप नोंदवलेली नाही</p>
                    <Button onClick={() => setIsEditing(true)}>कंपनी नोंदणी करा</Button>
                  </div>
                ) : isEditing ? (
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="name">कंपनीचे नाव *</Label>
                        <Input
                          id="name"
                          {...form.register("name")}
                          placeholder="उदा. गिरण्यार फायनान्स"
                        />
                        {form.formState.errors.name && (
                          <p className="text-red-600 text-sm mt-1">
                            {form.formState.errors.name.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="licenseNumber">परवाना क्रमांक</Label>
                        <Input
                          id="licenseNumber"
                          {...form.register("licenseNumber")}
                          placeholder="उदा. KRD19"
                          className="font-inter"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="address">पत्ता</Label>
                      <Textarea
                        id="address"
                        {...form.register("address")}
                        placeholder="संपूर्ण पत्ता"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="contactNumber">संपर्क क्रमांक</Label>
                        <Input
                          id="contactNumber"
                          {...form.register("contactNumber")}
                          placeholder="9876543210"
                          className="font-inter"
                        />
                      </div>

                      <div>
                        <Label htmlFor="email">ईमेल पत्ता</Label>
                        <Input
                          id="email"
                          type="email"
                          {...form.register("email")}
                          placeholder="example@email.com"
                          className="font-inter"
                        />
                        {form.formState.errors.email && (
                          <p className="text-red-600 text-sm mt-1">
                            {form.formState.errors.email.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3">
                      <Button type="button" variant="outline" onClick={handleCancel}>
                        रद्द करा
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createMutation.isPending || updateMutation.isPending}
                      >
                        {createMutation.isPending || updateMutation.isPending
                          ? "जतन करत आहे..." 
                          : company ? "अपडेट करा" : "जतन करा"
                        }
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label className="text-sm font-medium text-gray-500">कंपनीचे नाव</Label>
                        <p className="text-lg font-medium text-gray-900">{company?.name}</p>
                      </div>

                      {company?.licenseNumber && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">परवाना क्रमांक</Label>
                          <p className="text-lg font-medium text-gray-900 font-inter">
                            {company.licenseNumber}
                          </p>
                        </div>
                      )}
                    </div>

                    {company?.address && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500">पत्ता</Label>
                        <p className="text-gray-900">{company.address}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {company?.contactNumber && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">संपर्क क्रमांक</Label>
                          <p className="text-gray-900 font-inter">{company.contactNumber}</p>
                        </div>
                      )}

                      {company?.email && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">ईमेल पत्ता</Label>
                          <p className="text-gray-900 font-inter">{company.email}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
