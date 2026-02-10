import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { DateUtils } from "@/lib/date-utils";
import { UserPlus, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const partySchema = z.object({
  name: z.string().min(1, "नाव आवश्यक आहे"),
  mobile: z.string().optional(),
  address: z.string().optional(),
  accountType: z.enum(["supplier", "customer", "employee", "asset", "liability", "income", "expense", "bank"]).default("supplier"),
  openingBalance: z.union([z.string(), z.number()]).optional().transform(val => {
    if (val === "" || val === undefined || val === null) return 0;
    return typeof val === "string" ? Number(val) || 0 : val;
  }),
  openingBalanceType: z.enum(["debit", "credit"]).default("credit"),
  openingBalanceDate: z.string().optional(),
  openingBalanceNarration: z.string().default("Opening Balance"),
});

interface PartySelectProps {
  value?: string;
  onValueChange: (value?: string) => void;
  placeholder?: string;
}

export default function PartySelector({ value, onValueChange, placeholder = "व्यक्ती निवडा" }: PartySelectProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch parties
  const { data: parties } = useQuery({
    queryKey: ["/api/parties"],
  });

  const partiesList = Array.isArray(parties) ? parties : [];

  // Enhanced Dual Language Search for Cash Transactions - Same as Loan & Closure Forms
  const createDualLanguageQuery = (originalQuery: string) => {
    const englishToMarathi: Record<string, string> = {
      'ram': 'राम', 'shyam': 'श्याम', 'geeta': 'गीता', 'seeta': 'सीता',
      'vijay': 'विजय', 'ajay': 'अजय', 'sanjay': 'संजय', 'prakash': 'प्रकाश',
      'sunil': 'सुनील', 'anil': 'अनिल', 'vinod': 'विनोद', 'manoj': 'मनोज',
      'raju': 'राजू', 'babu': 'बाबू', 'sir': 'सर', 'ji': 'जी',
      'patel': 'पाटील', 'patil': 'पाटील', 'kumar': 'कुमार', 'devi': 'देवी',
      'laxmi': 'लक्ष्मी', 'ganga': 'गंगा', 'saraswati': 'सरस्वती',
      'rajkumar': 'राजकुमार', 'rajat': 'राजत', 'more': 'मोरे'
    };
    
    const marathiToEnglish: Record<string, string> = {
      'राम': 'ram', 'श्याम': 'shyam', 'गीता': 'geeta', 'सीता': 'seeta',
      'विजय': 'vijay', 'अजय': 'ajay', 'संजय': 'sanjay', 'प्रकाश': 'prakash',
      'सुनील': 'sunil', 'अनिल': 'anil', 'विनोद': 'vinod', 'मनोज': 'manoj',
      'राजू': 'raju', 'बाबू': 'babu', 'सर': 'sir', 'जी': 'ji',
      'पाटील': 'patel', 'कुमार': 'kumar', 'देवी': 'devi',
      'लक्ष्मी': 'laxmi', 'गंगा': 'ganga', 'सरस्वती': 'saraswati',
      'राजकुमार': 'rajkumar', 'राजत': 'rajat', 'मोरे': 'more'
    };
    
    const queries = [originalQuery];
    
    // Add English-to-Marathi translations
    Object.keys(englishToMarathi).forEach(english => {
      if (originalQuery.includes(english)) {
        queries.push(originalQuery.replace(new RegExp(english, 'g'), englishToMarathi[english]));
      }
    });
    
    // Add Marathi-to-English translations
    Object.keys(marathiToEnglish).forEach(marathi => {
      if (originalQuery.includes(marathi)) {
        queries.push(originalQuery.replace(new RegExp(marathi, 'g'), marathiToEnglish[marathi]));
      }
    });
    
    return queries;
  };

  // Enhanced party name matching with dual language support
  const matchesPartyName = (partyName: string, searchTerm: string): boolean => {
    if (!partyName || !searchTerm) return false;
    
    const searchQueries = createDualLanguageQuery(searchTerm.toLowerCase());
    const nameLower = partyName.toLowerCase();
    
    return searchQueries.some(query => {
      // Direct text inclusion
      if (nameLower.includes(query)) return true;
      
      // Word boundary matches
      const nameWords = nameLower.split(/\s+/);
      const queryWords = query.split(/\s+/);
      
      // Check if all query words are found in name
      if (queryWords.length > 1) {
        return queryWords.every(qWord => 
          nameWords.some(nWord => 
            nWord.includes(qWord) || 
            nWord.startsWith(qWord) ||
            qWord.includes(nWord)
          )
        );
      } else {
        // Single word - enhanced partial matching
        return nameWords.some(nWord => 
          nWord.includes(query) || 
          nWord.startsWith(query) ||
          query.includes(nWord) ||
          // Similar name matching (राम/राज, श्याम/श्री etc)
          (query.length >= 2 && nWord.length >= 2 && 
           query.substring(0, 2) === nWord.substring(0, 2))
        );
      }
    });
  };

  // Filter parties based on enhanced dual language search
  const filteredParties = partiesList.filter((party: any) => {
    // Enhanced search with dual language support
    const matchesSearch = !searchQuery || (
      matchesPartyName(party.name || "", searchQuery) ||
      (party.mobile && party.mobile.includes(searchQuery))
    );
    
    return matchesSearch;
  });

  // Add new party form
  type PartyFormValues = z.infer<typeof partySchema>;
  const form = useForm<PartyFormValues>({
    resolver: zodResolver(partySchema),
    defaultValues: {
      name: "",
      mobile: "",
      address: "",
      accountType: "supplier" as const,
      openingBalance: 0,
      openingBalanceType: "credit" as const,
      openingBalanceDate: new Date().toISOString().split('T')[0],
      openingBalanceNarration: "Opening Balance",
    },
  });

  const addPartyMutation = useMutation({
    mutationFn: (newParty: PartyFormValues) => 
      apiRequest("/api/parties", "POST", newParty),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/parties"] });
      setShowAddDialog(false);
      form.reset();
      onValueChange(data.id);
      toast({
        title: "यशस्वी!",
        description: "नवीन व्यक्ती जोडली गेली",
      });
    },
    onError: (error: any) => {
      toast({
        title: "त्रुटी!",
        description: "व्यक्ती जोडता आली नाही - कृपया पुन्हा प्रयत्न करा",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PartyFormValues) => {
    addPartyMutation.mutate(data);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <div className="flex-1">
          <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2">
                <div className="flex items-center space-x-2 mb-2">
                  <Search className="h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="व्यक्ती शोधा..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8"
                  />
                </div>
              </div>
              <SelectItem value="none">कोणतीही व्यक्ती नाही (रोकड)</SelectItem>
              {filteredParties.map((party: any) => (
                <SelectItem key={party.id} value={party.id}>
                  <div className="flex flex-col">
                    <span>{party.name}</span>
                    {party.mobile && (
                      <span className="text-xs text-gray-500">{party.mobile}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
              {filteredParties.length === 0 && searchQuery && (
                <div className="p-2 text-sm text-gray-500 text-center">
                  कोणत्याही व्यक्तीचे नाव सापडले नाही
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <UserPlus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto mx-2 my-2" aria-describedby="add-party-description">
            <DialogHeader>
              <DialogTitle>नवीन व्यक्ती जोडा</DialogTitle>
            </DialogHeader>
            <div id="add-party-description" className="sr-only">
              Add new party form for cash transactions
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-6" autoComplete="off">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>नाव *</FormLabel>
                      <FormControl>
                        <Input placeholder="व्यक्तीचे नाव" {...field} />
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
                          <SelectItem value="asset">मालमत्ता (Asset)</SelectItem>
                          <SelectItem value="liability">देणे (Liability)</SelectItem>
                          <SelectItem value="income">आय (Income)</SelectItem>
                          <SelectItem value="expense">खर्च (Expense)</SelectItem>
                          <SelectItem value="bank">बँक (Bank)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Opening Balance Section */}
                <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 text-sm">🏦 Opening Balance (प्राम्भिक शिल्लक)</h4>
                  
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
                              <SelectItem value="credit">Credit (त्यांना देणे आहे / पैसे मिळणार)</SelectItem>
                              <SelectItem value="debit">Debit (त्यांच्याकडून घेणे आहे / पैसे द्यायचे)</SelectItem>
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
                  
                  <div className="text-xs text-blue-600 bg-blue-100 p-2 rounded">
                    <strong>नोट:</strong> 
                    <br/>• <strong>Credit:</strong> पैसे मिळणार (Cash, Income, त्यांना देणे आहे)
                    <br/>• <strong>Debit:</strong> पैसे द्यायचे (Expense, Asset, त्यांच्याकडून घेणे आहे)
                    <br/>• <strong>रोकड खाते (Cash):</strong> Opening Balance सेट करण्यासाठी Credit निवडा
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 pt-4 border-t mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddDialog(false)}
                    className="min-h-[44px]"
                  >
                    रद्द करा
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={addPartyMutation.isPending}
                    className="min-h-[44px]"
                  >
                    {addPartyMutation.isPending ? "जोडत आहे..." : "जोडा"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Show selected party details */}
      {value && (
        <Card className="bg-gray-50">
          <CardContent className="pt-3">
            {(() => {
              const selectedParty = partiesList.find((p: any) => p.id === value);
              return selectedParty ? (
                <div className="text-sm">
                  <p className="font-medium">{selectedParty.name}</p>
                  {selectedParty.mobile && <p className="text-gray-600">मोबाईल: {selectedParty.mobile}</p>}
                  {selectedParty.address && <p className="text-gray-600">पत्ता: {selectedParty.address}</p>}
                </div>
              ) : (
                <p className="text-sm text-gray-600">रोकड व्यवहार</p>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}