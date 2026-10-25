import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye, ZoomIn, ZoomOut, RotateCw, Download, X, Camera, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { LoanPhoto } from "@/../../shared/schema";
type ViewerPhoto = LoanPhoto & { url?: string; thumbnailUrl?: string };

interface PhotoViewerProps {
  loanId: string;
  loanAccountNumber?: string;
  readonly?: boolean; // Read-only mode for space bar popup
}


export function PhotoViewer({ loanId, loanAccountNumber, readonly = false }: PhotoViewerProps) {
  const { toast } = useToast();
  const [selectedPhoto, setSelectedPhoto] = useState<ViewerPhoto | null>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  // Fetch photos for this loan
  const { data: photos = [], isLoading, error } = useQuery<ViewerPhoto[]>({
    queryKey: ["/api/loans", loanId, "photos"],
    enabled: !!loanId,
  });

  useEffect(() => { setSelectedPhoto(null); setZoom(100); setRotation(0); }, [loanId]);
  const groups = [
    { title: "कर्जदाराचा फोटो", label: "कर्जदाराचा फोटो", photos: photos.filter(photo => photo.photoType === "borrower") },
    { title: "तारण वस्तूंचे फोटो", label: "वस्तूचा फोटो", photos: photos.filter(photo => !photo.photoType || photo.photoType === "collateral") },
    { title: "इतर फोटो / कागदपत्रे", label: "कागदपत्र", photos: photos.filter(photo => photo.photoType && !["borrower", "collateral"].includes(photo.photoType)) },
  ];
  const photoLabel = (photo: ViewerPhoto) => photo.photoType === "borrower" ? "कर्जदाराचा फोटो" : photo.photoType === "document" || photo.photoType === "other" ? "इतर फोटो / कागदपत्र" : "वस्तूचा फोटो";
  const handlePhotoSelect = (photo: ViewerPhoto) => {
    setSelectedPhoto(photo);
    setZoom(100);
    setRotation(0);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 25));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const getPhotoSrc = (photo: ViewerPhoto) => {
    return photo.url || photo.thumbnailUrl || `/uploads/photos/${photo.filename}`;
  };

  const handleDownload = (photo: ViewerPhoto) => {
    const link = document.createElement('a');
    link.href = getPhotoSrc(photo);
    link.download = photo.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "डाउनलोड सुरू",
      description: `${photo.originalName} डाउनलोड सुरू झाले`,
      variant: "default",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h4 className="text-base font-semibold text-amber-800 flex items-center gap-2">
          <Camera className="h-5 w-5" />
          खात्याचे फोटो
        </h4>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
          <p className="text-sm text-gray-600 mt-2">फोटो लोड होत आहेत...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h4 className="text-base font-semibold text-amber-800 flex items-center gap-2">
          <Camera className="h-5 w-5" />
          खात्याचे फोटो
        </h4>
        <div className="text-center py-8 text-gray-500">
          <ImageIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p>फोटो लोड करताना त्रुटी झाली</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-amber-800 flex items-center gap-2">
          <Camera className="h-5 w-5" />
          खात्याचे फोटो ({photos.length})
        </h4>
        {readonly && photos.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            केवळ पाहणे
          </Badge>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-8 bg-amber-50 rounded-lg border border-amber-200">
          <ImageIcon className="h-12 w-12 mx-auto mb-2 text-amber-400" />
          <p className="text-amber-700 font-medium">या कर्जासाठी फोटो अपलोड केले नाहीत</p>
          {!readonly && (
            <p className="text-xs text-amber-600 mt-1">संपादन करा मध्ये फोटो अपलोड करा</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {!groups[0].photos.length && <p className="rounded-md bg-indigo-50 p-3 text-sm text-indigo-900">कर्जदाराचा स्वतंत्र फोटो सेव्ह केलेला नाही.{!readonly && " संपादन करा → कर्जदाराचा स्वतंत्र फोटो येथे जोडता येतो."}</p>}
          {/* Photo Grid */}
          {groups.filter(group => group.photos.length).map(group => <section key={group.title} aria-label={group.title} className="space-y-2">
          <h5 className="text-sm font-semibold text-slate-800">{group.title} ({group.photos.length})</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {group.photos.map((photo, index) => (
              <Card key={photo.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <button type="button" className="relative block w-full bg-slate-50 text-left" onClick={() => handlePhotoSelect(photo)} aria-label={`${group.label} ${index + 1} मोठा पहा`}>
                    <img
                      src={getPhotoSrc(photo)}
                      alt={`${group.label} ${index + 1}`}
                      className="w-full h-40 object-contain"
                    />
                    <span className="absolute bottom-2 right-2 flex items-center rounded bg-white/95 px-2 py-1 text-xs text-slate-800 shadow-sm"><Eye className="mr-1 h-3 w-3" />मोठा पहा</span>
                  </button>
                  <div className="p-3">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {group.label} {group.photos.length > 1 ? index + 1 : ""}
                    </p>
                    <div className="flex items-center justify-center mt-1">
                      <p className="text-xs text-gray-600">
                        {((photo.compressedSize ?? photo.fileSize) / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          </section>)}

          {/* Photo Preview Modal */}
          {selectedPhoto && (
            <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
              <DialogContent className="flex max-w-[95vw] sm:max-w-4xl max-h-[90vh] flex-col overflow-hidden">
                <DialogHeader>
                  <DialogTitle className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-noto">
                      {photoLabel(selectedPhoto)} · {loanAccountNumber ? `खाते ${loanAccountNumber}` : 'कर्ज फोटो'}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{zoom}%</Badge>
                      <Badge variant="outline">{rotation}°</Badge>
                    </div>
                  </DialogTitle>
                </DialogHeader>
                
                {/* Photo Controls - Mobile Optimized */}
                <div className="flex items-center justify-center gap-2 py-3 border-b flex-wrap">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleZoomOut}
                    className="min-h-[44px] min-w-[44px] touch-manipulation"
                  >
                    <ZoomOut className="h-5 w-5" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleZoomIn}
                    className="min-h-[44px] min-w-[44px] touch-manipulation"
                  >
                    <ZoomIn className="h-5 w-5" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleRotate}
                    className="min-h-[44px] min-w-[44px] touch-manipulation"
                  >
                    <RotateCw className="h-5 w-5" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleDownload(selectedPhoto)}
                    className="min-h-[44px] px-4 touch-manipulation"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    डाउनलोड
                  </Button>
                </div>

                {/* Photo Display */}
                <div className="min-h-0 flex-1 overflow-auto bg-gray-100 rounded-lg p-4">
                  <div className="flex items-center justify-center min-h-[200px] sm:min-h-[360px]">
                    <img
                      src={getPhotoSrc(selectedPhoto)}
                      alt={selectedPhoto.originalName}
                      className="max-w-full max-h-[50vh] object-contain transition-transform duration-200"
                      style={{
                        transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                      }}
                    />
                  </div>
                </div>

                {/* Photo Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600 bg-gray-50 p-3 rounded break-words">
                  <div>
                    <span className="font-medium">फाइलचे नाव:</span><br />
                    {selectedPhoto.originalName}
                  </div>
                  <div>
                    <span className="font-medium">साइज:</span><br />
                    {((selectedPhoto.compressedSize ?? selectedPhoto.fileSize) / 1024).toFixed(0)} KB
                  </div>
                  <div>
                    <span className="font-medium">अपलोड दिनांक:</span><br />
                    {new Date(selectedPhoto.createdAt).toLocaleDateString('en-IN')}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </div>
  );
}