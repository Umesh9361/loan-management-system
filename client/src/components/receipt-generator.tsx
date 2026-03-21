import { Loan } from "@shared/schema";
import { LoanCalculations } from '@/lib/loan-calculations';
import { formatCurrencyWithWordsMr } from '@/lib/number-to-words-mr';

export class ReceiptGenerator {
  // Helper function to parse and format collateral details
  static parseCollateralDetails(details: string, weight?: string | number, value?: string | number): string {
    if (!details) return '';
    
    // Format weight and value properly in Marathi
    const weightText = weight ? `वजन: ${weight} ग्राम` : '';
    const valueText = value ? `अंदाजे मूल्य: ₹${ReceiptGenerator.cleanDisplayAmount(value)}` : '';
    
    return `
      <div style="font-size: 10px; line-height: 1.2; padding: 2px;">
        <div style="margin-bottom: 1px; font-weight: 500;">वस्तूचा तपशील: ${details}</div>
        ${weightText ? `<div style="margin-bottom: 1px;">${weightText}</div>` : ''}
        ${valueText ? `<div style="margin-bottom: 1px;">${valueText}</div>` : ''}
      </div>
    `;
  }
  
  // Helper function to clean amount display (remove .00)
  static cleanDisplayAmount(amount?: string | number): string {
    if (!amount) return '0';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num % 1 === 0 ? num.toString() : num.toFixed(2).replace(/\.?0+$/, '');
  }

  static generateLoanReceipt(
    loan: Loan, 
    company: { name?: string; licenseNumber?: string } | null,
    receiptType: 'combined' | 'disbursement' | 'closure' | 'blank' | 'form12' | 'combined10_12' | 'blank10_12' = 'combined',
    closureData?: any,
    includeHamipatra: boolean = false,
    showInterestRate: boolean = true
  ): string {
    const formatDate = (date: string) => {
      return new Date(date).toLocaleDateString('en-GB');
    };

    // ✅ BLANK RECEIPT LOGIC: Return empty string for blank receipts, else return actual data
    const getDisplayData = (value: any, fallback: string = '') => {
      if (receiptType === 'blank' || receiptType === 'blank10_12') return '';
      return value !== null && value !== undefined ? value : fallback;
    };

    const isBlankType = receiptType === 'blank' || receiptType === 'blank10_12';

    const getBlankField = (value: any, fallback: string = '') => {
      if (isBlankType) {
        return '<span style="min-width: 100px; display: inline-block; height: 18px; margin: 0 2px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>';
      }
      return value !== null && value !== undefined ? value : fallback;
    };

    // ✅ CLOSURE DATA: Use provided closure data for amounts in नमुना नंबर 11
    const getClosureAmount = (field: string) => {
      if (isBlankType) return '';
      if (receiptType === 'closure' && closureData) {
        return closureData[field] ? `₹${ReceiptGenerator.cleanDisplayAmount(closureData[field])}` : '';
      }
      return ''; // Empty for combined/disbursement (maintain backward compatibility)
    };

    // ✅ SPECIAL: Total amount with words for closure receipt only
    const getClosureTotalWithWords = () => {
      if (isBlankType) return '';
      if (receiptType === 'closure' && closureData && closureData.totalAmount) {
        const amount = parseFloat(closureData.totalAmount);
        return formatCurrencyWithWordsMr(amount);
      }
      return getClosureAmount('totalAmount');
    };

    return `
<!DOCTYPE html>
<html lang="mr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>कर्ज पावती - ${loan.borrowerName}</title>
    <style>
        @page {
            size: 148mm 210mm;
            margin: 0;
        }
        
        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }
            
            html {
                width: 148mm !important;
                height: 210mm !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            
            body {
                width: 148mm !important;
                height: 210mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
            }
            
            .receipt-container {
                width: 144mm !important;
                max-width: 144mm !important;
                height: auto !important;
                max-height: 206mm !important;
                margin: 2mm auto !important;
                padding: 0 !important;
                box-sizing: border-box !important;
                display: flex !important;
                flex-direction: column !important;
                page-break-inside: avoid !important;
                background: white !important;
            }
            
            .control-panel, .no-print, .screen-only {
                display: none !important;
            }
            
            .loan-receipt {
                width: 100% !important;
                height: 94mm !important;
                min-height: 94mm !important;
                max-height: 94mm !important;
                flex: 0 0 94mm !important;
                padding: 3mm !important;
                margin: 0 !important;
                margin-top: 3mm !important;
                border: 1px solid #333 !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                page-break-inside: avoid !important;
                page-break-after: avoid !important;
            }
            
            .cutting-line {
                width: 100% !important;
                height: 10mm !important;
                flex: 0 0 10mm !important;
                margin: 0 !important;
                border: none !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                page-break-inside: avoid !important;
                position: relative !important;
            }
            
            .cutting-line::before {
                content: '' !important;
                position: absolute !important;
                top: 50% !important;
                left: 0 !important;
                right: 0 !important;
                border-top: 2px dashed #666 !important;
            }
            
            .closure-receipt {
                width: 100% !important;
                height: 94mm !important;
                min-height: 94mm !important;
                max-height: 94mm !important;
                flex: 0 0 94mm !important;
                padding: 3mm !important;
                margin: 0 !important;
                margin-bottom: 3mm !important;
                border: 1px solid #333 !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                page-break-inside: avoid !important;
                page-break-before: avoid !important;
            }
            
            .form12-receipt {
                width: 100% !important;
                height: 94mm !important;
                min-height: 94mm !important;
                max-height: 94mm !important;
                flex: 0 0 94mm !important;
                padding: 3mm !important;
                margin: 0 !important;
                margin-bottom: 3mm !important;
                border: 1px solid #333 !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                page-break-inside: avoid !important;
                page-break-before: avoid !important;
            }

            .hamipatra-page {
                page-break-before: always !important;
                width: 144mm !important;
                max-width: 144mm !important;
                margin: 2mm auto !important;
                padding: 5mm !important;
                border: 1px solid #333 !important;
                box-sizing: border-box !important;
            }
        }

        .hamipatra-page {
            width: 144mm;
            max-width: 144mm;
            margin: 4mm auto;
            padding: 5mm;
            border: 1px solid #333;
            font-size: 12px;
            line-height: 1.6;
            background: white;
            box-sizing: border-box;
        }
        .hamipatra-page .hamipatra-title {
            text-align: center;
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 8px;
            border-bottom: 2px solid #333;
            padding-bottom: 6px;
        }
        .hamipatra-page .hamipatra-body {
            font-size: 12px;
            line-height: 1.8;
            text-align: justify;
        }
        .hamipatra-page .hamipatra-field {
            border-bottom: 1px solid #333;
            padding: 0 4px 2px 4px;
            display: inline-block;
            min-width: 60px;
        }
        .hamipatra-page .hamipatra-signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            padding: 0 4px;
        }
        .hamipatra-page .hamipatra-sig-block {
            text-align: center;
            width: 44%;
        }
        .hamipatra-page .hamipatra-sig-line {
            border-bottom: 1px solid #333;
            margin-bottom: 3px;
            height: 24px;
        }
        .hamipatra-page .hamipatra-sig-label {
            font-size: 10px;
        }
        .receipt-container.export-mode ~ .hamipatra-page {
            width: 144mm !important;
            max-width: 144mm !important;
            margin: 2mm auto !important;
            padding: 5mm !important;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Noto Sans Devanagari', Arial, sans-serif;
            background: white;
            width: 100%;
            height: auto;
            margin: 0;
            padding: 8px;
            position: relative;
            font-size: 11px;
            line-height: 1.3;
            box-sizing: border-box;
        }

        .receipt-container {
            width: 100%;
            max-width: 100%;
            height: auto;
            display: flex;
            flex-direction: column;
            margin: 0 auto;
            padding: 2mm;
            background: white;
            box-sizing: border-box;
        }
        
        /* Export mode - fixed A5 dimensions for PDF/image generation */
        /* A5 = 148mm x 210mm. Container has 2mm padding = 206mm internal height */
        /* Top margin (2mm) + Receipt 1 (97mm) + Cut line (8mm) + Receipt 2 (97mm) + Bottom margin (2mm) = 206mm */
        .receipt-container.export-mode {
            width: 148mm !important;
            max-width: 148mm !important;
            height: 210mm !important;
            padding: 2mm !important;
            box-shadow: none !important;
        }
        
        .receipt-container.export-mode .loan-receipt {
            flex: 0 0 auto !important;
            height: 95mm !important;
            min-height: 95mm !important;
            max-height: 95mm !important;
            overflow: visible !important;
            padding: 3mm !important;
            margin-bottom: 0 !important;
            margin-top: 4mm !important;
        }
        
        .receipt-container.export-mode .closure-receipt {
            flex: 0 0 auto !important;
            height: 95mm !important;
            min-height: 95mm !important;
            max-height: 95mm !important;
            overflow: visible !important;
            padding: 3mm !important;
            margin-bottom: 4mm !important;
            margin-top: 0 !important;
        }
        
        .receipt-container.export-mode .form12-receipt {
            flex: 0 0 auto !important;
            height: 95mm !important;
            min-height: 95mm !important;
            max-height: 95mm !important;
            overflow: visible !important;
            padding: 3mm !important;
            margin-bottom: 4mm !important;
            margin-top: 0 !important;
        }
        
        .receipt-container.export-mode .cutting-line {
            flex: 0 0 auto !important;
            height: 4mm !important;
            margin: 2mm 0 !important;
            border-top: 2px dashed #666 !important;
            border-bottom: none !important;
        }
        
        @media screen and (min-width: 600px) {
            body {
                padding: 20px;
                font-size: 13px;
            }
            .receipt-container {
                width: 140mm;
                max-width: 140mm;
                height: 210mm;
                padding: 1mm 4mm;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
        }

        .loan-receipt {
            flex: none;
            padding: 3mm;
            position: relative;
            margin-bottom: 2mm;
            height: auto;
            min-height: auto;
            border: 1px solid #333;
            background: white;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            overflow: visible;
        }
        
        @media screen and (min-width: 600px) {
            .loan-receipt {
                flex: 1;
                overflow: hidden;
            }
        }

        .cutting-line {
            width: 100%;
            height: 4mm;
            flex-shrink: 0;
            border-top: 2px dashed #666;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 2mm 0;
            box-sizing: border-box;
        }

        .cutting-symbol {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            font-size: 12px;
            color: #333;
            background: white;
            padding: 1px 6px;
            font-weight: bold;
            border: 1px solid #ddd;
            border-radius: 2px;
        }

        .closure-receipt {
            flex: none;
            padding: 3mm;
            position: relative;
            margin-top: 2mm;
            height: auto;
            border: 1px solid #333;
            background: white;
            box-sizing: border-box;
            overflow: visible;
        }
        
        @media screen and (min-width: 600px) {
            .closure-receipt {
                flex: 1;
                overflow: hidden;
            }
        }

        .form12-receipt {
            flex: none;
            padding: 3mm;
            position: relative;
            margin-top: 2mm;
            height: auto;
            border: 1px solid #333;
            background: white;
            box-sizing: border-box;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            width: 100%;
            max-width: 100%;
        }
        
        @media screen and (min-width: 600px) {
            .form12-receipt {
                flex: 1;
                overflow: hidden;
            }
        }

        .receipt-header {
            text-align: center;
            margin-bottom: 4px; /* Reduced from 8px to 4px */
            border-bottom: 1px solid #333;
            padding-bottom: 2px; /* Reduced from 4px to 2px */
        }

        .form-number {
            font-size: 12px; /* Reduced from 14px to 12px */
            font-weight: bold;
            float: right;
            text-align: center;
            width: 100%;
            margin-bottom: 4px; /* Significantly reduced from 15px to 4px */
            padding: 2px 0; /* Reduced from 8px to 2px */
            line-height: 1.2; /* Reduced from 1.4 to 1.2 */
        }

        .receipt-title {
            font-size: 14px;
            font-weight: bold;
            margin: 1px 0; /* Reduced from 4px to 1px */
            text-align: center;
        }

        .receipt-title.yearly-statement {
            font-size: 11px; /* Smaller font for yearly statement line */
            font-weight: normal; /* Remove bold formatting */
            margin: 6px 0;
        }

        .field-row {
            display: flex;
            justify-content: space-between;
            margin: 4px 0;
            font-size: 11px;
            align-items: baseline;
            line-height: 1.4;
            padding: 0;
        }

        .field-label {
            font-weight: 600;
            min-width: fit-content;
            font-size: 11px;
            white-space: nowrap;
        }

        .field-value {
            border-bottom: 1px solid #333;
            flex: 1;
            margin-left: 4px;
            padding: 0px 4px 4px 4px;
            min-height: 18px;
            font-weight: 500;
            font-size: 11px;
            line-height: 1.4;
        }
        
        /* ✅ BLANK RECEIPT: Remove border for blank fields to avoid double underlines */
        .field-value.blank-field {
            border-bottom: 1px solid #333 !important;
            background: none;
        }

        .field-value.short {
            max-width: 70px;
            white-space: nowrap;
            flex: none;
        }

        .company-info {
            text-align: center;
            margin: 4px 0;
            font-size: 10px;
            border: 1px solid #333;
            padding: 4px;
            background: #f9f9f9;
            font-weight: 500;
            line-height: 1.2;
        }

        .signature-section {
            display: flex;
            justify-content: flex-end;
            margin-top: 8px;
            margin-bottom: 8px;
            font-size: 11px;
            padding-right: 10px;
        }

        .signature-box {
            text-align: center;
            width: 120px;
            margin-left: auto;
        }

        .signature-line {
            border-bottom: 1px solid #333;
            margin-bottom: 4px;
            height: 20px;
            width: 100%;
        }

        .calculation-section {
            margin: 4px 0; /* Reduced from 8px to 4px */
            border: 1px solid #333;
            padding: 3px; /* Reduced from 5px to 3px */
        }

        .calculation-title {
            text-align: center;
            font-weight: bold;
            margin-bottom: 3px; /* Reduced from 6px to 3px */
            font-size: 12px; /* Reduced back to 12px from 14px */
        }

        .calc-row {
            display: flex;
            justify-content: space-between;
            margin: 4px 0;
            font-size: 13px; /* Increased from 11px to 13px */
        }

        .calc-label {
            min-width: 80px;
        }

        .calc-value {
            border-bottom: 1px solid #333;
            flex: 1;
            margin-left: 10px;
            padding: 0 4px;
            min-height: 16px;
            font-size: 13px;
        }

        .form12-receipt .receipt-header {
            margin-bottom: 4px;
            padding-bottom: 2px;
        }
        .form12-receipt .field-row {
            margin: 6px 0;
            line-height: 1.4;
            font-size: 12px;
            flex-wrap: wrap;
        }
        .form12-receipt .field-label {
            font-size: 12px;
            white-space: normal;
        }
        .form12-receipt .field-value {
            padding: 0px 4px 5px 4px;
            min-height: 18px;
            line-height: 1.4;
            font-size: 12px;
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: normal;
        }
        .form12-receipt .field-value {
            border-bottom: 1px solid #333;
        }

    </style>
</head>
<body>

    <div class="receipt-container">
        ${(receiptType === 'disbursement' || receiptType === 'combined' || receiptType === 'combined10_12' || receiptType === 'blank' || receiptType === 'blank10_12') ? `
        <!-- Loan Statement Receipt (Top) - नमुना क्रमांक १० -->
        <div class="loan-receipt">
            <div class="receipt-header">
                <div class="form-number">नमुना क्रमांक १० (नियम १८)</div>
                <div class="receipt-title yearly-statement">कर्जाचा सद्यस्थितीचा तपशील दर्शविणारे विवरणपत्र</div>
                <div style="font-size: 9px; margin-top: 2px; margin-bottom: 3px; font-weight: 500; color: #333;">
                    सावकार: ${getDisplayData(company?.name)} | परवाना क्र.: ${getDisplayData(company?.licenseNumber)}
                </div>
            </div>

            <div class="field-row">
                <span class="field-label">कर्जदाराचे नाव:</span>
                <div class="field-value">${getBlankField(loan.borrowerName)}</div>
                <span class="field-label" style="margin-left: 15px;">खाते क्रमांक:</span>
                <div class="field-value short">${showInterestRate ? getBlankField(loan.accountNumber || loan.id) : '<span style="display: inline-block; min-width: 60px;">&nbsp;</span>'}</div>
            </div>

            <div class="field-row">
                <span class="field-label">पत्ता:</span>
                <div class="field-value" style="flex: 1;">${getBlankField(loan.borrowerAddress)}</div>
                <span class="field-label" style="margin-left: 10px;">कर्जाची रक्कम:</span>
                <div class="field-value" style="width: 70px; min-width: 70px; max-width: 70px; flex: none; text-align: right;">${getBlankField(`₹${ReceiptGenerator.cleanDisplayAmount(loan.principalAmount || 0)}`)}</div>
            </div>

            <div style="font-size: 10px; margin: 2px 0; line-height: 1.3; display: flex; justify-content: space-between; flex-wrap: wrap;">
                <span><b>कर्ज दिनांक:</b> ${getBlankField(formatDate(loan.loanDate))}</span>
                <span>|</span>
                <span><b>व्याजदर:</b> ${showInterestRate ? getBlankField(`${(loan as any).interestRateType === 'monthly' ? '12' : ReceiptGenerator.cleanDisplayAmount(loan.interestRate || 0)}% वार्षिक`) : '<span style="display: inline-block; min-width: 30px;">&nbsp;</span> वार्षिक'}</span>
                <span>|</span>
                <span><b>मुदत:</b> ${getBlankField(loan.maturityDate ? formatDate(loan.maturityDate) : '-')}</span>
                <span>|</span>
                <span><b>व्यवसाय:</b> ${getBlankField(loan.businessType, 'शेती')}</span>
                <span>|</span>
                <span><b>प्रकार:</b> ${getBlankField((loan as any).loanType === 'विनातारण' ? 'विनातारण' : 'तारण')}</span>
            </div>

            <!-- Collateral Details Section - Always show for blank receipts -->
            ${isBlankType ? `
            <div style="margin: 6px 0 4px 0; border: 1px solid #333; padding: 6px; min-height: 65px; box-sizing: border-box; overflow: hidden; position: relative;">
                <div style="text-align: center; font-weight: bold; margin-bottom: 5px; font-size: 11px;">तारण तपशील</div>
                
                <!-- Item description lines -->
                <div style="height: 14px; border-bottom: 1px solid #333; margin-bottom: 3px;"></div>
                <div style="height: 14px; border-bottom: 1px solid #333; margin-bottom: 6px;"></div>
                
                <!-- Weight and Value fields using simple divs -->
                <div style="display: flex; gap: 12px; font-size: 10px; margin-top: 4px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; margin-bottom: 2px;">वजन:</div>
                        <div style="border-bottom: 1px solid #333; height: 12px; width: 100%;"></div>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; margin-bottom: 2px;">मूल्य:</div>
                        <div style="border-bottom: 1px solid #333; height: 12px; width: 100%;"></div>
                    </div>
                </div>
            </div>
            ` : (loan as any).loanType === 'विनातारण' ? (() => {
                const unsecuredInfo = [(loan as any).specialConditions, (loan as any).documentDetails, (loan as any).otherInfo].filter((v: string) => v && v !== '—' && String(v).trim() !== '').join(' | ');
                return unsecuredInfo ? `
            <div style="margin: 6px 0 4px 0; border: 1px solid #333; padding: 4px 5px;">
                <div style="text-align: center; font-weight: bold; margin-bottom: 5px; font-size: 11px; border-bottom: 1px solid #999; padding-bottom: 3px;">कर्ज तपशील</div>
                <div style="font-size: 10px; line-height: 1.3; padding: 2px;">
                    <div style="font-weight: 500;">${unsecuredInfo}</div>
                </div>
            </div>` : '';
            })()
            : getDisplayData(loan.collateralDetails) ? `
            <div style="margin: 6px 0 4px 0; border: 1px solid #333; padding: 4px 5px;">
                <div style="text-align: center; font-weight: bold; margin-bottom: 5px; font-size: 11px; border-bottom: 1px solid #999; padding-bottom: 3px;">तारण तपशील</div>
                ${ReceiptGenerator.parseCollateralDetails(loan.collateralDetails || '', loan.weight || undefined, loan.marketValue || undefined)}
            </div>
            ` : ''}
            
            ${includeHamipatra ? `
            <!-- Undertaking / हमीपत्र - without border -->
            <div style="margin: 3px 0 2px 0; padding: 1px 2px; font-size: 10px; line-height: 1.2;">
                <span style="font-weight: bold; font-size: 10px;">हमीपत्र:</span>
                <span>
                    मी खात्रीने सांगतो/सांगते की, वर नमूद तारण दागिना/वस्तू माझ्या स्वतःच्या मालकीची असून त्यावर कुणाचाही हक्क/संबंध नाही. सदर वस्तू चोरीची, सापडलेली अथवा बळकावलेली नाही. असे निष्पन्न झाल्यास होणाऱ्या कायदेशीर कारवाईस मी पूर्णतः जबाबदार राहील.
                </span>
            </div>
            ` : ''}

            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 4px; padding: 0 5px;">
                <div style="text-align: center; width: 45%;">
                    <div style="border-bottom: 1px solid #333; margin-bottom: 2px; height: 14px;"></div>
                    <span style="font-size: 10px;">कर्जदाराची सही</span>
                </div>
                <div style="text-align: center; width: 45%;">
                    <div style="border-bottom: 1px solid #333; margin-bottom: 2px; height: 14px;"></div>
                    <span style="font-size: 10px;">सावकाराची सही</span>
                </div>
            </div>
        </div>
        ` : ''}

        ${(receiptType === 'combined' || receiptType === 'combined10_12' || receiptType === 'blank' || receiptType === 'blank10_12') ? `
        <!-- Cutting Line -->
        <div class="cutting-line">
            <span class="cutting-symbol">✂</span>
        </div>
        ` : ''}

        ${(receiptType === 'closure' || receiptType === 'combined' || receiptType === 'blank') ? `
        <!-- Closure Receipt (Bottom) - नमुना क्रमांक ११ -->
        <div class="closure-receipt">
            <div class="receipt-header">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2px;">
                  <div style="flex: 1;"></div>
                  <div style="flex: 2; text-align: center; font-size: 12px; font-weight: bold;">नमुना क्रमांक ११ (नियम १८)</div>
                  <div style="${(closureData && closureData.closureDate && receiptType !== 'blank') ? 'flex: 0 0 auto;' : 'flex: 1;'} text-align: right; font-size: 10px; white-space: nowrap;">
                    <span style="font-weight: 600;">दिनांक:</span>
                    ${(receiptType === 'blank' || !(closureData && closureData.closureDate)) 
                      ? `<span style="margin: 0 2px;">&nbsp;&nbsp;&nbsp;</span><span style="color: #555;">/</span><span style="margin: 0 2px;">&nbsp;&nbsp;&nbsp;</span><span style="color: #555;">/</span><span style="margin: 0 2px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>`
                      : `<span style="font-weight: 500; margin-left: 3px; font-size: 11px;">${formatDate(closureData.closureDate)}</span>`
                    }
                  </div>
                </div>
                <div class="receipt-title">पावती</div>
            </div>

            <div class="field-row">
                <span class="field-label">कर्जदाराचे नाव:</span>
                <div class="field-value">${getBlankField(loan.borrowerName)}</div>
                <span class="field-label" style="margin-left: 15px;">खाते क्रमांक:</span>
                <div class="field-value short">${showInterestRate ? getBlankField(loan.accountNumber || loan.id) : '<span style="display: inline-block; min-width: 60px;">&nbsp;</span>'}</div>
            </div>

            <div class="field-row">
                <span class="field-label">पत्ता:</span>
                <div class="field-value">${getBlankField(loan.borrowerAddress)}</div>
                <span class="field-label" style="margin-left: 15px;">कर्ज दिनांक:</span>
                <div class="field-value short">${getBlankField(formatDate(loan.loanDate))}</div>
            </div>

            <div class="calculation-section">
                <div class="calculation-title">हिशोब तपशील</div>
                <div class="calc-row">
                    <span class="calc-label">मुद्दल कर्जाची रक्कम:</span>
                    <div class="calc-value">${getClosureAmount('principalPaid')}</div>
                </div>
                <div class="calc-row">
                    <span class="calc-label">व्याज:</span>
                    <div class="calc-value">${getClosureAmount('interestPaid')}</div>
                </div>
                <div class="calc-row">
                    <span class="calc-label">इतर शुल्क:</span>
                    <div class="calc-value">${getClosureAmount('balanceRefund')}</div>
                </div>
                <div class="calc-row">
                    <span class="calc-label">एकूण फेडलेली रक्कम:</span>
                    <div class="calc-value">${getClosureTotalWithWords()}</div>
                </div>
            </div>

            <div class="company-info">
                सावकार: ${getDisplayData(company?.name)} | परवाना क्रमांक: ${getDisplayData(company?.licenseNumber)}
            </div>

            <p style="margin: 10px 0; font-size: 10px;">
                मी आपल्याकडे ठेवलेले जिन्नस (दागिने) माझे मला परत मिळाले आहे व तपासून घेतले असून माझी कोणतीही तक्रार नाही.
            </p>

            <div style="display: flex; justify-content: space-between; margin-top: 25px; padding: 0 5px; margin-bottom: 20px;">
                <div style="text-align: center; width: 45%;">
                    <div style="border-bottom: 1px solid #333; margin-bottom: 3px; height: 1px;"></div>
                    <span style="font-size: 11px;">प्रत मिळाली सही</span>
                </div>
                <div style="text-align: center; width: 45%;">
                    <div style="border-bottom: 1px solid #333; margin-bottom: 3px; height: 1px;"></div>
                    <span style="font-size: 11px;">सावकाराची सही</span>
                </div>
            </div>
        </div>
        ` : ''}

        ${(receiptType === 'form12' || receiptType === 'combined10_12' || receiptType === 'blank10_12') ? `
        <!-- Form 12 Receipt - नमुना क्रमांक १२ -->
        <div class="form12-receipt ${isBlankType ? 'form12-blank' : 'form12-filled'}">
            <div class="receipt-header" style="padding-bottom: 6px; margin-bottom: 6px;">
                <div class="form-number">नमुना क्रमांक १२ (नियम १८)</div>
                <div style="font-size: 10px; font-weight: normal; margin: 2px 0; text-align: center;">(तारण जंगम मालाची पावती)</div>
                <div style="font-size: 10px; margin-top: 3px; padding-bottom: 4px; font-weight: 500; color: #333;">
                    सावकार: ${getDisplayData(company?.name)} | परवाना क्र.: ${getDisplayData(company?.licenseNumber)}
                </div>
            </div>

            <div class="field-row">
                <span class="field-label">१. कर्जदाराचे नाव व पत्ता:</span>
                <div class="field-value" style="flex: 1;">${isBlankType ? '' : (getDisplayData(loan.borrowerName) + ', ' + getDisplayData(loan.borrowerAddress))}</div>
            </div>

            <div class="field-row">
                <span class="field-label">२. जात(मागासवर्गीय ${isBlankType ? 'आहे/नाही' : ((loan as any).isBackwardClass ? 'आहे' : 'नाही')})</span>
                <span class="field-label" style="margin-left: 8px;">३. ${isBlankType ? 'कृषी/अकृषिक' : ((loan as any).isFarmer ? 'कृषी' : 'अकृषिक')}</span>
                <span class="field-label" style="margin-left: 8px;">दिनांक:</span>
                <div class="field-value" style="flex: none; min-width: 70px; padding: 0 4px 4px 4px;">${isBlankType ? '' : formatDate(loan.loanDate)}</div>
            </div>

            <div class="field-row">
                <span class="field-label">४. ${(loan as any).loanType === 'विनातारण' ? 'कर्ज तपशील:' : 'तारणाचा तपशील:'}</span>
                <div class="field-value" style="flex: 1; min-height: 36px;">${isBlankType ? '' : ((loan as any).loanType === 'विनातारण' ? [(loan as any).specialConditions, (loan as any).documentDetails, (loan as any).otherInfo].filter((v: string) => v && v !== '—' && String(v).trim() !== '').join(' | ') : (loan.collateralDetails ? (loan.collateralDetails + ((loan as any).weight ? ' | वजन: ' + (loan as any).weight + ' ग्राम' : '')) : ''))}</div>
            </div>
            ${isBlankType ? '<div style="border-bottom: 1px solid #333; height: 18px; margin: 0 0 2px 0;"></div>' : ''}

            <div class="field-row">
                <span class="field-label">५. अंदाजे मूल्य:</span>
                <div class="field-value" style="flex: 0.4;">${isBlankType ? '' : ((loan as any).loanType === 'विनातारण' ? '—' : ((loan as any).marketValue ? '₹' + ReceiptGenerator.cleanDisplayAmount((loan as any).marketValue) : ''))}</div>
                <span class="field-label" style="margin-left: 8px;">६. कर्जाची रक्कम:</span>
                <div class="field-value" style="flex: 0.4;">${isBlankType ? '' : ('₹' + ReceiptGenerator.cleanDisplayAmount(loan.principalAmount || 0))}</div>
            </div>

            <div class="field-row">
                <span class="field-label">७. इतर अनुषंगिक माहिती:</span>
                <div class="field-value" style="flex: 1;">${isBlankType ? '' : ((loan as any).loanType === 'विनातारण' ? [(loan as any).specialConditions, (loan as any).documentDetails, (loan as any).otherInfo].filter((v: string) => v && v !== '—' && String(v).trim() !== '').join(' | ') : ((loan as any).otherInfo && (loan as any).otherInfo !== '—' ? (loan as any).otherInfo : ''))}</div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding: 0 8px; padding-bottom: 4px;">
                <div style="text-align: center; width: 44%;">
                    <div style="border-bottom: 1px solid #333; margin-bottom: 3px; height: 24px;"></div>
                    <span style="font-size: 11px;">कर्जदाराची सही</span>
                </div>
                <div style="text-align: center; width: 44%;">
                    <div style="border-bottom: 1px solid #333; margin-bottom: 3px; height: 24px;"></div>
                    <span style="font-size: 11px;">सावकाराची सही</span>
                </div>
            </div>
        </div>
        ` : ''}
    </div>

    ${includeHamipatra && (receiptType === 'disbursement' || receiptType === 'combined' || receiptType === 'combined10_12' || receiptType === 'blank' || receiptType === 'blank10_12') ? `
    <div class="hamipatra-page">
        <div class="hamipatra-title">हमीपत्र</div>
        <div class="hamipatra-body">
            <p style="margin-bottom: 8px;">
                मी/आम्ही खालील सही करणार, कर्जदार
                <span class="hamipatra-field" style="min-width: 120px; font-weight: 600;">${isBlankType ? '' : getDisplayData(loan.borrowerName)}</span>
                रा.
                <span class="hamipatra-field" style="min-width: 100px;">${isBlankType ? '' : getDisplayData(loan.borrowerAddress)}</span>
                यांचे/यांची हमी घेतो/घेतली आहे.
            </p>
            <p style="margin-bottom: 8px;">
                सदर कर्जदार यांनी सावकार
                <span class="hamipatra-field" style="font-weight: 600;">${getDisplayData(company?.name)}</span>
                यांचेकडून दिनांक
                <span class="hamipatra-field">${isBlankType ? '&nbsp;&nbsp;/&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;' : formatDate(loan.loanDate)}</span>
                रोजी रुपये
                <span class="hamipatra-field" style="font-weight: 600;">${isBlankType ? '' : '₹' + ReceiptGenerator.cleanDisplayAmount(loan.principalAmount || 0)}</span>
                (अक्षरी रु.
                <span class="hamipatra-field" style="min-width: 140px;">${isBlankType ? '' : ''}</span>
                ) इतके कर्ज घेतले आहे.
            </p>
            <p style="margin-bottom: 8px;">
                सदर कर्जाची परतफेड कर्जदार करू न शकल्यास मी/आम्ही सदर कर्जाची संपूर्ण रक्कम व्याजासह फेडण्यास जबाबदार राहू.
            </p>
            <p>
                हे हमीपत्र मी/आम्ही स्वखुशीने व कोणत्याही दबावाशिवाय लिहून देत आहोत.
            </p>
        </div>
        <div class="hamipatra-signatures">
            <div class="hamipatra-sig-block">
                <div class="hamipatra-sig-line"></div>
                <div class="hamipatra-sig-label">हमीदाराची सही / अंगठा</div>
                <div class="hamipatra-sig-line" style="margin-top: 10px;"></div>
                <div class="hamipatra-sig-label">नाव:</div>
                <div class="hamipatra-sig-line" style="margin-top: 10px;"></div>
                <div class="hamipatra-sig-label">पत्ता:</div>
            </div>
            <div class="hamipatra-sig-block">
                <div class="hamipatra-sig-line"></div>
                <div class="hamipatra-sig-label">साक्षीदाराची सही</div>
                <div class="hamipatra-sig-line" style="margin-top: 10px;"></div>
                <div class="hamipatra-sig-label">नाव:</div>
                <div class="hamipatra-sig-line" style="margin-top: 10px;"></div>
                <div class="hamipatra-sig-label">पत्ता:</div>
            </div>
        </div>
        <div style="margin-top: 14px; text-align: right; font-size: 11px;">
            <span>दिनांक: </span>
            <span class="hamipatra-field" style="min-width: 80px;">${isBlankType ? '&nbsp;&nbsp;/&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;' : formatDate(loan.loanDate)}</span>
        </div>
        <div style="margin-top: 10px; text-align: right; font-size: 11px;">
            <span>ठिकाण: </span>
            <span class="hamipatra-field" style="min-width: 80px;">${isBlankType ? '' : ''}</span>
        </div>
    </div>
    ` : ''}
    
    <script>
        window.addEventListener('load', function() {
            setTimeout(function() {
                const printSection = document.getElementById('print-section');
                if (printSection) {
                    printSection.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' 
                    });
                }
            }, 500);
        });
    </script>
</body>
</html>
    `;
  }

  static cleanCSSForBulk(css: string): string {
    css = css.replace(/@page\s*\{[^}]*\}/g, '');
    const removeBlock = (src: string, marker: string): string => {
      let idx = src.indexOf(marker);
      while (idx !== -1) {
        let depth = 0, end = -1, started = false;
        for (let i = idx; i < src.length; i++) {
          if (src[i] === '{') { depth++; started = true; }
          if (src[i] === '}') { depth--; if (started && depth <= 0) { end = i + 1; break; } }
        }
        if (end === -1) break;
        src = src.substring(0, idx) + src.substring(end);
        idx = src.indexOf(marker);
      }
      return src;
    };
    css = removeBlock(css, '@media print');
    css = removeBlock(css, '@media screen');
    css = removeBlock(css, '.receipt-container.export-mode');
    return css;
  }

  static generateBulkReceipts(
    loans: Loan[],
    company: { name?: string; licenseNumber?: string } | null,
    receiptType: 'combined' | 'disbursement' | 'closure' | 'blank' | 'form12' | 'combined10_12' | 'blank10_12',
    showInterestRate: boolean = true
  ): string {
    if (loans.length === 0) return '';
    const isFullA5 = ['combined', 'combined10_12', 'blank', 'blank10_12'].includes(receiptType);
    const perPage = isFullA5 ? 2 : 4;

    const sampleHtml = this.generateLoanReceipt(loans[0], company, receiptType, undefined, false, showInterestRate);
    const styleMatch = sampleHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const receiptCSS = this.cleanCSSForBulk(styleMatch ? styleMatch[1] : '');

    const cellContents: string[] = [];
    for (const loan of loans) {
      const html = this.generateLoanReceipt(loan, company, receiptType, undefined, false, showInterestRate);
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch) {
        let content = bodyMatch[1].trim();
        content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
        cellContents.push(content);
      }
    }

    let pagesHTML = '';
    for (let i = 0; i < cellContents.length; i += perPage) {
      const pageItems = cellContents.slice(i, i + perPage);
      const needsBreak = (i + perPage) < cellContents.length;
      pagesHTML += `<div class="bulk-page${needsBreak ? ' page-break-after' : ''}">`;
      pageItems.forEach(content => {
        pagesHTML += `<div class="bulk-cell">${content}</div>`;
      });
      pagesHTML += '</div>\n';
    }

    const cellHeight = isFullA5 ? '202mm' : '100mm';

    return `<!DOCTYPE html>
<html lang="mr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>बल्क पावती प्रिंट - ${loans.length} कर्जे</title>
<style>
  ${receiptCSS}

  @page { size: A4 landscape; margin: 3mm; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    html, body { width: 291mm !important; margin: 0 !important; padding: 0 !important; }
    .bulk-page { page-break-inside: avoid; }
    .bulk-cell { border-color: #ccc !important; }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: white; }
  body { font-family: 'Noto Sans Devanagari', Arial, sans-serif; font-size: 11px; line-height: 1.3; padding: 0; width: 100%; }

  .bulk-page {
    width: 291mm;
    height: 204mm;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 2mm;
    padding: 0;
    margin: 0 auto;
  }
  .page-break-after { page-break-after: always; }

  .bulk-cell {
    width: 144mm;
    height: ${cellHeight};
    border: 1px dashed #aaa;
    overflow: hidden;
    position: relative;
  }

  .bulk-cell .receipt-container {
    width: 100% !important;
    max-width: 100% !important;
    height: 100% !important;
    max-height: 100% !important;
    padding: 1mm 2mm !important;
    margin: 0 !important;
    box-shadow: none !important;
    display: flex !important;
    flex-direction: column !important;
  }

  .bulk-cell .loan-receipt,
  .bulk-cell .closure-receipt,
  .bulk-cell .form12-receipt {
    flex: 1 !important;
    height: auto !important;
    min-height: auto !important;
    max-height: none !important;
    overflow: hidden !important;
    padding: 2mm !important;
    margin: 1mm 0 !important;
    border: 1px solid #333 !important;
  }

  .bulk-cell .cutting-line {
    height: 4mm !important;
    min-height: 4mm !important;
    max-height: 4mm !important;
    flex: 0 0 4mm !important;
    margin: 0 !important;
  }

  .bulk-cell .hamipatra-page { display: none !important; }

  .bulk-cell .field-row { margin: 2px 0 !important; font-size: 10px !important; }
  .bulk-cell .field-label { font-size: 10px !important; }
  .bulk-cell .field-value { font-size: 10px !important; min-height: 14px !important; padding: 0 3px 2px 3px !important; }
  .bulk-cell .receipt-header { margin-bottom: 2px !important; padding-bottom: 1px !important; }
  .bulk-cell .form-number { font-size: 10px !important; margin-bottom: 2px !important; padding: 1px 0 !important; }
  .bulk-cell .receipt-title { font-size: 12px !important; margin: 0 !important; }
  .bulk-cell .receipt-title.yearly-statement { font-size: 9px !important; }
  .bulk-cell .company-info { font-size: 8px !important; padding: 2px !important; margin: 2px 0 !important; }
  .bulk-cell .calculation-section { margin: 2px 0 !important; padding: 2px !important; }
  .bulk-cell .calculation-title { font-size: 10px !important; margin-bottom: 2px !important; }
  .bulk-cell .calc-row { margin: 2px 0 !important; font-size: 10px !important; }
  .bulk-cell .calc-label { font-size: 10px !important; }
  .bulk-cell .calc-value { font-size: 10px !important; }
  .bulk-cell .signature-section { margin-top: 4px !important; }
</style>
</head>
<body>
${pagesHTML}
</body>
</html>`;
  }

  static openReceiptWindow(
    loan: Loan, 
    company: { name?: string; licenseNumber?: string } | null,
    receiptType: 'combined' | 'disbursement' | 'closure' | 'blank' | 'form12' | 'combined10_12' | 'blank10_12' = 'combined',
    closureData?: any
  ) {
    try {
      console.log("⚡ Fast receipt generation for:", loan.borrowerName);
      const receiptHTML = this.generateLoanReceipt(loan, company, receiptType, closureData);
      
      // Detect mobile devices
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        // Mobile: Always redirect to receipt generator page - most reliable approach
        // window.open often fails or shows blank on mobile in-app browsers
        console.log("📱 Mobile receipt generation - redirecting to receipt generator page");
        
        const receiptURL = `/reports/receipt-generator?loanId=${loan.id}&type=${receiptType}&autoGenerate=true`;
        window.location.href = receiptURL;
        return; // Exit after redirect
      } else {
        // Desktop: Clean popup with preview only (no auto-print)
        const printWindow = window.open('', '_blank', 'width=600,height=800,scrollbars=yes,resizable=yes');
        
        if (printWindow) {
          printWindow.document.write(receiptHTML);
          printWindow.document.close();
          printWindow.focus();
          
          // ✅ NO AUTO-PRINT: User will click "तयार" button to print
          console.log("✅ Desktop preview window opened");
          
        } else {
          // Fallback for blocked popups
          this.downloadReceiptFallback(receiptHTML, loan);
        }
      }
    } catch (error) {
      console.error('🚨 Receipt generation error:', error);
      alert('पावती तयार करण्यात त्रुटी झाली. कृपया पुन्हा प्रयत्न करा.');
    }
  }
  
  static downloadReceiptFallback(receiptHTML: string, loan: Loan) {
    try {
      console.log("📥 Using download fallback method");
      alert('पॉपअप ब्लॉक झाले आहे. पावती HTML file म्हणून download होत आहे. File खोलून print करा.');
      
      const blob = new Blob([receiptHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt_${loan.borrowerName}_${loan.accountNumber || loan.id}.html`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log("✅ Download initiated successfully");
    } catch (error) {
      console.error('🚨 Download fallback error:', error);
      alert('पावती डाउनलोड करण्यात समस्या आली. कृपया browser settings check करा.');
    }
  }

  // Generate Annual Statement Receipt - नमुना क्रमांक १४
  static generateAnnualStatement(
    data: any, 
    company: { name?: string; licenseNumber?: string } | null
  ): string {
    const formatAmount = (amount: number) => {
      return amount ? `₹${Math.round(amount).toLocaleString('en-IN')}` : '₹0';
    };
    
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    return `
<!DOCTYPE html>
<html lang="mr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>वार्षिक लेखा विवरणपत्र - ${data.borrowerName}</title>
    <style>
        @page {
            size: 148mm 210mm;
            margin: 0;
        }

        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            html {
                width: 148mm !important;
                height: 210mm !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            body {
                width: 148mm !important;
                height: 210mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
            }
            .receipt-container {
                width: 144mm !important;
                max-width: 144mm !important;
                margin: 2mm auto !important;
                padding: 0 !important;
                box-sizing: border-box !important;
                background: white !important;
            }
            .annual-receipt {
                width: 100% !important;
                padding: 3mm !important;
                border: 1px solid #333 !important;
                box-sizing: border-box !important;
                margin-top: 3mm !important;
            }
            .control-panel, .no-print {
                display: none !important;
            }
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Noto Sans Devanagari', Arial, sans-serif;
            background: white;
            width: 100%;
            height: auto;
            margin: 0;
            padding: 8px;
            font-size: 10px;
            line-height: 1.2;
            box-sizing: border-box;
        }

        .receipt-container {
            width: 100%;
            max-width: 100%;
            height: auto;
            margin: 0 auto;
            padding: 2mm;
            background: white;
            box-sizing: border-box;
        }

        .receipt-container.export-mode {
            width: 148mm !important;
            max-width: 148mm !important;
            height: 210mm !important;
            padding: 6mm 8mm !important;
            box-shadow: none !important;
        }

        .receipt-container.export-mode .annual-receipt {
            height: auto !important;
            max-height: 190mm !important;
            overflow: visible !important;
            padding: 4mm 5mm !important;
            margin-top: 4mm !important;
        }

        .receipt-container.export-mode .field-row {
            margin: 3px 0 !important;
            font-size: 11px !important;
        }

        .receipt-container.export-mode .field-label {
            font-size: 11px !important;
        }

        .receipt-container.export-mode .field-value {
            font-size: 11px !important;
            padding-bottom: 2px !important;
            min-height: 16px !important;
        }

        .receipt-container.export-mode .table-cell-label {
            padding: 3px 6px !important;
            font-size: 10px !important;
            line-height: 1.4 !important;
        }

        .receipt-container.export-mode .table-cell-value {
            padding: 3px 6px !important;
            font-size: 10px !important;
            width: 90px !important;
            line-height: 1.4 !important;
        }

        .receipt-container.export-mode .form-number {
            font-size: 12px !important;
        }

        .receipt-container.export-mode .receipt-title {
            font-size: 10px !important;
        }

        .receipt-container.export-mode .company-info {
            font-size: 9px !important;
        }

        .receipt-container.export-mode .signature-section {
            font-size: 10px !important;
            margin-top: 6px !important;
        }

        @media screen and (min-width: 600px) {
            body {
                padding: 20px;
                font-size: 11px;
            }
            .receipt-container {
                width: 144mm;
                max-width: 144mm;
                padding: 1mm 4mm;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
        }

        .annual-receipt {
            padding: 3mm;
            border: 1px solid #333;
            background: white;
            box-sizing: border-box;
            overflow: visible;
            margin-top: 2mm;
        }

        .receipt-header {
            text-align: center;
            margin-bottom: 3px;
            border-bottom: 1px solid #333;
            padding-bottom: 2px;
        }

        .form-number {
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 1px;
            line-height: 1.2;
        }

        .receipt-title {
            font-size: 9px;
            font-weight: bold;
            margin: 1px 0;
            line-height: 1.3;
        }

        .field-row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
            font-size: 10px;
            align-items: baseline;
            line-height: 1.3;
            padding: 0;
        }

        .field-label {
            font-weight: 600;
            min-width: fit-content;
            font-size: 10px;
            white-space: nowrap;
        }

        .field-value {
            border-bottom: 1px solid #333;
            flex: 1;
            margin-left: 4px;
            padding: 0px 4px 1px 4px;
            min-height: 14px;
            font-weight: 500;
            font-size: 10px;
            line-height: 1.3;
        }

        .radio-row {
            display: flex;
            align-items: center;
            margin: 2px 0;
            font-size: 9px;
            line-height: 1.2;
            gap: 6px;
        }

        .radio-label {
            font-weight: 600;
            font-size: 9px;
        }

        .radio-option {
            display: inline-flex;
            align-items: center;
            gap: 2px;
            font-size: 9px;
        }

        .radio-option input[type="radio"] {
            width: 10px;
            height: 10px;
            margin: 0;
        }

        .table-section {
            margin: 3px 0;
            border: 1px solid #000;
            font-size: 9px;
        }

        .table-row {
            display: flex;
            border-bottom: 1px solid #000;
        }

        .table-row:last-child {
            border-bottom: none;
        }

        .table-cell-label {
            flex: 1;
            padding: 2px 4px;
            border-right: 1px solid #000;
            line-height: 1.3;
            font-size: 9px;
        }

        .table-cell-value {
            width: 80px;
            padding: 2px 4px;
            text-align: right;
            line-height: 1.3;
            font-size: 9px;
        }

        .company-info {
            text-align: center;
            margin: 3px 0;
            font-size: 8px;
            border: 1px solid #333;
            padding: 2px;
            background: #f9f9f9;
            font-weight: 500;
            line-height: 1.2;
        }

        .signature-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 4px;
            font-size: 9px;
        }

        .date-field {
            font-size: 9px;
        }

        .signature-box {
            text-align: center;
        }

        .signature-line {
            border-bottom: 1px solid #333;
            width: 80px;
            height: 14px;
            margin-bottom: 1px;
        }
    </style>
</head>
<body>
    <div class="receipt-container">
        <div class="annual-receipt">
            <div class="receipt-header">
                <div class="form-number">नमुना क्र १४ (नियम २० पहा)</div>
                <div class="receipt-title">वार्षिक लेखा विवरणपत्र</div>
                <div style="font-size: 7px; line-height: 1.2; margin-top: 1px;">(वर्ष संपल्यानंतर ४५ दिवसांच्या आत सावकाराने कर्जदारास द्यावयाचे)</div>
            </div>

            <div class="field-row">
                <span class="field-label">कर्जदाराचे नाव :</span>
                <span class="field-value">${data.borrowerName || ''}</span>
            </div>

            <div class="field-row">
                <span class="field-label">व्यवसाय :</span>
                <span class="field-value">${data.occupation || ''}</span>
                <span class="field-label" style="margin-left: 8px;">पत्ता :</span>
                <span class="field-value">${data.address || ''}</span>
            </div>

            <div class="radio-row">
                <span class="radio-label">मागासवर्गीय:</span>
                <span class="radio-option"><input type="radio" ${data.isBackwardClass ? 'checked' : ''}> होय</span>
                <span class="radio-option"><input type="radio" ${!data.isBackwardClass ? 'checked' : ''}> नाही</span>
                <span style="margin-left: 10px;"></span>
                <span class="radio-label">शेतकरी:</span>
                <span class="radio-option"><input type="radio" ${data.isFarmer ? 'checked' : ''}> होय</span>
                <span class="radio-option"><input type="radio" ${!data.isFarmer ? 'checked' : ''}> नाही</span>
            </div>

            <div class="field-row">
                <span class="field-label">खाते क्र. :</span>
                <span class="field-value" style="max-width: 80px; flex: none;">${data.accountNumber || ''}</span>
                <span class="field-label" style="margin-left: 8px;">कर्ज दिनांक :</span>
                <span class="field-value" style="max-width: 80px; flex: none;">${formatDate(data.loanDate)}</span>
                <span class="field-label" style="margin-left: 8px;">आर्थिक वर्ष :</span>
                <span class="field-value">${data.financialYear || ''}</span>
            </div>

            <div class="table-section">
                <div class="table-row">
                    <div class="table-cell-label"><strong>वर्षाच्या सुरुवातीस देय मुद्दल, व्याज व कलम २६ शुल्क :</strong></div>
                    <div class="table-cell-value">${formatAmount(data.openingTotal)}</div>
                </div>
                <div class="table-row">
                    <div class="table-cell-label">वर्षभरात दिलेलें एकूण कर्ज :</div>
                    <div class="table-cell-value">${formatAmount(data.yearDisbursement)}</div>
                </div>
                <div class="table-row">
                    <div class="table-cell-label"><strong>वर्षभरात प्राप्त परतफेड</strong> — मुद्दल :</div>
                    <div class="table-cell-value">${formatAmount(data.yearPrincipalRepayment)}</div>
                </div>
                <div class="table-row">
                    <div class="table-cell-label" style="padding-left: 12px;">व्याज :</div>
                    <div class="table-cell-value">${formatAmount(data.yearInterestRepayment)}</div>
                </div>
                <div class="table-row">
                    <div class="table-cell-label"><strong>वर्ष अखेरीस देय</strong> — मुद्दल :</div>
                    <div class="table-cell-value"><strong>${formatAmount(data.closingPrincipal)}</strong></div>
                </div>
                <div class="table-row">
                    <div class="table-cell-label" style="padding-left: 12px;">व्याज :</div>
                    <div class="table-cell-value"><strong>${formatAmount(data.closingInterest)}</strong></div>
                </div>
                <div class="table-row" style="border-top: 2px solid #333;">
                    <div class="table-cell-label"><strong>एकूण देय रक्कम</strong></div>
                    <div class="table-cell-value"><strong>${formatAmount(data.closingTotal)}</strong></div>
                </div>
            </div>

            <div class="company-info">
                सावकार: ${company?.name || ''} | परवाना क्रमांक: ${company?.licenseNumber || ''}
            </div>

            <div class="signature-section">
                <div class="date-field">दिनांक : ${new Date().toLocaleDateString('en-GB')}</div>
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <div>सावकाराची स्वाक्षरी</div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }

  static generateBulkLoanLedger(
    dataArray: any[],
    company: { name?: string; licenseNumber?: string } | null | undefined,
    groups: { id?: string; name?: string }[]
  ): string {
    if (dataArray.length === 0) return '';

    const companyName = company?.name || '';
    const groupMap = new Map((groups || []).map((g: any) => [g.id, g.name]));

    const formatDate = (d: string) => {
      if (!d) return '';
      const parts = d.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return d;
    };

    let pagesHTML = '';
    dataArray.forEach((loan, idx) => {
      const groupName = groupMap.get(loan.groupId) || '';
      const rateLabel = loan.interestRateType === 'monthly' ? 'मासिक' : 'वार्षिक';
      const needsBreak = idx < dataArray.length - 1;

      let rows = '';
      (loan.entries || []).forEach((entry: any) => {
        const bal = entry.balance || 0;
        const drLabel = bal >= 0 ? ' (Dr.)' : ' (Cr.)';
        const dateDisplay = entry.type === 'opening' ? 'प्रारंभिक' : formatDate(entry.date);
        const rowBg = entry.type === 'opening' ? 'background:#fff4e6;' : '';

        rows += `<tr style="${rowBg}">
          <td style="border:1px solid #333;padding:3px 4px;text-align:center;font-size:9px;">${dateDisplay}</td>
          <td style="border:1px solid #333;padding:3px 4px;text-align:left;font-size:9px;">${entry.description || ''}</td>
          <td style="border:1px solid #333;padding:3px 4px;text-align:right;font-size:9px;">${entry.debit > 0 ? '₹' + Math.round(entry.debit).toLocaleString('en-IN') : ''}</td>
          <td style="border:1px solid #333;padding:3px 4px;text-align:right;font-size:9px;">${entry.credit > 0 ? '₹' + Math.round(entry.credit).toLocaleString('en-IN') : ''}</td>
          <td style="border:1px solid #333;padding:3px 4px;text-align:right;font-size:9px;font-weight:bold;color:red;">${bal < 0 ? '-' : ''}₹${Math.round(Math.abs(bal)).toLocaleString('en-IN')}${drLabel}</td>
        </tr>`;
      });

      const finalBal = loan.finalBalance || 0;
      const finalDrLabel = finalBal >= 0 ? ' (Dr.)' : ' (Cr.)';
      rows += `<tr style="background:#e3f2fd;font-weight:bold;">
        <td style="border:1px solid #333;padding:4px;text-align:center;font-size:9px;" colspan="2">एकूण</td>
        <td style="border:1px solid #333;padding:4px;text-align:right;font-size:9px;">₹${Math.round(loan.totalDebit || 0).toLocaleString('en-IN')}</td>
        <td style="border:1px solid #333;padding:4px;text-align:right;font-size:9px;">₹${Math.round(loan.totalCredit || 0).toLocaleString('en-IN')}</td>
        <td style="border:1px solid #333;padding:4px;text-align:right;font-size:10px;color:red;">${finalBal < 0 ? '-' : ''}₹${Math.round(Math.abs(finalBal)).toLocaleString('en-IN')}${finalDrLabel}</td>
      </tr>`;

      pagesHTML += `<div class="ledger-page${needsBreak ? ' page-break-after' : ''}">
        <div style="text-align:center;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #333;">
          <p style="font-size:14px;font-weight:bold;margin:0 0 3px 0;">${companyName}</p>
          <p style="font-size:12px;font-weight:bold;margin:0 0 2px 0;">नमुना क्रमांक आठ</p>
          <p style="font-size:9px;color:#555;margin:0;">(नियम १८ पहा)</p>
        </div>
        <div style="margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #ddd;">
          <p style="font-size:10px;font-weight:600;margin:0 0 3px 0;">खाते: ${loan.borrowerName}${groupName ? ' | गट: ' + groupName : ''}</p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:9px;">
            <span>खाते क्र.: ${loan.accountNumber}</span>
            <span>मुद्दल: ₹${Math.round(loan.principalAmount).toLocaleString('en-IN')}</span>
            <span>व्याज दर: ${loan.interestRate}% ${rateLabel}</span>
            <span>कर्ज दिनांक: ${formatDate(loan.loanDate)}</span>
          </div>
          <p style="font-size:9px;color:#555;margin-top:2px;">कालावधी: ${formatDate(loan.dateFrom)} ते ${formatDate(loan.dateTo)}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <colgroup><col style="width:12%;"><col style="width:34%;"><col style="width:16%;"><col style="width:16%;"><col style="width:22%;"></colgroup>
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="border:1px solid #333;padding:4px;text-align:center;font-size:9px;">दिनांक</th>
              <th style="border:1px solid #333;padding:4px;text-align:center;font-size:9px;">तपशील</th>
              <th style="border:1px solid #333;padding:4px;text-align:center;font-size:9px;">नावे (Dr.)</th>
              <th style="border:1px solid #333;padding:4px;text-align:center;font-size:9px;">जमा (Cr.)</th>
              <th style="border:1px solid #333;padding:4px;text-align:center;font-size:9px;background:#dbeafe;">शिल्लक</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:8px;text-align:right;font-size:8px;color:#888;">
          ${loan.status === 'closed' ? '<span style="color:red;font-weight:bold;">बंद</span> | ' : ''}अहवाल तयार केला: ${new Date().toLocaleDateString('en-GB')}
        </div>
      </div>\n`;
    });

    return `<!DOCTYPE html>
<html lang="mr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>बल्क कर्ज लेजर (नमुना क्र. ८) - ${dataArray.length} कर्जे</title>
<style>
  @page { size: A4 portrait; margin: 8mm 8mm 8mm 25.4mm; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .ledger-page { page-break-inside: avoid; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: white; font-family: 'Noto Sans Devanagari', Arial, sans-serif; }
  .ledger-page { padding: 15px 20px 15px 15mm; }
  .page-break-after { page-break-after: always; }
  table { width: 100%; border-collapse: collapse; }
</style>
</head>
<body>
${pagesHTML}
</body>
</html>`;
  }

  static generateBulkAnnualStatements(
    dataArray: any[],
    company: { name?: string; licenseNumber?: string } | null
  ): string {
    if (dataArray.length === 0) return '';
    const perPage = 4;

    const sampleHtml = this.generateAnnualStatement(dataArray[0], company);
    const styleMatch = sampleHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const receiptCSS = this.cleanCSSForBulk(styleMatch ? styleMatch[1] : '');

    const cellContents: string[] = [];
    for (const data of dataArray) {
      const html = this.generateAnnualStatement(data, company);
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch) {
        let content = bodyMatch[1].trim();
        content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
        cellContents.push(content);
      }
    }

    let pagesHTML = '';
    for (let i = 0; i < cellContents.length; i += perPage) {
      const pageItems = cellContents.slice(i, i + perPage);
      const needsBreak = (i + perPage) < cellContents.length;
      pagesHTML += `<div class="bulk-page${needsBreak ? ' page-break-after' : ''}">`;
      pageItems.forEach(content => {
        pagesHTML += `<div class="bulk-cell">${content}</div>`;
      });
      pagesHTML += '</div>\n';
    }

    return `<!DOCTYPE html>
<html lang="mr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>बल्क वार्षिक लेखा विवरणपत्र - ${dataArray.length} कर्जे</title>
<style>
  ${receiptCSS}

  @page { size: A4 landscape; margin: 3mm; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    html, body { width: 291mm !important; margin: 0 !important; padding: 0 !important; }
    .bulk-page { page-break-inside: avoid; }
    .bulk-cell { border-color: #ccc !important; }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: white; }
  body { font-family: 'Noto Sans Devanagari', Arial, sans-serif; font-size: 10px; line-height: 1.2; padding: 0; width: 100%; }

  .bulk-page {
    width: 291mm;
    height: 204mm;
    display: grid;
    grid-template-columns: 144mm 144mm;
    grid-template-rows: 100mm 100mm;
    gap: 1.5mm 3mm;
    padding: 0;
    margin: 0 auto;
  }
  .page-break-after { page-break-after: always; }

  .bulk-cell {
    width: 144mm;
    height: 100mm;
    border: 1px dashed #aaa;
    overflow: hidden;
    position: relative;
  }

  .bulk-cell .receipt-container {
    width: 100% !important;
    max-width: 100% !important;
    height: 100% !important;
    max-height: 100% !important;
    padding: 1mm 2mm !important;
    margin: 0 !important;
    box-shadow: none !important;
  }

  .bulk-cell .annual-receipt {
    height: auto !important;
    max-height: none !important;
    overflow: hidden !important;
    padding: 2mm !important;
    margin: 1mm 0 !important;
    border: 1px solid #333 !important;
  }

  .bulk-cell .receipt-header { margin-bottom: 1px !important; padding-bottom: 1px !important; }
  .bulk-cell .form-number { font-size: 9px !important; margin-bottom: 1px !important; padding: 0 !important; }
  .bulk-cell .receipt-title { font-size: 8px !important; margin: 0 !important; }
  .bulk-cell .field-row { margin: 1px 0 !important; font-size: 9px !important; }
  .bulk-cell .field-label { font-size: 9px !important; }
  .bulk-cell .field-value { font-size: 9px !important; min-height: 12px !important; padding: 0 3px 1px 3px !important; }
  .bulk-cell .radio-row { font-size: 8px !important; margin: 1px 0 !important; gap: 4px !important; }
  .bulk-cell .radio-label { font-size: 8px !important; }
  .bulk-cell .radio-option { font-size: 8px !important; }
  .bulk-cell .radio-option input[type="radio"] { width: 8px !important; height: 8px !important; }
  .bulk-cell .table-section { margin: 2px 0 !important; font-size: 8px !important; }
  .bulk-cell .table-row { }
  .bulk-cell .table-cell-label { padding: 1px 3px !important; font-size: 8px !important; line-height: 1.2 !important; }
  .bulk-cell .table-cell-value { padding: 1px 3px !important; font-size: 8px !important; width: 70px !important; line-height: 1.2 !important; }
  .bulk-cell .company-info { font-size: 7px !important; padding: 1px !important; margin: 2px 0 !important; }
  .bulk-cell .signature-section { margin-top: 2px !important; font-size: 8px !important; }
  .bulk-cell .signature-line { width: 60px !important; height: 10px !important; }
  .bulk-cell .date-field { font-size: 8px !important; }
</style>
</head>
<body>
${pagesHTML}
</body>
</html>`;
  }

  static generateJawabForm(data: {
    financialYear: string;
    prevYear?: string;
    company: { name?: string; licenseNumber?: string; address?: string } | null;
    openingBalance: number;
    yearDisbursement: number;
    totalAmount: number;
    yearCollection: number;
    closingBalance: number;
    interestCollected: number;
    maxCapitalAmount?: number;
    maxCapitalDate?: string;
    inspectionFee?: number;
    renewalDate?: string;
    feeDate?: string;
    jawabDate?: string;
    proprietorName?: string;
    proprietorAge?: string;
  }): string {
    const fy = data.financialYear || '';
    const fyParts = fy.split('-');
    const fyStart = fyParts[0] || '';
    const fyEnd = fyParts[1] || '';
    const prevFyEnd = String(parseInt(fyStart));
    const company = data.company || { name: '', licenseNumber: '', address: '' };
    const companyName = company.name || '';
    const licenseNumber = company.licenseNumber || '';
    const companyAddress = company.address || '';

    const formatAmt = (amount: number) => {
      if (!amount && amount !== 0) return '₹ 0';
      return '₹ ' + Math.round(amount).toLocaleString('en-IN');
    };

    const formatDateDDMMYYYY = (dateStr?: string) => {
      if (!dateStr) return '____/____/____';
      const d = new Date(dateStr);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    const maxCapitalAmt = data.maxCapitalAmount || 0;
    const maxCapitalDateFormatted = formatDateDDMMYYYY(data.maxCapitalDate);
    const inspectionFee = data.inspectionFee || 0;

    const renewalDateFmt = data.renewalDate ? formatDateDDMMYYYY(data.renewalDate) : `______/______/${fyEnd}`;
    const feeDateFmt = data.feeDate ? formatDateDDMMYYYY(data.feeDate) : `______/______/${fyEnd}`;
    const jawabDateFmt = data.jawabDate ? formatDateDDMMYYYY(data.jawabDate) : `____/____/${fyEnd}`;
    const proprietorName = data.proprietorName || '________________________________________';
    const proprietorAge = data.proprietorAge || '______';

    return `<!DOCTYPE html>
<html lang="mr">
<head>
<meta charset="UTF-8">
<title>जवाब - ${fy}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page {
    size: A4 portrait;
    margin: 20mm 15mm 15mm 25.4mm;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Noto Sans Devanagari', Arial, sans-serif;
    font-size: 13px;
    line-height: 1.7;
    color: #000;
    background: white;
    -webkit-text-size-adjust: 100%;
  }
  .jawab-page {
    width: 100%;
    max-width: 700px;
    margin: 0 auto;
    padding: 15px 10px;
  }
  .company-header {
    text-align: center;
    font-size: 17px;
    font-weight: 700;
    margin-bottom: 2px;
    letter-spacing: 0.5px;
  }
  .company-address {
    text-align: center;
    font-size: 11px;
    font-weight: 400;
    color: #333;
    margin-bottom: 6px;
  }
  .header-title {
    text-align: center;
    font-size: 18px;
    font-weight: 700;
    text-decoration: underline;
    margin-bottom: 12px;
    letter-spacing: 1px;
  }
  .sub-title {
    text-align: center;
    font-size: 11px;
    font-weight: 500;
    margin-bottom: 10px;
    color: #333;
  }
  .header-info {
    font-size: 12px;
    margin-bottom: 5px;
    line-height: 1.8;
    text-align: justify;
  }
  .header-info div {
    margin-bottom: 2px;
  }
  .legal-text {
    font-size: 12px;
    line-height: 1.8;
    text-align: justify;
    margin: 12px 0;
  }
  .legal-text p {
    margin-bottom: 8px;
    text-indent: 25px;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 12px;
  }
  .data-table th, .data-table td {
    border: 1.5px solid #000;
    padding: 6px 10px;
    text-align: left;
  }
  .data-table th {
    background: #f0f0f0;
    font-weight: 700;
    text-align: center;
    font-size: 13px;
  }
  .data-table .sr-col { width: 50px; text-align: center; }
  .data-table .desc-col { width: auto; }
  .data-table .amt-col { width: 150px; text-align: right; font-weight: 500; }
  .data-table tr.total-row td { font-weight: 700; }
  .closing-text {
    font-size: 12px;
    line-height: 1.8;
    text-align: justify;
    margin: 14px 0;
  }
  .signature-section {
    margin-top: 20px;
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    align-items: flex-start;
  }
  .signature-left {
    text-align: left;
    line-height: 1.6;
  }
  .signature-right {
    text-align: center;
    min-width: 200px;
  }
  .footer-text {
    margin-top: 30px;
    font-size: 11px;
    text-align: center;
    border-top: 1px solid #999;
    padding-top: 10px;
    color: #333;
  }
  @media screen and (max-width: 480px) {
    body { font-size: 11px; line-height: 1.5; }
    .jawab-page { padding: 8px 6px; }
    .company-header { font-size: 14px; }
    .header-title { font-size: 15px; margin-bottom: 8px; }
    .sub-title { font-size: 10px; margin-bottom: 6px; }
    .header-info { font-size: 10px; line-height: 1.6; }
    .legal-text { font-size: 10px; line-height: 1.6; margin: 8px 0; }
    .legal-text p { margin-bottom: 5px; text-indent: 15px; }
    .data-table { font-size: 10px; margin: 8px 0; }
    .data-table th, .data-table td { padding: 4px 5px; }
    .data-table th { font-size: 11px; }
    .data-table .sr-col { width: 30px; }
    .data-table .amt-col { width: 90px; }
    .closing-text { font-size: 10px; line-height: 1.6; margin: 8px 0; }
    .signature-section { margin-top: 20px; font-size: 10px; flex-direction: column; gap: 20px; align-items: stretch; }
    .signature-right { min-width: auto; text-align: right; }
    .footer-text { margin-top: 15px; font-size: 9px; }
  }
  @media print {
    body { margin: 0; padding: 0; font-size: 13px; line-height: 1.7; }
    .jawab-page { max-width: 100%; padding: 0; }
  }
</style>
</head>
<body>
<div class="jawab-page">
  <div class="header-title">जवाब</div>
  <div class="sub-title">(सावकारी कायदा अधिनियम-2014, कलम 18, 25 व 26)</div>

  <div class="header-info">
    <div>मी, <strong style="font-size:14px;">${companyName}</strong>${companyAddress ? ', ' + companyAddress : ''} (प्रोप्रायटर - ${proprietorName}, वय ${proprietorAge} वर्षे) यांना</div>
    <div>सन ${fy} या वर्षाकरिता सावकारी परवाना क्रमांक ${licenseNumber} मिळालेला आहे. सदर परवान्याचे</div>
    <div>वर्ष ${fy} या वर्षाकरिता उपनिबंधक कार्यालयामार्फत आमच्या कार्यालयातून दि. ${renewalDateFmt} रोजी नूतनीकरण अर्ज</div>
    <div>केलेला आहे. सदर अर्जासोबत दिनांक ${feeDateFmt} रोजी केलेले नूतनीकरण परवाना फी रु. 500/- (दंडाची रक्कम रु. /-) चा</div>
    <div>भरणा करण्यात आलेला आहे. परवाना फी मागणी अर्जास रु. 10/- चा कोर्ट फी स्टॅम्प लावलेला आहे. अर्जात भरलेली सर्व माहिती बरोबर आहे.</div>
  </div>

  <div class="legal-text">
    <p>मी, सावकारी व्यवसायाशी संबंधित नमुना नं. 7 व ठरलेला नमुना नं. 9 चे नमुने ठेवलेले आहेत. कर्जदारास कर्ज देतेवेळी नमुना नं. 12 ची
    पावती देणे बंधनकारक असून नमुना नं. 10 आणि कर्जवसुलीच्या वेळी कार्यालयाने निर्धारित केलेली पावती नमुना नं. 11 मध्ये आणि
    सावकाराने भांडवली खात्याची नोंद नमुना नं. 13 मध्ये ठेवलेली आहे. सावकारी व्यवसायातील ज्या खातेदारांचे येणे बाकी आहे, त्या खातेदारांचे
    विवरणपत्र नमुना नं. 14 मध्ये सादर केलेले आहे. मी सावकारी नियमानुसार व्यवसाय करतो/करते. सावकारी व्यवसायानुसार दि. 01/04/${fyStart} ते
    दि. 31/03/${fyEnd} या कालावधीत दि. ${maxCapitalDateFormatted} रोजी जास्तीत जास्त भांडवल/कर्जरक्कम ${formatAmt(maxCapitalAmt)}/- गुंतवलेली होती. त्यानुसार
    तपासणी शुल्क (1%) रक्कम ${formatAmt(inspectionFee)}/- शासकीय खजिन्यात भरणा केलेला आहे.
    सदर शासकीय निर्णयातील अनुसूची तक्त्यानुसार रक्कम शासकीय खजिन्यात भरणा केलेली आहे व
    याबाबतचा मी आणि/किंवा कार्यालयातील दाखला सादर केलेला आहे.</p>

    <p>मी, सावकार/यांच्या नावाचा बोर्ड दुकानाच्या समोरील भागात दिसेल अशा ठिकाणी लावलेला आहे. मी कोणत्याही बेकायदेशीर
    सावकारी करत नाही व अन्य कोणत्याही संघटित सावकाराशी संबंधित नाही. कोणत्याही अवैध कर्ज व्यवहाराशी संबंध नाही. मी शासकीय सेवेत किंवा कोणत्याही स्थानिक
    संस्थेत नोकरीस नाही. माझा अन्य व्यवसाय असल्यास विहित माहिती लागू असून दि. 31/03/${fyEnd} अखेर या वर्षात मी आयकर रु. <span style="display:inline-block; min-width:60px; border-bottom:1px dotted #000;">&nbsp;</span>/- भरलेला आहे.</p>

    <p>मी व्यवसायकर रु. <span style="display:inline-block; min-width:60px; border-bottom:1px dotted #000;">&nbsp;</span>/- भरलेला आहे व माझा व्यवसाय कायमस्वरूपी आहे.</p>

    <p>या महाराष्ट्र सावकारी व्यवसाय (नियमन) कायद्यातील कोणत्याही तरतुदींचा भंग करणार नाही. सावकारी
    कायदा/नियम यातील कोणत्याही तरतुदींचे उल्लंघन करणार नाही. माझ्या धंद्याची कोणतीही शाखा किंवा
    अन्य व्यवसायाची जागा नाही.</p>

    <p>मी सावकारी कायदा अधिनियम-2014 मधील कलम 18, 25 व 26 चे पालन करतो/करते. मी सावकारी कायद्यातील कोणत्याही
    कलमाचे उल्लंघन केलेले नाही. मी कर्जदारांना दिलेल्या पावत्यांची प्रत आपल्या कार्यालयास पाठवलेली असल्याबद्दल त्याची पोहोच
    पावती माझ्या दप्तरी आहे. मला माहितीनुसार माझ्यावर कोणत्याही प्रकारचा दंड अथवा शिक्षा झालेली नाही.</p>

    <p>सन ${fy} या वर्षात झालेला सावकारी व्यवसाय खालीलप्रमाणे आहे.</p>
  </div>

  <table class="data-table">
    <thead>
      <tr>
        <th class="sr-col">अ.क्र.</th>
        <th class="desc-col">तपशील</th>
        <th class="amt-col">रक्कम रुपये</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="sr-col">1</td>
        <td>दि. 31/03/${prevFyEnd} अखेरचे येणे बाकी</td>
        <td class="amt-col">${formatAmt(data.openingBalance)} /-</td>
      </tr>
      <tr>
        <td class="sr-col">2</td>
        <td>सन ${fy} मध्ये वाटप केलेले कर्ज</td>
        <td class="amt-col">${formatAmt(data.yearDisbursement)} /-</td>
      </tr>
      <tr class="total-row">
        <td class="sr-col">3</td>
        <td>एकूण रक्कम (1 + 2)</td>
        <td class="amt-col">${formatAmt(data.totalAmount)} /-</td>
      </tr>
      <tr>
        <td class="sr-col">4</td>
        <td>सन ${fy} मध्ये आलेली एकूण वसुली</td>
        <td class="amt-col">${formatAmt(data.yearCollection)} /-</td>
      </tr>
      <tr class="total-row">
        <td class="sr-col">5</td>
        <td>दि. 31/03/${fyEnd} अखेर शिल्लक कर्ज</td>
        <td class="amt-col">${formatAmt(data.closingBalance)} /-</td>
      </tr>
      <tr>
        <td class="sr-col">6</td>
        <td>दि. 31/03/${fyEnd} अखेर वसूल केलेले व्याज</td>
        <td class="amt-col">${formatAmt(data.interestCollected)} /-</td>
      </tr>
      <tr>
        <td class="sr-col">7</td>
        <td>सन ${fy} मध्ये दिलेल्या नमुना नं. 11 च्या पावत्या</td>
        <td class="amt-col"></td>
      </tr>
      <tr>
        <td class="sr-col">8</td>
        <td>सन ${fy} मध्ये दिलेल्या नमुना नं. 12 च्या पावत्या</td>
        <td class="amt-col"></td>
      </tr>
    </tbody>
  </table>

  <div class="closing-text">
    <p>परवाना नूतनीकरणाकरिता लागणारे फोटो, रेशन कार्ड, पॅनकार्ड, आधारकार्ड, घराचा उतारा या सर्व कागदपत्रांच्या
    छायांकित प्रती अर्जासोबत यापूर्वीच जोडलेल्या आहेत. आवश्यकता वाटल्यास आपण मागणी केलेले सर्व सावकाराचे दप्तर आपल्या
    कार्यालयाकडे तपासणीसाठी सादर करण्यास तयार आहे. त्याची सर्व जबाबदारी माझी राहील. यामध्ये माझी कोणतीही तक्रार नाही. वरील मजकूर
    प्रतिज्ञेवर आज दि. ${jawabDateFmt} रोजी लिहून स्वतःची सही केली आहे.</p>
  </div>

  <div class="signature-section">
    <div class="signature-left">
      <div style="line-height: 1.4;">
        <strong style="font-size:14px;">${companyName}</strong><br>
        सा.ला.नं. ${licenseNumber}<br>
        ${companyAddress}
      </div>
      <div style="margin-top: 6px;">दिनांक: ${jawabDateFmt}</div>
    </div>
    <div class="signature-right" style="text-align:right;">
      <div style="font-weight: 600;">सावकाराचे नाव व सही</div>
    </div>
  </div>

  <div class="footer-text">
    सहाय्यक निबंधक तथा<br>
    उपनिबंधक, सहकारी संस्था
  </div>
</div>
</body>
</html>`;
  }
}