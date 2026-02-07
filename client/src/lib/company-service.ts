// Company service to fetch company information
export interface Company {
  id: string;
  tenantId: string;
  name: string;
  licenseNumber?: string;
  address?: string;
  contactNumber?: string;
  email?: string;
}

export class CompanyService {
  static async getCompany(): Promise<Company | null> {
    try {
      const response = await fetch('/api/company', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch company:', error);
      return null;
    }
  }
}