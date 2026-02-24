import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { 
  CreditCard, 
  HandCoins, 
  Clock, 
  Users,
  TrendingUp,
  TrendingDown,
  UserCheck,
  Calculator,
  Lock,
  Edit,
  Trash2,
  FileText,
  X,
  MoreVertical,
  Receipt,
  AlertTriangle,
  Building,
  Shield,
  Activity,
  Globe
} from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function SuperAdminHome() {
  const { user } = useCurrentUser();

  const { data: company } = useQuery({
    queryKey: ["/api/company"],
  });

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-8">
            <div className="max-w-7xl mx-auto">
              {/* Welcome Header */}
              <div className="mb-8">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="h-12 w-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 font-noto">
                      🔐 सुपर एडमिन मुख्य पटल
                    </h1>
                    <p className="text-gray-600 font-inter">
                      Welcome back, Super Administrator
                    </p>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-red-600 mr-3" />
                    <div>
                      <h3 className="font-semibold text-red-800 font-noto">
                        सुपर एडमिन मोड सक्रिय
                      </h3>
                      <p className="text-sm text-red-700 font-inter">
                        आपल्याकडे सर्व सिस्टम टेनंट्स आणि यूजर्सचा पूर्ण नियंत्रण आहे
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <Link href="/super-admin-dashboard">
                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-noto text-red-800">
                          सुपर एडमिन डॅशबोर्ड
                        </CardTitle>
                        <Shield className="h-8 w-8 text-red-600" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-red-700 font-inter">
                        टेनंट व्यवस्थापन, सिस्टम मॉनिटरिंग आणि एडमिन कंट्रोल्स
                      </p>
                      <Button className="w-full mt-3 bg-red-600 hover:bg-red-700">
                        डॅशबोर्ड उघडा
                      </Button>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/company">
                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-noto text-indigo-800">
                          कंपनी नोंदणी
                        </CardTitle>
                        <Building className="h-8 w-8 text-indigo-600" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-indigo-700 font-inter">
                        कंपनी माहिती आणि कॉन्फिगरेशन व्यवस्थापित करा
                      </p>
                      <Button className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700">
                        कंपनी व्यवस्थापन
                      </Button>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/user-management">
                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-noto text-green-800">
                          यूजर मॅनेजमेंट
                        </CardTitle>
                        <Users className="h-8 w-8 text-green-600" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-green-700 font-inter">
                        यूजर अकाउंट्स आणि परमिशन्स व्यवस्थापित करा
                      </p>
                      <Button className="w-full mt-3 bg-green-600 hover:bg-green-700">
                        यूजर व्यवस्थापन
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              </div>

              {/* System Features Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Financial Management */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center font-noto">
                      <CreditCard className="h-5 w-5 mr-2 text-indigo-600" />
                      आर्थिक व्यवस्थापन
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Link href="/loans">
                        <Button variant="outline" className="w-full justify-start">
                          <CreditCard className="h-4 w-4 mr-2" />
                          कर्ज नोंदणी आणि व्यवस्थापन
                        </Button>
                      </Link>
                      <Link href="/closure">
                        <Button variant="outline" className="w-full justify-start">
                          <Lock className="h-4 w-4 mr-2" />
                          कर्ज बंद करा
                        </Button>
                      </Link>
                      <Link href="/cash-transactions">
                        <Button variant="outline" className="w-full justify-start">
                          <HandCoins className="h-4 w-4 mr-2" />
                          रोकड व्यवहार
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                {/* Reports & Analytics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center font-noto">
                      <FileText className="h-5 w-5 mr-2 text-green-600" />
                      अहवाल आणि विश्लेषण
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Link href="/reports/cashbook">
                        <Button variant="outline" className="w-full justify-start">
                          <FileText className="h-4 w-4 mr-2" />
                          रोकड वही (नमुना क्र. ७)
                        </Button>
                      </Link>
                      <Link href="/reports/capital-account">
                        <Button variant="outline" className="w-full justify-start">
                          <TrendingUp className="h-4 w-4 mr-2" />
                          भांडवल खाते (नमुना क्र. १३)
                        </Button>
                      </Link>
                      <Link href="/reports/borrower-list">
                        <Button variant="outline" className="w-full justify-start">
                          <Users className="h-4 w-4 mr-2" />
                          कर्जदार यादी अहवाल
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* System Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center font-noto">
                    <Activity className="h-5 w-5 mr-2 text-purple-600" />
                    सिस्टम स्थिती
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 md:p-6 bg-green-50 rounded-lg">
                      <Globe className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <h3 className="font-semibold md:text-lg text-green-800 font-noto">सिस्टम ऑनलाइन</h3>
                      <p className="text-sm md:text-base text-green-600">सर्व सेवा कार्यरत</p>
                    </div>
                    <div className="text-center p-4 md:p-6 bg-indigo-50 rounded-lg">
                      <Shield className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
                      <h3 className="font-semibold md:text-lg text-indigo-800 font-noto">सुरक्षा सक्रिय</h3>
                      <p className="text-sm md:text-base text-indigo-600">सर्व कनेक्शन सुरक्षित</p>
                    </div>
                    <div className="text-center p-4 md:p-6 bg-purple-50 rounded-lg">
                      <UserCheck className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                      <h3 className="font-semibold md:text-lg text-purple-800 font-noto">एडमिन मोड</h3>
                      <p className="text-sm md:text-base text-purple-600">पूर्ण अधिकार सक्रिय</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}