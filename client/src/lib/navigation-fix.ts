// Navigation fix utilities for reports section
export class NavigationFix {
  static initReportsNavigation() {
    // Fix all report buttons to work properly
    document.addEventListener('DOMContentLoaded', () => {
      this.fixReportButtons();
    });

    // Fix on every route change
    window.addEventListener('popstate', () => {
      setTimeout(() => this.fixReportButtons(), 100);
    });
  }

  static fixReportButtons() {
    const reportButtons = document.querySelectorAll('[data-report-button]');
    
    reportButtons.forEach(button => {
      // Remove existing listeners
      const newButton = button.cloneNode(true);
      button.parentNode?.replaceChild(newButton, button);
      
      // Add proper click handler
      newButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const href = newButton.getAttribute('data-href') || 
                    newButton.getAttribute('href');
        
        if (href) {
          // Force navigation
          window.location.href = href;
        }
      });
      
      // Ensure button is clickable
      (newButton as HTMLElement).style.pointerEvents = 'auto';
      (newButton as HTMLElement).style.cursor = 'pointer';
    });
  }

  static forceReportsReload() {
    // Force reload of reports section if stuck
    const reportsSection = document.querySelector('.reports-section');
    if (reportsSection) {
      reportsSection.classList.remove('loading-stuck');
      
      // Re-enable all interactions
      const allButtons = reportsSection.querySelectorAll('button, a');
      allButtons.forEach(element => {
        (element as HTMLElement).style.pointerEvents = 'auto';
        (element as HTMLElement).style.opacity = '1';
      });
    }
  }
}

// Auto-initialize
if (typeof window !== 'undefined') {
  NavigationFix.initReportsNavigation();
}