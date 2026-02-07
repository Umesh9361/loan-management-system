import { useEffect } from 'react';

// This component fixes navigation issues in reports section
export function ReportsNavFix() {
  useEffect(() => {
    // Force proper navigation handling for reports
    const handleReportsNavigation = () => {
      // Fix button click issues
      const reportButtons = document.querySelectorAll('[data-report-button]');
      reportButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const href = button.getAttribute('href') || button.getAttribute('data-href');
          if (href) {
            window.location.href = href;
          }
        });
      });

      // Fix loading states
      const loadingElements = document.querySelectorAll('[data-loading]');
      loadingElements.forEach(element => {
        element.classList.remove('loading-stuck');
      });
    };

    // Run immediately and on DOM changes
    handleReportsNavigation();
    
    const observer = new MutationObserver(handleReportsNavigation);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}

// CSS fix for reports section
export const reportsFixStyles = `
  .reports-section {
    pointer-events: auto !important;
  }
  
  .reports-section button {
    pointer-events: auto !important;
    cursor: pointer !important;
  }
  
  .reports-section a {
    pointer-events: auto !important;
    text-decoration: none !important;
  }
  
  .loading-stuck {
    display: none !important;
  }
  
  .report-button-fix {
    transition: all 0.2s ease !important;
  }
  
  .report-button-fix:hover {
    background-color: var(--primary) !important;
    color: white !important;
  }
`;