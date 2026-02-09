import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, Users, FileText, CreditCard, Briefcase, TrendingUp, Calendar } from "lucide-react";

interface TenantStats {
  tenantId: string;
  userCount: number;
  activeUsers: number;
  loanCount: number;
  groupCount: number;
  borrowerCount: number;
  cashTransactionCount: number;
  lastActivity: string;
}

export default function TenantManagement() {
  const { toast } = useToast();
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);

  const { data: tenantStats, isLoading } = useQuery<TenantStats[]>({
    queryKey: ["/api/super-admin/tenant-stats"],
  });

  const deleteTenantMutation = useMutation({
    mutationFn: (tenantId: string) => apiRequest(`/api/super-admin/tenant/${tenantId}`, "DELETE"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenant-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/users"] });
      toast({
        title: "यशस्वी!",
        description: `टेनंट आणि त्याचा डेटा डिलीट झाला`,
      });
      setSelectedTenant(null);
    },
    onError: (error: any) => {
      toast({
        title: "त्रुटी!",
        description: error.message || "टेनंट डिलीट करताना त्रुटी झाली",
        variant: "destructive",
      });
    },
  });

  const handleDeleteTenant = (tenantId: string) => {
    deleteTenantMutation.mutate(tenantId);
  };

  const getTotalDataEntries = (stats: TenantStats) => {
    return stats.loanCount + stats.groupCount + stats.borrowerCount + stats.cashTransactionCount;
  };

  const isInactiveTenant = (stats: TenantStats) => {
    const totalEntries = getTotalDataEntries(stats);
    const lastActivity = new Date(stats.lastActivity);
    const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    
    return totalEntries === 0 || (totalEntries < 5 && daysSinceActivity > 30);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">डेटा लोड करत आहे...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            टेनंट आकडेवारी आणि व्यवस्थापन
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>टेनंट आयडी</TableHead>
                  <TableHead className="text-center">वापरकर्ते</TableHead>
                  <TableHead className="text-center">कर्जे</TableHead>
                  <TableHead className="text-center">गट</TableHead>
                  <TableHead className="text-center">कर्जदार</TableHead>
                  <TableHead className="text-center">रोकड व्यवहार</TableHead>
                  <TableHead className="text-center">एकूण डेटा</TableHead>
                  <TableHead className="text-center">शेवटची क्रिया</TableHead>
                  <TableHead className="text-center">स्थिती</TableHead>
                  <TableHead className="text-center">कृती</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantStats?.map((stats) => {
                  const totalData = getTotalDataEntries(stats);
                  const isInactive = isInactiveTenant(stats);
                  const lastActivity = new Date(stats.lastActivity);
                  const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <TableRow key={stats.tenantId}>
                      <TableCell className="font-medium">{stats.tenantId}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="gap-1">
                          <Users className="h-3 w-3" />
                          {stats.activeUsers}/{stats.userCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="gap-1">
                          <CreditCard className="h-3 w-3" />
                          {stats.loanCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="gap-1">
                          <Briefcase className="h-3 w-3" />
                          {stats.groupCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="gap-1">
                          <Users className="h-3 w-3" />
                          {stats.borrowerCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="gap-1">
                          <FileText className="h-3 w-3" />
                          {stats.cashTransactionCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={totalData === 0 ? "destructive" : totalData < 10 ? "secondary" : "default"}>
                          {totalData}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground">
                            {lastActivity.toLocaleDateString('hi-IN')}
                          </span>
                          <Badge variant={daysSinceActivity > 30 ? "destructive" : daysSinceActivity > 7 ? "secondary" : "default"} className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            {daysSinceActivity} दिवस
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={isInactive ? "destructive" : "default"}>
                          {isInactive ? "निष्क्रिय" : "सक्रिय"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {isInactive && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setSelectedTenant(stats.tenantId)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                डिलीट करा
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>टेनंट डिलीट करा</AlertDialogTitle>
                                <AlertDialogDescription>
                                  तुम्ही खात्री आहात की तुम्हाला टेनंट "{stats.tenantId}" आणि त्याचा सगळा डेटा कायमचा डिलीट करायचा आहे?
                                  <br /><br />
                                  <strong>हे डिलीट होईल:</strong>
                                  <ul className="list-disc list-inside mt-2 space-y-1">
                                    <li>{stats.userCount} वापरकर्ते</li>
                                    <li>{stats.loanCount} कर्जे</li>
                                    <li>{stats.groupCount} गट</li>
                                    <li>{stats.borrowerCount} कर्जदार</li>
                                    <li>{stats.cashTransactionCount} रोकड व्यवहार</li>
                                  </ul>
                                  <br />
                                  <strong className="text-red-600">हा डेटा पुन्हा मिळणार नाही!</strong>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>रद्द करा</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteTenant(stats.tenantId)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  disabled={deleteTenantMutation.isPending}
                                >
                                  {deleteTenantMutation.isPending ? "डिलीट करत आहे..." : "होय, डिलीट करा"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {!isInactive && (
                          <Badge variant="outline" className="text-xs">
                            सक्रिय डेटा
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {tenantStats?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              कोणतेही टेनंट सापडले नाहीत
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>निष्क्रिय टेनंट मापदंड</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <p><strong>निष्क्रिय टेनंट म्हणजे:</strong></p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>कोणताही डेटा एन्ट्री नाही (कर्जे, गट, कर्जदार, रोकड व्यवहार)</li>
              <li>किंवा कमी डेटा (5 पेक्षा कमी एन्ट्री) आणि 30 दिवसांपेक्षा जास्त काळ निष्क्रिय</li>
            </ul>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <Badge variant="destructive">निष्क्रिय - डिलीट करता येईल</Badge>
            <Badge variant="default">सक्रिय - संरक्षित</Badge>
            <Badge variant="secondary">मध्यम क्रिया</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}