"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center py-2",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
      <SliderPrimitive.Range className="absolute h-full bg-[#0071e3] rounded-full" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4.5 w-4.5 rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.28),0_0_1px_rgba(0,0,0,0.2)] border border-black/10 dark:border-white/20 ring-offset-background transition-transform active:scale-115 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/50 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
