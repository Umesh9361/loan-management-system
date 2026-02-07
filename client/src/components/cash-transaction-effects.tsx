import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface CashTransactionEffectsProps {
  transaction?: any;
  action: 'create' | 'update' | 'delete';
}

export default function CashTransactionEffects({ transaction, action }: CashTransactionEffectsProps) {
  const { toast } = useToast();

  useEffect(() => {
    if (!transaction || !transaction.narration) return;

    // Show relevant effects based on the action and transaction type
    if (transaction.narration.includes('कर्ज')) {
      let message = '';
      let title = '';

      if (action === 'create') {
        if (transaction.narration.includes('कर्ज वितरण')) {
          title = "कर्ज सक्रिय झाले";
          message = "नवीन कर्ज वितरण नोंदवले गेले आणि कर्ज सक्रिय केले गेले";
        } else if (transaction.narration.includes('कर्ज बंद')) {
          title = "कर्ज बंद झाले";
          message = "कर्ज बंद करण्याची नोंद झाली आणि कर्ज बंद केले गेले";
        }
      } else if (action === 'delete') {
        if (transaction.narration.includes('कर्ज वितरण')) {
          title = "कर्ज निष्क्रिय केले";
          message = "कर्ज वितरण रद्द केल्यामुळे कर्ज निष्क्रिय केले गेले";
        } else if (transaction.narration.includes('कर्ज बंद')) {
          title = "कर्ज पुन्हा सक्रिय";
          message = "कर्ज बंद नोंद रद्द केल्यामुळे कर्ज पुन्हा सक्रिय केले गेले";
        }
      } else if (action === 'update') {
        title = "कर्ज स्थिती अद्यतनित";
        message = "रोकड व्यवहार बदलल्यामुळे संबंधित कर्ज स्थिती अद्यतनित केली गेली";
      }

      if (message) {
        toast({
          title,
          description: message,
          duration: 5000,
          action: (
            <div className="flex items-center">
              {action === 'delete' ? (
                <AlertCircle className="h-4 w-4 text-orange-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
            </div>
          ),
        });
      }
    }
  }, [transaction, action, toast]);

  return null;
}