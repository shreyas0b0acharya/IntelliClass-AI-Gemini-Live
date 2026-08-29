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
    <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-md border border-gray-200/50">
      <label htmlFor={name} className="text-sm font-medium text-gray-700">
        {name}
      </label>

      <select
        id={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white text-gray-900 text-sm font-medium rounded-md px-2.5 py-1 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
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
