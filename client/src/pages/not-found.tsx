import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

export default function NotFound() {
  const [, setLocation] = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);
  
  const handleHomeNavigation = () => {
    if (isNavigating) return; // Prevent multiple clicks
    setIsNavigating(true);
    setLocation('/');
  };
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          
          <h1 className="text-xl font-bold text-gray-900 mb-2">पृष्ठ सापडले नाही</h1>
          <p className="text-gray-600 mb-6">
            तुम्ही शोधत असलेले पृष्ठ अस्तित्वात नाही किंवा तुम्हाला त्यावर प्रवेश करण्याची परवानगी नाही आहे.
          </p>
          
          <Button
            onClick={handleHomeNavigation}
            disabled={isNavigating}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            <Home className="mr-2 h-4 w-4" />
            {isNavigating ? 'जात आहे...' : 'मुख्यपृष्ठावर परत जा'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
