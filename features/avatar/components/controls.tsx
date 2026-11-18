"use client";

interface ControllerProps {
  name: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export function Controller({
  name,
  options,
  value,
  onChange,
}: ControllerProps) {
  return (
    <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-md border border-border/50">
      <label htmlFor={name} className="text-sm font-medium text-muted-foreground">
        {name}
      </label>

      <select
        id={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white text-foreground text-sm font-medium rounded-md px-2.5 py-1 border border-border focus:outline-none focus:ring-2 focus:ring-ring shadow-sm cursor-pointer"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export default Controller;
