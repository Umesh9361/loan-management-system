import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DualLanguageInput } from "@/components/ui/dual-language-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Users, Search, X } from "lucide-react";

const groupSchema = z.object({
  name: z.string().min(1, "ग्रुपचे नाव आवश्यक आहे"),
  description: z.string().optional(),
});

type GroupFormData = z.infer<typeof groupSchema>;

export default function Groups() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["/api/groups"],
  });

  // Filter and sort groups
  const filteredAndSortedGroups = Array.isArray(groups) ? groups
    .filter((group: any) => 
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (group.description && group.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a: any, b: any) => a.name.localeCompare(b.name)) // Ascending order by name
    .slice(0, 5) : []; // Show recent 5 groups

  const form = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: GroupFormData) => apiRequest("/api/groups", "POST", data),
    onSuccess: () => {
      // Aggressive cache clearing for immediate update
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.refetchQueries({ queryKey: ["/api/groups"] });
      queryClient.removeQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "यशस्वी",
        description: "ग्रुप यशस्वीपणे तयार केला",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      console.log('Create group error:', error);
      
      // Handle duplicate name error specifically
      if (error?.response?.status === 409 && error?.response?.data?.type === "DUPLICATE_NAME_ERROR") {
        toast({
          title: "डुप्लिकेट नाव त्रुटी",
          description: error.response.data.message || "हे ग्रुप नाव आधीच अस्तित्वात आहे",
          variant: "destructive",
        });
        
        // Set form error for name field
        form.setError("name", {
          type: "duplicate",
          message: "हे ग्रुप नाव आधीच अस्तित्वात आहे. कृपया वेगळे नाव निवडा."
        });
      } else {
        toast({
          title: "त्रुटी",
          description: error?.response?.data?.message || "ग्रुप तयार करताना त्रुटी झाली",
          variant: "destructive",
        });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GroupFormData }) => 
      apiRequest(`/api/groups/${id}`, "PUT", data),
    onSuccess: () => {
      // Aggressive cache clearing for immediate update
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.refetchQueries({ queryKey: ["/api/groups"] });
      queryClient.removeQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "यशस्वी",
        description: "ग्रुप यशस्वीपणे अपडेट केला",
      });
      setIsDialogOpen(false);
      setEditingGroup(null);
      form.reset();
    },
    onError: (error: any) => {
      console.log('Update group error:', error);
      
      // Handle duplicate name error specifically
      if (error?.response?.status === 409 && error?.response?.data?.type === "DUPLICATE_NAME_ERROR") {
        toast({
          title: "डुप्लिकेट नाव त्रुटी",
          description: error.response.data.message || "हे ग्रुप नाव आधीच अस्तित्वात आहे",
          variant: "destructive",
        });
        
        // Set form error for name field
        form.setError("name", {
          type: "duplicate",
          message: "हे ग्रुप नाव आधीच अस्तित्वात आहे. कृपया वेगळे नाव निवडा."
        });
      } else {
        toast({
          title: "त्रुटी",
          description: error?.response?.data?.message || "ग्रुप अपडेट करताना त्रुटी झाली",
          variant: "destructive",
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/groups/${id}`, "DELETE"),
    onSuccess: () => {
      // Aggressive cache clearing for immediate update
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.refetchQueries({ queryKey: ["/api/groups"] });
      queryClient.removeQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "यशस्वी",
        description: "ग्रुप यशस्वीपणे डिलीट केला",
      });
    },
    onError: () => {
      toast({
        title: "त्रुटी",
        description: "ग्रुप डिलीट करताना त्रुटी झाली",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: GroupFormData) => {
    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (group: any) => {
    setEditingGroup(group);
    form.reset({
      name: group.name,
      description: group.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("आपण खरोखर हा ग्रुप डिलीट करू इच्छिता?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleNewGroup = () => {
    setEditingGroup(null);
    form.reset();
    setIsDialogOpen(true);
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
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">ग्रुप व्यवस्थापन</h1>
                  <p className="text-gray-600">कर्जदारांचे ग्रुप तयार करा आणि व्यवस्थापित करा</p>
                </div>
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={handleNewGroup}>
                      <Plus className="mr-2 h-4 w-4" />
                      नवीन ग्रुप
                    </Button>
                  </DialogTrigger>
                  
                  <DialogContent aria-describedby="group-dialog-description">
                    <DialogHeader>
                      <div className="flex items-center justify-between">
                        <DialogTitle>
                          {editingGroup ? "ग्रुप संपादित करा" : "नवीन ग्रुप तयार करा"}
                        </DialogTitle>
                        <DialogClose className="lg:hidden">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <X className="h-4 w-4" />
                          </Button>
                        </DialogClose>
                      </div>
                    </DialogHeader>
                    <div id="group-dialog-description" className="sr-only">
                      Group creation and editing form
                    </div>
                    
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
                      <div>
                        <Label htmlFor="name">ग्रुपचे नाव *</Label>
                        <DualLanguageInput
                          id="name"
                          {...form.register("name")}
                          placeholder="ग्रुपचे नाव टाका"
                          enableTransliteration={true}
                          showLanguageToggle={true}
                        />
                        {form.formState.errors.name && (
                          <p className="text-red-600 text-sm mt-1">
                            {form.formState.errors.name.message}
                          </p>
                        )}

                      </div>

                      <div>
                        <Label htmlFor="description">वर्णन</Label>
                        <DualLanguageInput
                          variant="textarea"
                          id="description"
                          {...form.register("description")}
                          placeholder="ग्रुपबद्दल माहिती"
                          enableTransliteration={true}
                          showLanguageToggle={true}
                          textareaProps={{ rows: 3 }}
                        />

                      </div>

                      <div className="flex justify-end space-x-3">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsDialogOpen(false)}
                        >
                          रद्द करा
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createMutation.isPending || updateMutation.isPending}
                        >
                          {createMutation.isPending || updateMutation.isPending
                            ? "जतन करत आहे..." 
                            : editingGroup ? "अपडेट करा" : "तयार करा"
                          }
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Smart Search Box */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="ग्रुप सर्च करा (नाव किंवा वर्णन)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 font-noto"
                />
                <p className="text-sm text-gray-500 mt-1">
                  {searchTerm ? `"${searchTerm}" साठी ${filteredAndSortedGroups.length} परिणाम` : "सर्व ग्रुप्स (नावानुसार क्रमाने)"}
                </p>
              </div>
            </div>

            {/* Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedGroups.map((group: any) => (
                <Card key={group.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-medium font-noto">{group.name}</CardTitle>
                    <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {group.description && (
                      <p className="text-gray-600 text-sm mb-4 font-noto">{group.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-500">
                        तयार केले: {new Date(group.createdAt).toLocaleDateString('hi-IN')}
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(group)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(group.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {(!filteredAndSortedGroups || filteredAndSortedGroups.length === 0) && !searchTerm && (
                <div className="col-span-full">
                  <Card>
                    <CardContent className="text-center py-12">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        कोणतेही ग्रुप नाहीत
                      </h3>
                      <p className="text-gray-600 mb-4">
                        कर्जदारांचे व्यवस्थापन करण्यासाठी पहिला ग्रुप तयार करा
                      </p>
                      <Button onClick={handleNewGroup}>
                        <Plus className="mr-2 h-4 w-4" />
                        पहिला ग्रुप तयार करा
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              {(!filteredAndSortedGroups || filteredAndSortedGroups.length === 0) && searchTerm && (
                <div className="col-span-full">
                  <Card>
                    <CardContent className="text-center py-12">
                      <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        कोणतेही परिणाम सापडले नाहीत
                      </h3>
                      <p className="text-gray-600 mb-4">
                        "{searchTerm}" साठी कोणतेही ग्रुप सापडले नाहीत
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}