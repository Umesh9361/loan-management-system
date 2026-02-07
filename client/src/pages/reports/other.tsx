import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, FileText, TrendingUp, Calendar, PieChart, Users } from "lucide-react";
import { Link } from "wouter";

export default function OtherReports() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">इतर अहवाल</h1>
        <Button variant="outline" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            मुख्य पान
          </Link>
        </Button>
      </div>

      {/* Coming Soon Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            अतिरिक्त रिपोर्ट्स - लवकरच उपलब्ध
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-600">
              येथे अतिरिक्त रिपोर्ट्स उपलब्ध होतील. सध्या खालील रिपोर्ट्स विकसित होत आहेत:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <h3 className="font-medium">मासिक वृद्धी अहवाल</h3>
                </div>
                <p className="text-sm text-gray-600">महिनानुसार व्यापार वृद्धी आकडेवारी</p>
              </div>
              
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
                  <PieChart className="h-4 w-4 text-green-600" />
                  <h3 className="font-medium">ग्रुप निहाय विश्लेषण</h3>
                </div>
                <p className="text-sm text-gray-600">प्रत्येक ग्रुपचे तपशीलवार आकडे</p>
              </div>
              
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  <h3 className="font-medium">वार्षिक सारांश</h3>
                </div>
                <p className="text-sm text-gray-600">संपूर्ण वर्षाचा व्यापार सारांश</p>
              </div>
              
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-orange-600" />
                  <h3 className="font-medium">कस्टमर रिपोर्ट</h3>
                </div>
                <p className="text-sm text-gray-600">ग्राहकांची तपशीलवार माहिती</p>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <h3 className="font-medium text-blue-800">सध्या उपलब्ध रिपोर्ट्स</h3>
              </div>
              <p className="text-sm text-blue-700 mb-3">
                सध्याच्या अवस्थेत खालील रिपोर्ट्स पूर्णपणे उपलब्ध आहेत:
              </p>
              <div className="space-y-1 text-sm text-blue-700">
                <div>• पावती जनरेशन (नमुना क्र. १०/११)</div>
                <div>• रोकड वही (नमुना क्र. ७)</div>
                <div>• भांडवल खाते (नमुना क्र. १३)</div>
                <div>• कर्जदाराची यादी</div>
                <div>• लॉस रिपोर्ट</div>
                <div>• खाते सारांश अहवाल</div>
                <div>• खाते लेजर (सर्वप्रकार)</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}