// Force DD/MM/YYYY format for all date inputs across the application
export function setupDateLocale() {
  // Override the browser's default date format behavior
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
      // Set the document language to Hindi-India
      document.documentElement.lang = 'hi-IN';
      
      // Add event listeners to all existing date inputs
      const dateInputs = document.querySelectorAll('input[type="date"]');
      dateInputs.forEach((input) => setupDateInput(input as HTMLInputElement));
      
      // Observer for dynamically added date inputs
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) { // Element node
              const element = node as Element;
              if (element.tagName === 'INPUT' && element.getAttribute('type') === 'date') {
                setupDateInput(element as HTMLInputElement);
              }
              // Check for date inputs in added subtrees
              const dateInputs = element.querySelectorAll('input[type="date"]');
              dateInputs.forEach((input) => setupDateInput(input as HTMLInputElement));
            }
          });
        });
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
}

function setupDateInput(input: HTMLInputElement) {
  // Force the input to use Indian locale
  input.lang = 'hi-IN';
  
  // Add a data attribute to identify our custom date inputs
  input.dataset.customDateFormat = 'dd/mm/yyyy';
  
  // Listen for changes and ensure proper format display
  input.addEventListener('input', function() {
    // The browser will handle the internal YYYY-MM-DD format
    // Our helper text below the input will show DD/MM/YYYY format
    const event = new CustomEvent('dateChanged', {
      detail: { 
        value: input.value,
        displayFormat: formatDateForDisplay(input.value)
      }
    });
    input.dispatchEvent(event);
  });
}

function formatDateForDisplay(isoDate: string): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

// Initialize on module load
setupDateLocale();