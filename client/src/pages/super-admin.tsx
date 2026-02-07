import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Link } from "wouter";

export default function SuperAdmin() {
  return (
    <div className="min-h-screen bg-gray-50">
      <MobileNav />
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>
        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-center">
                  🔒 Super Admin Access Notice
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-lg text-gray-700">
                  Super Admin फक्त Tenant Management करू शकतो.
                </p>
                <p className="text-gray-600">
                  Individual users manage करण्यासाठी तुम्हाला tenant admin म्हणून login करावे लागेल.
                </p>
                <div className="space-y-2 pt-4">
                  <Button asChild className="w-full">
                    <Link href="/super-admin-tenant-management">
                      🏢 टेनंट व्यवस्थापन (Admin Enable/Disable)
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/super-admin-dashboard">
                      📊 सुपर एडमिन डॅशबोर्ड
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}