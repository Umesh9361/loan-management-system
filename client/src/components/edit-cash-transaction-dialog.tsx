import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

const editCashTransactionSchema = z.object({
  transactionDate: z.string().min(1, "दिनांक आवश्यक आहे"),
  amount: z.number().min(1, "रक्कम 1 रुपयांपेक्षा जास्त असावी"),
  category: z.string().min(1, "प्रकार निवडा"),
  narration: z.string().min(1, "तपशील आवश्यक आहे"),
});

type EditCashTransactionFormData = z.infer<typeof editCashTransactionSchema>;

interface EditCashTransactionDialogProps {
  transaction: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditCashTransactionDialog({ 
  transaction, 
  open, 
  onOpenChange 
}: EditCashTransactionDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<EditCashTransactionFormData>({
    resolver: zodResolver(editCashTransactionSchema),
    defaultValues: {
      transactionDate: "",
      category: "",
      narration: "",
    },
  });

  // Reset form when transaction changes
  useEffect(() => {
    if (transaction && open) {
      setValue("transactionDate", transaction.transactionDate || "");
      setValue("amount", Number(transaction.amount) || 0);
      setValue("category", transaction.category || "");
      setValue("narration", transaction.narration || "");
    }
  }, [transaction, open, setValue]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => {
      return apiRequest(`/api/cash-transactions/${transaction.id}`, "PUT", data);
    },
    onSuccess: () => {
      // Invalidate all cash-related queries for real-time updates
      queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parties"] });
      
      // Force refresh
      queryClient.refetchQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.refetchQueries({ queryKey: ["/api/cash-balance"] });
      
      toast({
        title: "यशस्वी!",
        description: "व्यवहार अपडेट झाला",
      });
      reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "त्रुटी!",
        description: `व्यवहार अपडेट करता आला नाही: ${error?.message || 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditCashTransactionFormData) => {
    const requestData = {
      ...data,
      transactionDate: data.transactionDate,
      transactionType: transaction.transactionType, // Keep original type
      partyId: transaction.partyId || null, // Keep original party
    };
    updateMutation.mutate(requestData);
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" aria-describedby="edit-transaction-description">
        <DialogHeader>
          <DialogTitle className={transaction.transactionType === 'cash_in' ? "text-green-700" : "text-red-700"}>
            व्यवहार संपादित करा ({transaction.transactionType === 'cash_in' ? 'पैसे आले' : 'पैसे दिले'})
          </DialogTitle>
          <DialogDescription>
            व्यवहाराची माहिती बदला
          </DialogDescription>
        </DialogHeader>
        <div id="edit-transaction-description" className="sr-only">
          Edit cash transaction form
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="transactionDate">दिनांक *</Label>
            <Input
              id="transactionDate"
              type="date"
              {...register("transactionDate")}
              className="font-inter"
            />
            {errors.transactionDate && (
              <p className="text-red-500 text-sm">{errors.transactionDate.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="amount">रक्कम (₹) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="रक्कम भरा"
              {...register("amount", { valueAsNumber: true })}
              className="font-inter"
            />
            {errors.amount && (
              <p className="text-red-500 text-sm">{errors.amount.message}</p>
            )}
          </div>

          <div>
            <Label>प्रकार *</Label>
            <Select value={watch("category")} onValueChange={(value) => setValue("category", value)}>
              <SelectTrigger>
                <SelectValue placeholder="प्रकार निवडा" />
              </SelectTrigger>
              <SelectContent>
                {transaction.transactionType === 'cash_in' ? (
                  <>
                    <SelectItem value="capital">भांडवल</SelectItem>
                    <SelectItem value="income">उत्पन्न</SelectItem>
                    <SelectItem value="other">इतर</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="expense">खर्च</SelectItem>
                    <SelectItem value="other">इतर</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-red-500 text-sm">{errors.category.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="narration">तपशील *</Label>
            <Input
              id="narration"
              placeholder="तपशील भरा"
              {...register("narration")}
            />
            {errors.narration && (
              <p className="text-red-500 text-sm">{errors.narration.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              रद्द करा
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateMutation.isPending ? "अपडेट करत आहे..." : "अपडेट करा"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}