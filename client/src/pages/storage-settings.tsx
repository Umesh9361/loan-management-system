import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { useToast } from "@/hooks/use-toast";
import { 
  Cloud, 
  HardDrive, 
  Settings, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  ArrowLeft,
  Shield,
  Eye,
  EyeOff,
  TestTube
} from "lucide-react";
import { Link } from "wouter";

export default function StorageSettings() {
  const { toast } = useToast();
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);

  const { user, isLoading: loadingUser } = useCurrentUser();

  const isSuperAdmin = user?.role === 'super_admin';
  const userLoaded = !!user && !loadingUser;

  const { data: tenantSettings, isLoading: loadingTenant } = useQuery<any>({
    queryKey: ["/api/admin/storage-settings/tenant"],
    enabled: userLoaded && !isSuperAdmin,
  });

  const { data: defaultSettings, isLoading: loadingDefault } = useQuery<any>({
    queryKey: ["/api/admin/storage-settings/default"],
    enabled: userLoaded && isSuperAdmin,
  });

  const { data: allTenantSettings } = useQuery<any[]>({
    queryKey: ["/api/admin/storage-settings/all-tenants"],
    enabled: userLoaded && isSuperAdmin,
  });

  const settings = isSuperAdmin ? defaultSettings : tenantSettings;
  const isLoading = loadingUser || (isSuperAdmin ? loadingDefault : loadingTenant);

  const [provider, setProvider] = useState<string>('local');
  const [cloudName, setCloudName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [folder, setFolder] = useState('');

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (settings && !isInitialized) {
      setProvider(isSuperAdmin ? (settings.provider || 'local') : (settings.storageProvider || 'local'));
      setCloudName(settings.cloudinaryCloudName || '');
      setApiKey(settings.cloudinaryApiKey || '');
      setApiSecret(settings.cloudinaryApiSecret || '');
      setFolder(isSuperAdmin ? (settings.cloudinaryFolder || 'loan_photos') : (settings.cloudinaryFolder || ''));
      setIsInitialized(true);
    }
  }, [settings, isInitialized, isSuperAdmin]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = isSuperAdmin 
        ? '/api/admin/storage-settings/default'
        : '/api/admin/storage-settings/tenant';
      return apiRequest(endpoint, 'POST', data);
    },
    onSuccess: () => {
      toast({ title: "सेटिंग्स सेव्ह झाल्या", description: "Photo storage settings यशस्वीरित्या अपडेट केले" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/storage-settings"] });
    },
    onError: () => {
      toast({ title: "त्रुटी", description: "Settings save करताना त्रुटी झाली", variant: "destructive" });
    }
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/admin/storage-settings/test-cloudinary', 'POST', {
        cloudinaryCloudName: cloudName,
        cloudinaryApiKey: apiKey !== '••••••••' ? apiKey : '',
        cloudinaryApiSecret: apiSecret !== '••••••••' ? apiSecret : '',
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "कनेक्शन यशस्वी!", description: "Cloudinary कनेक्शन चालू आहे" });
      } else {
        toast({ title: "कनेक्शन अयशस्वी", description: data.message, variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "टेस्ट अयशस्वी", description: "कनेक्शन टेस्ट करताना त्रुटी", variant: "destructive" });
    }
  });

  const handleSave = () => {
    if (isSuperAdmin) {
      saveMutation.mutate({
        provider,
        cloudinaryCloudName: cloudName,
        cloudinaryApiKey: apiKey !== '••••••••' ? apiKey : undefined,
        cloudinaryApiSecret: apiSecret !== '••••••••' ? apiSecret : undefined,
        cloudinaryFolder: folder,
      });
    } else {
      saveMutation.mutate({
        storageProvider: provider,
        cloudinaryCloudName: cloudName,
        cloudinaryApiKey: apiKey !== '••••••••' ? apiKey : undefined,
        cloudinaryApiSecret: apiSecret !== '••••••••' ? apiSecret : undefined,
        cloudinaryFolder: folder,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileNav />
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>
        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
          <div className="p-4 lg:p-8">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <Link href={isSuperAdmin ? "/super-admin-home" : "/dashboard"}>
                  <Button variant="ghost" size="sm" className="mb-2">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    मागे जा
                  </Button>
                </Link>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <Settings className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 font-noto">
                      फोटो स्टोरेज सेटिंग्स
                    </h1>
                    <p className="text-sm text-gray-600">
                      {isSuperAdmin ? "डीफॉल्ट स्टोरेज सेटिंग्स (सर्व Tenant साठी)" : "तुमच्या कंपनीचे फोटो स्टोरेज कॉन्फिगर करा"}
                    </p>
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                  <p className="mt-2 text-gray-600">लोड होत आहे...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-noto text-lg">स्टोरेज प्रोव्हायडर निवडा</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div
                          onClick={() => setProvider('local')}
                          className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
                            provider === 'local' 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <HardDrive className={`h-8 w-8 ${provider === 'local' ? 'text-blue-600' : 'text-gray-400'}`} />
                            <div>
                              <h3 className="font-semibold text-gray-900 font-noto">Local Storage</h3>
                              <p className="text-xs text-gray-500">सर्व्हर/PC वर फोटो सेव्ह</p>
                            </div>
                          </div>
                          <div className="space-y-1 text-xs text-gray-600">
                            <p>Local host / Development साठी</p>
                            <p>कोणतीही सेटिंग लागत नाही</p>
                            <Badge variant="outline" className="mt-1 text-green-700 border-green-300 text-xs">
                              Free - कोणतेही Account नाही
                            </Badge>
                          </div>
                        </div>

                        <div
                          onClick={() => setProvider('cloudinary')}
                          className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
                            provider === 'cloudinary' 
                              ? 'border-purple-500 bg-purple-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <Cloud className={`h-8 w-8 ${provider === 'cloudinary' ? 'text-purple-600' : 'text-gray-400'}`} />
                            <div>
                              <h3 className="font-semibold text-gray-900 font-noto">Cloudinary</h3>
                              <p className="text-xs text-gray-500">Cloud वर फोटो सेव्ह</p>
                            </div>
                          </div>
                          <div className="space-y-1 text-xs text-gray-600">
                            <p>Railway/Production deploy साठी</p>
                            <p>25GB free storage</p>
                            <Badge variant="outline" className="mt-1 text-purple-700 border-purple-300 text-xs">
                              Free Plan - Credit Card नाही
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {provider === 'cloudinary' && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="font-noto text-lg flex items-center gap-2">
                          <Cloud className="h-5 w-5 text-purple-600" />
                          Cloudinary कॉन्फिगरेशन
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Alert>
                          <AlertDescription className="text-sm">
                            <strong>cloudinary.com</strong> वर free account create करा आणि Dashboard वरून खालील 3 keys मिळवा.
                          </AlertDescription>
                        </Alert>

                        <div className="space-y-4">
                          <div>
                            <Label className="font-noto">Cloud Name</Label>
                            <Input
                              value={cloudName}
                              onChange={(e) => setCloudName(e.target.value)}
                              placeholder="तुमचे Cloudinary Cloud Name"
                              className="mt-1"
                            />
                          </div>

                          <div>
                            <Label className="font-noto flex items-center gap-2">
                              API Key
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setShowApiKey(!showApiKey)}
                              >
                                {showApiKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </Button>
                            </Label>
                            <Input
                              type={showApiKey ? "text" : "password"}
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                              placeholder="तुमची Cloudinary API Key"
                              className="mt-1"
                            />
                          </div>

                          <div>
                            <Label className="font-noto flex items-center gap-2">
                              API Secret
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setShowApiSecret(!showApiSecret)}
                              >
                                {showApiSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </Button>
                            </Label>
                            <Input
                              type={showApiSecret ? "text" : "password"}
                              value={apiSecret}
                              onChange={(e) => setApiSecret(e.target.value)}
                              placeholder="तुमची Cloudinary API Secret"
                              className="mt-1"
                            />
                          </div>

                          <div>
                            <Label className="font-noto">Folder Name (ऐच्छिक)</Label>
                            <Input
                              value={folder}
                              onChange={(e) => setFolder(e.target.value)}
                              placeholder="loan_photos"
                              className="mt-1"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Cloudinary मध्ये फोटो कोणत्या folder मध्ये save होतील
                            </p>
                          </div>

                          <Button
                            onClick={() => testMutation.mutate()}
                            disabled={!cloudName || testMutation.isPending}
                            variant="outline"
                            className="w-full"
                          >
                            {testMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <TestTube className="h-4 w-4 mr-2" />
                            )}
                            कनेक्शन टेस्ट करा
                          </Button>

                          {settings?.testStatus && (
                            <div className={`flex items-center gap-2 p-3 rounded-lg ${
                              settings.testStatus === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                            }`}>
                              {settings.testStatus === 'success' ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600" />
                              )}
                              <span className="text-sm font-medium">
                                {settings.testStatus === 'success' ? 'कनेक्शन यशस्वी!' : 'कनेक्शन अयशस्वी'}
                              </span>
                              {settings.lastTestedAt && (
                                <span className="text-xs ml-auto">
                                  {new Date(settings.lastTestedAt).toLocaleString('hi-IN')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex justify-end gap-3">
                    <Button
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      className="min-w-[160px]"
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Settings className="h-4 w-4 mr-2" />
                      )}
                      सेटिंग्स सेव्ह करा
                    </Button>
                  </div>

                  {isSuperAdmin && allTenantSettings && allTenantSettings.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="font-noto text-lg flex items-center gap-2">
                          <Shield className="h-5 w-5 text-red-600" />
                          Tenant Storage Overview
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {allTenantSettings.map((tenant: any) => (
                            <div key={tenant.tenantId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <span className="font-medium text-sm">{tenant.tenantId}</span>
                                <Badge variant={tenant.storageProvider === 'cloudinary' ? 'default' : 'secondary'} className="text-xs">
                                  {tenant.storageProvider === 'cloudinary' ? (
                                    <><Cloud className="h-3 w-3 mr-1" /> Cloudinary</>
                                  ) : (
                                    <><HardDrive className="h-3 w-3 mr-1" /> Local</>
                                  )}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                {tenant.isConfigured ? (
                                  <Badge variant="outline" className="text-green-700 border-green-300 text-xs">
                                    <CheckCircle className="h-3 w-3 mr-1" /> Configured
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">
                                    Default
                                  </Badge>
                                )}
                                {tenant.testStatus === 'success' && (
                                  <Badge variant="outline" className="text-green-700 border-green-300 text-xs">
                                    Tested
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="pt-6">
                      <div className="space-y-3 text-sm text-amber-800">
                        <h4 className="font-semibold font-noto">महत्त्वाची माहिती:</h4>
                        <ul className="list-disc list-inside space-y-1.5">
                          <li><strong>Local Storage:</strong> फोटो तुमच्या सर्व्हर/PC वर save होतात. Development आणि local hosting साठी योग्य.</li>
                          <li><strong>Cloudinary:</strong> फोटो cloud वर safe राहतात. Railway/production deploy साठी आवश्यक.</li>
                          <li>Provider बदलल्यावर जुने फोटो जिथे save आहेत तिथेच राहतील. फक्त नवीन फोटो नवीन provider वर जातील.</li>
                          <li>Cloudinary free plan: 25GB storage, 25GB bandwidth/month - 2000+ फोटो साठी पुरेसे.</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
