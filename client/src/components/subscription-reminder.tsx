import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Clock, X, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubscriptionStatus {
  subscriptionType: string;
  isExpired: boolean;
  daysRemaining: number | null;
  showReminder: boolean;
  reminderType?: string;
  subscriptionEndDate?: string | null;
  subscriptionMonths?: number | null;
}

export function SubscriptionReminder() {
  const [dismissed, setDismissed] = useState(false);

  const { data: status } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription-status"],
    staleTime: 60000,
  });

  if (!status || status.subscriptionType === 'lifetime' || dismissed) {
    return null;
  }

  if (status.isExpired) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-red-700 mb-2 font-noto">
            सदस्यत्व कालबाह्य झाले!
          </h2>
          <p className="text-gray-600 mb-4 font-noto">
            तुमच्या संस्थेचे सदस्यत्व संपले आहे. कृपया Super Admin शी संपर्क साधा सदस्यत्व नूतनीकरणासाठी.
          </p>
          <div className="bg-red-50 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-700 font-noto">
              सदस्यत्व समाप्ती तारीख: {status.subscriptionEndDate ? new Date(status.subscriptionEndDate).toLocaleDateString('hi-IN') : '-'}
            </p>
          </div>
          <p className="text-xs text-gray-500 font-noto">
            System मध्ये कोणतीही माहिती बदलता येणार नाही. फक्त बघता येईल.
          </p>
        </div>
      </div>
    );
  }

  if (!status.showReminder) {
    return null;
  }

  const isUrgent = status.reminderType === 'urgent';
  const bgColor = isUrgent ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-300';
  const textColor = isUrgent ? 'text-red-800' : 'text-orange-800';
  const iconColor = isUrgent ? 'text-red-600' : 'text-orange-600';

  return (
    <div className={`${bgColor} border rounded-lg p-3 mb-4 mx-4 relative`}>
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${iconColor}`}>
          {isUrgent ? <AlertTriangle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
        </div>
        <div>
          <p className={`font-semibold text-sm ${textColor} font-noto`}>
            {isUrgent ? '⚠️ सदस्यत्व लवकरच संपत आहे!' : '🔔 सदस्यत्व नूतनीकरण सूचना'}
          </p>
          <p className={`text-xs mt-1 ${textColor} font-noto`}>
            तुमचे सदस्यत्व {status.daysRemaining} दिवसांत संपेल
            {status.subscriptionEndDate && ` (${new Date(status.subscriptionEndDate).toLocaleDateString('hi-IN')})`}.
            कृपया Super Admin शी संपर्क करा.
          </p>
        </div>
      </div>
    </div>
  );
}
