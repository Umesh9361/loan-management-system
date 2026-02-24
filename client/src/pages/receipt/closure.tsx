import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function ClosureReceiptPage() {
  const [receiptData, setReceiptData] = useState<any>(null);

  useEffect(() => {
    // Get receipt data from window object
    if ((window as any).receiptData) {
      setReceiptData((window as any).receiptData);
    }
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (!receiptData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading receipt...</p>
      </div>
    );
  }

  const { loan, closureDetails } = receiptData;

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-3xl md:max-w-5xl mx-auto">
        {/* Print Button - Hidden during print */}
        <div className="no-print mb-4 flex justify-end">
          <Button onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Print Receipt
          </Button>
        </div>

        {/* Receipt Content */}
        <Card className="border-2 border-gray-300 p-8 md:p-10">
          <div className="text-center mb-6">
            <h1 className="text-2xl md:text-3xl font-bold">कर्ज बंद पावती</h1>
            <h2 className="text-xl md:text-2xl">LOAN CLOSURE RECEIPT</h2>
            <p className="text-gray-600 mt-2">Company Name Here</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-600">पावती क्र. / Receipt No:</p>
              <p className="font-semibold">CL-{loan.loanNumber.substring(0, 8)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">दिनांक / Date:</p>
              <p className="font-semibold">
                {new Date(closureDetails.closureDate).toLocaleDateString('en-GB')}
              </p>
            </div>
          </div>

          <div className="border-t border-b py-4 mb-4">
            <h3 className="font-semibold md:text-lg mb-3">कर्जदार माहिती / Borrower Details:</h3>
            <div className="grid grid-cols-2 gap-2">
              <p>नाव / Name:</p>
              <p className="font-medium">{loan.borrowerName}</p>
              
              <p>मोबाईल / Mobile:</p>
              <p className="font-medium">{loan.borrowerMobile || 'N/A'}</p>
              
              <p>कर्ज क्रमांक / Loan No:</p>
              <p className="font-medium">{loan.loanNumber}</p>
              
              <p>खाते क्रमांक / Account No:</p>
              <p className="font-medium">{loan.accountNumber}</p>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold md:text-lg mb-3">कर्ज बंद तपशील / Closure Details:</h3>
            <table className="w-full">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 md:py-3 md:text-base">मुद्दल रक्कम / Principal Amount</td>
                  <td className="text-right font-medium md:text-base">
                    ₹{closureDetails.principalAmount.toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 md:py-3 md:text-base">व्याज रक्कम / Interest Amount</td>
                  <td className="text-right font-medium md:text-base">
                    ₹{closureDetails.interestAmount.toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr className="border-b font-semibold">
                  <td className="py-2 md:py-3 md:text-base">एकूण रक्कम / Total Amount</td>
                  <td className="text-right md:text-base">
                    ₹{closureDetails.totalAmount.toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 md:py-3 md:text-base">प्राप्त रक्कम / Received Amount</td>
                  <td className="text-right font-medium md:text-base">
                    ₹{closureDetails.actualPaid.toLocaleString('en-IN')}
                  </td>
                </tr>
                {closureDetails.balanceRefund > 0 && (
                  <tr className="border-b">
                    <td className="py-2 md:py-3 md:text-base">परतावा रक्कम / Refund Amount</td>
                    <td className="text-right font-medium text-green-600 md:text-base">
                      ₹{closureDetails.balanceRefund.toLocaleString('en-IN')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-center py-4 bg-gray-100 rounded">
            <p className="font-semibold text-lg">कर्ज यशस्वीरित्या बंद केले गेले आहे</p>
            <p className="text-lg">Loan Successfully Closed</p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="border-t border-gray-400 pt-2 mt-16">
                <p className="text-sm">कर्जदाराची सही / Borrower's Signature</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-gray-400 pt-2 mt-16">
                <p className="text-sm">अधिकृत सही / Authorized Signature</p>
              </div>
            </div>
          </div>
        </Card>

        <div className="mt-4 text-center text-xs text-gray-500">
          <p>हि पावती संगणकाद्वारे तयार केली गेली आहे / This receipt is computer generated</p>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          body {
            margin: 0;
            padding: 0;
          }
          
          .min-h-screen {
            min-height: auto;
          }
        }
      `}</style>
    </div>
  );
}