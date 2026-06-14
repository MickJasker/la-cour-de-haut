import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, RefAttributes } from "react";

const buttonVariants = cva(
  `inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap rounded-lg 
  text-body-large font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 
  focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background 
  disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 
  [&_svg]:shrink-0`,
  {
    variants: {
      variant: {
        primary:
          "bg-brand-forest text-cream-50 hover:bg-olive-600 active:bg-olive-800",
        secondary:
          "bg-brand-sage text-olive-800 hover:bg-sage-300 active:bg-sage-400",
      },
      size: {
        default: "h-9 px-6",
        sm: "h-8 px-4 text-body-medium",
        lg: "h-11 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  RefAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = ({
  className,
  variant,
  size,
  asChild = false,
  ref,
  ...props
}: ButtonProps) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
};

export { Button, buttonVariants };
