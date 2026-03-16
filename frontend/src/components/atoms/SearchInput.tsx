import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@heroui/react";

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChange,
    placeholder = "Search...",
    className = "",
}) => {
    return (
        <div className={`relative flex ${className}`}>
            <Input
                classNames={{
                    base: "w-full",
                    innerWrapper: "flex flex-row items-center gap-2",
                    input: "text-xl font-semibold outline-none px-2",
                    inputWrapper:
                        "h-16 bg-white border-2 border-black rounded-none shadow-[6px_6px_0_0_rgba(0,0,0,0.1)] data-[hover=true]:border-black group-data-[focus=true]:border-black",
                }}
                placeholder={placeholder}
                startContent={<Search className="text-black/40 ml-2" size={24} />}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {value && (
                <button
                    onClick={() => onChange("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-black/20 hover:text-black transition-colors"
                >
                    <X size={20} strokeWidth={3} />
                </button>
            )}
        </div>
    );
};

export default SearchInput;
