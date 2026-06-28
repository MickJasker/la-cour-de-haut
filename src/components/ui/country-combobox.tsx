"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { getCountryName, getCountryOptions } from "@/lib/countries";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function CountryCombobox(props: {
  value: string;
  onChange: (code: string) => void;
  onBlur?: () => void;
  locale: string;
  id?: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  "aria-invalid"?: boolean;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const options = React.useMemo(
    () => getCountryOptions(props.locale),
    [props.locale],
  );
  const displayValue = props.value
    ? getCountryName(props.value, props.locale)
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={props.id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={props["aria-invalid"]}
          className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-cream-50 px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        >
          {displayValue ? (
            <span>{displayValue}</span>
          ) : (
            <span className="text-muted-foreground">{props.placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        id={listId}
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command>
          <CommandInput placeholder={props.searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{props.emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.code}
                  value={option.name}
                  onSelect={() => {
                    props.onChange(option.code);
                    setOpen(false);
                    props.onBlur?.();
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      option.code === props.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
