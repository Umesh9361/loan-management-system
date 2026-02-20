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
    receiptType: 'combined' | 'disbursement' | 'closure' | 'blank' = 'combined',
    closureData?: any
  ): string {
    const formatDate = (date: string) => {
      return new Date(date).toLocaleDateString('en-GB');
    };

    // ✅ BLANK RECEIPT LOGIC: Return empty string for blank receipts, else return actual data
    const getDisplayData = (value: any, fallback: string = '') => {
      if (receiptType === 'blank') return '';
      return value !== null && value !== undefined ? value : fallback;
    };

    // ✅ BLANK RECEIPT: Get blank field with handwriting lines - Remove double border
    const getBlankField = (value: any, fallback: string = '') => {
      if (receiptType === 'blank') {
        return '<span style="min-width: 100px; display: inline-block; height: 18px; margin: 0 2px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>';
      }
      return value !== null && value !== undefined ? value : fallback;
    };

    // ✅ CLOSURE DATA: Use provided closure data for amounts in नमुना नंबर 11
    const getClosureAmount = (field: string) => {
      if (receiptType === 'blank') return '';
      if (receiptType === 'closure' && closureData) {
        return closureData[field] ? `₹${ReceiptGenerator.cleanDisplayAmount(closureData[field])}` : '';
      }
      return ''; // Empty for combined/disbursement (maintain backward compatibility)
    };

    // ✅ SPECIAL: Total amount with words for closure receipt only
    const getClosureTotalWithWords = () => {
      if (receiptType === 'blank') return '';
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
            align-items: flex-start;
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
            min-height: 16px; /* Increased from 14px to 16px for better readability */
            font-size: 13px; /* Added explicit font size */
        }

    </style>
</head>
<body>

    <div class="receipt-container">
        ${(receiptType === 'disbursement' || receiptType === 'combined' || receiptType === 'blank') ? `
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
                <div class="field-value short">${getBlankField(loan.accountNumber || loan.id)}</div>
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
                <span><b>व्याजदर:</b> ${getBlankField(`${ReceiptGenerator.cleanDisplayAmount(loan.interestRate || 0)}% वार्षिक`)}</span>
                <span>|</span>
                <span><b>मुदत:</b> ${getBlankField(loan.maturityDate ? formatDate(loan.maturityDate) : '-')}</span>
                <span>|</span>
                <span><b>व्यवसाय:</b> ${getBlankField(loan.businessType, 'शेती')}</span>
                <span>|</span>
                <span><b>प्रकार:</b> ${getBlankField(loan.collateralDetails ? 'तारण' : 'बिनतारण')}</span>
            </div>

            <!-- Collateral Details Section - Always show for blank receipts -->
            ${receiptType === 'blank' ? `
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
            ` : getDisplayData(loan.collateralDetails) ? `
            <div style="margin: 6px 0 4px 0; border: 1px solid #333; padding: 4px 5px;">
                <div style="text-align: center; font-weight: bold; margin-bottom: 5px; font-size: 11px; border-bottom: 1px solid #999; padding-bottom: 3px;">तारण तपशील</div>
                ${ReceiptGenerator.parseCollateralDetails(loan.collateralDetails || '', loan.weight || undefined, loan.marketValue || undefined)}
            </div>
            ` : ''}
            
            <!-- Undertaking / हमीपत्र - without border -->
            <div style="margin: 3px 0 2px 0; padding: 1px 2px; font-size: 10px; line-height: 1.2;">
                <span style="font-weight: bold; font-size: 10px;">हमीपत्र:</span>
                <span>
                    मी खात्रीने सांगतो/सांगते की, वर नमूद तारण दागिना/वस्तू माझ्या स्वतःच्या मालकीची असून त्यावर कुणाचाही हक्क/संबंध नाही. सदर वस्तू चोरीची, सापडलेली अथवा बळकावलेली नाही. असे निष्पन्न झाल्यास होणाऱ्या कायदेशीर कारवाईस मी पूर्णतः जबाबदार राहील.
                </span>
            </div>

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

        ${(receiptType === 'combined' || receiptType === 'blank') ? `
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
                  <div style="flex: 1; text-align: right; font-size: 10px; white-space: nowrap;">
                    <span style="font-weight: 600;">दिनांक:</span>
                    ${(receiptType === 'blank' || !(closureData && closureData.closureDate)) 
                      ? `<span style="margin: 0 2px;">&nbsp;&nbsp;&nbsp;</span><span style="color: #555;">/</span><span style="margin: 0 2px;">&nbsp;&nbsp;&nbsp;</span><span style="color: #555;">/</span><span style="margin: 0 2px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>`
                      : `<span style="font-weight: 500; margin-left: 3px;">${formatDate(closureData.closureDate)}</span>`
                    }
                  </div>
                </div>
                <div class="receipt-title">पावती</div>
            </div>

            <div class="field-row">
                <span class="field-label">कर्जदाराचे नाव:</span>
                <div class="field-value">${getBlankField(loan.borrowerName)}</div>
                <span class="field-label" style="margin-left: 15px;">खाते क्रमांक:</span>
                <div class="field-value short">${getBlankField(loan.accountNumber || loan.id)}</div>
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
    </div>
    
    <!-- Print button removed - now handled by parent dialog/popup controls -->
    
    <!-- ✅ AUTO SCROLL: Scroll to print button when page loads -->
    <script>
        window.addEventListener('load', function() {
            // Small delay to ensure content is fully rendered
            setTimeout(function() {
                const printSection = document.getElementById('print-section');
                if (printSection) {
                    // Smooth scroll to print button
                    printSection.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' 
                    });
                    console.log('✅ Auto-scrolled to print section');
                }
            }, 500);
        });
    </script>
</body>
</html>
    `;
  }

  static openReceiptWindow(
    loan: Loan, 
    company: { name?: string; licenseNumber?: string } | null,
    receiptType: 'combined' | 'disbursement' | 'closure' | 'blank' = 'combined',
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
            size: A5 portrait;
            margin: 0mm 8mm;
        }
        
        @media print {
            html, body {
                width: auto !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            .receipt-container {
                width: 140mm !important;
                max-width: 140mm !important;
                margin: 0 auto !important;
                padding: 4mm !important;
                box-sizing: border-box !important;
            }
            
            .no-print {
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
            width: 148mm;
            margin: 0 auto;
        }

        .receipt-container {
            width: 140mm;
            margin: 0 auto;
            padding: 4mm;
            background: white;
        }

        .header {
            text-align: center;
            margin-bottom: 8px;
        }

        .form-number {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 4px;
        }

        .title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 12px;
            text-decoration: underline;
        }

        .field-row {
            margin: 6px 0;
            font-size: 11px;
            line-height: 1.5;
        }

        .field-label {
            font-weight: 600;
            display: inline-block;
            margin-bottom: 2px;
        }

        .field-value {
            display: inline-block;
            margin-left: 8px;
            border-bottom: 1px dotted #000;
            min-width: 200px;
            padding-bottom: 6px;
            line-height: 1.8;
            vertical-align: baseline;
        }

        .radio-option {
            display: inline-block;
            margin-right: 15px;
        }

        .table-section {
            margin: 12px 0;
            border: 1px solid #000;
            font-size: 11px;
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
            padding: 4px 8px;
            border-right: 1px solid #000;
        }

        .table-cell-value {
            width: 120px;
            padding: 4px 8px;
            text-align: right;
        }

        .footer {
            margin-top: 20px;
            font-size: 11px;
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
            text-align: right;
            margin-top: 30px;
            font-size: 10px;
        }

        .control-panel {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
        }

        .print-button {
            background: #1e40af;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }

        .print-button:hover {
            background: #1e3a8a;
        }

        @media print {
            .control-panel {
                display: none !important;
            }
        }
    </style>
</head>
<body>
    <!-- Print button removed - now handled by parent dialog/popup controls -->

    <div class="receipt-container">
        <div class="header">
            <div class="form-number">नमुना क्र १४<br/>(नियम २० पहा)</div>
            <div class="title">वर्ष संपल्यानंतर ४५ दिवसांच्या आत सावकाराने कर्जदारास द्यावयाचे वार्षिक लेखा विवरणपत्र</div>
        </div>

        <div class="field-row">
            <span class="field-label">कर्जदाराचे नाव :</span>
            <span class="field-value">${data.borrowerName || ''}</span>
        </div>

        <div class="field-row">
            <span class="field-label">व्यवसाय :</span>
            <span class="field-value">${data.occupation || ''}</span>
        </div>

        <div class="field-row">
            <span class="field-label">पत्ता :</span>
            <span class="field-value">${data.address || ''}</span>
        </div>

        <div class="field-row">
            <span class="field-label">कर्जाकर मागासवर्गीय आहे काय?</span>
            <span class="radio-option">
                <input type="radio" ${data.isBackwardClass ? 'checked' : ''}> होय
            </span>
            <span class="radio-option">
                <input type="radio" ${!data.isBackwardClass ? 'checked' : ''}> नाही
            </span>
        </div>

        <div class="field-row">
            <span class="field-label">कर्जाकर शेतकरी प्रभागातील आहे काय?</span>
            <span class="radio-option">
                <input type="radio" ${data.isFarmer ? 'checked' : ''}> होय
            </span>
            <span class="radio-option">
                <input type="radio" ${!data.isFarmer ? 'checked' : ''}> नाही
            </span>
        </div>

        <div class="field-row">
            <span class="field-label">खाते क्रमांक अथवा खात्याची क्रमांक :</span>
            <span class="field-value">${data.accountNumber || ''}</span>
        </div>

        <div class="field-row">
            <span class="field-label">कर्ज दिनांक :</span>
            <span class="field-value">${formatDate(data.loanDate)}</span>
        </div>

        <div class="field-row">
            <span class="field-label">आर्थिक वर्ष :</span>
            <span class="field-value">${data.financialYear || ''}</span>
        </div>

        <div class="table-section">
            <div class="table-row">
                <div class="table-cell-label">
                    <strong>वर्षाच्या सुरुवातीस सावकारास देय असलेली मुद्दलाची रक्कम, व्याजाची रक्कम आणि कलम २६ मध्ये विनिर्दिष्ट शुल्क :</strong>
                </div>
                <div class="table-cell-value">
                    ${formatAmount(data.openingTotal)}
                </div>
            </div>

            <div class="table-row">
                <div class="table-cell-label">वर्ष भरात दिलेलें एकूण कर्ज :</div>
                <div class="table-cell-value">${formatAmount(data.yearDisbursement)}</div>
            </div>

            <div class="table-row">
                <div class="table-cell-label">
                    <strong>वर्ष भरात प्राप्त झालेली परतफेडीची रक्कम</strong>
                </div>
                <div class="table-cell-value"></div>
            </div>

            <div class="table-row">
                <div class="table-cell-label" style="padding-left: 20px;">मुद्दल/रुपये</div>
                <div class="table-cell-value">${formatAmount(data.yearPrincipalRepayment)}</div>
            </div>

            <div class="table-row">
                <div class="table-cell-label" style="padding-left: 20px;">व्याज/रुपये</div>
                <div class="table-cell-value">${formatAmount(data.yearInterestRepayment)}</div>
            </div>

            <div class="table-row">
                <div class="table-cell-label">
                    <strong>वर्ष अखेरीस देय असलेली मुद्दल आणि व्याजाची रक्कम</strong>
                </div>
                <div class="table-cell-value"></div>
            </div>

            <div class="table-row">
                <div class="table-cell-label" style="padding-left: 20px;">मुद्दल/रुपये</div>
                <div class="table-cell-value"><strong>${formatAmount(data.closingPrincipal)}</strong></div>
            </div>

            <div class="table-row">
                <div class="table-cell-label" style="padding-left: 20px;">व्याज/रुपये</div>
                <div class="table-cell-value"><strong>${formatAmount(data.closingInterest)}</strong></div>
            </div>

            <div class="table-row" style="border-top: 2px solid #333; margin-top: 4px;">
                <div class="table-cell-label">
                    <strong>एकूण देय रक्कम</strong>
                </div>
                <div class="table-cell-value">
                    <strong>${formatAmount(data.closingTotal)}</strong>
                </div>
            </div>
        </div>

        <div class="company-info">
            सावकार: ${company?.name || ''} | परवाना क्रमांक: ${company?.licenseNumber || ''}
        </div>

        <div class="field-row" style="margin-top: 8px;">
            <span class="field-label">दिनांक :</span>
            <span class="field-value">${new Date().toLocaleDateString('en-GB')}</span>
        </div>

        <div class="signature-section">
            <div style="border-top: 1px solid #000; display: inline-block; padding: 5px 30px;">
                सावकाराची स्वाक्षरी
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }
}