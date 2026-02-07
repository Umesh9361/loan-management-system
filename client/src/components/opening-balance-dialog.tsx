import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const openingBalanceSchema = z.object({
  amount: z.string().min(1, "रक्कम आवश्यक आहे"),
  type: z.enum(["cash_in", "cash_out"], {
    required_error: "प्रकार निवडा"
  }),
  narration: z.string().min(1, "तपशील आवश्यक आहे"),
});

type OpeningBalanceFormData = z.infer<typeof openingBalanceSchema>;

interface OpeningBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpeningBalanceDialog({ open, onOpenChange }: OpeningBalanceDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<OpeningBalanceFormData>({
    resolver: zodResolver(openingBalanceSchema),
    defaultValues: {
      amount: "",
      type: "cash_in",
      narration: "Opening Balance - आरंभिक शिल्लक",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/cash-transactions", "POST", data),
    onSuccess: () => {
      // Invalidate all cash-related queries for real-time updates
      queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      
      // Force refresh
      queryClient.refetchQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.refetchQueries({ queryKey: ["/api/cash-balance"] });
      
      toast({
        title: "यशस्वी!",
        description: "आरंभिक शिल्लक सेट केली गेली",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "त्रुटी!",
        description: error?.message === "Not authenticated" ? "कृपया पुन्हा लॉगिन करा" : "आरंभिक शिल्लक सेट करता आली नाही",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: OpeningBalanceFormData) => {
    // Convert date to DD/MM/YYYY format for database
    const today = new Date();
    const formatDateForDB = (date: Date) => {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const requestData = {
      amount: parseFloat(data.amount),
      transactionDate: formatDateForDB(today),
      transactionType: data.type,
      category: "opening_balance", // Special category for opening balance
      narration: data.narration,
      partyId: null, // No party for opening balance
    };
    
    createMutation.mutate(requestData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md mx-2 my-2 max-h-[85vh] overflow-y-auto" aria-describedby="opening-balance-description">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold text-blue-700">
            🏦 आरंभिक शिल्लक सेट करा
          </DialogTitle>
          <DialogDescription className="text-center">
            व्यवसायाची प्रारंभिक रोकड शिल्लक सेट करा
          </DialogDescription>
        </DialogHeader>
        <div id="opening-balance-description" className="sr-only">
          Opening balance entry form for cash transactions
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>💵 रक्कम *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      {...field}
                      className="text-xl font-bold text-center h-12"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>📊 प्रकार *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="प्रकार निवडा" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash_in">🟢 Cash In - रोकड आली (Positive Balance)</SelectItem>
                      <SelectItem value="cash_out">🔴 Cash Out - रोकड दिली (Negative Balance)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="narration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>📝 तपशील *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Opening Balance - आरंभिक शिल्लक"
                      {...field}
                      className="h-12"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800">
                <strong>📌 महत्त्वाची माहिती:</strong><br/>
                • हे फक्त एकदाच सेट करा जेव्हा तुम्ही नवीन व्यवसाय सुरू करता<br/>
                • Cash In = तुमच्याकडे रोकड आहे (Positive)<br/>
                • Cash Out = तुमच्याकडे रोकड नाही (Negative/Overdraft)
              </p>
            </div>

            <div className="flex justify-between pt-4 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-12 flex-1"
              >
                ❌ रद्द करा
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="h-12 flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {createMutation.isPending ? "⏳ सेट करत आहे..." : "✅ सेट करा"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}