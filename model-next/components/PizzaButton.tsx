"use client";

import { AppButton } from "@/components/app/AppButton";

interface PizzaButtonProps {
    playing: boolean;
    onPlay: () => void;
}

export default function PizzaButton({
    playing,
    onPlay,
}: PizzaButtonProps) {
    return (
        <AppButton
            type="button"
            onClick={onPlay}
            disabled={playing}
            isLoading={playing}
            loadingText="Playing Pizza..."
            variant="primary"
            shape="rounded"
            size="lg"
            className="shadow-lg"
        >
            <span>🍕 Play Pizza</span>
        </AppButton>
    );
}