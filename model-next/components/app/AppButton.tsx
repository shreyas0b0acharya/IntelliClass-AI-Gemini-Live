"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const appButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-medium text-center transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-45 disabled:active:scale-100 cursor-pointer select-none active:scale-[0.97] tracking-tight shrink-0",
  {
    variants: {
      variant: {
        // Apple Prominent System Blue
        primary:
          "bg-[#0071e3] text-white hover:bg-[#0077ed] active:bg-[#0062c4] shadow-xs shadow-[#0071e3]/20 dark:shadow-[#0071e3]/30 border border-transparent",
        // Apple System Filled / Subtle Neutral
        secondary:
          "bg-black/[0.06] dark:bg-white/[0.10] text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.10] dark:hover:bg-white/[0.16] active:bg-black/[0.14] dark:active:bg-white/[0.22] border border-black/[0.04] dark:border-white/[0.06]",
        // Apple Translucent Tinted Accent
        tinted:
          "bg-[#0071e3]/12 text-[#0071e3] hover:bg-[#0071e3]/18 active:bg-[#0071e3]/26 dark:bg-[#0071e3]/20 dark:text-[#2997ff] dark:hover:bg-[#0071e3]/30 dark:active:bg-[#0071e3]/40 border border-[#0071e3]/15 dark:border-[#0071e3]/30",
        // Apple VisionOS / macOS Frosted Glass Vibrancy
        glass:
          "bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-xl text-[#1d1d1f] dark:text-[#f5f5f7] border border-white/60 dark:border-white/10 hover:bg-white/90 dark:hover:bg-[#2c2c2e]/80 active:bg-white/60 dark:active:bg-[#1c1c1e]/60 shadow-xs",
        // Apple Hairline Bordered
        outline:
          "border border-[#d2d2d7] dark:border-[#3a3a3c] bg-transparent text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.10]",
        // Apple Borderless Plain Button
        ghost:
          "bg-transparent text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] active:bg-black/[0.09] dark:active:bg-white/[0.12] border border-transparent shadow-none",
        // Apple System Red Alert
        destructive:
          "bg-[#ff3b30] text-white hover:bg-[#e0352b] active:bg-[#c92f26] shadow-xs shadow-[#ff3b30]/20 dark:bg-[#ff453a] dark:hover:bg-[#ff5b52] dark:active:bg-[#e0382f] border border-transparent",
        // Apple Destructive Subtle Tint
        "destructive-tinted":
          "bg-[#ff3b30]/10 text-[#ff3b30] hover:bg-[#ff3b30]/18 active:bg-[#ff3b30]/26 dark:bg-[#ff453a]/20 dark:text-[#ff453a] dark:hover:bg-[#ff453a]/30 dark:active:bg-[#ff453a]/40 border border-[#ff3b30]/15 dark:border-[#ff453a]/30",
        // Apple System Green
        success:
          "bg-[#34c759] text-white hover:bg-[#30b753] active:bg-[#289e47] shadow-xs shadow-[#34c759]/20 dark:bg-[#30d158] dark:hover:bg-[#34e060] dark:active:bg-[#28b84d] border border-transparent",
        // Apple Success Subtle Tint
        "success-tinted":
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/18 active:bg-emerald-500/26 border border-emerald-500/15 dark:border-emerald-500/30",
        // Apple Text Link
        link:
          "text-[#0071e3] dark:text-[#2997ff] underline-offset-4 hover:underline bg-transparent p-0 h-auto shadow-none border-transparent active:scale-100",
      },
      size: {
        xs: "h-7 px-2.5 text-xs gap-1.5 [&_svg]:size-3.5",
        sm: "h-8.5 px-3.5 text-xs font-medium gap-1.5 [&_svg]:size-3.5",
        default: "h-10 px-4 py-2 text-sm font-medium gap-2 [&_svg]:size-4",
        lg: "h-12 px-6 text-[15px] font-semibold gap-2.5 [&_svg]:size-4.5",
        xl: "h-14 px-8 text-base font-semibold gap-3 [&_svg]:size-5",
        "icon-xs": "h-7 w-7 p-0 justify-center [&_svg]:size-3.5",
        "icon-sm": "h-8.5 w-8.5 p-0 justify-center [&_svg]:size-4",
        icon: "h-10 w-10 p-0 justify-center [&_svg]:size-4.5",
        "icon-lg": "h-12 w-12 p-0 justify-center [&_svg]:size-5",
      },
      shape: {
        rounded: "rounded-xl data-[size=lg]:rounded-2xl data-[size=xl]:rounded-2xl data-[size=xs]:rounded-lg",
        pill: "rounded-full",
        square: "rounded-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      shape: "rounded",
    },
  }
);

export interface AppButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof appButtonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const AppButton = React.forwardRef<HTMLButtonElement, AppButtonProps>(
  (
    {
      className,
      variant,
      size,
      shape,
      asChild = false,
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isIconOnly =
      size === "icon-xs" ||
      size === "icon-sm" ||
      size === "icon" ||
      size === "icon-lg";

    const content = (
      <>
        {isLoading ? (
          <Loader2 className="animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0 items-center">{leftIcon}</span>
        )}
        {isLoading && loadingText ? (
          <span>{loadingText}</span>
        ) : (
          children
        )}
        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0 items-center">{rightIcon}</span>
        )}
      </>
    );

    if (asChild) {
      return (
        <Slot
          className={cn(
            appButtonVariants({ variant, size, shape }),
            isIconOnly ? "" : "",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        data-size={size}
        className={cn(
          appButtonVariants({ variant, size, shape }),
          className
        )}
        {...props}
      >
        {content}
      </button>
    );
  }
);

AppButton.displayName = "AppButton";

export { AppButton, appButtonVariants };
