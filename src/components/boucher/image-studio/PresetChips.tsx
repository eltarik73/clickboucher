// src/components/boucher/image-studio/PresetChips.tsx — radio-style chip group
"use client";

type Option = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
};

export default function PresetChips({ label, value, options, onChange }: Props) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={[
                "min-h-[44px] px-3.5 rounded-full text-sm font-medium border transition-colors",
                active
                  ? "bg-[#DC2626] border-[#DC2626] text-white"
                  : "bg-gray-100 dark:bg-white/5 border-transparent text-gray-700 dark:text-gray-300 hover:border-[#DC2626] hover:text-[#DC2626]",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
