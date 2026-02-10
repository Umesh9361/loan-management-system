import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Shield, Database, Lock } from "lucide-react";

export function DataIsolationDemo() {
  const { user } = useCurrentUser();

  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader>
        <CardTitle className="text-green-800 font-noto flex items-center">
          <Shield className="mr-2 h-5 w-5" />
          🔒 मल्टी-टेनंट डेटा सुरक्षा
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-green-700">
          <div className="flex items-center space-x-2">
            <Database className="h-4 w-4" />
            <span className="font-medium">तुमची टेनंट आयडी:</span>
            <Badge variant="outline" className="bg-white">
              {user?.tenantId}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <div className="flex items-start space-x-2">
              <Lock className="h-4 w-4 mt-1 text-green-600" />
              <div>
                <p className="font-medium text-sm">डेटा वेगळीकरण</p>
                <p className="text-xs text-green-600">
                  तुमचा सर्व डेटा फक्त {user?.tenantId} टेनंटमध्ये सुरक्षित आहे
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              <Shield className="h-4 w-4 mt-1 text-green-600" />
              <div>
                <p className="font-medium text-sm">प्रवेश नियंत्रण</p>
                <p className="text-xs text-green-600">
                  इतर कंपन्यांचा डेटा दिसणार नाही
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              <Database className="h-4 w-4 mt-1 text-green-600" />
              <div>
                <p className="font-medium text-sm">स्वतंत्र संग्रहण</p>
                <p className="text-xs text-green-600">
                  कर्ज, गट, सदस्य सर्व अलग
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              <Lock className="h-4 w-4 mt-1 text-green-600" />
              <div>
                <p className="font-medium text-sm">सुरक्षित सत्र</p>
                <p className="text-xs text-green-600">
                  तुमचा लॉगिन फक्त तुमच्या डेटासाठी
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-green-200 rounded-lg p-3 mt-4">
            <p className="font-medium text-sm text-green-800 mb-2">✅ तुमची गोपनीयता सुनिश्चित:</p>
            <ul className="text-xs text-green-700 space-y-1">
              <li>• तुमचे कर्जदार फक्त तुम्हाला दिसतील</li>
              <li>• तुमची आर्थिक माहिती संरक्षित आहे</li>
              <li>• इतर टेनंट्स तुमचा डेटा पाहू शकत नाहीत</li>
              <li>• प्रत्येक query मध्ये तुमची टेनंट आयडी check होते</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}