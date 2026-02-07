import * as XLSX from 'xlsx';
import { DateUtils } from '@/lib/date-utils';

export interface ExcelExportOptions {
  filename: string;
  sheetName: string;
  data: any[];
  columns?: { key: string; header: string; width?: number }[];
}

export const exportToExcel = ({ filename, sheetName, data, columns }: ExcelExportOptions) => {
  try {
    console.log('Excel export starting...', { filename, sheetName, dataLength: data?.length, columns });
    
    // Validate data
    if (!data || data.length === 0) {
      console.error('No data provided for Excel export');
      return false;
    }
    
    // Check if XLSX is available
    if (!XLSX) {
      console.error('XLSX library not available');
      return false;
    }
    
    // Create a new workbook
    const wb = XLSX.utils.book_new();
    console.log('Workbook created successfully');
    
    // If columns are specified, format the data accordingly
    let formattedData = data;
    if (columns && columns.length > 0) {
      console.log('Formatting data with columns...', columns);
      // Create header row
      const headers = columns.map(col => col.header);
      
      // Create data rows
      const rows = data.map(item => 
        columns.map(col => item[col.key] || '')
      );
      
      formattedData = [headers, ...rows];
      console.log('Data formatted, rows:', formattedData.length);
    } else {
      // No columns specified - convert object data to array format
      console.log('No columns specified, converting objects to arrays...');
      if (data.length > 0 && typeof data[0] === 'object') {
        // Get all unique keys from all objects
        const allKeys = Array.from(new Set(data.flatMap(obj => Object.keys(obj))));
        console.log('Object keys found:', allKeys);
        
        // Convert objects to arrays of values
        formattedData = data.map(item => 
          allKeys.map(key => item[key] || '')
        );
        console.log('Data converted to arrays, rows:', formattedData.length);
      }
    }
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(formattedData);
    console.log('Worksheet created successfully');
    
    // Set column widths if specified
    if (columns) {
      const colWidths = columns.map(col => ({ width: col.width || 15 }));
      ws['!cols'] = colWidths;
    }
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    console.log('Worksheet added to workbook');
    
    // Generate filename with current date
    const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const finalFilename = `${filename}_${currentDate}.xlsx`;
    console.log('Final filename:', finalFilename);
    
    // Save the file
    XLSX.writeFile(wb, finalFilename);
    console.log('File saved successfully');
    
    return true;
  } catch (error) {
    console.error('Excel export error:', error);
    console.error('Error details:', {
      message: (error as Error).message || 'Unknown error',
      stack: (error as Error).stack || 'No stack trace',
      name: (error as Error).name || 'Error'
    });
    return false;
  }
};

// Specific export functions for different reports
export const exportCashBookToExcel = (data: any[], companyName: string, dateRange: { from: string, to: string }) => {
  return exportToExcel({
    filename: 'रोकड_वही_स्टेटमेंट',
    sheetName: 'Cash Book Statement',
    data: data.map((item, index) => ({
      serialNo: index + 1,
      date: item.date ? DateUtils.isoToIndianDate(item.date) : item.formattedDate || '',
      particulars: item.particulars || item.narration || item.description || '',
      amount: item.amount > 0 ? `₹${Math.round(item.amount).toLocaleString('en-IN')}` : (item.debit > 0 ? `₹${Math.round(item.debit).toLocaleString('en-IN')}` : (item.credit > 0 ? `₹${Math.round(item.credit).toLocaleString('en-IN')}` : '')),
      type: item.type === 'cash_in' ? 'आवक' : item.type === 'cash_out' ? 'जावक' : item.type || ''
    })),
    columns: [
      { key: 'serialNo', header: 'अ.क्र.', width: 8 },
      { key: 'date', header: 'दिनांक', width: 12 },
      { key: 'particulars', header: 'तपशील', width: 35 },
      { key: 'amount', header: 'रक्कम', width: 15 },
      { key: 'type', header: 'प्रकार', width: 12 }
    ]
  });
};

export const exportCapitalAccountToExcel = (data: any[], companyName: string, dateRange: { from: string, to: string }) => {
  // Prepare header information for Capital Account - CENTERED LAYOUT
  const headerData: any[] = [];
  
  // Add company information and report header - CENTER IN MIDDLE COLUMNS
  headerData.push(
    ['', '', '', `${companyName || 'कंपनी नाव'}`, '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', 'भांडवल खाते', '', '', ''],
    ['', '', '', 'नमुना क्रमांक १३', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', '(नियम १९ पहा)', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', `कालावधी: ${DateUtils.isoToIndianDate(dateRange.from)} ते ${DateUtils.isoToIndianDate(dateRange.to)}`, '', '', ''],
    ['', '', '', '', '', '', ''],
    ['अ.क्र.', 'दिनांक', 'कर्जाची रकमेची एकूण परतफेड', 'रोकड वहीतील पान क्रमांक', 'कर्ज वाटपाची एकूण रक्कम', 'रोकड वहीतील पान क्रमांक', 'व्यवसायात गुंतवलेली निव्वळ शिल्लक रक्कम']
  );

  // Convert data to array format for proper Excel export
  const dataRows = data.map(item => [
    item.serialNo || '',
    item.date || '',
    item.repaymentAmount || '',
    item.repaymentPageNo || '',
    item.disbursementAmount || '',
    item.disbursementPageNo || '',
    item.netBalance || ''
  ]);

  // Calculate totals for the total row
  let totalRepayment = 0;
  let totalDisbursement = 0;
  let finalBalance = 0;
  
  data.forEach(item => {
    if (item.repaymentAmount && typeof item.repaymentAmount === 'number') {
      totalRepayment += item.repaymentAmount;
    }
    if (item.disbursementAmount && typeof item.disbursementAmount === 'number') {
      totalDisbursement += item.disbursementAmount;
    }
    if (item.netBalance && typeof item.netBalance === 'number') {
      finalBalance = item.netBalance; // Get last balance
    }
  });

  // Add total row
  const totalRow = [
    '',
    '',
    `₹${totalRepayment.toLocaleString('en-IN')}`,
    '',
    `₹${totalDisbursement.toLocaleString('en-IN')}`,
    '',
    `₹${Math.abs(finalBalance).toLocaleString('en-IN')}`
  ];

  // Combine all data
  const finalData = [...headerData, ...dataRows, totalRow];

  return exportToExcel({
    filename: 'भांडवल_खाते',
    sheetName: 'Capital Account',
    data: finalData
    // No columns parameter to avoid creating duplicate headers
  });
};



export const exportBorrowerListToExcel = (data: any[], title?: string) => {
  return exportToExcel({
    filename: 'कर्जदारांची_यादी',
    sheetName: 'Borrower List',
    data: data,
    columns: [
      { key: 'serialNo', header: 'अ.क्र.', width: 8 },
      { key: 'borrowerName', header: 'नाव', width: 20 },
      { key: 'mobileNumber', header: 'मोबाईल', width: 15 },
      { key: 'address', header: 'पत्ता', width: 20 },
      { key: 'groupName', header: 'गट', width: 15 },
      { key: 'totalLoans', header: 'एकूण कर्जे', width: 12 },
      { key: 'activeLoans', header: 'सक्रिय कर्जे', width: 12 },
      { key: 'totalOutstanding', header: 'बकाया रक्कम', width: 15 },
      { key: 'registrationDate', header: 'नोंदणी दिनांक', width: 15 }
    ]
  });
};

export const exportAccountLedgerToExcel = (data: any[], accountName: string, dateRange: { from: string, to: string }, accountDetails?: any, companyData?: any, statementData?: any) => {
  // Prepare comprehensive header information
  const headerData: any[] = [];
  
  // Add company information and account name for ALL account ledger types
  if (companyData) {
    headerData.push(
      { serialNo: '', date: '', particulars: `${companyData.name || 'कंपनी नाव'}`, debit: '', credit: '', balance: '' },
      { serialNo: '', date: '', particulars: `${companyData.address || ''}`, debit: '', credit: '', balance: '' },
      { serialNo: '', date: '', particulars: '', debit: '', credit: '', balance: '' },
      { serialNo: '', date: '', particulars: 'खाते लेजर', debit: '', credit: '', balance: '' },
      { serialNo: '', date: '', particulars: `खाते: ${accountName}`, debit: '', credit: '', balance: '' },
      { serialNo: '', date: '', particulars: '', debit: '', credit: '', balance: '' }
    );
  }
  
  // Add account-specific headers only for individual loan statements
  if (accountDetails && accountDetails.type === 'individual_loan') {
    headerData.push(
      { serialNo: '', date: '', particulars: `${accountDetails.formattedType || 'नमुना क्रमांक आठ (नियम 18 पहा)'}`, debit: '', credit: '', balance: '' },
      { serialNo: '', date: '', particulars: '', debit: '', credit: '', balance: '' },
      { serialNo: '', date: '', particulars: `खाते: ${accountDetails.borrowerName || accountName}`, debit: '', credit: '', balance: '' },
      { serialNo: '', date: '', particulars: `मोबाईल: ${accountDetails.borrowerMobile || accountDetails.mobile || ''}`, debit: '', credit: '', balance: '' },
      { serialNo: '', date: '', particulars: `खाते क्र.: ${accountDetails.accountNumber || accountDetails.loanNumber || ''}`, debit: '', credit: '', balance: '' },
      { serialNo: '', date: '', particulars: `मुद्दल राशी: ₹${Number(accountDetails.principalAmount || 0).toLocaleString('en-IN')}`, debit: '', credit: '', balance: '' },
      { serialNo: '', date: '', particulars: `व्याज दर: ${accountDetails.interestRate || 0}% ${accountDetails.interestRateType === 'monthly' ? 'मासिक' : 'वार्षिक'}`, debit: '', credit: '', balance: '' },
      { serialNo: '', date: '', particulars: `कर्ज दिनांक: ${accountDetails.loanDate ? DateUtils.isoToIndianDate(accountDetails.loanDate) : ''}`, debit: '', credit: '', balance: '' },
      { serialNo: '', date: '', particulars: `परतफेड दिनांक: ${accountDetails.maturityDate ? DateUtils.isoToIndianDate(accountDetails.maturityDate) : ''}`, debit: '', credit: '', balance: '' },
      { serialNo: '', date: '', particulars: `व्यवसाय प्रकार: ${accountDetails.businessType === 'कृषी' ? 'कृषी' : accountDetails.businessType === 'agriculture' ? 'कृषी' : accountDetails.businessType ? 'बिगर कृषी' : ''}`, debit: '', credit: '', balance: '' },
      { serialNo: '', date: '', particulars: `वस्तूचे नाव: ${accountDetails.collateral || ''}`, debit: '', credit: '', balance: '' },
      { serialNo: '', date: '', particulars: '', debit: '', credit: '', balance: '' }
    );
  }
  
  // Skip additional headers for cash and loan types
  
  // Add table headers
  headerData.push(
    { serialNo: 'अ.क्र.', date: 'दिनांक', particulars: 'तपशील', debit: 'नाम (Dr)', credit: 'जमा (Cr)', balance: 'शिल्लक' }
  );

  // Prepare data rows with proper formatting - EXACTLY match screen display
  const dataRows = data.map((item, index) => {
    // Handle date format exactly like screen display
    let formattedDate = '';
    if (item.type === 'opening') {
      formattedDate = 'प्रारंभिक';
    } else if (item.date) {
      formattedDate = DateUtils.isoToIndianDate(item.date);
    }
    
    // Handle amounts exactly like screen display
    const debitAmount = item.debit > 0 ? `₹${Math.round(item.debit).toLocaleString('en-IN')}` : '';
    const creditAmount = item.credit > 0 ? `₹${Math.round(item.credit).toLocaleString('en-IN')}` : '';
    const balanceAmount = item.balance !== undefined ? 
      `₹${Math.round(Math.abs(item.balance)).toLocaleString('en-IN')}${item.balance >= 0 ? ' (Dr.)' : ' (Cr.)'}` : '';
    
    return {
      serialNo: index + 1,
      date: formattedDate,
      particulars: item.description || item.particulars || item.narration || '',
      debit: debitAmount,
      credit: creditAmount,
      balance: balanceAmount
    };
  });
  
  // Add totals row exactly like screen display
  const finalData = [...headerData, ...dataRows];
  
  // Add summary row exactly like screen table
  if (statementData) {
    const totalCredit = Math.round(parseFloat(statementData.totalCredit || 0));
    const totalDebit = Math.round(parseFloat(statementData.totalDebit || 0));
    const finalBalance = parseFloat(statementData.finalBalance || 0);
    
    finalData.push({
      serialNo: '',
      date: '',
      particulars: 'एकूण',
      debit: `₹${totalDebit.toLocaleString('en-IN')}`,
      credit: `₹${totalCredit.toLocaleString('en-IN')}`,
      balance: `₹${Math.round(Math.abs(finalBalance)).toLocaleString('en-IN')}${finalBalance >= 0 ? ' (Dr.)' : ' (Cr.)'}`
    });
  }

  // Convert data to array format for Excel (no columns to avoid double headers)
  const arrayData = finalData.map(row => [
    row.serialNo || '',
    row.date || '',
    row.particulars || '',
    row.debit || '',
    row.credit || '',
    row.balance || ''
  ]);

  return exportToExcel({
    filename: `खाते_लेजर_${accountName}`,
    sheetName: 'Account Ledger',
    data: arrayData
    // No columns parameter to avoid creating duplicate headers
  });
};

export const exportAccountSummaryToExcel = (data: any[]) => {
  return exportToExcel({
    filename: 'खाते_सारांश_अहवाल',
    sheetName: 'Account Summary',
    data: data.map((item, index) => ({
      serialNo: index + 1,
      accountName: item.accountName || item.groupName || item.name || '',
      totalLoans: item.totalLoans || 0,
      activeLoans: item.activeLoans || 0,
      closedLoans: item.closedLoans || 0,
      totalAmount: item.totalAmount || 0,
      closedAmount: item.closedAmount || 0,
      activeBalance: item.activeBalance || 0,
      totalInterest: item.totalInterest || 0
    })),
    columns: [
      { key: 'serialNo', header: 'अ.क्र.', width: 8 },
      { key: 'accountName', header: 'गट नाव', width: 20 },
      { key: 'totalLoans', header: 'एकूण कर्जे', width: 12 },
      { key: 'activeLoans', header: 'सक्रिय कर्जे', width: 12 },
      { key: 'closedLoans', header: 'बंद कर्जे', width: 12 },
      { key: 'totalAmount', header: 'एकूण वाटप', width: 15 },
      { key: 'closedAmount', header: 'बंद रक्कम', width: 15 },
      { key: 'activeBalance', header: 'सक्रिय शिल्लक', width: 15 },
      { key: 'totalInterest', header: 'एकूण व्याज', width: 15 }
    ]
  });
};