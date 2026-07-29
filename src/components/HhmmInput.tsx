// Campo de tempo em texto livre no formato HH:MM.
//
// O <input type="time"> nativo trava a digitação em celulares e não aceita
// "9h40". Aqui o gestor digita livremente ("940", "9:40", "9h40") e o valor é
// normalizado só quando ele sai do campo — nada é pré-preenchido.
import { forwardRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { minutesToHHMM, parseDurationToMinutes } from "@/lib/date-utils";

type Props = {
  /** Valor controlado em HH:MM (ou string vazia). */
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  id?: string;
  /** Limita a 23:59 (horário de relógio). Falso para durações longas. */
  clock?: boolean;
  disabled?: boolean;
};

export const HhmmInput = forwardRef<HTMLInputElement, Props>(function HhmmInput(
  { value, onChange, placeholder = "HH:MM", className, clock = false, ...rest },
  ref,
) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const min = parseDurationToMinutes(draft);
    if (min === null) {
      onChange("");
      setDraft("");
      return;
    }
    const capped = clock ? Math.min(min, 23 * 60 + 59) : min;
    const next = minutesToHHMM(capped);
    setDraft(next);
    onChange(next);
  };

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={draft}
      onChange={(e) => {
        // Só dígitos e separadores — nunca bloqueia número algum.
        setDraft(e.target.value.replace(/[^\d:h.,]/gi, "").slice(0, 6));
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
      className={cn("font-mono", className)}
      {...rest}
    />
  );
});
