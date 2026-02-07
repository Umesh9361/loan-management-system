import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, X, Image as ImageIcon, Eye, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import imageCompression from "browser-image-compression";

interface PhotoUploadProps {
  maxPhotos?: number;
  onPhotosChange?: (photos: UploadedPhoto[]) => void;
  existingPhotos?: UploadedPhoto[];
  disabled?: boolean;
  className?: string;
  loanId?: string; // For existing loans to show/manage photos
  onCameraDialogChange?: (isOpen: boolean) => void; // Notify parent when camera dialog opens/closes
}

import { UploadedPhoto } from "@/lib/photo-utils";

interface LoanPhoto {
  id: string;
  filename: string;
  originalName: string;
  storagePath: string;
  fileSize: number;
  compressedSize?: number;
  photoType: string;
  storageProvider?: string;
  url?: string;
  description?: string;
  uploadedAt: string;
}

export function PhotoUpload({ 
  maxPhotos = 2, 
  onPhotosChange, 
  existingPhotos = [], 
  disabled = false,
  className = "",
  loanId,
  onCameraDialogChange 
}: PhotoUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [photos, setPhotos] = useState<UploadedPhoto[]>(existingPhotos);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<UploadedPhoto | null>(null);

  // Fetch existing photos when editing a loan
  const { data: existingLoanPhotos = [] } = useQuery<LoanPhoto[]>({
    queryKey: ["/api/loans", loanId, "photos"],
    enabled: !!loanId,
  });

  // Convert server photos to UploadedPhoto format for component
  useEffect(() => {
    if (existingLoanPhotos.length > 0) {
      const convertedPhotos: UploadedPhoto[] = existingLoanPhotos.map((loanPhoto) => ({
        id: loanPhoto.id,
        file: new File([], loanPhoto.filename),
        preview: loanPhoto.url || (loanPhoto.storagePath?.includes('cloudinary.com') ? loanPhoto.storagePath : `/${loanPhoto.storagePath.replace(/\\/g, '/')}`),
        originalSize: loanPhoto.fileSize,
        compressedSize: loanPhoto.compressedSize,
        type: 'gallery' as const, // Default to gallery type for existing photos
        isExisting: true // Mark as existing photo - won't be re-uploaded
      }));
      setPhotos(convertedPhotos);
    }
  }, [existingLoanPhotos]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Professional compression settings
  const compressionOptions = {
    maxSizeMB: 0.5, // Target 500KB max
    maxWidthOrHeight: 1920, // Max resolution
    useWebWorker: true,
    fileType: 'image/jpeg' as const,
    quality: 0.85 // High quality balance
  };

  const generatePhotoId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  const compressImage = async (file: File): Promise<File> => {
    try {
      setIsCompressing(true);
      const compressedFile = await imageCompression(file, compressionOptions);
      
      toast({
        title: "फोटो कॉम्प्रेस केला",
        description: `साइज ${(file.size / 1024 / 1024).toFixed(2)}MB वरून ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB कमी झाला`,
      });
      
      return compressedFile;
    } catch (error) {
      console.error('Compression error:', error);
      toast({
        title: "कॉम्प्रेशन त्रुटी",
        description: "फोटो कॉम्प्रेस करताना समस्या झाली",
        variant: "destructive",
      });
      return file; // Return original if compression fails
    } finally {
      setIsCompressing(false);
    }
  };

  const addPhoto = useCallback(async (file: File, type: 'camera' | 'gallery') => {
    if (photos.length >= maxPhotos) {
      toast({
        title: "फोटो मर्यादा",
        description: `केवळ ${maxPhotos} फोटो अपलोड करता येतील`,
        variant: "destructive",
      });
      return;
    }

    try {
      const compressedFile = await compressImage(file);
      const preview = URL.createObjectURL(compressedFile);
      
      const newPhoto: UploadedPhoto = {
        id: generatePhotoId(),
        file,
        compressed: compressedFile,
        preview,
        originalSize: file.size,
        compressedSize: compressedFile.size,
        type
      };

      const updatedPhotos = [...photos, newPhoto];
      setPhotos(updatedPhotos);
      onPhotosChange?.(updatedPhotos);

      toast({
        title: "फोटो जोडला",
        description: `${type === 'camera' ? 'कॅमेराने' : 'गॅलरीतून'} फोटो यशस्वीरित्या जोडला`,
      });
    } catch (error) {
      toast({
        title: "त्रुटी",
        description: "फोटो जोडताना समस्या झाली",
        variant: "destructive",
      });
    }
  }, [photos, maxPhotos, onPhotosChange, toast]);

  const removePhoto = useCallback(async (photoId: string) => {
    const photoToRemove = photos.find(photo => photo.id === photoId);
    
    if (!photoToRemove) {
      toast({
        title: "त्रुटी",
        description: "फोटो सापडला नाही",
        variant: "destructive",
      });
      return;
    }

    try {
      // For existing photos, call API to delete from server
      if (photoToRemove.isExisting && loanId) {
        const response = await fetch(`/api/loans/${loanId}/photos/${photoId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Server deletion failed');
        }

        console.log(`📸 Server photo deleted: ${photoId}`);
        
        // Invalidate cache to refresh photos list
        queryClient?.invalidateQueries({ queryKey: ["/api/loans", loanId, "photos"] });
      } else {
        // For new photos, just clean up local memory
        URL.revokeObjectURL(photoToRemove.preview);
      }

      // Remove from local state
      const updatedPhotos = photos.filter(photo => photo.id !== photoId);
      setPhotos(updatedPhotos);
      onPhotosChange?.(updatedPhotos);

      toast({
        title: "फोटो काढला",
        description: "फोटो यशस्वीरित्या काढला गेला",
      });

    } catch (error) {
      console.error('Photo removal error:', error);
      toast({
        title: "फोटो काढण्यात त्रुटी",
        description: "फोटो काढताना समस्या झाली. कृपया पुन्हा प्रयत्न करा.",
        variant: "destructive",
      });
    }
  }, [photos, onPhotosChange, toast, loanId]);

  // Camera capture logic
  const handleCameraCapture = useCallback(async () => {
    console.log('📸 CAMERA: Starting camera capture...');
    try {
      // Enhanced mobile browser compatibility check
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('📸 CAMERA: MediaDevices API not supported');
        throw new Error("Camera API not supported");
      }

      console.log('📸 CAMERA: Requesting camera permission...');
      // Progressive permission request with mobile fallback
      let constraints = { 
        video: { 
          facingMode: 'environment', // Back camera preferred
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      };

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('📸 CAMERA: High-res stream obtained');
      } catch (firstError) {
        console.warn("📸 CAMERA: High-res failed, trying basic mode:", firstError);
        
        // Fallback to basic camera settings for older mobile browsers
        constraints = { 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        };
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('📸 CAMERA: Basic stream obtained');
        } catch (secondError) {
          console.warn("📸 CAMERA: Back camera failed, trying any camera:", secondError);
          
          // Final fallback - any available camera
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          console.log('📸 CAMERA: Fallback stream obtained');
        }
      }
      
      if (videoRef.current && stream) {
        console.log('📸 CAMERA: Setting video source...');
        videoRef.current.srcObject = stream;
        
        // Enhanced mobile play with user interaction
        try {
          await videoRef.current.play();
          console.log('📸 CAMERA: Video playing successfully');
        } catch (playError) {
          console.warn("📸 CAMERA: Autoplay blocked, requiring user interaction:", playError);
          // Video will play when user interacts
        }
      }
      
    } catch (error) {
      console.error("Camera access failed:", error);
      
      // More specific error messages
      let errorMsg = "कॅमेरा चालू करता आला नाही";
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMsg = "कॅमेरा परवानगी नाकारली गेली. सेटिंग्जमध्ये परवानगी द्या";
        } else if (error.name === 'NotFoundError') {
          errorMsg = "कॅमेरा सापडत नाही. 'फोटो घ्या' वापरा";
        } else if (error.name === 'NotSupportedError') {
          errorMsg = "कॅमेरा सपोर्ट नाही. 'फोटो घ्या' वापरा";
        }
      }
      
      toast({
        title: "कॅमेरा त्रुटी", 
        description: errorMsg,
        variant: "destructive",
      });
      
      // Mobile fallback - automatically trigger file input for camera
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.log('📸 CAMERA: Permission denied, triggering mobile fallback in 1.5s...');
        setTimeout(() => {
          console.log('📸 CAMERA: Clicking mobile camera input...');
          cameraInputRef.current?.click(); // Use camera input with capture attribute
        }, 1500);
      }
    }
  }, [toast]);

  const capturePhoto = useCallback(async () => {
    console.log('📸 CAMERA: Capturing photo from video stream...');
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) {
      console.error('📸 CAMERA: Video or canvas ref not available');
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      console.error('📸 CAMERA: Canvas context not available');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    console.log('📸 CAMERA: Image drawn to canvas, creating blob...');

    canvas.toBlob(async (blob) => {
      if (!blob) {
        console.error('📸 CAMERA: Blob creation failed');
        return;
      }
      
      console.log('📸 CAMERA: Blob created, adding photo...');
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      await addPhoto(file, 'camera');
      
      // Stop camera stream
      const stream = video.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      console.log('📸 CAMERA: Camera stream stopped, closing dialog');
      setShowCameraDialog(false);
    }, 'image/jpeg', 0.9);
  }, [addPhoto]);

  // Gallery selection
  const handleGallerySelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "अवैध फाइल",
        description: "केवळ इमेज फाइल्स अपलोड करा",
        variant: "destructive",
      });
      return;
    }

    console.log('📸 Gallery photo selected:', file.name);
    await addPhoto(file, 'gallery');
    
    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [addPhoto, toast]);

  // Camera input selection (mobile fallback)
  const handleCameraSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "अवैध फाइल",
        description: "केवळ इमेज फाइल्स अपलोड करा",
        variant: "destructive",
      });
      return;
    }

    console.log('📸 Camera photo captured:', file.name);
    await addPhoto(file, 'camera');
    
    // Clear input
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  }, [addPhoto, toast]);

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ImageIcon className="h-5 w-5" />
          वस्तूंचे फोटो ({photos.length}/{maxPhotos})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Upload Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Camera Option */}
          <Dialog 
            open={showCameraDialog} 
            onOpenChange={(open) => {
              setShowCameraDialog(open);
              onCameraDialogChange?.(open);
            }}
            modal={true}
          >
            <DialogTrigger asChild>
              <Button 
                type="button"
                variant="outline" 
                disabled={disabled || photos.length >= maxPhotos || isCompressing}
                className="h-20 flex-col gap-2"
                data-testid="button-camera-capture"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('📸 CAMERA: Opening camera dialog...');
                  setShowCameraDialog(true);
                }}
              >
                <Camera className="h-6 w-6" />
                <span className="text-sm">कॅमेराने फोटो</span>
              </Button>
            </DialogTrigger>
            <DialogContent 
              className="max-w-md"
              onEscapeKeyDown={(e) => {
                e.stopPropagation();
                // Stop camera stream before closing
                const stream = videoRef.current?.srcObject as MediaStream;
                stream?.getTracks().forEach(track => track.stop());
                setShowCameraDialog(false);
              }}
              onPointerDownOutside={(e) => {
                e.stopPropagation();
                // Stop camera stream before closing
                const stream = videoRef.current?.srcObject as MediaStream;
                stream?.getTracks().forEach(track => track.stop());
                setShowCameraDialog(false);
              }}
              onInteractOutside={(e) => {
                e.stopPropagation();
              }}
            >
              <DialogHeader>
                <DialogTitle>कॅमेराने फोटो घ्या</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="relative">
                  <video
                    ref={videoRef}
                    className="w-full rounded-lg bg-gray-100"
                    autoPlay
                    playsInline
                  />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCameraCapture();
                    }}
                    variant="outline"
                    className="flex-1 min-w-[120px]"
                    data-testid="button-start-camera"
                  >
                    कॅमेरा चालू करा
                  </Button>
                  
                  {/* Mobile Fallback Button */}
                  <Button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Stop camera stream before switching to mobile camera
                      const stream = videoRef.current?.srcObject as MediaStream;
                      stream?.getTracks().forEach(track => track.stop());
                      setShowCameraDialog(false);
                      setTimeout(() => {
                        cameraInputRef.current?.click();
                      }, 100);
                    }}
                    variant="secondary"
                    className="flex-1 min-w-[120px]"
                    data-testid="button-mobile-camera"
                  >
                    📱 मोबाइल कॅमेरा
                  </Button>
                  <Button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      capturePhoto();
                    }}
                    className="flex-1 min-w-[100px]"
                    data-testid="button-capture-photo"
                  >
                    फोटो घ्या
                  </Button>
                </div>
                
                {/* Explicit Close Button */}
                <div className="pt-2 border-t">
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Stop camera stream before closing
                      const stream = videoRef.current?.srcObject as MediaStream;
                      stream?.getTracks().forEach(track => track.stop());
                      console.log('📸 CAMERA: Manual close button clicked');
                      setShowCameraDialog(false);
                    }}
                    className="w-full"
                    data-testid="button-close-camera"
                  >
                    ❌ बंद करा
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Gallery Option */}
          <Button 
            type="button"
            variant="outline" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            disabled={disabled || photos.length >= maxPhotos || isCompressing}
            className="h-20 flex-col gap-2"
            data-testid="button-gallery-select"
          >
            <Upload className="h-6 w-6" />
            <span className="text-sm">गॅलरीतून निवडा</span>
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleGallerySelect}
            className="hidden"
            data-testid="input-gallery-file"
          />
          
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCameraSelect}
            className="hidden"
            data-testid="input-camera-file"
          />
        </div>

        {/* Loading State */}
        {isCompressing && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">फोटो कॉम्प्रेस करत आहे...</p>
          </div>
        )}

        {/* Photo Grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {photos.map((photo) => (
              <Card key={photo.id} className="relative">
                <div className="relative group">
                  <img
                    src={photo.preview}
                    alt="वस्तूचा फोटो"
                    className="w-full h-32 object-cover rounded-t-lg"
                  />
                  
                  {/* Photo Actions */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-t-lg">
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPreviewPhoto(photo);
                        }}
                        className="h-8 w-8 p-0"
                        data-testid={`button-preview-photo-${photo.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removePhoto(photo.id);
                        }}
                        className="h-8 w-8 p-0"
                        data-testid={`button-remove-photo-${photo.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Photo Type Badge */}
                  <Badge 
                    variant={photo.type === 'camera' ? 'default' : 'secondary'}
                    className="absolute bottom-2 left-2"
                  >
                    {photo.type === 'camera' ? '📸 कॅमेरा' : '🖼️ गॅलरी'}
                  </Badge>
                </div>
                
                <CardContent className="p-2">
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>मूळ साइज: {(photo.originalSize / 1024 / 1024).toFixed(2)}MB</div>
                    {photo.compressedSize && (
                      <div>कॉम्प्रेस्ड: {(photo.compressedSize / 1024 / 1024).toFixed(2)}MB</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Full Screen Photo Preview */}
        {previewPhoto && (
          <Dialog 
            open={!!previewPhoto} 
            onOpenChange={(open) => {
              if (!open) setPreviewPhoto(null);
            }}
            modal={true}
          >
            <DialogContent 
              className="max-w-4xl"
              onEscapeKeyDown={(e) => {
                e.preventDefault(); 
                e.stopPropagation();
                setPreviewPhoto(null);
              }}
              onPointerDownOutside={(e) => {
                e.preventDefault();
                e.stopPropagation(); 
                setPreviewPhoto(null);
              }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  फोटो प्रिव्हू
                  <Badge variant={previewPhoto.type === 'camera' ? 'default' : 'secondary'}>
                    {previewPhoto.type === 'camera' ? '📸 कॅमेरा' : '🖼️ गॅलरी'}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <img
                  src={previewPhoto.preview}
                  alt="Full size preview"
                  className="w-full max-h-96 object-contain rounded-lg"
                />
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>मूळ साइज: {(previewPhoto.originalSize / 1024 / 1024).toFixed(2)}MB</div>
                  {previewPhoto.compressedSize && (
                    <div>कॉम्प्रेस्ड साइज: {(previewPhoto.compressedSize / 1024 / 1024).toFixed(2)}MB</div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const link = document.createElement('a');
                      link.href = previewPhoto.preview;
                      link.download = `फोटो_${new Date().getTime()}.jpg`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    data-testid={`button-download-preview-${previewPhoto.id}`}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    डाउनलोड
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removePhoto(previewPhoto.id);
                      setPreviewPhoto(null);
                    }}
                    data-testid={`button-delete-preview-${previewPhoto.id}`}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    फोटो काढा
                  </Button>
                  <Button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPreviewPhoto(null);
                    }}
                  >बंद करा</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Help Text */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• केवळ JPG, PNG फाइल्स support</p>
          <p>• अपलोड केल्यानंतर automatic compression</p>
          <p>• कर्ज बंद झाल्यावर फोटो automatic delete</p>
          {photos.length < maxPhotos && (
            <p className="text-blue-600">• आणखी {maxPhotos - photos.length} फोटो जोडू शकता</p>
          )}
        </div>

      </CardContent>
    </Card>
  );
}

