import { useState } from "react";
import { Volume2, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unlockAudioContext } from "@/features/avatar";

interface AudioUnlockModalProps {
  onUnlock: () => void;
  topic?: string;
  isLecturer?: boolean;
}

export function AudioUnlockModal({
  onUnlock,
  topic = "Live AI Classroom",
  isLecturer = false,
}: AudioUnlockModalProps) {
  const [isUnlocking, setIsUnlocking] = useState(false);

  const handleUnlock = () => {
    setIsUnlocking(true);
    try {
      unlockAudioContext();
      onUnlock();
    } catch {
      setIsUnlocking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mb-6 shadow-xl animate-bounce">
        <Volume2 className="h-10 w-10" />
      </div>

      <div className="max-w-md space-y-3 mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          {isLecturer ? "Faculty Broadcast Deck" : "Student Live Sync"}
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {topic}
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Enable browser audio to synchronize speech, biomechanical visemes, and live interaction with Professor Sharma.
        </p>
      </div>

      <Button
        onClick={handleUnlock}
        disabled={isUnlocking}
        variant="default"
        size="lg"
        className="px-10 h-13 text-sm font-bold shadow-xl shadow-primary/20 rounded-xl"
      >
        {isUnlocking ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span>Connecting Audio Engine...</span>
          </>
        ) : (
          <span>Enter Classroom &amp; Enable Audio</span>
        )}
      </Button>
    </div>
  );
}
