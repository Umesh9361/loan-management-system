// Internationalization support for Marathi/English
import { useState, createContext, useContext } from 'react';

export type Language = 'mr' | 'en';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

export const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

// Translation dictionaries
const translations = {
  mr: {
    // Navigation
    'nav.dashboard': 'डॅशबोर्ड',
    'nav.loans': 'कर्ज व्यवस्थापन',
    'nav.borrowers': 'कर्जदार',
    'nav.groups': 'ग्रुप',
    'nav.reports': 'अहवाल',
    'nav.settings': 'सेटिंग्स',
    
    // Loan Management
    'loans.title': 'कर्ज नोंदणी',
    'loans.subtitle': 'नवीन कर्ज नोंदणी करा किंवा अस्तित्वात असलेले संपादित करा',
    'loans.newLoan': 'नवीन कर्ज',
    'loans.editLoan': 'कर्ज संपादित करा',
    'loans.searchPlaceholder': 'कर्जदाराचे नाव, मोबाइल नंबर किंवा खाते क्रमांक शोधा...',
    'loans.searchButton': 'शोधा',
    'loans.clearSearch': 'सर्च साफ करा',
    'loans.recentLoans': 'अलीकडील ५ कर्जे',
    'loans.allLoans': 'सर्व कर्जे',
    'loans.searchResults': 'शोध निकाल',
    
    // Form Labels
    'form.selectGroup': 'ग्रुप निवडा',
    'form.borrowerName': 'कर्जदाराचे नाव',
    'form.borrowerNameSmart': 'कर्जदाराचे नाव (Smart Auto-Fill)',
    'form.borrowerNamePlaceholder': 'कर्जदाराचे नाव टाका - जर असेल तर auto-fill होईल',
    'form.mobileNumber': 'मोबाइल नंबर',
    'form.address': 'पत्ता',
    'form.businessType': 'व्यवसाय',
    'form.loanType': 'कर्जाचा प्रकार',
    'form.accountNumber': 'खाते क्रमांक',
    'form.principalAmount': 'मूळ रक्कम',
    'form.loanDate': 'कर्ज दिनांक',
    'form.maturityDate': 'परतफेडीचा दिनांक',
    'form.interestRate': 'व्याज दर',
    'form.collateralDetails': 'तारणाचा तपशील',
    'form.weight': 'वजन',
    'form.marketValue': 'बाजार मूल्य',
    'form.documentDetails': 'कागदपत्रांचा तपशील',
    'form.specialConditions': 'विशेष अटी',
    'form.otherInfo': 'इतर माहिती',
    
    // Buttons
    'button.save': 'जतन करा',
    'button.cancel': 'रद्द करा',
    'button.edit': 'संपादित करा',
    'button.delete': 'डिलीट करा',
    'button.submit': 'सबमिट करा',
    
    // Messages
    'message.success': 'यशस्वी',
    'message.error': 'त्रुटी',
    'message.loanCreated': 'कर्ज यशस्वीपणे नोंद केले',
    'message.loanUpdated': 'कर्ज यशस्वीपणे अपडेट केले',
    'message.loanDeleted': 'कर्ज यशस्वीपणे डिलीट केले',
    'message.borrowerCreated': 'नवीन कर्जदार जोडला',
    'message.autoFillHint': 'कर्जदार यापूर्वी नोंदणी झाला असेल तर नाव टाईप करताच माहिती auto-fill होईल, नसेल तर नवीन borrower create होईल',
  },
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.loans': 'Loan Management',
    'nav.borrowers': 'Borrowers',
    'nav.groups': 'Groups',
    'nav.reports': 'Reports',
    'nav.settings': 'Settings',
    
    // Loan Management
    'loans.title': 'Loan Registration',
    'loans.subtitle': 'Register new loans or edit existing ones',
    'loans.newLoan': 'New Loan',
    'loans.editLoan': 'Edit Loan',
    'loans.searchPlaceholder': 'Search by borrower name, mobile number or account number...',
    'loans.searchButton': 'Search',
    'loans.clearSearch': 'Clear Search',
    'loans.recentLoans': 'Recent 5 Loans',
    'loans.allLoans': 'All Loans',
    'loans.searchResults': 'Search Results',
    
    // Form Labels
    'form.selectGroup': 'Select Group',
    'form.borrowerName': 'Borrower Name',
    'form.borrowerNameSmart': 'Borrower Name (Smart Auto-Fill)',
    'form.borrowerNamePlaceholder': 'Enter borrower name - will auto-fill if exists',
    'form.mobileNumber': 'Mobile Number',
    'form.address': 'Address',
    'form.businessType': 'Business Type',
    'form.loanType': 'Loan Type',
    'form.accountNumber': 'Account Number',
    'form.principalAmount': 'Principal Amount',
    'form.loanDate': 'Loan Date',
    'form.maturityDate': 'Maturity Date',
    'form.interestRate': 'Interest Rate',
    'form.collateralDetails': 'Collateral Details',
    'form.weight': 'Weight',
    'form.marketValue': 'Market Value',
    'form.documentDetails': 'Document Details',
    'form.specialConditions': 'Special Conditions',
    'form.otherInfo': 'Other Information',
    
    // Buttons
    'button.save': 'Save',
    'button.cancel': 'Cancel',
    'button.edit': 'Edit',
    'button.delete': 'Delete',
    'button.submit': 'Submit',
    
    // Messages
    'message.success': 'Success',
    'message.error': 'Error',
    'message.loanCreated': 'Loan created successfully',
    'message.loanUpdated': 'Loan updated successfully',
    'message.loanDeleted': 'Loan deleted successfully',
    'message.borrowerCreated': 'New borrower added',
    'message.autoFillHint': 'If borrower exists, details will auto-fill when typing name, otherwise new borrower will be created',
  }
};

export const createTranslator = (language: Language) => {
  return (key: string): string => {
    return translations[language][key as keyof typeof translations[typeof language]] || key;
  };
};

export { translations };