import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import PartySelector from "@/components/party-selector";
import { ACCOUNT_TYPES, getCashInAccount } from "@shared/constants";
import { Switch } from "@/components/ui/switch";
import { useEffect } from "react";

const cashInSchema = z.object({
  transactionDate: z.string().min(1, "दिनांक आवश्यक आहे"),
  amount: z.string().min(1, "रक्कम आवश्यक आहे").transform(val => Number(val)),
  category: z.string().min(1, "तपशील निवडा"),
  narration: z.string().optional(),
  partyId: z.string().optional(),
});

type CashInFormData = z.infer<typeof cashInSchema>;

interface CashInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CashInDialog({ open, onOpenChange }: CashInDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [useDualEntry, setUseDualEntry] = useState(false); // Toggle for dual-entry

  // Fetch parties for selector
  const { data: parties } = useQuery({
    queryKey: ["/api/parties"],
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    clearErrors
  } = useForm<CashInFormData>({
    resolver: zodResolver(cashInSchema),
    defaultValues: {
      transactionDate: new Date().toISOString().split('T')[0],
      category: "",
      narration: "",
    },
  });

  // Keyboard shortcut for Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleSubmit(onSubmit)();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleSubmit]);

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      // Choose endpoint based on dual-entry toggle
      const endpoint = useDualEntry ? "/api/cash-transactions-with-journal" : "/api/cash-transactions";
      return apiRequest(endpoint, "POST", data);
    },
    onSuccess: (result) => {
      // Invalidate all cash-related queries for real-time updates
      queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] }); // For cash book calculations
      queryClient.invalidateQueries({ queryKey: ["/api/parties"] }); // For party balances
      
      // Force refresh of cash book and reports
      queryClient.refetchQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.refetchQueries({ queryKey: ["/api/cash-balance"] });
      
      const response = result as any;
      const description = useDualEntry 
        ? `रोकड आलेली नोंद झाली आहे - द्विनोंदणी जर्नल ${response.journalEntry?.journalNumber || 'तयार'} झाले`
        : "रोकड आलेली साधी नोंद झाली आहे";
      toast({
        title: "यशस्वी!",
        description: description,
      });
      reset();
      setSelectedParty(null);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "त्रुटी!",
        description: error?.message === "Not authenticated" ? "कृपया पुन्हा लॉगिन करा" : `व्यवहार नोंदवता आला नाही: ${error?.message || 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CashInFormData) => {
    const fromAccount = selectedParty?.name || getCashInAccount(!!selectedParty, data.category);
    
    const requestData = {
      ...data,
      transactionDate: data.transactionDate, // Keep original YYYY-MM-DD format
      transactionType: "cash_in",
      partyId: selectedParty?.id || null,
    };

    // For dual entry, don't add extra fields - the server handles dual entry creation
    createMutation.mutate(requestData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" aria-describedby="cash-in-description">
        <DialogHeader>
          <DialogTitle className="text-green-700">पैसे आले</DialogTitle>
          <DialogDescription>
            रोकड आलेली नोंद करा
          </DialogDescription>
        </DialogHeader>
        <div id="cash-in-description" className="sr-only">
          Cash in transaction entry form
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-4" autoComplete="off">
          {/* DEBUG: Show form validation errors */}
          {Object.keys(errors).length > 0 && (
            <div className="p-2 bg-red-100 border border-red-300 rounded">
              <p className="text-sm text-red-600">Validation Errors:</p>
              <pre className="text-xs">{JSON.stringify(errors, null, 2)}</pre>
            </div>
          )}
          
          {/* Dual Entry Toggle */}
          <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border">
            <div>
              <Label className="text-sm font-medium">द्विनोंदणी (Dual Entry)</Label>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {useDualEntry ? "पूर्ण accounting entries होतील" : "फक्त साधी रोखवही entry होईल"}
              </p>
            </div>
            <Switch
              checked={useDualEntry}
              onCheckedChange={setUseDualEntry}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="transactionDate">दिनांक</Label>
              <Input
                id="transactionDate"
                type="date"
                tabIndex={1}
                autoFocus
                {...register("transactionDate")}
              />
              {errors.transactionDate && (
                <p className="text-sm text-red-600">{errors.transactionDate.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="amount">रक्कम (₹)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                tabIndex={2}
                inputMode="decimal"
                {...register("amount")}
              />
              {errors.amount && (
                <p className="text-sm text-red-600">{errors.amount.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="category">तपशील</Label>
            <Select 
              onValueChange={(value) => {
                setValue("category", value);
                clearErrors("category");
                // Auto-focus next field after selection
                setTimeout(() => {
                  const nextField = document.getElementById("narration");
                  if (nextField) nextField.focus();
                }, 100);
              }}
              value={watch("category")}
            >
              <SelectTrigger tabIndex={3}>
                <SelectValue placeholder="तपशील निवडा" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="capital">मालकाचे भांडवल</SelectItem>
                <SelectItem value="income">उत्पन्न</SelectItem>
                <SelectItem value="expense">खर्च परतावा</SelectItem>
                <SelectItem value="other">इतर</SelectItem>
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-sm text-red-600">{errors.category.message}</p>
            )}
          </div>

          {/* Show party selector only when dual-entry is enabled */}
          {useDualEntry && (
            <>
              <div>
                <Label>कोणाकडून (From)</Label>
                <PartySelector
                  value={selectedParty?.id}
                  onValueChange={(value) => {
                    // Find party from fetched data
                    const partiesList = Array.isArray(parties) ? parties : [];
                    const party = partiesList.find((p: any) => p.id === value);
                    setSelectedParty(party);
                  }}
                  placeholder="व्यक्ती निवडा किंवा नवीन जोडा"
                />
              </div>

              <div>
                <Label htmlFor="toAccount">To</Label>
                <Input
                  value="Cash (रोकड)"
                  disabled
                  className="bg-gray-50 dark:bg-gray-800"
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="narration">इतर माहिती</Label>
            <Textarea
              id="narration"
              placeholder="तपशील लिहा (उदा: दुकान आय, उसना परतावा, वेचाण) - कर्ज operations टाळा"
              tabIndex={4}
              {...register("narration")}
            />
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2 pt-4 sticky bottom-0 bg-white dark:bg-gray-800 border-t mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              रद्द करा
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6"
              tabIndex={5}
            >
              {createMutation.isPending ? "सेव्ह करत आहे..." : "सेव्ह करा"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}