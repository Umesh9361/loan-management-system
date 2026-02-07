import { useQuery } from "@tanstack/react-query";
import { ReceiptGenerator } from "./receipt-generator";

interface LoanReceiptProps {
  loan: any;
}

export function LoanReceiptComponent({ loan }: LoanReceiptProps) {
  const { data: company } = useQuery({
    queryKey: ["/api/company"],
  });

  const receiptHtml = ReceiptGenerator.generateLoanReceipt(loan, company || null);

  return (
    <div 
      className="receipt-display w-full"
      dangerouslySetInnerHTML={{ __html: receiptHtml }}
    />
  );
}