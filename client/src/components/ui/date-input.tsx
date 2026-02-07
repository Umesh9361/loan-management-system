import React, { useState, useEffect, useRef } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface DateInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  displayFormat?: boolean; // Whether to show DD/MM/YYYY display below input
  showFormatHint?: boolean; // Whether to show format hint
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value = "", onChange, className, displayFormat = true, showFormatHint = true, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    
    // Convert ISO date (YYYY-MM-DD) to DD/MM/YYYY for display
    const formatToDisplay = (isoDate: string): string => {
      if (!isoDate) return "";
      const [year, month, day] = isoDate.split('-');
      return `${day}/${month}/${year}`;
    };

    // Update display value when input value changes
    useEffect(() => {
      if (value) {
        setDisplayValue(formatToDisplay(value));
      } else {
        setDisplayValue("");
      }
    }, [value]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setDisplayValue(newValue ? formatToDisplay(newValue) : "");
      
      // Call the original onChange handler
      if (onChange) {
        onChange(e);
      }
    };

    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleBlur = () => {
      setIsFocused(false);
    };

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref || inputRef}
          type="date"
          value={value || ""}
          onChange={handleDateChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(
            "font-inter date-input-dd-mm-yyyy", 
            // Ensure visibility across all devices
            "text-foreground bg-background border-input",
            // Force text visibility with important declarations
            "!text-gray-900 !bg-white dark:!text-white dark:!bg-gray-800",
            // Webkit specific fixes for mobile
            "[&::-webkit-datetime-edit]:!text-gray-900 [&::-webkit-datetime-edit]:!bg-transparent",
            "[&::-webkit-datetime-edit-fields-wrapper]:!text-gray-900",
            "[&::-webkit-datetime-edit-text]:!text-gray-900",
            "[&::-webkit-datetime-edit-month-field]:!text-gray-900",
            "[&::-webkit-datetime-edit-day-field]:!text-gray-900", 
            "[&::-webkit-datetime-edit-year-field]:!text-gray-900",
            "[&::-webkit-calendar-picker-indicator]:!opacity-100",
            className
          )}
          lang="hi-IN" // Set Indian locale for date input
          pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" // DD/MM/YYYY pattern
          style={{
            // Force consistent appearance across all devices
            colorScheme: 'light',
            color: 'hsl(var(--foreground))',
            backgroundColor: 'hsl(var(--background))'
          } as React.CSSProperties}
        />
        
        {/* Always show DD/MM/YYYY format hint below input */}
        {displayFormat && displayValue && (
          <div className="absolute top-full left-0 mt-1 text-xs text-muted-foreground bg-background px-1 rounded z-10">
            📅 {displayValue}
          </div>
        )}
        
        {/* Format hint when focused and no value */}
        {showFormatHint && isFocused && !value && (
          <div className="absolute top-full left-0 mt-1 text-xs text-muted-foreground bg-background px-1 rounded z-10">
            Format: DD/MM/YYYY
          </div>
        )}

      </div>
    );
  }
);

DateInput.displayName = "DateInput";