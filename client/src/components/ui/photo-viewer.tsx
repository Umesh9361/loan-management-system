import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye, ZoomIn, ZoomOut, RotateCw, Download, X, Camera, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { LoanPhoto } from "@/../../shared/schema";

interface PhotoViewerProps {
  loanId: string;
  loanAccountNumber?: string;
  readonly?: boolean; // Read-only mode for space bar popup
}


export function PhotoViewer({ loanId, loanAccountNumber, readonly = false }: PhotoViewerProps) {
  const { toast } = useToast();
  const [selectedPhoto, setSelectedPhoto] = useState<LoanPhoto | null>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  // Fetch photos for this loan
  const { data: photos = [], isLoading, error } = useQuery<LoanPhoto[]>({
    queryKey: ["/api/loans", loanId, "photos"],
    enabled: !!loanId,
  });

  const handlePhotoSelect = (photo: LoanPhoto) => {
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

  const getPhotoSrc = (photo: LoanPhoto) => {
    return photo.url || photo.thumbnailUrl || `/uploads/photos/${photo.filename}`;
  };

  const handleDownload = (photo: LoanPhoto) => {
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
          तारणाचे फोटो
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
          तारणाचे फोटो
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
          तारणाचे फोटो ({photos.length}/2)
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
          {/* Photo Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {photos.map((photo, index) => (
              <Card key={photo.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className="relative group">
                    <img
                      src={getPhotoSrc(photo)}
                      alt={photo.originalName}
                      className="w-full h-40 object-cover cursor-pointer transition-transform hover:scale-105"
                      onClick={() => handlePhotoSelect(photo)}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handlePhotoSelect(photo)}
                        className="bg-white/90 hover:bg-white text-black"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        पाहा
                      </Button>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      फोटो {index + 1}
                    </p>
                    <div className="flex items-center justify-center mt-1">
                      <p className="text-xs text-gray-600">
                        {(photo.compressedSize || photo.fileSize / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Photo Preview Modal */}
          {selectedPhoto && (
            <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
              <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-hidden">
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <span className="font-noto">
                      फोटो प्रिव्ह्यू - {loanAccountNumber ? `खाते ${loanAccountNumber}` : 'कर्ज फोटो'}
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
                <div className="flex-1 overflow-auto bg-gray-100 rounded-lg p-4">
                  <div className="flex items-center justify-center min-h-[400px]">
                    <img
                      src={getPhotoSrc(selectedPhoto)}
                      alt={selectedPhoto.originalName}
                      className="max-w-full max-h-full object-contain transition-transform duration-200"
                      style={{
                        transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                      }}
                    />
                  </div>
                </div>

                {/* Photo Info */}
                <div className="grid grid-cols-3 gap-4 text-xs text-gray-600 bg-gray-50 p-3 rounded">
                  <div>
                    <span className="font-medium">फाइलचे नाव:</span><br />
                    {selectedPhoto.originalName}
                  </div>
                  <div>
                    <span className="font-medium">साइज:</span><br />
                    {(selectedPhoto.compressedSize || selectedPhoto.fileSize / 1024).toFixed(0)} KB
                  </div>
                  <div>
                    <span className="font-medium">अपलोड दिनांक:</span><br />
                    {new Date(selectedPhoto.createdAt).toLocaleDateString('hi-IN')}
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