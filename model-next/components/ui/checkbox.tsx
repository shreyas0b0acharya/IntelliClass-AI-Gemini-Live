"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <div className="relative flex items-center">
    <input
      type="checkbox"
      ref={ref}
      className={cn(
        "peer h-5 w-5 shrink-0 appearance-none rounded-md border-2 border-primary bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 checked:bg-primary",
        className
      )}
      {...props}
    />
    <Check 
      className="absolute left-1 top-1 h-3 w-3 text-primary-foreground opacity-0 pointer-events-none peer-checked:opacity-100 transition-opacity" 
      strokeWidth={4}
    />
  </div>
))
Checkbox.displayName = "Checkbox"

export { Checkbox }
