import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, TrendingUp, BookOpen, Download } from "lucide-react";
import { Link } from "wouter";

export default function CashReportWidget() {
  const reports = [
    {
      title: "रोकड वही (नमुना ७)",
      description: "नियम १८ प्रमाणे दैनंदिन रोकड व्यवहार नोंद",
      icon: FileText,
      href: "/reports/cashbook-ledger",
      color: "from-blue-500 to-blue-600"
    },
    {
      title: "व्यक्तीवार खाते",
      description: "प्रत्येक व्यक्तीचे देणे-घेणे तपशील",
      icon: BookOpen,
      href: "/cash",
      color: "from-purple-500 to-purple-600"
    },
    {
      title: "मासिक रोकड अहवाल",
      description: "महिन्याचे एकत्रित रोकड विश्लेषण",
      icon: TrendingUp,
      href: "/reports/cashbook",
      color: "from-green-500 to-green-600"
    },
    {
      title: "वार्षिक रोकड सारांश",
      description: "वर्षभराचे रोकड व्यवहार विवरण",
      icon: Download,
      href: "/reports/capital",
      color: "from-orange-500 to-orange-600"
    }
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        रोकड अहवाल
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.href} href={report.href}>
              <Card className={`cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-r ${report.color} text-white`}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-sm">
                    <Icon className="h-4 w-4 mr-2" />
                    {report.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs opacity-90">
                    {report.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}