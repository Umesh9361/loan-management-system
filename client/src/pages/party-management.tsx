import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Edit, 
  Trash2, 
  UserPlus, 
  Search, 
  Home,
  Users,
  Phone,
  MapPin,
  Eye
} from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";

const partySchema = z.object({
  name: z.string().min(1, "नाव आवश्यक आहे"),
  mobile: z.string().optional(),
  address: z.string().optional(),
  accountType: z.enum(["supplier", "customer", "employee", "asset", "current_asset", "liability", "current_liability", "long_term_liability", "income", "expense", "bank"]).default("supplier"),
  openingBalance: z.union([z.string(), z.number()]).optional().transform(val => {
    if (val === "" || val === undefined || val === null) return 0;
    return typeof val === "string" ? Number(val) || 0 : val;
  }),
  openingBalanceType: z.enum(["debit", "credit"]).default("credit"),
  openingBalanceDate: z.string().optional(),
  openingBalanceNarration: z.string().default("Opening Balance"),
});

// Account type labels in Marathi
const getAccountTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    supplier: "पुरवठादार",
    customer: "ग्राहक", 
    employee: "कर्मचारी",
    asset: "स्थिर मालमत्ता",
    current_asset: "चालू मालमत्ता",
    liability: "देणे",
    current_liability: "चालू देयता",
    long_term_liability: "दीर्घकालीन देयता",
    income: "आय",
    expense: "खर्च",
    bank: "बँक",
  };
  return labels[type] || type;
};

export default function PartyManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingParty, setEditingParty] = useState<any>(null);

  // Fetch parties
  const { data: parties } = useQuery({
    queryKey: ["/api/parties"],
  });

  const partiesList = Array.isArray(parties) ? parties : [];

  // Show all parties (no balance filtering) to allow users to manage all accounts
  const filteredParties = partiesList.filter((party: any) => {
    // Search query filter only
    const matchesSearch = !searchQuery || (
      party.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (party.mobile && party.mobile.includes(searchQuery)) ||
      (party.address && party.address.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    
    return matchesSearch;
  });

  // Add new party form
  const form = useForm<z.infer<typeof partySchema>>({
    resolver: zodResolver(partySchema),
    defaultValues: {
      name: "",
      mobile: "",
      address: "",
      accountType: "supplier",
      openingBalance: 0,
      openingBalanceType: "credit",
      openingBalanceDate: new Date().toISOString().split('T')[0],
      openingBalanceNarration: "Opening Balance",
    },
  });

  // Edit party form
  const editForm = useForm<z.infer<typeof partySchema>>({
    resolver: zodResolver(partySchema),
    defaultValues: {
      name: "",
      mobile: "",
      address: "",
      accountType: "supplier",
      openingBalance: 0,
      openingBalanceType: "credit",
      openingBalanceDate: new Date().toISOString().split('T')[0],
      openingBalanceNarration: "Opening Balance",
    },
  });

  // Add party mutation
  const addPartyMutation = useMutation({
    mutationFn: (newParty: z.infer<typeof partySchema>) => 
      apiRequest("/api/parties", "POST", newParty),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/parties"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
      setShowAddDialog(false);
      form.reset();
      toast({
        title: "यशस्वी!",
        description: "नवीन खाते तयार केले गेले",
      });
    },
    onError: () => {
      toast({
        title: "त्रुटी!",
        description: "खाते तयार करता आले नाही",
        variant: "destructive",
      });
    },
  });

  // Update party mutation
  const updatePartyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: z.infer<typeof partySchema> }) => 
      apiRequest(`/api/parties/${id}`, "PUT", data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/parties"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
      setShowEditDialog(false);
      setEditingParty(null);
      editForm.reset();
      toast({
        title: "यशस्वी!",
        description: "व्यक्तीची माहिती अपडेट केली",
      });
    },
    onError: () => {
      toast({
        title: "त्रुटी!",
        description: "व्यक्तीची माहिती अपडेट करता आली नाही",
        variant: "destructive",
      });
    },
  });

  // Delete party mutation
  const deletePartyMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/parties/${id}`, "DELETE"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/parties"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
      toast({
        title: "यशस्वी!",
        description: "व्यक्ती काढून टाकली",
      });
    },
    onError: (error: any) => {
      console.error("Delete party error:", error);
      const errorMessage = error?.message || "व्यक्ती काढून टाकता आली नाही";
      toast({
        title: "त्रुटी!",
        description: errorMessage.includes("related transactions") 
          ? "ही व्यक्ती काढून टाकता येत नाही कारण तिचे व्यवहार आहेत"
          : errorMessage,
        variant: "destructive",
      });
    },
  });

  const onAddSubmit = (data: z.infer<typeof partySchema>) => {
    addPartyMutation.mutate(data);
  };

  const onEditSubmit = (data: z.infer<typeof partySchema>) => {
    if (editingParty) {
      updatePartyMutation.mutate({ id: editingParty.id, data });
    }
  };

  const handleEdit = (party: any) => {
    setEditingParty(party);
    editForm.reset({
      name: party.name || "",
      mobile: party.mobile || "",
      address: party.address || "",
      accountType: party.accountType || "supplier",
      openingBalance: party.openingBalance || 0,
      openingBalanceType: party.openingBalanceType || "credit",
      openingBalanceDate: party.openingBalanceDate || new Date().toISOString().split('T')[0],
      openingBalanceNarration: party.openingBalanceNarration || "Opening Balance",
    });
    setShowEditDialog(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("तुम्हाला खरोखर हे खाते काढून टाकायचे आहे का?")) {
      deletePartyMutation.mutate(id);
    }
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
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-3">
                <Link href="/">
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    मुखपृष्ठ
                  </Button>
                </Link>
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">अकाउंट क्रिएशन</h1>
              <p className="text-gray-600">व्यक्तींची खाती तयार करा आणि व्यवस्थापित करा</p>
            </div>

            <div className="space-y-6">
              {/* Search and Add */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      खाते यादी
                    </CardTitle>
                    <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                      <DialogTrigger asChild>
                        <Button className="bg-green-600 hover:bg-green-700">
                          <UserPlus className="h-4 w-4 mr-2" />
                          नवीन खाते तयार करा
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>नवीन खाते तयार करा</DialogTitle>
                        </DialogHeader>
                        <PartyForm 
                          form={form} 
                          onSubmit={onAddSubmit} 
                          isLoading={addPartyMutation.isPending}
                          onCancel={() => setShowAddDialog(false)}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2 mb-4">
                    <Search className="h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="नाव, मोबाईल किंवा पत्त्याने शोधा..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1"
                    />
                  </div>

                  {/* Parties Table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="md:bg-indigo-700">
                          <TableHead className="md:text-white md:py-3">नाव</TableHead>
                          <TableHead className="hidden sm:table-cell md:text-white md:py-3">खाते प्रकार</TableHead>
                          <TableHead className="hidden md:table-cell md:text-white md:py-3">मोबाईल</TableHead>
                          <TableHead className="hidden lg:table-cell md:text-white md:py-3">पत्ता</TableHead>
                          <TableHead className="hidden xl:table-cell md:text-white md:py-3">Opening Balance</TableHead>
                          <TableHead className="md:text-white md:py-3">क्रिया</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredParties.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                              {searchQuery ? "शोधासाठी कोणतेही खाते सापडले नाही" : "कोणतेही खाते सापडले नाही"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredParties.map((party: any) => (
                            <TableRow key={party.id}>
                              <TableCell className="md:px-4 md:py-3">
                                <div className="font-medium md:text-base">{party.name}</div>
                                <div className="sm:hidden text-xs text-gray-500 mt-1 space-y-1">
                                  {party.mobile && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {party.mobile}
                                    </div>
                                  )}
                                  {party.address && (
                                    <div className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {party.address}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell md:px-4 md:py-3">
                                <Badge variant="outline" className="capitalize">
                                  {getAccountTypeLabel(party.accountType || "supplier")}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell md:px-4 md:py-3 md:text-base">
                                {party.mobile || "-"}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell md:px-4 md:py-3 md:text-base">
                                {party.address || "-"}
                              </TableCell>
                              <TableCell className="hidden xl:table-cell md:px-4 md:py-3">
                                {party.openingBalance ? (
                                  <Badge variant={party.openingBalanceType === 'credit' ? 'default' : 'secondary'}>
                                    {party.openingBalanceType === 'credit' ? 'Credit' : 'Debit'}: ₹{Number(party.openingBalance).toLocaleString('en-IN')}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                              <TableCell className="md:px-4 md:py-3">
                                <div className="flex space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(party)}
                                    title="संपादित करा"
                                  >
                                    <Edit className="h-4 w-4 text-indigo-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(party.id)}
                                    disabled={deletePartyMutation.isPending}
                                    title="काढून टाका"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>खाते माहिती संपादित करा</DialogTitle>
          </DialogHeader>
          <PartyForm 
            form={editForm} 
            onSubmit={onEditSubmit} 
            isLoading={updatePartyMutation.isPending}
            onCancel={() => {
              setShowEditDialog(false);
              setEditingParty(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Reusable form component
function PartyForm({ 
  form, 
  onSubmit, 
  isLoading, 
  onCancel 
}: { 
  form: any; 
  onSubmit: (data: any) => void; 
  isLoading: boolean;
  onCancel: () => void;
}) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>नाव *</FormLabel>
              <FormControl>
                <Input placeholder="खाते धारकाचे नाव" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="mobile"
          render={({ field }) => (
            <FormItem>
              <FormLabel>मोबाईल नंबर</FormLabel>
              <FormControl>
                <Input placeholder="मोबाईल नंबर" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>पत्ता</FormLabel>
              <FormControl>
                <Input placeholder="पत्ता" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="accountType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>खाते प्रकार *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="खाते प्रकार निवडा" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="supplier">पुरवठादार (Supplier)</SelectItem>
                  <SelectItem value="customer">ग्राहक (Customer)</SelectItem>
                  <SelectItem value="employee">कर्मचारी (Employee)</SelectItem>
                  <SelectItem value="bank">बँक (Bank)</SelectItem>
                  <SelectItem value="asset">स्थिर मालमत्ता (Fixed Asset)</SelectItem>
                  <SelectItem value="current_asset">चालू मालमत्ता (Current Asset)</SelectItem>
                  <SelectItem value="liability">देणे (Liability)</SelectItem>
                  <SelectItem value="current_liability">चालू देयता (Current Liability)</SelectItem>
                  <SelectItem value="long_term_liability">दीर्घकालीन देयता (Long-term Liability)</SelectItem>
                  <SelectItem value="income">आय (Income)</SelectItem>
                  <SelectItem value="expense">खर्च (Expense)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Opening Balance Section */}
        <div className="space-y-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
          <h4 className="font-semibold text-indigo-800 text-sm">🏦 Opening Balance (प्राम्भिक शिल्लक)</h4>
          
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="openingBalance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>रक्कम (Amount)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="0" 
                      {...field}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="openingBalanceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>प्रकार (Type)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="प्रकार निवडा" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="credit">Credit (त्यांना देणे आहे)</SelectItem>
                      <SelectItem value="debit">Debit (त्यांच्याकडून घेणे आहे)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={form.control}
            name="openingBalanceNarration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>तपशील (Narration)</FormLabel>
                <FormControl>
                  <Input placeholder="Opening Balance" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="text-xs text-indigo-600 bg-indigo-100 p-2 rounded">
            <strong>नोट:</strong> Credit = या व्यक्तीकडून आम्हाला पैसे मिळणार, Debit = या व्यक्तीला आम्ही पैसे द्यायचे
          </div>
        </div>
        
        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            रद्द करा
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading}
          >
            {isLoading ? "प्रतीक्षा करा..." : "जतन करा"}
          </Button>
        </div>
      </form>
    </Form>
  );
}