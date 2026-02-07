import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Button } from "./button";
import { Languages, Keyboard } from "lucide-react";

interface DualLanguageInputProps extends React.ComponentProps<"input"> {
  enableTransliteration?: boolean;
  showLanguageToggle?: boolean;
  variant?: "input" | "textarea";
  textareaProps?: React.ComponentProps<"textarea">;
}

// Comprehensive English to Marathi transliteration mapping
const englishToMarathiMap: Record<string, string> = {
  // Basic characters
  'a': 'अ', 'aa': 'आ', 'i': 'इ', 'ii': 'ई', 'u': 'उ', 'uu': 'ऊ', 
  'e': 'ए', 'ai': 'ऐ', 'o': 'ओ', 'au': 'औ',
  
  // Consonants with vowels
  'ka': 'क', 'kha': 'ख', 'ga': 'ग', 'gha': 'घ', 'nga': 'ङ',
  'cha': 'च', 'chha': 'छ', 'ja': 'ज', 'jha': 'झ', 'nya': 'ञ',
  'ta': 'त', 'tha': 'थ', 'da': 'द', 'dha': 'ध', 'na': 'न',
  'pa': 'प', 'pha': 'फ', 'ba': 'ब', 'bha': 'भ', 'ma': 'म',
  'ya': 'य', 'ra': 'र', 'la': 'ल', 'va': 'व', 'wa': 'व',
  'sha': 'श', 'shha': 'ष', 'sa': 'स', 'ha': 'ह',
  
  // Common words
  'ram': 'राम', 'shyam': 'श्याम', 'geeta': 'गीता', 'seeta': 'सीता',
  'vijay': 'विजय', 'ajay': 'अजय', 'sanjay': 'संजय', 'prakash': 'प्रकाश',
  'sunil': 'सुनील', 'anil': 'अनिल', 'vinod': 'विनोद', 'manoj': 'मनोज',
  'raju': 'राजू', 'babu': 'बाबू', 'patel': 'पाटेल', 'sharma': 'शर्मा',
  
  // Business terms
  'business': 'व्यवसाय', 'loan': 'कर्ज', 'amount': 'रक्कम', 'interest': 'व्याज',
  'group': 'ग्रुप', 'borrower': 'कर्जदार', 'address': 'पत्ता', 'mobile': 'मोबाइल',
  'gold': 'सोने', 'silver': 'चांदी', 'necklace': 'नेकलेस', 'ring': 'अंगठी',
  'chain': 'चेन', 'bangles': 'बांगड्या', 'earrings': 'कानातले',
  
  // Numbers
  'one': 'एक', 'two': 'दोन', 'three': 'तीन', 'four': 'चार', 'five': 'पाच',
  'six': 'सहा', 'seven': 'सात', 'eight': 'आठ', 'nine': 'नऊ', 'ten': 'दहा'
};

// Marathi to English mapping (reverse)
const marathiToEnglishMap: Record<string, string> = Object.fromEntries(
  Object.entries(englishToMarathiMap).map(([key, value]) => [value, key])
);

const DualLanguageInput = React.forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  DualLanguageInputProps
>(({ 
  className, 
  enableTransliteration = true, 
  showLanguageToggle = true,
  variant = "input",
  textareaProps,
  onChange,
  ...props 
}, ref) => {
  const [inputMode, setInputMode] = React.useState<'english' | 'marathi' | 'auto'>('auto');
  const [value, setValue] = React.useState<string>(props.defaultValue as string || '');

  const translateText = React.useCallback((text: string, targetLang: 'marathi' | 'english'): string => {
    if (!enableTransliteration || !text) return text;
    
    const map = targetLang === 'marathi' ? englishToMarathiMap : marathiToEnglishMap;
    let translatedText = text.toLowerCase();
    
    // Sort by length (longer first) to handle overlapping patterns
    const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);
    
    sortedKeys.forEach(key => {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      translatedText = translatedText.replace(regex, map[key]);
    });
    
    return translatedText;
  }, [enableTransliteration]);

  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    
    // Auto-detect language and provide suggestions
    if (inputMode === 'auto' && enableTransliteration) {
      const hasEnglish = /[a-zA-Z]/.test(newValue);
      const hasMarathi = /[\u0900-\u097F]/.test(newValue);
      
      if (hasEnglish && !hasMarathi) {
        // Provide Marathi suggestion
        const marathiSuggestion = translateText(newValue, 'marathi');
        if (marathiSuggestion !== newValue.toLowerCase()) {
          e.target.setAttribute('data-suggestion', marathiSuggestion);
          e.target.setAttribute('data-suggestion-type', 'marathi');
        }
      } else if (hasMarathi && !hasEnglish) {
        // Provide English suggestion
        const englishSuggestion = translateText(newValue, 'english');
        if (englishSuggestion !== newValue.toLowerCase()) {
          e.target.setAttribute('data-suggestion', englishSuggestion);
          e.target.setAttribute('data-suggestion-type', 'english');
        }
      }
    }
    
    if (onChange) {
      onChange(e);
    }
  }, [inputMode, enableTransliteration, translateText, onChange]);

  const toggleInputMode = () => {
    const modes: ('auto' | 'english' | 'marathi')[] = ['auto', 'english', 'marathi'];
    const currentIndex = modes.indexOf(inputMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setInputMode(nextMode);
  };

  const getModeIcon = () => {
    switch (inputMode) {
      case 'english': return <span className="text-xs font-medium">EN</span>;
      case 'marathi': return <span className="text-xs font-medium">मर</span>;
      default: return <Languages className="h-3 w-3" />;
    }
  };

  const getModeLabel = () => {
    switch (inputMode) {
      case 'english': return 'English only';
      case 'marathi': return 'मराठी only';
      default: return 'Auto detect';
    }
  };

  const baseClassName = cn(
    "flex w-full rounded-md border border-input bg-background ring-offset-background",
    "placeholder:text-muted-foreground focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50",
    className
  );

  if (variant === "textarea") {
    return (
      <div className="relative">
        <div className={baseClassName}>
          <Textarea
            {...textareaProps}
            ref={ref as React.Ref<HTMLTextAreaElement>}
            className={cn(
              "border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none",
              showLanguageToggle ? "pr-12" : "",
              inputMode === 'marathi' ? "font-noto" : "font-inter"
            )}
            onChange={handleInputChange}
            value={value}
            {...props}
          />
          {showLanguageToggle && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-8 w-8 p-0 hover:bg-muted"
              onClick={toggleInputMode}
              title={getModeLabel()}
            >
              {getModeIcon()}
            </Button>
          )}
        </div>

      </div>
    );
  }

  return (
    <div className="relative">
      <div className={baseClassName}>
        <Input
          ref={ref as React.Ref<HTMLInputElement>}
          className={cn(
            "border-0 focus-visible:ring-0 focus-visible:ring-offset-0",
            showLanguageToggle ? "pr-12" : "",
            inputMode === 'marathi' ? "font-noto" : "font-inter"
          )}
          onChange={handleInputChange}
          value={value}
          {...props}
        />
        {showLanguageToggle && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute top-1/2 right-2 h-8 w-8 p-0 -translate-y-1/2 hover:bg-muted"
            onClick={toggleInputMode}
            title={getModeLabel()}
          >
            {getModeIcon()}
          </Button>
        )}
      </div>

    </div>
  );
});

DualLanguageInput.displayName = "DualLanguageInput";

export { DualLanguageInput };
export type { DualLanguageInputProps };