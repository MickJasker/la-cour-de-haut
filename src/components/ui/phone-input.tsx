"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  composePhone,
  detectCountry,
  getDialCodeOptions,
  parsePhone,
} from "@/lib/phone";
import { Input } from "@/components/ui/input";
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

/**
 * Compound phone control: a searchable country-calling-code picker (mirrors
 * `CountryCombobox`) + a local-number input. Emits a normalized E.164 string
 * (e.g. "+33612345678") via `onChange`; see ADR-0013. The correctness-critical
 * normalization lives in `@/lib/phone` so it can be unit-tested.
 */
export function PhoneInput(props: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  locale: string;
  defaultCountry: string;
  id?: string;
  countryLabel: string;
  searchPlaceholder: string;
  emptyText: string;
  numberPlaceholder?: string;
  "aria-invalid"?: boolean;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const options = React.useMemo(
    () => getDialCodeOptions(props.locale),
    [props.locale],
  );

  // Internal display state is the source of truth for what the user sees; the
  // composed E.164 string is pushed up via onChange. We re-hydrate from
  // `props.value` ONLY when it changes from the outside (e.g. a server
  // validation bounce) — tracked via `lastValue` — never on our own emissions,
  // which would otherwise clobber the raw national text (and its trunk 0)
  // mid-typing. This is the "adjust state during render" pattern (no effect).
  const [state, setState] = React.useState(() => {
    const { country, national } = parsePhone(props.value, props.defaultCountry);
    return { country, national, lastValue: props.value };
  });
  if (props.value !== state.lastValue) {
    const { country, national } = parsePhone(props.value, props.defaultCountry);
    setState({ country, national, lastValue: props.value });
  }

  const { country, national } = state;
  const selectedDialCode =
    options.find((option) => option.code === country)?.dialCode ?? "";

  const emit = (nextCountry: string, nextNational: string) => {
    const composed = composePhone(nextCountry, nextNational);
    setState({
      country: nextCountry,
      national: nextNational,
      lastValue: composed,
    });
    props.onChange(composed);
  };

  const handleNationalChange = (raw: string) => {
    // A pasted/typed "+international" number drives the picker and snaps the
    // visible field to its national part once it parses.
    const detected = detectCountry(raw);
    if (detected) {
      const { national: nat } = parsePhone(raw, detected);
      emit(detected, nat || raw);
    } else {
      emit(country, raw);
    }
  };

  const handleSelectCountry = (code: string) => {
    emit(code, national);
    setOpen(false);
    props.onBlur?.();
  };

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-label={props.countryLabel}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            // No aria-invalid here: the country selection is always valid; only
            // the local number can be malformed, so the error sits on the input.
            className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-input bg-cream-50 px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          >
            <span>{selectedDialCode || props.countryLabel}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          id={listId}
          align="start"
          className="w-[min(20rem,calc(100vw-2rem))] p-0"
        >
          <Command>
            <CommandInput placeholder={props.searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{props.emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.code}
                    // Include the dial code in the searchable value so typing
                    // "+31" or "31" filters as well as the country name.
                    value={`${option.name} ${option.dialCode}`}
                    onSelect={() => handleSelectCountry(option.code)}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        option.code === country ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex-1">{option.name}</span>
                    <span className="text-muted-foreground">
                      {option.dialCode}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        id={props.id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        className="flex-1"
        value={national}
        placeholder={props.numberPlaceholder}
        aria-invalid={props["aria-invalid"]}
        onChange={(event) => handleNationalChange(event.target.value)}
        onBlur={props.onBlur}
      />
    </div>
  );
}
