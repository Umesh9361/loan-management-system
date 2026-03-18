import jsPDF from "jspdf";
import "jspdf-autotable";
import { initDevanagariFont } from "./pdf-text-generator";

export interface ExportData {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  summary?: { label: string; value: string | number }[];
}

export class ExportService {
  /**
   * Export data to PDF
   */
  static exportToPDF(data: ExportData, filename: string = "report.pdf"): void {
    const doc = new jsPDF();
    
    initDevanagariFont(doc);
    
    // Title
    doc.setFontSize(16);
    doc.text(data.title, 105, 20, { align: "center" });
    
    // Subtitle
    if (data.subtitle) {
      doc.setFontSize(12);
      doc.text(data.subtitle, 105, 30, { align: "center" });
    }
    
    // Table
    (doc as any).autoTable({
      head: [data.headers],
      body: data.rows,
      startY: data.subtitle ? 40 : 30,
      styles: {
        font: "NotoDevanagari",
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [25, 118, 210], // Primary blue color
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
    });
    
    // Summary section
    if (data.summary && data.summary.length > 0) {
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      
      doc.setFontSize(12);
      doc.text("सारांश:", 20, finalY);
      
      data.summary.forEach((item, index) => {
        const yPos = finalY + 10 + (index * 8);
        doc.setFontSize(10);
        doc.text(`${item.label}: ${item.value}`, 20, yPos);
      });
    }
    
    // Save the PDF
    doc.save(filename);
  }

  /**
   * Export data to Excel (CSV format)
   */
  static exportToExcel(data: ExportData, filename: string = "report.csv"): void {
    const csvContent = [
      // Title row
      [data.title],
      ...(data.subtitle ? [[data.subtitle]] : []),
      [""], // Empty row
      // Headers
      data.headers,
      // Data rows
      ...data.rows,
      ...(data.summary ? [
        [""], // Empty row
        ["सारांश:"],
        ...data.summary.map(item => [item.label, item.value])
      ] : [])
    ].map(row => 
      row.map(cell => 
        typeof cell === "string" && cell.includes(",") 
          ? `"${cell}"` 
          : cell
      ).join(",")
    ).join("\n");

    // Create blob and download
    const blob = new Blob(["\ufeff" + csvContent], { 
      type: "text/csv;charset=utf-8;" 
    });
    
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Generate cash book report data
   */
  static prepareCashBookData(
    transactions: any[],
    openingBalance: number = 0,
    dateFrom: string,
    dateTo: string
  ): ExportData {
    let runningBalance = openingBalance;
    
    const rows: (string | number)[][] = [
      [dateFrom, "ओपनिंग बॅलन्स", "-", "-", runningBalance.toLocaleString()]
    ];

    transactions.forEach(transaction => {
      const isDebit = transaction.type === "disbursement";
      const debit = isDebit ? transaction.amount : "-";
      const credit = !isDebit ? transaction.amount : "-";
      
      if (isDebit) {
        runningBalance -= Number(transaction.amount);
      } else {
        runningBalance += Number(transaction.amount);
      }

      rows.push([
        transaction.transactionDate,
        transaction.description || `${transaction.loan.borrower.name} - ${transaction.type}`,
        debit !== "-" ? Number(debit).toLocaleString() : debit,
        credit !== "-" ? Number(credit).toLocaleString() : credit,
        runningBalance.toLocaleString()
      ]);
    });

    // Add closing balance
    rows.push([
      dateTo,
      "क्लोजिंग बॅलन्स",
      "-",
      "-",
      runningBalance.toLocaleString()
    ]);

    return {
      title: "रोकड वही अहवाल",
      subtitle: `${dateFrom} ते ${dateTo}`,
      headers: ["तारीख", "तपशील", "डेबिट (वाटप)", "क्रेडिट (परतफेड)", "शिल्लक"],
      rows,
    };
  }

  /**
   * Generate loan ledger data
   */
  static prepareLoanLedgerData(
    loanData: any,
    transactions: any[]
  ): ExportData {
    const rows: (string | number)[][] = [];
    let balance = Number(loanData.principalAmount);

    transactions.forEach(transaction => {
      const isPayment = transaction.type === "payment" || transaction.type === "closure";
      
      if (isPayment) {
        balance -= Number(transaction.amount);
      }

      rows.push([
        transaction.transactionDate,
        transaction.description || transaction.type,
        !isPayment ? Number(transaction.amount).toLocaleString() : "-",
        isPayment ? Number(transaction.amount).toLocaleString() : "-",
        balance.toLocaleString()
      ]);
    });

    return {
      title: "खातेवही - व्यक्तिगत विवरण",
      subtitle: `${loanData.borrower.name} (${loanData.loanNumber})`,
      headers: ["तारीख", "तपशील", "डेबिट", "क्रेडिट", "शिल्लक"],
      rows,
      summary: [
        { label: "मुद्दल रक्कम", value: `₹ ${Number(loanData.principalAmount).toLocaleString()}` },
        { label: "व्याज दर", value: `${loanData.interestRate}%` },
        { label: "कालावधी", value: `${loanData.durationMonths} महिने` },
        { label: "वर्तमान शिल्लक", value: `₹ ${balance.toLocaleString()}` },
      ],
    };
  }
}
