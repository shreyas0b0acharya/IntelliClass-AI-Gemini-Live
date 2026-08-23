"use client";

interface PizzaButtonProps {
    playing: boolean;
    onPlay: () => void;
}

export default function PizzaButton({
    playing,
    onPlay,
}: PizzaButtonProps) {
    return (
        <button
            type="button"
            onClick={onPlay}
            disabled={playing}
            className="rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
            {playing ? "Playing Pizza..." : "🍕 Play Pizza"}
        </button>
    );
}