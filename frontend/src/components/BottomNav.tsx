import React from "react";
import { Search, Map, BarChart3, Library, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface BottomNavItemProps {
    icon: LucideIcon;
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const BottomNavItem: React.FC<BottomNavItemProps> = ({ icon: Icon, label, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all duration-100 border-2 border-transparent ${
                isActive
                    ? "text-white border-t-white/30"
                    : "text-white/50 hover:text-white/80"
            }`}
        >
            <Icon size={20} strokeWidth={2.5} />
            <span className="text-[9px] font-black uppercase tracking-tight">{label}</span>
        </button>
    );
};

interface BottomNavProps {
    activePage: string;
    setActivePage: (page: string) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activePage, setActivePage }) => {
    const menuItems = [
        { id: "home", label: "Search", icon: Search },
        { id: "emptyroomfinder", label: "Rooms", icon: Map },
        { id: "analysis", label: "Analysis", icon: BarChart3 },
        { id: "browse", label: "Browse", icon: Library },
        { id: "about", label: "About", icon: Info },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-retro-secondary border-t-2 border-black z-50 flex md:hidden shadow-[0_-4px_0_0_rgba(0,0,0,0.2)]">
            {menuItems.map((item) => (
                <BottomNavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    isActive={activePage === item.id}
                    onClick={() => setActivePage(item.id)}
                />
            ))}
        </nav>
    );
};

export default BottomNav;
